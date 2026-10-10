"""Evidence-weight calibration, guess correction and study statistics."""
from __future__ import annotations

import random

import pytest

from pathsync.calibration import KINDS, fit_weights, implied_error_ratios, predict
from pathsync.evidence import smoothed_accuracy
from pathsync.study import DEFAULT_ARMS, analyse, assign_arm, holm


def test_guess_corrected_accuracy_is_not_above_prior_when_all_wrong():
    assert smoothed_accuracy(0, 2) == 0.0                 # was 0.25 > prior 0.10 before the fix
    assert smoothed_accuracy(2, 2) > smoothed_accuracy(1, 2) > smoothed_accuracy(0, 2)


def test_prior_weights_imply_explicit_error_ratios():
    r = implied_error_ratios()
    assert r["assessment"] == 1.0 and r["academic"] > r["certificate"] > r["project"] > 1.0


def test_fit_recovers_the_more_reliable_source():
    """Synthetic truth where projects are as precise as assessments: the fit must move weight to projects."""
    rng = random.Random(1)
    samples = []
    sd = {"academic": 0.30, "certificate": 0.25, "project": 0.06, "assessment": 0.06}
    for _ in range(300):
        theta = rng.uniform(0.1, 0.9)
        comps = {k: min(1, max(0, theta + rng.gauss(0, sd[k]))) for k in KINDS if rng.random() < 0.8}
        if comps:
            samples.append((comps, theta))
    res = fit_weights(samples, prior_strength=4.0)
    w = res["weights"]
    assert w["project"] > w["academic"] and w["assessment"] > w["academic"]
    assert res["rmse_fit"] <= res["rmse_prior"] + 1e-9
    assert sum(w.values()) == pytest.approx(1.0, abs=1e-3)
    assert 0 <= predict({"academic": 1.0}, w) <= 1


def test_minimisation_balances_arms():
    counts: dict[str, int] = {}
    rng = random.Random(0)
    for _ in range(12):
        a = assign_arm(DEFAULT_ARMS, counts, rng)
        counts[a] = counts.get(a, 0) + 1
    assert set(counts.values()) == {3}


def test_holm_and_analysis():
    adj = holm({"a": 0.01, "b": 0.04, "c": 0.03})
    assert adj["a"] == pytest.approx(0.03) and adj["c"] == pytest.approx(0.06) and adj["b"] == pytest.approx(0.06)
    res = analyse({"A": [2, 2, 3, 2, 3], "D": [4, 5, 4, 5, 4]})
    assert res["kruskal_wallis"]["p"] < 0.05 and res["rank_biserial"]["A-D"] == pytest.approx(1.0)
