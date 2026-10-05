"""Expert-ranking scenarios (paper III.A.4).

~15 base scenarios built from fictional student profiles ("profil rekaan"), each with
the student's competency state, the market state and eight candidate skills, plus two
derivatives: one with changed competency and one with changed market demand -> ~45
scenarios. Experts rank the candidates without seeing system output; the base scenario
is ranked side by side with its derivatives.

Until real expert rankings are collected, `simulate_expert` provides the paper's
feasibility check: simulated experts with three possible judging styles.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass

import numpy as np

from .demand import MarketMap
from .ranker import build_candidates
from .taxonomy import SkillGraph

ARCHETYPES = [
    ("Mahasiswa Manajemen semester 5", {"business_process": 0.45, "data_analytics": 0.25, "tools": 0.30, "communication": 0.55}),
    ("Mahasiswa Sistem Informasi semester 7", {"business_process": 0.50, "data_analytics": 0.40, "tools": 0.45, "communication": 0.50}),
    ("Mahasiswa Akuntansi semester 6", {"business_process": 0.35, "data_analytics": 0.40, "tools": 0.40, "communication": 0.50}),
    ("Mahasiswa Teknik Informatika semester 7", {"business_process": 0.30, "data_analytics": 0.50, "tools": 0.55, "communication": 0.40}),
    ("Lulusan bootcamp analitik data", {"business_process": 0.30, "data_analytics": 0.60, "tools": 0.55, "communication": 0.45}),
]
SKILL_BIAS = {   # archetype-specific nudges so profiles are not cluster-uniform
    0: {"strategic_analysis": 0.2, "financial_analysis": 0.15, "sql": -0.15, "presentation_storytelling": 0.15},
    1: {"system_modeling_uml": 0.2, "requirements_documentation": 0.1, "sdlc": 0.2, "sql": 0.1},
    2: {"financial_analysis": 0.35, "excel": 0.25, "risk_management": 0.2, "business_case": 0.1},
    3: {"sql": 0.2, "python_analytics": 0.3, "api_integration": 0.25, "stakeholder_management": -0.15},
    4: {"sql": 0.25, "data_visualization": 0.2, "python_analytics": 0.2, "requirements_elicitation": -0.2},
}


@dataclass
class ScenarioState:
    p: dict[str, float]
    K: dict[str, float]
    D: dict[str, float]
    T: dict[str, float]


def make_profile(idx: int, graph: SkillGraph, rng: random.Random) -> tuple[str, dict[str, float], dict[str, float]]:
    label, base = ARCHETYPES[idx % len(ARCHETYPES)]
    bias = SKILL_BIAS[idx % len(ARCHETYPES)]
    p, K = {}, {}
    for s, sk in graph.skills.items():
        v = base[sk.cluster] + bias.get(s, 0.0) + rng.gauss(0, 0.15)
        p[s] = round(min(0.95, max(0.03, v)), 2)
        K[s] = round(min(0.95, max(0.05, rng.uniform(0.15, 0.85))), 2)
    return label, p, K


def _features(graph, st: ScenarioState, req, cands):
    cs = build_candidates(graph, st.p, req, st.D, st.T, st.K, cands)
    return {c.skill_id: c for c in cs}


def choose_candidates(graph: SkillGraph, st: ScenarioState, req: dict[str, float], rng: random.Random, n: int = 8) -> list[str]:
    allc = build_candidates(graph, st.p, req, st.D, st.T, st.K, [s for s in graph.skills if st.D.get(s, 0) >= 0.05])
    allc = [c for c in allc if c.G >= 0.05]
    by_gd = sorted(allc, key=lambda c: -(c.G * c.D))
    by_u = sorted(allc, key=lambda c: -c.U)
    picked: list[str] = []
    for c in by_gd[:3] + by_u[:3]:
        if c.skill_id not in picked:
            picked.append(c.skill_id)
    rest = [c.skill_id for c in allc if c.skill_id not in picked]
    rng.shuffle(rest)
    picked += rest[: max(0, n - len(picked))]
    return picked[:n]


def build_scenarios(graph: SkillGraph, market: MarketMap, req: dict[str, float], n_base: int = 15, seed: int = 7) -> list[dict]:
    rng = random.Random(seed)
    D = {s: market.D(s) for s in graph.skills}
    T = {s: market.T(s) for s in graph.skills}
    out = []
    for b in range(n_base):
        label, p, K = make_profile(b, graph, rng)
        base = ScenarioState(p, K, D, T)
        cands = choose_candidates(graph, base, req, rng)
        if len(cands) < 6:
            continue
        feats = _features(graph, base, req, cands)
        bid = f"S{b + 1:02d}"
        out.append(_pack(f"{bid}-base", bid, "base", f"{label}", base, req, feats, cands, graph))
        # derivative 1: the most "unlocking" candidate is learned (e.g. SQL 0.35 -> 0.72 in Table 4)
        bott = max(cands, key=lambda s: (feats[s].U, feats[s].G))
        p2 = dict(p)
        p2[bott] = round(max(p[bott], req.get(bott, 0.7) - 0.08), 2)
        st2 = ScenarioState(p2, K, D, T)
        feats2 = _features(graph, st2, req, cands)
        c2 = [c for c in cands if c in feats2]
        out.append(_pack(f"{bid}-comp", bid, "competency",
                         f"{label} - setelah belajar {graph.skills[bott].name} ({p[bott]:.2f} -> {p2[bott]:.2f})",
                         st2, req, feats2, c2, graph, changed={"skill_id": bott, "p_from": p[bott], "p_to": p2[bott]}))
        # derivative 2: market demand for a lower-ranked candidate rises
        ordered = sorted(cands, key=lambda s: -(feats[s].G * feats[s].D * feats[s].U * feats[s].R))
        target = ordered[len(ordered) // 2] if len(ordered) > 2 else ordered[-1]
        D3 = dict(D)
        T3 = dict(T)
        D3[target] = round(min(0.95, D[target] + 0.25), 3)
        T3[target] = 1.25
        st3 = ScenarioState(p, K, D3, T3)
        feats3 = _features(graph, st3, req, cands)
        out.append(_pack(f"{bid}-market", bid, "market",
                         f"{label} - permintaan {graph.skills[target].name} naik {D[target]:.0%} -> {D3[target]:.0%}",
                         st3, req, feats3, cands, graph, changed={"skill_id": target, "D_from": D[target], "D_to": D3[target]}))
    return out


def _pack(sid, base_id, variant, title, st: ScenarioState, req, feats, cands, graph, changed=None) -> dict:
    ctx_skills = set(cands)
    for c in cands:
        ctx_skills |= set(graph.prereqs.get(c, [])) | set(graph.dependents.get(c, []))
    return {
        "id": sid, "base_id": base_id, "variant": variant, "title": title, "candidates": cands,
        "changed": changed or {},
        "features": {c: {k: round(v, 4) for k, v in feats[c].x().items()} for c in cands},
        "blocked_by": {c: feats[c].blocked_by for c in cands},
        "unlocks": {c: feats[c].unlocks for c in cands},
        "student": {s: {"p": st.p[s], "K": st.K[s], "r": req.get(s, 0.0)} for s in sorted(ctx_skills)},
        "market": {c: {"D": round(st.D.get(c, 0.0), 4), "T": round(st.T.get(c, 1.0), 4)} for c in cands},
    }


# ------------------------------------------------------------ simulated experts
STYLES = {
    # judges by bottleneck: readiness and unlock value matter a lot
    "titik_hambat": {"G": 1.0, "D": 1.0, "R": 1.5, "U": 1.3, "T": 0.5, "B": 0.3, "K": 0.0},
    # judges by gap x demand only
    "kesenjangan_permintaan": {"G": 1.0, "D": 1.0, "R": 0.0, "U": 0.0, "T": 0.0, "B": 0.0, "K": 0.0},
    # judges by readiness and evidence confidence
    "kesiapan": {"G": 0.8, "D": 1.0, "R": 2.0, "U": 0.4, "T": 1.0, "B": 0.0, "K": -0.4},
}


def simulate_expert(scn: dict, style: str, rng: np.random.Generator, noise: float = 0.20) -> list[str]:
    w = STYLES[style]
    scores = {}
    for c in scn["candidates"]:
        x = scn["features"][c]
        u = sum(w[f] * math.log(max(x[f], 1e-6)) for f in w)
        scores[c] = u + rng.normal(0, noise)
    return sorted(scn["candidates"], key=lambda c: -scores[c])
