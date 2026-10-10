"""Taxonomy governance: is the Business Analyst skill list final? (answers the judges' note)

"Final" is defined by three measurable exit criteria, checked on the live data:

  C1 coverage  - at least 95% of skill mentions extracted from target-role postings map to a taxonomy
                 skill (automatically or after review); the rest are "new-skill candidates".
  C2 no gap    - no new-skill candidate cluster appears in 10% or more of target-role postings.
  C3 grounding - every skill is grounded for at least one supported role: an ESCO essential/optional
                 skill of that occupation, or in >= 10% of its postings, or added from extraction evidence.
                 Skills grounded for the target role form its *core* list; skills grounded only for an
                 adjacent role (e.g. Power BI for Data Analyst) are reported as *adjacent*.

The taxonomy file is frozen by its SHA-256; any edit changes the hash and the version, and the report
lists the changelog so results stay comparable across versions (paper III.A.1).
"""
from __future__ import annotations

import hashlib
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import ROLES, SEED_DIR
from .db import Posting, PostingMention, active_snapshot
from .market import esco_status
from .taxonomy import load_skills, load_taxonomy

COVERAGE_TARGET = 0.95
CANDIDATE_MAX_SHARE = 0.10
GROUNDING_MIN_SHARE = 0.10
CHANGELOG = [
    {"version": "2026.10-v1", "date": "2026-10-01", "change": "41 skills in 4 clusters from ESCO business analyst, "
     "ICT business analyst and data analyst profiles plus frequent extraction terms."},
    {"version": "2026.10-v2", "date": "2026-10-01", "change": "Added 'API & system integration': most frequent "
     "new-skill candidate cluster (REST API, JSON, Swagger, system integration) in IT BA postings."},
]


def taxonomy_hash() -> str:
    return hashlib.sha256((SEED_DIR / "taxonomy.json").read_bytes()).hexdigest()


def _cluster_candidates(surfaces: list[tuple[str, str]]) -> list[dict]:
    """Group new-skill candidate phrases by embedding similarity (greedy, threshold 0.75)."""
    if not surfaces:
        return []
    from .embeddings import encode

    texts = [s for s, _ in surfaces]
    vecs = encode(texts)
    clusters: list[dict] = []
    for i, (txt, pid) in enumerate(surfaces):
        for c in clusters:
            if float(vecs[i] @ c["centroid"]) >= 0.75:
                c["members"].add(txt.lower())
                c["postings"].add(pid)
                break
        else:
            clusters.append({"centroid": vecs[i], "label": txt, "members": {txt.lower()}, "postings": {pid}})
    return clusters


def report(s: Session, role: str = "business_analyst") -> dict:
    skills = load_skills()
    tax = load_taxonomy()
    posts = s.scalars(select(Posting).where(Posting.role == role, Posting.duplicate_of.is_(None), Posting.in_window.is_(True))).all()
    n_posts = len(posts)
    pids = {p.id for p in posts}
    mentions = s.execute(select(PostingMention.posting_id, PostingMention.skill_id, PostingMention.status,
                                PostingMention.surface).where(PostingMention.posting_id.in_(pids))).all()
    counted = [m for m in mentions if m.status in ("auto", "review", "new")]
    covered = [m for m in counted if m.status in ("auto", "review") and m.skill_id]
    coverage = len(covered) / len(counted) if counted else 0.0

    clusters = _cluster_candidates([(m.surface, m.posting_id) for m in counted if m.status == "new"])
    cands = sorted(({"label": c["label"], "examples": sorted(c["members"])[:6], "postings": len(c["postings"]),
                     "share": round(len(c["postings"]) / max(1, n_posts), 3)} for c in clusters),
                   key=lambda c: -c["postings"])
    worst = cands[0]["share"] if cands else 0.0

    seed = {sk["id"]: sk for sk in tax["skills"]}

    def grounds_for(r: str) -> dict[str, list[str]]:
        snap = active_snapshot(s, r)
        share = {k: v["share"] for k, v in snap.data["skills"].items()} if snap else {}
        esco = esco_status().get(r, {})
        out = {}
        for sid in skills:
            g = []
            if esco.get(sid):
                g.append(f"ESCO {esco[sid]}")
            if share.get(sid, 0) >= GROUNDING_MIN_SHARE:
                g.append(f"in {share[sid]:.0%} of postings")
            if seed[sid].get("added_from_extraction"):
                g.append("added from extraction evidence")
            out[sid] = g
        return out

    role_grounds = {r: grounds_for(r) for r in ROLES}
    snap = active_snapshot(s, role)
    share = {k: v["share"] for k, v in snap.data["skills"].items()} if snap else {}
    per_skill, ungrounded = [], []
    for sid, sk in skills.items():
        mine = role_grounds[role][sid]
        other = {r: g for r, g in role_grounds.items() if r != role and g}
        status = "core" if mine else ("adjacent" if other else "ungrounded")
        if status == "ungrounded":
            ungrounded.append(sid)
        per_skill.append({"skill_id": sid, "name": sk.name, "cluster": sk.cluster, "status": status,
                          "posting_share": round(share.get(sid, 0.0), 3), "grounds": mine,
                          "core_for": [ROLES[r]["name"] for r, g in role_grounds.items() if g]})
    per_skill.sort(key=lambda r: (r["status"] != "core", -r["posting_share"]))
    core = [r["skill_id"] for r in per_skill if r["status"] == "core"]
    criteria = {
        "C1_coverage": {"value": round(coverage, 4), "target": COVERAGE_TARGET, "pass": coverage >= COVERAGE_TARGET},
        "C2_no_frequent_candidate": {"value": worst, "target": f"< {CANDIDATE_MAX_SHARE}", "pass": worst < CANDIDATE_MAX_SHARE},
        "C3_grounding": {"value": f"{len(skills) - len(ungrounded)}/{len(skills)} grounded in at least one role",
                         "ungrounded": ungrounded, "pass": not ungrounded},
    }
    by_cluster = defaultdict(int)
    for sk in skills.values():
        by_cluster[sk.cluster] += 1
    return {"role": role, "role_name": ROLES[role]["name"], "version": tax["version"], "sha256": taxonomy_hash(),
            "frozen_at": tax.get("frozen_at"), "n_skills": len(skills), "by_cluster": dict(by_cluster),
            "n_postings": n_posts, "n_mentions": len(counted), "criteria": criteria,
            "core_skills": core, "n_core": len(core),
            "adjacent_skills": [r["skill_id"] for r in per_skill if r["status"] == "adjacent"],
            "final": all(c["pass"] for c in criteria.values()),
            "new_skill_candidates": cands[:15], "skills": per_skill, "changelog": CHANGELOG}
