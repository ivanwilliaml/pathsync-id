"""Career Map (docs/CAREER_VIZ_DISCOVERY.md): every role at once, from the same evidence and formula as the target role.

- `career_graph`: roles as nodes, linked when their posting-backed requirements overlap (Jaccard). Market data only.
- `careers_for`: one student's readiness for every role, using coverage (eq. 6), the same number the dashboard shows
  for the target role. Mastery does not depend on the role, so the student is diagnosed once and scored 14 times.
Nothing here is a hiring probability; readiness = demand-weighted share of what postings ask for that the student can show.
"""
from __future__ import annotations

from itertools import combinations

from sqlalchemy.orm import Session

from .config import ROLES
from .db import Student
from .engine import load_context, responses, student_states
from .pathing import coverage, level_label
from .roles import FAMILIES
from .taxonomy import cluster_names

LIMITED_DATA_POSTINGS = 30      # same threshold as the "Beta" label on the landing page (api/routers/public.py)
REQUIRED_FLOOR = 0.35           # a skill counts as "required" by a role from Basic level up
EDGE_MIN_OVERLAP = 0.25         # weaker links are noise on a 14-role map (15 of 91 pairs pass, Oct 2026)


def _role_requirements(ctx) -> dict[str, float]:
    """Skills the role's postings actually ask for (demand > 0) with their required level."""
    return {k: v for k, v in ctx.req.items() if ctx.market.D(k) > 0}


def career_graph(s: Session) -> dict:
    reqs, nodes = {}, []
    for role, cfg in ROLES.items():
        ctx = load_context(s, role)
        req = _role_requirements(ctx)
        reqs[role] = {k for k, v in req.items() if v >= REQUIRED_FLOOR}
        n = ctx.market.n_postings
        nodes.append({"id": role, "name": cfg["name"], "family": cfg["family"], "n_postings": n,
                      "limited_data": n < LIMITED_DATA_POSTINGS, "n_skills": len(reqs[role])})
    edges = []
    for a, b in combinations(sorted(reqs), 2):
        union = reqs[a] | reqs[b]
        if not union:
            continue
        overlap = len(reqs[a] & reqs[b]) / len(union)
        if overlap >= EDGE_MIN_OVERLAP:
            edges.append({"a": a, "b": b, "overlap": round(overlap, 3), "shared": len(reqs[a] & reqs[b])})
    return {"nodes": nodes, "edges": edges, "families": FAMILIES, "min_overlap": EDGE_MIN_OVERLAP}


def careers_for(s: Session, student: Student) -> dict:
    resp = responses(s, student.id)
    states = None
    out = []
    for role, cfg in ROLES.items():
        ctx = load_context(s, role)
        if states is None:      # mastery is role-independent: diagnose once
            states = student_states(s, student, ctx, resp)
        p = {k: st.p for k, st in states.items()}
        demand = {k: ctx.market.D(k) for k in ctx.skills}
        req = _role_requirements(ctx)
        measured = [k for k in req if k in states and states[k].has_evidence]
        clusters = []
        for cl, label in cluster_names().items():
            ids = [k for k in req if ctx.skills[k].cluster == cl]
            if not ids:
                continue
            clusters.append({"id": cl, "label": label, "n_skills": len(ids),
                             "coverage": round(coverage(p, {k: req[k] for k in ids}, demand), 4),
                             "measured": sum(1 for k in ids if k in measured)})
        clusters.sort(key=lambda c: -c["n_skills"])
        top_gaps = sorted(((k, demand[k] * max(0.0, req[k] - p.get(k, 0.0))) for k in req), key=lambda x: -x[1])[:3]
        n = ctx.market.n_postings
        out.append({
            "id": role, "name": cfg["name"], "family": cfg["family"], "is_target": role == student.target_role,
            "readiness": round(coverage(p, req, demand), 4), "n_skills": len(req), "n_measured": len(measured),
            "n_postings": n, "limited_data": n < LIMITED_DATA_POSTINGS, "clusters": clusters,
            "top_gaps": [{"skill_id": k, "name": ctx.names[k], "level_now": level_label(p.get(k, 0.0)),
                          "level_needed": level_label(req[k])} for k, gap in top_gaps if gap > 0],
            # skills the role's postings ask for from Basic up: what two careers have in common (compare view)
            "skills": sorted(({"skill_id": k, "name": ctx.names[k]} for k, v in req.items() if v >= REQUIRED_FLOOR),
                             key=lambda x: x["name"]),
        })
    out.sort(key=lambda r: -r["readiness"])
    return {"careers": out, "any_evidence": any(st.has_evidence for st in (states or {}).values())}


def career_readiness(s: Session, student: Student) -> dict[str, float]:
    """{role: readiness} for the history log (Path History shows which other careers moved)."""
    return {c["id"]: c["readiness"] for c in careers_for(s, student)["careers"]}
