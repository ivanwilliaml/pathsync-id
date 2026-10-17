"""Item-bank quality gates (PM audit P0-1): answers must not be guessable from option length or position."""
import importlib
from collections import Counter

import pytest


@pytest.fixture(params=["en", "id"])
def bank(request):
    import pathsync.assessment as assessment

    return assessment.item_bank(request.param)


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
    # Plan A6: after the 60 most cue-prone items were rewritten the classifier sits at chance (0.258 on 14 Oct,
    # down from 0.37). Ceiling 0.35; ratchet towards 0.30 as item analysis on real answers replaces weak items.
    assert max(accs) <= 0.35, f"cue-only accuracy {accs} (chance 0.25)"
    for cue in ("longest", "shortest", "most_overlap_with_others", "most_stem_overlap"):
        assert 0.12 <= single_cue_rates(items)[cue] <= 0.36, cue


def _bank(lang, monkeypatch=None):
    import pathsync.assessment as assessment

    return assessment.item_bank(lang)


def test_both_languages_hold_the_same_items(monkeypatch):
    """Plan A7: the Indonesian and English banks differ only in text, never in structure or in which option is the key."""

    import pathsync.assessment as assessment

    try:
        en, idn = _bank("en", monkeypatch), _bank("id", monkeypatch)
        assert set(en) == set(idn)
        for k in en:
            assert en[k]["skill_id"] == idn[k]["skill_id"] and en[k]["difficulty"] == idn[k]["difficulty"], k
            assert len(en[k]["options"]) == len(idn[k]["options"]) == 4, k
            assert en[k]["answer"] == idn[k]["answer"], k
    finally:
        assessment.item_bank.cache_clear()
        importlib.reload(assessment)


def test_indonesian_bank_is_translated(monkeypatch):
    """No item of the Indonesian bank may still be its English text (the 440 x_* items started out in English)."""

    import pathsync.assessment as assessment

    try:
        en, idn = _bank("en", monkeypatch), _bank("id", monkeypatch)
        same = [k for k in en if en[k]["stem"] == idn[k]["stem"] and not k.startswith(("excel", "sql", "python"))]
        assert len(same) <= 5, same[:10]
    finally:
        assessment.item_bank.cache_clear()
        importlib.reload(assessment)


def test_extractor_meets_precision_target_on_blind_gold():
    """Bab III.D sets precision > 0.80 for the extraction component; measured on postings never used to tune aliases.
    Once the two-annotator consensus exists (plan A1), the test half of the locked split replaces the blind set."""
    from pathsync.gold import CONSENSUS_FILE
    from pipeline.eval_extractor import evaluate

    if CONSENSUS_FILE.exists():
        r = evaluate(goldfile=CONSENSUS_FILE.name, split="test")["overall"]
    else:
        r = evaluate(goldfile="gold_blind.json")["overall"]
    assert r["precision"] >= 0.80, r
    assert r["recall"] >= 0.80, r
