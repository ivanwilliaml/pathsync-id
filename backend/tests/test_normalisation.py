"""Plan A3: the normalisation curve, chosen threshold and cluster purity are computed from human
labels; the sample is locked and shows no system prediction to labellers."""
from __future__ import annotations

import json

from pathsync.config import SEED_DIR
from pipeline.normalisation import AUTO_PRECISION_TARGET, BANDS, PER_BAND, THRESHOLDS, cohen_kappa, evaluate


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


def test_unsupported_phrases_are_not_auto_mapped_and_kappa():
    """Ported from the earlier normalisation_eval tool: the curve applies the lexical-support guard, and
    labeller agreement is Cohen's kappa."""
    gold = {"a": "sql", "b": "none"}
    preds = {"a": ("sql", 0.95, True), "b": ("sql", 0.93, False)}          # b: similar vector, no shared word
    by_t = {c["threshold"]: c for c in evaluate(gold, preds)["curve"]}
    assert by_t[0.90]["auto"] == 1 and by_t[0.90]["precision"] == 1.0
    assert cohen_kappa(["sql", "none", "excel"], ["sql", "none", "excel"]) == 1.0
    assert cohen_kappa(["sql", "sql"], ["none", "none"]) == 0.0
