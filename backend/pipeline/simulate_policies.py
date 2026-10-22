"""Simulation: does the PathSync order (formula 5, recomputed after every study session) reach role coverage faster
than three simpler orders a student could follow? Synthetic students only; this checks the direction and size of the
effect under stated assumptions, not real learning.

Data: Business Analyst demand from data/processed/market_latest.json (the 12 most requested skills) plus the two
dependents of Requirements Elicitation that experts approved; prerequisite edges = the expert-approved BA edges among
these skills. Required level r = 0.60 + 0.25 * D / max D (the 0.60-0.85 band of Bab III).

Learning assumption: one session on skill s moves p toward 1 by `rate` when every prerequisite of s has p >= 0.6,
and by `rate * k` otherwise; k is varied (0.25, 0.5, 1.0) because how much an unmet prerequisite slows learning is
not known. k = 1.0 means prerequisites do not matter at all, the case least favourable to PathSync.

    python -m pipeline.simulate_policies          # writes data/models/policy_simulation.json
"""
import json
import random
import statistics
from datetime import datetime

from pathsync.config import MODELS_DIR, PROCESSED_DIR

EXTRA_DEMAND = {"system_modeling_uml": 0.11, "wireframing": 0.05}   # share of BA postings in the expert sheet (V2)
EDGES = [("requirements_elicitation", "requirements_documentation"),
         ("requirements_elicitation", "system_modeling_uml"),
         ("requirements_elicitation", "wireframing"),
         ("requirements_documentation", "testing_uat"),
         ("sdlc", "testing_uat")]
READY = 0.6
POLICIES = ("pathsync", "biggest_gap", "most_demanded", "random")


def load_role() -> tuple[dict[str, float], dict[str, float], dict[str, list[str]], dict[str, list[str]]]:
    market = json.loads((PROCESSED_DIR / "market_latest.json").read_text(encoding="utf-8"))
    demand = {s: d for s, d in market["roles"]["business_analyst"]["top"]}
    demand.update(EXTRA_DEMAND)
    top = max(demand.values())
    req = {s: 0.60 + 0.25 * d / top for s, d in demand.items()}
    prereqs: dict[str, list[str]] = {s: [] for s in demand}
    dependents: dict[str, list[str]] = {s: [] for s in demand}
    for a, b in EDGES:
        prereqs[b].append(a)
        dependents[a].append(b)
    return demand, req, prereqs, dependents


def coverage(p, demand, req) -> float:
    return sum(demand[s] * min(p[s], req[s]) for s in demand) / sum(demand[s] * req[s] for s in demand)


def choose(policy, p, demand, req, prereqs, dependents, rng) -> str | None:
    gap = {s: max(0.0, req[s] - p[s]) for s in demand}
    open_ = [s for s in demand if gap[s] > 1e-9]
    if not open_:
        return None
    if policy == "random":
        return rng.choice(open_)
    if policy == "biggest_gap":
        return max(open_, key=lambda s: gap[s])
    if policy == "most_demanded":
        return max(open_, key=lambda s: demand[s])

    def prio(s):                                          # formula (5) with T = 1 (no trend data for BA yet)
        unlock = 1 + sum(demand[t] for t in dependents[s] if gap[t] > 1e-9)
        ready = 1.0 if all(p[q] >= READY for q in prereqs[s]) else 0.5
        return gap[s] * demand[s] * unlock * ready
    return max(open_, key=prio)


def run(policy, k, n, sessions, rate, seed) -> dict:
    demand, req, prereqs, dependents = load_role()
    rng = random.Random(seed)
    cov = {t: [] for t in (5, 10, 20)}
    blocked, to80 = [], []
    for _ in range(n):
        p = {s: rng.uniform(0.05, 0.6) for s in demand}
        n_blocked, reached = 0, None
        for t in range(1, sessions + 1):
            s = choose(policy, p, demand, req, prereqs, dependents, rng)
            if s is not None:
                ok = all(p[q] >= READY for q in prereqs[s])
                n_blocked += not ok
                p[s] += (rate if ok else rate * k) * (1 - p[s])
            c = coverage(p, demand, req)
            if reached is None and c >= 0.8:
                reached = t
            if t in cov:
                cov[t].append(c)
        blocked.append(n_blocked / sessions)
        to80.append(reached if reached is not None else sessions + 1)
    return {"coverage_after": {str(t): round(statistics.mean(v), 4) for t, v in cov.items()},
            "sessions_on_unready_skill": round(statistics.mean(blocked), 4),
            "median_sessions_to_coverage_0_8": statistics.median(to80),
            "reached_0_8_within_horizon": round(sum(x <= sessions for x in to80) / n, 4)}


def main(n: int = 2000, sessions: int = 20, rate: float = 0.35) -> dict:
    out = {"generated_at": datetime.now().isoformat(timespec="seconds"),
           "label": "simulation: synthetic students, BA demand and expert-approved edges; not evidence about real learners",
           "n_students": n, "sessions": sessions, "rate": rate, "ready_threshold": READY,
           "scenarios": []}
    for k in (0.25, 0.5, 1.0):
        out["scenarios"].append({"k_unready": k, "policies": {pol: run(pol, k, n, sessions, rate, seed=7) for pol in POLICIES}})
    (MODELS_DIR / "policy_simulation.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    return out


if __name__ == "__main__":
    res = main()
    for sc in res["scenarios"]:
        print(f"k = {sc['k_unready']}")
        for pol, r in sc["policies"].items():
            print(f"  {pol:14s} cov@5 {r['coverage_after']['5']:.3f} cov@10 {r['coverage_after']['10']:.3f} "
                  f"cov@20 {r['coverage_after']['20']:.3f} unready {r['sessions_on_unready_skill']:.3f} "
                  f"to0.8 {r['median_sessions_to_coverage_0_8']}")
