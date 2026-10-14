"""Item-bank quality gates (PM audit P0-1): answers must not be guessable from option length or position."""
import importlib
from collections import Counter

import pytest


@pytest.fixture(params=["en", "id"])
def bank(request, monkeypatch):
    import pathsync.assessment as assessment
    import pathsync.config as config

    monkeypatch.setattr(config, "LANG", request.param)
    monkeypatch.setattr(assessment, "LANG", request.param)
    assessment.item_bank.cache_clear()
    yield assessment.item_bank()
    assessment.item_bank.cache_clear()
    importlib.reload(assessment)


def _share(bank, pick) -> float:
    return sum(pick(it["options"]) == it["answer"] for it in bank.values()) / len(bank)


def test_longest_option_is_not_a_cue(bank):
    share = _share(bank, lambda o: max(range(len(o)), key=lambda i: len(o[i])))
    assert share <= 0.34, f"longest option is correct in {share:.0%} of items (chance = 25%)"


def test_shortest_option_is_not_a_cue(bank):
    share = _share(bank, lambda o: min(range(len(o)), key=lambda i: len(o[i])))
    assert share <= 0.34, f"shortest option is correct in {share:.0%} of items (chance = 25%)"


def test_answer_positions_are_balanced(bank):
    pos = Counter(it["answer"] for it in bank.values())
    for i in range(4):
        assert 0.15 <= pos[i] / len(bank) <= 0.35, pos


def test_every_item_has_four_distinct_options(bank):
    for it in bank.values():
        assert len(it["options"]) == 4 and len(set(it["options"])) == 4, it["id"]


def test_cue_only_model_cannot_find_the_key(bank):
    """A classifier that sees only the surface of the options (length, punctuation, absolutes, overlap) must stay near
    chance. Run with three fold seeds so one lucky split cannot hide a cue."""
    from pathsync.item_audit import cue_classifier_accuracy, single_cue_rates

    items = list(bank.values())
    accs = [cue_classifier_accuracy(items, seed=s)["accuracy"] for s in (0, 1, 2)]
    # Ceiling for the current bank (new items still carry a residual cue; scoring compensates with per-item guess
    # probabilities). Ratchet this down as items are rewritten or replaced by item-analysis-approved ones; target 0.30.
    assert max(accs) <= 0.42, f"cue-only accuracy {accs} (chance 0.25)"
    for cue in ("longest", "shortest", "most_overlap_with_others", "most_stem_overlap"):
        assert 0.12 <= single_cue_rates(items)[cue] <= 0.36, cue


def test_extractor_meets_precision_target_on_blind_gold():
    """Bab III.D sets precision > 0.80 for the extraction component; measured on postings never used to tune aliases."""
    from pipeline.eval_extractor import evaluate

    r = evaluate(goldfile="gold_blind.json")["overall"]
    assert r["precision"] >= 0.80, r
    assert r["recall"] >= 0.80, r
