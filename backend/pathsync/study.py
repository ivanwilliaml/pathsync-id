"""Controlled user study (answers the judges' note that the comparison group was too simple).

Four arms instead of "PathSync vs a skill list", so each component's contribution is measured:

  A  posting_list   - target role + skill list from postings, student plans alone (the paper's control)
  B  generic_plan   - a general AI-style plan: skills ordered by market demand with generic advice,
                      no evidence diagnosis, no prerequisite graph (active control; mirrors "ask a chatbot")
  C  pathsync_static- PathSync diagnosis + graph-aware ranking, but the path never updates (no adaptivity)
  D  pathsync_full  - everything, including the adaptive cycle

Assignment uses stratified minimisation (by study programme) so arms stay balanced in small samples.
Outcomes are logged in-product: direction-clarity pulse (H1), plan quality rated blind by experts (H2),
minutes to finish the plan (H3), rank changes after new evidence (H4). Analysis: Kruskal-Wallis across
arms, then Mann-Whitney U pairs with Holm correction (pre-registered).
"""
from __future__ import annotations

import random
import secrets
from itertools import combinations

from scipy.stats import kruskal, mannwhitneyu

DEFAULT_ARMS = [
    {"id": "A", "key": "posting_list", "label": "Skill list from postings",
     "features": {"evidence": False, "graph": False, "adaptive": False, "explanations": False, "path": False}},
    {"id": "B", "key": "generic_plan", "label": "Generic AI-style plan",
     "features": {"evidence": False, "graph": False, "adaptive": False, "explanations": False, "path": True}},
    {"id": "C", "key": "pathsync_static", "label": "PathSync without adaptivity",
     "features": {"evidence": True, "graph": True, "adaptive": False, "explanations": True, "path": True}},
    {"id": "D", "key": "pathsync_full", "label": "PathSync (full)",
     "features": {"evidence": True, "graph": True, "adaptive": True, "explanations": True, "path": True}},
]


def join_code() -> str:
    return secrets.token_hex(3).upper()


def assign_arm(arms: list[dict], counts_in_stratum: dict[str, int], rng: random.Random | None = None) -> str:
    """Minimisation: pick the arm with the fewest participants in this stratum (ties broken at random)."""
    rng = rng or random.Random()
    low = min(counts_in_stratum.get(a["id"], 0) for a in arms)
    return rng.choice([a["id"] for a in arms if counts_in_stratum.get(a["id"], 0) == low])


def arm_features(arms: list[dict], arm_id: str | None) -> dict | None:
    for a in arms:
        if a["id"] == arm_id:
            return a["features"]
    return None


def holm(pvals: dict[str, float]) -> dict[str, float]:
    order = sorted(pvals.items(), key=lambda kv: kv[1])
    m, adj, running = len(order), {}, 0.0
    for i, (k, p) in enumerate(order):
        running = max(running, min(1.0, (m - i) * p))
        adj[k] = round(running, 4)
    return adj


def analyse(outcome_by_arm: dict[str, list[float]]) -> dict:
    """Kruskal-Wallis + Holm-corrected pairwise Mann-Whitney U (two-sided)."""
    groups = {a: v for a, v in outcome_by_arm.items() if len(v) >= 2}
    res = {"n": {a: len(v) for a, v in outcome_by_arm.items()},
           "median": {a: (sorted(v)[len(v) // 2] if v else None) for a, v in outcome_by_arm.items()}}
    if len(groups) < 2:
        res["note"] = "Need at least two arms with 2+ participants."
        return res
    h, p = kruskal(*groups.values())
    res["kruskal_wallis"] = {"H": round(float(h), 4), "p": round(float(p), 4)}
    raw = {}
    effect = {}
    for a, b in combinations(sorted(groups), 2):
        u, pv = mannwhitneyu(groups[a], groups[b], alternative="two-sided")
        raw[f"{a}-{b}"] = float(pv)
        # rank-biserial correlation as effect size
        effect[f"{a}-{b}"] = round(1 - 2 * float(u) / (len(groups[a]) * len(groups[b])), 3)
    res["pairwise_p_holm"] = holm(raw)
    res["rank_biserial"] = effect
    return res
