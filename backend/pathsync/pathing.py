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

from .config import PATH_TOP_K, READINESS_THRESHOLD, tr
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
        tr("PathSync order", "Urutan PathSync"): order,
        tr("Biggest gap first", "Gap terbesar dulu"): sorted(order, key=lambda s: -(cand[s].G if s in cand else 0.0)),
        tr("Most in-demand first", "Paling dicari dulu"): sorted(order, key=lambda s: -(cand[s].D if s in cand else 0.0)),
    }
    for c, _ in ranked[1:PATH_TOP_K]:
        if c.skill_id in order and c.blocked_by:
            alts[tr(f"{names[c.skill_id]} first", f"{names[c.skill_id]} dulu")] = [c.skill_id] + [s for s in order if s != c.skill_id]
    rows = []
    for label, o in alts.items():
        b = blocked_steps(o, graph, p)
        rows.append({"label": label, "order": o, "blocked": len(b),
                     "blocked_detail": [{"skill_id": s, "waiting_for": m} for s, m in b]})
    notes = []
    for r in rows[1:]:
        for d in r["blocked_detail"][:1]:
            waiting = ", ".join(names[m] for m in d["waiting_for"])
            notes.append(tr(f"With \"{r['label'].lower()}\", you would get stuck on {names[d['skill_id']]} because "
                            f"{waiting} is not mastered yet.",
                            f"Dengan \"{r['label'].lower()}\", kamu akan macet di {names[d['skill_id']]} karena "
                            f"{waiting} belum dikuasai."))
    best = min(rows, key=lambda r: r["blocked"])
    return {"alternatives": rows, "notes": notes[:3], "recommended_blocked": rows[0]["blocked"],
            "recommended_is_minimal": rows[0]["blocked"] == best["blocked"]}


# (English, Indonesian)
LEVEL_TEXT = {"awal": ("beginner", "pemula"), "dasar": ("basic", "dasar"), "mandiri": ("proficient", "mandiri"),
              "mahir": ("advanced", "mahir")}


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

    def lv(x: float) -> str:
        return tr(*LEVEL_TEXT[level_label(x)])
    what = tr(f"Focus on {sk.learn_what}. You are at {lv(p)} level ({p:.2f}); the role expects {lv(r)} ({r:.2f}).",
              f"Fokus pada {sk.learn_what}. Kamu di level {lv(p)} ({p:.2f}); role ini butuh {lv(r)} ({r:.2f}).")
    why_parts = []
    if md and ctx["market"].n_postings:
        n = ctx["market"].n_postings
        why_parts.append(tr(f"Asked for in {md.count} of {n} {role_name} job postings ({md.share:.0%}).",
                            f"Diminta di {md.count} dari {n} job posting {role_name} ({md.share:.0%})."))
        if ctx["market"].trend_status == "ok" and abs(md.trend) >= 0.05:
            up = md.trend > 0
            why_parts.append(tr(f"Demand is {'rising' if up else 'falling'} {abs(md.trend):.0%} over the last 6 months.",
                                f"Demand {'naik' if up else 'turun'} {abs(md.trend):.0%} dalam 6 bulan terakhir."))
    esco = ctx["esco"].get(c.skill_id)
    if esco:
        ess = esco == "essential"
        why_parts.append(tr(f"Listed as {'essential' if ess else 'optional'} for this occupation in ESCO.",
                            f"Tercatat sebagai skill {'essential' if ess else 'optional'} untuk okupasi ini di ESCO."))
    quotes = ctx["quotes"].get(c.skill_id, [])[:2]

    if c.blocked_by:
        pre = ", ".join(names[q] for q in c.blocked_by)
        now = tr(f"Not ready yet: {pre} must reach 0.6 first, so your path covers {'it' if len(c.blocked_by) == 1 else 'them'} before this.",
                 f"Belum siap: {pre} harus mencapai 0.6 dulu, jadi path-mu membahasnya sebelum skill ini.")
    else:
        now = tr("You already have the prerequisites, so you can start now.", "Prasyaratnya sudah kamu punya, jadi kamu bisa mulai sekarang.")
    if c.unlocks:
        k = len(c.unlocks)
        listed = ", ".join(names[t] for t in c.unlocks[:4])
        now += tr(f" It unlocks {k} other skill{'s' if k > 1 else ''} you still need: {listed}{'' if k <= 4 else ', and more'}.",
                  f" Skill ini membuka {k} skill lain yang masih kamu butuhkan: {listed}{'' if k <= 4 else ', dan lainnya'}.")
    bottleneck = len(c.unlocks) >= 2 and not c.blocked_by

    nxt = ctx["next_step"].get(c.skill_id)
    if nxt:
        nxt_txt = tr(f"{names[nxt]}, once your {names[c.skill_id]} evidence reaches 0.6.",
                     f"{names[nxt]}, setelah evidence {names[c.skill_id]}-mu mencapai 0.6.")
    elif c.unlocks:
        nxt_txt = tr(f"{names[c.unlocks[0]]}, which builds on this skill.", f"{names[c.unlocks[0]]}, yang dibangun di atas skill ini.")
    else:
        nxt_txt = tr("Add new evidence (a re-check or a project) to refresh your path.",
                     "Tambahkan evidence baru (check ulang atau project) untuk memperbarui path-mu.")
    why = " ".join(why_parts) or tr("Required by your target role.", "Dibutuhkan oleh target role-mu.")
    return {"what": what, "why": why, "why_now": now, "next": nxt_txt,
            "quotes": quotes, "bottleneck": bottleneck, "contributions": contrib, "rank": rank}
