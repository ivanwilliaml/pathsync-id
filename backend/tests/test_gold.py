"""Human gold set (plan A1): locked split, Wilson intervals, kappa and consensus."""
from __future__ import annotations

from pathsync.gold import agreement, consensus, earlier_gold_ids, kappa, load_split, make_split, wilson


def test_wilson_interval_matches_known_values():
    assert wilson(0, 0) == [0.0, 0.0]
    lo, hi = wilson(8, 10)
    assert 0.49 < lo < 0.50 and 0.94 < hi < 0.95       # textbook value: [0.490, 0.943]
    lo, hi = wilson(80, 100)
    assert lo < 0.80 < hi and hi - lo < 0.17


def test_split_is_stratified_balanced_and_excludes_tuning_postings():
    used = earlier_gold_ids()
    cands = {f"p{i}": ("business_analyst" if i % 3 else "qa_engineer") for i in range(60)}
    cands.update({k: "business_analyst" for k in list(used)[:3]})
    doc = make_split(cands)
    assert abs(len(doc["dev"]) - len(doc["test"])) <= 1          # 15 postings: one half gets the extra
    assert not (set(doc["dev"]) & set(doc["test"]))
    assert not (set(doc["dev"]) | set(doc["test"])) & used
    assert doc["per_role"]["business_analyst"] == {"dev": 5, "test": 5}
    assert make_split(cands) == doc                      # same seed, same split


def test_locked_split_file_is_fifty_fifty():
    split = load_split()
    assert split is not None, "data/seed/gold_split.json is part of the repo"
    assert len(split["dev"]) == 50 and len(split["test"]) == 50
    assert not (set(split["dev"]) | set(split["test"])) & earlier_gold_ids()


def test_kappa_and_consensus():
    assert kappa([1, 0, 1, 0], [1, 0, 1, 0]) == 1.0
    by_post = {"a": {"x": {"sql", "excel"}, "y": {"sql"}},
               "b": {"x": {"bpmn"}, "y": {"bpmn"}},
               "c": {"x": {"sql"}, "y": {"sql", "bpmn"}}}
    pair = agreement(by_post, ["sql", "excel", "bpmn"])[0]
    assert pair["annotators"] == ["x", "y"] and pair["postings"] == 3
    assert {r["skill"] for r in pair["per_skill"]} == {"sql", "excel", "bpmn"}
    doc, open_disputes = consensus(by_post, {"a": "business_analyst"}, {"a": {"excel": True}})
    assert doc["postings"]["a"]["skills"] == ["excel", "sql"]
    assert doc["postings"]["b"]["skills"] == ["bpmn"]
    assert open_disputes == [{"posting_id": "c", "skill": "bpmn", "chosen_by": ["y"]}]
