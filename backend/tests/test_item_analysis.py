"""Plan A5: item analysis, reliability, Rasch difficulty and BKT re-estimation, checked on simulated
answers whose true parameters are known."""
from __future__ import annotations

import math
import random

import numpy as np
from scipy.stats import spearmanr

from pathsync.item_analysis import (
    MIN_ANSWERS_PER_ITEM,
    bkt_log_loss,
    fit_bkt,
    fit_rasch,
    item_information,
    item_stats,
    kr20,
    reliability_by_skill,
    spearman_brown_items,
    theta_from_mastery,
)


def simulate(n_people=300, n_items=10, seed=0):
    rng = random.Random(seed)
    b_true = {f"sql-{i}": (i - n_items / 2) / 2 for i in range(n_items)}
    rows = []
    for p in range(n_people):
        theta = rng.gauss(0, 1)
        for iid, b in b_true.items():
            ok = rng.random() < 1 / (1 + math.exp(-(theta - b)))
            canon = 0 if ok else rng.choice([1, 2, 3])
            rows.append((f"s{p}", iid, "sql", ok, canon))
    return rows, b_true


def test_rasch_recovers_known_difficulty():
    rows, b_true = simulate()
    b, theta = fit_rasch(rows)
    rho = spearmanr([b[i] for i in b_true], list(b_true.values())).statistic
    assert rho > 0.95 and abs(np.mean(list(b.values()))) < 1e-3          # centred (values rounded to 4 dp)
    assert len(theta) == 300


def test_item_stats_flags_by_the_written_rule():
    rows, _ = simulate(n_people=200)
    rows += [(f"s{p}", "sql-dead", "sql", True, 0) for p in range(200)]      # everyone right, no distractor chosen
    stats = {s["item_id"]: s for s in item_stats(rows)}
    assert "p_out_of_range" in stats["sql-dead"]["flags"] and "dead_distractor" in stats["sql-dead"]["flags"]
    mid = stats["sql-5"]
    assert mid["point_biserial"] > 0.15 and 0.2 <= mid["p_correct"] <= 0.9
    assert abs(sum(mid["choice_shares"].values()) - 1.0) < 0.01


def test_reliability_and_spearman_brown():
    rows, _ = simulate(n_people=300)
    r = reliability_by_skill(rows)["sql"]
    assert r["n_items"] == 10 and 0.5 < r["kr20"] < 0.95
    assert spearman_brown_items(0.4, 5) == 12                  # 0.4 with 5 items needs 12 for 0.6
    assert spearman_brown_items(0.7, 5) == 5
    assert kr20(np.ones((5, 3))) is None


def test_information_peaks_at_matching_difficulty():
    assert item_information(0.0, 0.0) > item_information(0.0, 2.0)
    assert theta_from_mastery(0.5) == 0.0 and theta_from_mastery(0.999) < 4


def test_bkt_fit_keeps_or_improves_held_out_loss():
    rng = random.Random(1)
    slip, guess, learn = 0.05, 0.30, 0.25
    seqs = []
    for _ in range(400):
        known, seq = rng.random() < 0.1, []
        for _ in range(6):
            seq.append(rng.random() < ((1 - slip) if known else guess))
            known = known or rng.random() < learn
        seqs.append(seq)
    r = fit_bkt(seqs, 0.10, (0.10, 0.25, 0.10))
    assert r["held_out_log_loss"]["fitted"] <= r["held_out_log_loss"]["start"]
    assert r["fitted"]["guess"] >= 0.25 and r["fitted"]["transit"] >= 0.15
    assert bkt_log_loss(seqs, 0.05, 0.30, 0.25, 0.10) < bkt_log_loss(seqs, 0.20, 0.15, 0.05, 0.10)


def test_calibration_activates_only_with_enough_answers():
    from pipeline.calibrate_items import build

    rows, _ = simulate(n_people=MIN_ANSWERS_PER_ITEM)
    out = build(rows, [(r[0], r[2], r[3]) for r in rows])
    assert out["n_items_calibrated"] == 10 and out["active"] is False      # 10 of 570 items is not half the bank
    assert out["bkt"]["n_sequences"] == MIN_ANSWERS_PER_ITEM
