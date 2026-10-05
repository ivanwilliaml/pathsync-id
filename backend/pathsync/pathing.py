"""Learning path, explanations, counterfactual comparison and coverage (paper III.A.5, eq. 6).

* Path: the three top-ranked skills plus their prerequisites that are not yet mastered,
  ordered topologically on the prerequisite graph (ties broken by model score).
* Explanation: every step answers what to learn, why (data), why now, and what next;
  the ranking comes from the model, the reasons from the graph and feature contributions.
* Counterfactual: for alternative orders the system counts steps that would be blocked
  by unmastered prerequisites; the recommended order minimises that count.
* Coverage = sum_s D_s min(p_s, r_s) / sum_s D_s r_s      (eq. 6)
"""
from __future__ import annotations

from dataclasses import dataclass

from .config import PATH_TOP_K, READINESS_THRESHOLD
from .ranker import Candidate
from .taxonomy import SkillGraph


def coverage(p: dict[str, float], req: dict[str, float], demand: dict[str, float]) -> float:
    num = sum(demand.get(s, 0.0) * min(p.get(s, 0.0), r) for s, r in req.items())
    den = sum(demand.get(s, 0.0) * r for s, r in req.items())
    return num / den if den else 0.0


@dataclass
class PathStep:
    skill_id: str
    role_in_path: str          # prioritas | prasyarat
    rank: int | None


def build_path(graph: SkillGraph, ranked: list[tuple[Candidate, float]], p: dict[str, float],
               top_k: int = PATH_TOP_K) -> list[PathStep]:
    top = [c.skill_id for c, _ in ranked[:top_k]]
    rank_of = {c.skill_id: i + 1 for i, (c, _) in enumerate(ranked)}
    score = {c.skill_id: sc for c, sc in ranked}
    needed = set(top)
    for s in top:
        for a in graph.ancestors(s):
            if p.get(a, 0.0) < READINESS_THRESHOLD:
                needed.add(a)
    order = [s for s in graph.topological_order(priority={s: score.get(s, -50.0) for s in needed}) if s in needed]
    return [PathStep(s, "prioritas" if s in top else "prasyarat", rank_of.get(s)) for s in order]


def blocked_steps(order: list[str], graph: SkillGraph, p: dict[str, float]) -> list[tuple[str, list[str]]]:
    """Steps whose prerequisites are neither mastered nor learned earlier in `order`."""
    learned: set[str] = set()
    out = []
    for s in order:
        missing = [q for q in graph.prereqs.get(s, []) if p.get(q, 0.0) < READINESS_THRESHOLD and q not in learned]
        if missing:
            out.append((s, missing))
        learned.add(s)
    return out


def counterfactuals(path: list[PathStep], ranked: list[tuple[Candidate, float]], graph: SkillGraph,
                    p: dict[str, float], names: dict[str, str]) -> dict:
    order = [st.skill_id for st in path]
    cand = {c.skill_id: c for c, _ in ranked}
    alts = {
        "PathSync (urutan topologis + skor model)": order,
        "Kesenjangan terbesar lebih dulu": sorted(order, key=lambda s: -(cand[s].G if s in cand else 0.0)),
        "Permintaan pasar tertinggi lebih dulu": sorted(order, key=lambda s: -(cand[s].D if s in cand else 0.0)),
    }
    for c, _ in ranked[1:PATH_TOP_K]:
        if c.skill_id in order and c.blocked_by:
            alts[f"{names[c.skill_id]} didahulukan"] = [c.skill_id] + [s for s in order if s != c.skill_id]
    rows = []
    for label, o in alts.items():
        b = blocked_steps(o, graph, p)
        rows.append({"label": label, "order": o, "blocked": len(b),
                     "blocked_detail": [{"skill_id": s, "waiting_for": m} for s, m in b]})
    notes = []
    for r in rows[1:]:
        for d in r["blocked_detail"][:1]:
            notes.append(f"Bila urutan \"{r['label'].lower()}\" dipakai, {names[d['skill_id']]} tertahan karena "
                         f"{', '.join(names[m] for m in d['waiting_for'])} belum dikuasai.")
    best = min(rows, key=lambda r: r["blocked"])
    return {"alternatives": rows, "notes": notes[:3], "recommended_blocked": rows[0]["blocked"],
            "recommended_is_minimal": rows[0]["blocked"] == best["blocked"]}


def level_label(x: float) -> str:
    if x >= 0.8:
        return "mahir"
    if x >= 0.6:
        return "mandiri"
    if x >= 0.35:
        return "dasar"
    return "awal"


def explain(c: Candidate, rank: int, contrib: dict[str, float], ctx: dict) -> dict:
    """Four questions per recommendation: what, why (data), why now, what next."""
    sk, names = ctx["skills"][c.skill_id], ctx["names"]
    md = ctx["market"].skills.get(c.skill_id)
    role_name = ctx["role_name"]
    p, r = ctx["p"].get(c.skill_id, 0.0), ctx["req"].get(c.skill_id, 0.0)

    what = f"{sk.learn_what}. Target tingkat {r:.2f} ({level_label(r)}), posisi saat ini {p:.2f} ({level_label(p)})."
    why_parts = []
    if md and ctx["market"].n_postings:
        why_parts.append(f"Muncul di {md.count} dari {ctx['market'].n_postings} lowongan {role_name} "
                         f"({md.share:.0%}; tertimbang kebaruan {md.demand:.0%}).")
        if ctx["market"].trend_status == "ok" and abs(md.trend) >= 0.05:
            why_parts.append(f"Tren 6 bulan terakhir {'naik' if md.trend > 0 else 'turun'} {abs(md.trend):.0%}.")
    esco = ctx["esco"].get(c.skill_id)
    if esco:
        why_parts.append(f"Berstatus {'esensial' if esco == 'essential' else 'opsional'} untuk okupasi ini di ESCO.")
    quotes = ctx["quotes"].get(c.skill_id, [])[:2]

    if c.blocked_by:
        now = (f"Belum siap dipelajari langsung: prasyarat {', '.join(names[q] for q in c.blocked_by)} belum mencapai 0,6, "
               f"jadi jalur mendahulukannya.")
    else:
        now = "Seluruh prasyaratnya sudah terpenuhi, jadi bisa dipelajari sekarang."
    if c.unlocks:
        k = len(c.unlocks)
        now += (f" Menguasainya membuka {k} keterampilan lain yang masih kurang: "
                f"{', '.join(names[t] for t in c.unlocks[:4])}{'' if k <= 4 else ', dan lainnya'}.")
    bottleneck = len(c.unlocks) >= 2 and not c.blocked_by

    nxt = ctx["next_step"].get(c.skill_id)
    if nxt:
        nxt_txt = f"{names[nxt]}, setelah bukti {names[c.skill_id]} mencapai 0,6."
    elif c.unlocks:
        nxt_txt = f"{names[c.unlocks[0]]}, yang bergantung pada keterampilan ini."
    else:
        nxt_txt = "Unggah bukti (asesmen ulang atau proyek) agar jalur diperbarui."
    return {"what": what, "why": " ".join(why_parts) or "Dibutuhkan peran target.", "why_now": now, "next": nxt_txt,
            "quotes": quotes, "bottleneck": bottleneck, "contributions": contrib, "rank": rank}
