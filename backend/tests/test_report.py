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


def test_new_market_snapshots_record_their_provenance():
    from datetime import date

    from pathsync.db import get_session
    from pathsync.market import build_snapshot

    with get_session() as s:
        snap = build_snapshot(s, "business_analyst", "test-provenance", date(2026, 10, 6), note="test")
        prov = snap.provenance
        s.rollback()            # leave the active snapshot untouched
    assert prov["taxonomy_sha"] and prov["graph_sha"] and prov["postings"] > 0
    assert sum(prov["extractors"].values()) == prov["postings"]


def test_normalisation_scoring_kappa_and_curve(tmp_path, monkeypatch):
    import json

    from pipeline import normalisation_eval as ne

    monkeypatch.setattr(ne, "MODELS_DIR", tmp_path)
    items = [  # two labellers agree on 3 of 4; the model is right on 2 of the 3 agreed phrases
        {"phrase": "sql queries", "label_a": "sql", "label_b": "sql", "_model": {"skill_id": "sql", "similarity": 0.97}},
        {"phrase": "bpmn", "label_a": "business_process_modeling", "label_b": "business_process_modeling",
         "_model": {"skill_id": "business_process_modeling", "similarity": 0.88}},
        {"phrase": "teliti", "label_a": "none", "label_b": "none", "_model": {"skill_id": "nodejs_backend", "similarity": 0.93}},
        {"phrase": "excel", "label_a": "excel", "label_b": "none", "_model": {"skill_id": "excel", "similarity": 0.99}},
    ]
    f = tmp_path / "labels.json"
    f.write_text(json.dumps({"items": items}), encoding="utf-8")
    out = ne.score(f)
    assert out["n_agreed"] == 3 and 0 < out["kappa"] < 1
    at = {c["threshold"]: c for c in out["curve"]}
    assert at[0.85]["precision"] == round(2 / 3, 3) and at[0.95]["precision"] == 1.0
    assert out["recommended_sim_auto"] == 0.95
