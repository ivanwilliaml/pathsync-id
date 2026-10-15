"""Plan D2 (single metrics file) and rule 0.3 (intervals are reported, not point estimates alone)."""


def test_wilson_interval_matches_reference_values():
    from pipeline.eval_extractor import wilson

    assert wilson(0, 0) == [0.0, 1.0]
    lo, hi = wilson(82, 99)          # statsmodels proportion_confint(method="wilson"): 0.7421 - 0.8899
    assert abs(lo - 0.7421) < 0.001 and abs(hi - 0.8899) < 0.001
    lo, hi = wilson(10, 10)
    assert hi == 1.0 and 0.69 < lo < 0.73


def test_metrics_report_has_every_block_with_provenance():
    from pipeline.report import build

    m = build()
    assert {"extraction", "assessment_items", "ranker", "market", "validation", "inputs", "constants"} <= set(m)
    assert m["inputs"]["taxonomy_sha"] and m["constants"]["bkt"]["guess"] == 0.25
    assert m["ranker"]["experts"] in {"real", "simulated"}
    assert m["market"]["total_postings_in_window"] > 0
