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
from .i18n import t
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
        "PathSync order": order,
        "Biggest gap first": sorted(order, key=lambda s: -(cand[s].G if s in cand else 0.0)),
        "Most in-demand first": sorted(order, key=lambda s: -(cand[s].D if s in cand else 0.0)),
    }
    for c, _ in ranked[1:PATH_TOP_K]:
        if c.skill_id in order and c.blocked_by:
            alts[f"{names[c.skill_id]} first"] = [c.skill_id] + [s for s in order if s != c.skill_id]
    rows = []
    for label, o in alts.items():
        b = blocked_steps(o, graph, p)
        rows.append({"label": label, "order": o, "blocked": len(b),
                     "blocked_detail": [{"skill_id": s, "waiting_for": m} for s, m in b]})
    notes = []
    for r in rows[1:]:
        for d in r["blocked_detail"][:1]:
            notes.append(f"With \"{r['label'].lower()}\", you would get stuck on {names[d['skill_id']]} because "
                         f"{', '.join(names[m] for m in d['waiting_for'])} is not mastered yet.")
    best = min(rows, key=lambda r: r["blocked"])
    return {"alternatives": rows, "notes": notes[:3], "recommended_blocked": rows[0]["blocked"],
            "recommended_is_minimal": rows[0]["blocked"] == best["blocked"]}


def level_text(level: str) -> str:
    return t(f"level.{level}")


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

    what = t("explain.what", learn=sk.learn_what, now=level_text(level_label(p)), p=p, need=level_text(level_label(r)), r=r)
    why_parts = []
    if md and ctx["market"].n_postings:
        why_parts.append(t("explain.why.postings", count=md.count, n=ctx["market"].n_postings, role=role_name, share=md.share))
        if ctx["market"].trend_status == "ok" and abs(md.trend) >= 0.05:
            why_parts.append(t("explain.why.trend_up" if md.trend > 0 else "explain.why.trend_down", pct=abs(md.trend)))
    esco = ctx["esco"].get(c.skill_id)
    if esco:
        why_parts.append(t("explain.why.esco_essential" if esco == "essential" else "explain.why.esco_optional"))
    quotes = ctx["quotes"].get(c.skill_id, [])[:2]

    if c.blocked_by:
        now = t("explain.now.blocked_one" if len(c.blocked_by) == 1 else "explain.now.blocked_many",
                names=", ".join(names[q] for q in c.blocked_by))
    else:
        now = t("explain.now.ready")
    if c.unlocks:
        k = len(c.unlocks)
        shown = ", ".join(names[x] for x in c.unlocks[:4])
        now += (t("explain.now.unlocks_one", names=shown) if k == 1 else
                t("explain.now.unlocks_many", k=k, names=shown, more="" if k <= 4 else t("explain.and_more")))
    bottleneck = len(c.unlocks) >= 2 and not c.blocked_by

    nxt = ctx["next_step"].get(c.skill_id)
    if nxt:
        nxt_txt = t("explain.next.after", nxt=names[nxt], cur=names[c.skill_id])
    elif c.unlocks:
        nxt_txt = t("explain.next.builds", nxt=names[c.unlocks[0]])
    else:
        nxt_txt = t("explain.next.refresh")
    return {"what": what, "why": " ".join(why_parts) or t("explain.why.default"), "why_now": now, "next": nxt_txt,
            "quotes": quotes, "bottleneck": bottleneck, "contributions": contrib, "rank": rank}
