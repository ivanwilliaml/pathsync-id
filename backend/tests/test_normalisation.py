"""Plan A3: the normalisation curve, chosen threshold and cluster purity are computed from human
labels; the sample is locked and shows no system prediction to labellers."""
from __future__ import annotations

import json

from pathsync.config import SEED_DIR
from pipeline.normalisation import AUTO_PRECISION_TARGET, BANDS, PER_BAND, THRESHOLDS, evaluate


def test_threshold_follows_the_written_rule():
    gold = {"a": "sql", "b": "sql", "c": "excel", "d": "none", "e": "bpmn"}
    preds = {"a": ("sql", 0.95), "b": ("sql", 0.88), "c": ("excel", 0.81), "d": ("sql", 0.72), "e": ("sql", 0.66)}
    r = evaluate(gold, preds)
    by_t = {c["threshold"]: c for c in r["curve"]}
    assert [c["threshold"] for c in r["curve"]] == THRESHOLDS
    assert by_t[0.85]["precision"] == 1.0 and by_t[0.85]["auto"] == 2
    assert by_t[0.70]["precision"] == 0.75                        # the non-skill phrase at 0.72 slips in
    assert r["chosen_threshold"] == 0.75 and AUTO_PRECISION_TARGET == 0.95
    assert by_t[0.75]["coverage"] == 0.75                          # 3 of 4 real skill phrases mapped right
    assert r["cluster_purity"] == 0.6                              # sql group {sql, sql, none, bpmn} + excel


def test_locked_sample_has_three_bands_and_no_predictions():
    doc = json.loads((SEED_DIR / "normalisation_sample.json").read_text(encoding="utf-8"))
    bands = [p["band"] for p in doc["phrases"]]
    assert {b for b, _, _ in BANDS} == set(bands)
    assert max(bands.count(b) for b in set(bands)) == PER_BAND
    assert all(set(p) == {"id", "surface", "quote", "band"} for p in doc["phrases"])
