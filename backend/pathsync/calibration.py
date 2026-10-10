"""Evidence-weight rationale and calibration (answers "why 0.2 / 0.3 / 0.5?").

Eq. (2) combines evidence types with weights w_k. The rationale has three layers:

1. Principle - inverse-variance weighting. For independent, unbiased noisy measurements of the same
   mastery, the minimum-variance combination weights each source by 1 / sigma_k^2. The prior weights
   therefore encode an explicit, testable assumption about each source's error:
       w_academic : w_certificate : w_project : w_assessment = 0.20 : 0.25 : 0.30 : 0.50
   <=> sigma_k proportional to 1 / sqrt(w_k), i.e. a course grade is assumed ~1.6x noisier than a
   direct assessment (grades measure exposure and are inflated; Kruger & Dunning show self-views are
   too). This mirrors Miller's (1990) pyramid: knows (course) < knows how (certificate) <
   shows how (artifact) / measured performance (assessment).

2. Empirical calibration inside the product. Every later re-assessment is a direct measurement that
   was not used when the earlier indirect evidence was scored. Pairs (indirect components, later
   direct accuracy) are collected automatically and the weights are re-estimated on the simplex with a
   Dirichlet prior centred on the values above (MAP), so small pilots cannot swing them wildly.

3. Sensitivity. Until enough pairs exist, `sensitivity_report` shows how much the top-3
   recommendations change when the weights move (Dirichlet perturbations and extreme alternatives).
"""
from __future__ import annotations

import json
import math
import random
from functools import lru_cache

import numpy as np
from scipy.optimize import minimize

from .config import EVIDENCE_WEIGHTS, MODELS_DIR

KINDS = ["academic", "certificate", "project", "assessment"]
MIN_WEIGHT = 0.02          # a source never drops to 0: eq. (2) must stay defined when it is the only evidence
WEIGHTS_FILE = MODELS_DIR / "evidence_weights.json"
MIN_SAMPLES = 30


def _normalise(w: dict[str, float]) -> dict[str, float]:
    tot = sum(w[k] for k in KINDS)
    return {k: w[k] / tot for k in KINDS}


def implied_error_ratios(w: dict[str, float] = EVIDENCE_WEIGHTS) -> dict[str, float]:
    """sigma_k relative to the assessment's sigma implied by inverse-variance weights."""
    return {k: round(math.sqrt(w["assessment"] / w[k]), 3) for k in KINDS}


@lru_cache(maxsize=4)
def _load(mtime: float) -> dict[str, float] | None:
    data = json.loads(WEIGHTS_FILE.read_text(encoding="utf-8"))
    if data.get("status") == "active" and all(k in data.get("weights", {}) for k in KINDS):
        return {k: float(data["weights"][k]) for k in KINDS}
    return None


def active_evidence_weights() -> dict[str, float]:
    """Calibrated weights when a validated set is active, otherwise the documented prior."""
    if WEIGHTS_FILE.exists():
        w = _load(WEIGHTS_FILE.stat().st_mtime)
        if w:
            return w
    return dict(EVIDENCE_WEIGHTS)


# ------------------------------------------------------------------ fitting
def predict(components: dict[str, float], w: dict[str, float]) -> float:
    avail = [k for k in KINDS if k in components]
    den = sum(max(w[k], 1e-9) for k in avail)
    return sum(max(w[k], 1e-9) * components[k] for k in avail) / den


def fit_weights(samples: list[tuple[dict[str, float], float]], prior: dict[str, float] = EVIDENCE_WEIGHTS,
                prior_strength: float = 40.0) -> dict:
    """MAP estimate of w on the simplex: squared error + Dirichlet(prior_strength * prior) log-prior.

    samples: [(components {kind: e}, reference mastery in [0,1]), ...] where the reference is a direct
    measurement that was not part of the components.
    """
    p0 = _normalise(prior)
    alpha = np.array([prior_strength * p0[k] for k in KINDS])

    def unpack(z):
        e = np.exp(z - z.max())
        w = e / e.sum()
        return MIN_WEIGHT + (1 - MIN_WEIGHT * len(KINDS)) * w

    def loss(z):
        w = unpack(z)
        wd = dict(zip(KINDS, w, strict=False))
        sse = sum((predict(c, wd) - y) ** 2 for c, y in samples)
        return sse - float(((alpha - 1) * np.log(w + 1e-12)).sum()) * 0.01

    z0 = np.log(np.array([p0[k] for k in KINDS]))
    res = minimize(loss, z0, method="Nelder-Mead", options={"maxiter": 4000, "xatol": 1e-6, "fatol": 1e-9})
    w = dict(zip(KINDS, (float(x) for x in unpack(res.x)), strict=False))
    rmse_fit = math.sqrt(sum((predict(c, w) - y) ** 2 for c, y in samples) / max(1, len(samples)))
    rmse_prior = math.sqrt(sum((predict(c, p0) - y) ** 2 for c, y in samples) / max(1, len(samples)))
    return {"weights": {k: round(v, 4) for k, v in w.items()}, "rmse_fit": round(rmse_fit, 4),
            "rmse_prior": round(rmse_prior, 4), "n": len(samples)}


def collect_samples(rows: list[dict]) -> list[tuple[dict[str, float], float]]:
    """Build (indirect components, later direct accuracy) pairs.

    rows: per student-skill dicts with `components` (excluding re-assessment) and `later_correct` /
    `later_total` from re-assessment items answered after those components existed.
    """
    from .evidence import smoothed_accuracy

    out = []
    for r in rows:
        if r.get("later_total", 0) >= 3 and r.get("components"):
            comps = {k: v for k, v in r["components"].items() if k in KINDS}
            if comps:
                out.append((comps, smoothed_accuracy(r["later_correct"], r["later_total"])))
    return out


# --------------------------------------------------------------- sensitivity
def simulate_cohort(n: int, skill_ids: list[str], seed: int = 3) -> list[dict]:
    """Synthetic students: true mastery per skill plus noisy evidence from each source.

    Noise levels follow the error ratios implied by the prior weights (assumption, stated in the report).
    """
    rng = random.Random(seed)
    ratios = implied_error_ratios()
    base_sd = 0.12
    cohort = []
    for _ in range(n):
        level = rng.uniform(0.15, 0.7)
        theta = {s: min(0.95, max(0.02, rng.gauss(level, 0.18))) for s in skill_ids}
        comps = {}
        for s in skill_ids:
            c = {}
            if rng.random() < 0.8:
                c["academic"] = min(1, max(0, theta[s] + 0.12 + rng.gauss(0, base_sd * ratios["academic"])))   # grade inflation
            if rng.random() < 0.25:
                c["certificate"] = min(1, max(0, theta[s] + 0.08 + rng.gauss(0, base_sd * ratios["certificate"])))
            if rng.random() < 0.35:
                c["project"] = min(1, max(0, theta[s] + rng.gauss(0, base_sd * ratios["project"])))
            if rng.random() < 0.5:
                c["assessment"] = min(1, max(0, theta[s] + rng.gauss(0, base_sd * ratios["assessment"])))
            if c:
                comps[s] = c
        cohort.append({"theta": theta, "components": comps})
    return cohort


def _mastery(comps: dict[str, dict[str, float]], w: dict[str, float], skill_ids, prior: float = 0.10) -> dict[str, float]:
    return {s: predict(comps[s], w) if s in comps else prior for s in skill_ids}


def sensitivity_report(rank_fn, skill_ids: list[str], n_students: int = 60, n_draws: int = 40, seed: int = 5) -> dict:
    """How stable are recommendations when evidence weights change?

    rank_fn(p: dict) -> ordered list of skill ids (the live ranking model on the live market map).
    """
    from .ranker import kendall_tau

    rng = np.random.default_rng(seed)
    cohort = simulate_cohort(n_students, skill_ids, seed)
    base_w = _normalise(EVIDENCE_WEIGHTS)
    alternatives = {
        "equal weights": {k: 0.25 for k in KINDS},
        "no assessment weight boost (assessment = project)": _normalise({**EVIDENCE_WEIGHTS, "assessment": EVIDENCE_WEIGHTS["project"]}),
        "grades weigh most (reversed)": _normalise({"academic": 0.5, "certificate": 0.3, "project": 0.25, "assessment": 0.2}),
    }
    rows = {}

    def compare(w):
        top3, taus, errs = [], [], []
        for st in cohort:
            b = rank_fn(_mastery(st["components"], base_w, skill_ids))
            a = rank_fn(_mastery(st["components"], w, skill_ids))
            top3.append(len(set(a[:3]) & set(b[:3])) / 3 if b else 1.0)
            taus.append(kendall_tau(a, b) if len(b) > 1 else 1.0)
            m = _mastery(st["components"], w, skill_ids)
            errs.append(np.mean([abs(m[s] - st["theta"][s]) for s in st["components"]]))
        return {"top3_overlap": round(float(np.mean(top3)), 4), "kendall_tau": round(float(np.mean(taus)), 4),
                "mastery_mae": round(float(np.mean(errs)), 4)}

    rows["documented prior (0.20/0.25/0.30/0.50)"] = compare(base_w)
    for conc in (100.0, 30.0):
        draws = [compare(dict(zip(KINDS, rng.dirichlet([conc * base_w[k] for k in KINDS]), strict=False))) for _ in range(n_draws)]
        rows[f"random weights near the prior (Dirichlet, concentration {int(conc)})"] = {
            m: round(float(np.mean([d[m] for d in draws])), 4) for m in draws[0]}
    for name, w in alternatives.items():
        rows[name] = compare(w)
    return {"assumption": "synthetic cohort; source noise follows the error ratios implied by the prior weights",
            "implied_error_ratio_vs_assessment": implied_error_ratios(), "n_students": n_students,
            "results": rows}


def write_weights(result: dict, status: str, note: str) -> None:
    WEIGHTS_FILE.write_text(json.dumps({**result, "status": status, "note": note}, indent=1), encoding="utf-8")
    _load.cache_clear()
