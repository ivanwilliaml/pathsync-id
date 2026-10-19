"""Item-bank guessability audit (PM audit P0-1, extended).

A multiple-choice bank is only evidence of skill if the key cannot be found without the skill. Length is one cue;
this module measures all the surface cues a test-wise student (or a classifier) can use, with no domain knowledge:

* option length and its rank, word count, punctuation, digits
* absolute / hedging words ("always", "never", "only", "selalu", "hanya")
* overlap with the question stem
* "centroid" cue: the key often shares words with several distractors (they are mutations of it)
* "odd one out" cue: the opposite pattern

`cue_classifier_accuracy` trains a conditional-logit style model (logistic regression on option rows, argmax per item)
with grouped cross-validation. On a clean bank its accuracy sits near chance (25%); the CI test requires a ceiling.
"""
from __future__ import annotations

import re
from collections import Counter

import numpy as np

ABSOLUTE = re.compile(r"\b(always|never|only|all|every|none|completely|must|definitely|guaranteed|any|no|"
                      r"selalu|tidak pernah|hanya|semua|setiap|pasti|harus|sama sekali|tanpa)\b", re.I)
HEDGE = re.compile(r"\b(usually|often|typically|may|might|can|sometimes|generally|biasanya|sering|umumnya|dapat|bisa|kadang)\b", re.I)
WORD = re.compile(r"\w+", re.U)


def _words(s: str) -> set[str]:
    return {w.lower() for w in WORD.findall(s) if len(w) > 2}


def _jac(a: set[str], b: set[str]) -> float:
    return len(a & b) / len(a | b) if a | b else 0.0


def option_features(stem: str, options: list[str]) -> np.ndarray:
    """One row of cue features per option (relative to the other options of the same item)."""
    ws = [_words(o) for o in options]
    stem_w = _words(stem)
    lens = np.array([len(o) for o in options], dtype=float)
    wc = np.array([len(WORD.findall(o)) for o in options], dtype=float)
    order = lens.argsort().argsort()          # 0 = shortest
    rows = []
    for i, o in enumerate(options):
        others = [j for j in range(len(options)) if j != i]
        overlap_others = np.mean([_jac(ws[i], ws[j]) for j in others])
        rows.append([
            (lens[i] - lens.mean()) / (lens.std() + 1e-6),
            float(order[i] == len(options) - 1), float(order[i] == 0), order[i] / (len(options) - 1),
            (wc[i] - wc.mean()) / (wc.std() + 1e-6),
            overlap_others, overlap_others - 0.0,
            _jac(ws[i], stem_w),
            float(bool(ABSOLUTE.search(o))), float(bool(HEDGE.search(o))),
            float("," in o or ";" in o), float(any(c.isdigit() for c in o)),
            float(i == 0), float(i == len(options) - 1),
        ])
    x = np.array(rows)
    # centroid / odd-one-out: standardise the overlap column within the item
    col = x[:, 5]
    x[:, 6] = (col - col.mean()) / (col.std() + 1e-6)
    return x


def build_matrix(items: list[dict]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    X, y, g = [], [], []
    for k, it in enumerate(items):
        f = option_features(it["stem"], it["options"])
        X.append(f)
        y.extend(1 if i == it["answer"] else 0 for i in range(len(it["options"])))
        g.extend([k] * len(it["options"]))
    return np.vstack(X), np.array(y), np.array(g)


def cue_classifier_accuracy(items: list[dict], folds: int = 5, seed: int = 0) -> dict:
    """Grouped CV accuracy of a cue-only model at picking the key, plus a permutation baseline."""
    from sklearn.linear_model import LogisticRegression

    X, y, g = build_matrix(items)
    rng = np.random.default_rng(seed)
    ids = np.arange(len(items))
    rng.shuffle(ids)
    fold_of = {item: i % folds for i, item in enumerate(ids)}
    correct = 0
    for f in range(folds):
        test = np.array([fold_of[k] == f for k in g])
        clf = LogisticRegression(C=0.5, max_iter=500, class_weight="balanced").fit(X[~test], y[~test])
        s = clf.decision_function(X[test])
        gt, yt = g[test], y[test]
        for item in np.unique(gt):
            m = gt == item
            correct += int(yt[m][s[m].argmax()] == 1)
    acc = correct / len(items)
    # permutation null: shuffle which option is the key inside each item
    null = []
    for _ in range(30):
        yp = y.copy()
        for item in np.unique(g):
            m = np.where(g == item)[0]
            yp[m] = rng.permutation(yp[m])
        c = 0
        for f in range(folds):
            test = np.array([fold_of[k] == f for k in g])
            clf = LogisticRegression(C=0.5, max_iter=300, class_weight="balanced").fit(X[~test], yp[~test])
            s = clf.decision_function(X[test])
            gt, yt = g[test], yp[test]
            for item in np.unique(gt):
                m = gt == item
                c += int(yt[m][s[m].argmax()] == 1)
        null.append(c / len(items))
    return {"n_items": len(items), "accuracy": round(acc, 3), "chance": 0.25,
            "null_mean": round(float(np.mean(null)), 3), "null_p95": round(float(np.percentile(null, 95)), 3),
            "_null": null}


AUDIT_SEEDS = (0, 1, 2, 3, 4)


def cue_classifier_accuracy_multi(items: list[dict], seeds: tuple[int, ...] = AUDIT_SEEDS) -> dict:
    """Mean over several fold splits. One split is noisy (the same 570 items gave 0.258 to 0.314 across seeds), so the
    reported accuracy and its null are both averaged over `seeds`; the null p95 is the 95th percentile of the averaged
    permutation runs, which is the right yardstick for an averaged accuracy."""
    runs = [cue_classifier_accuracy(items, seed=s) for s in seeds]
    accs = [r["accuracy"] for r in runs]
    null = np.mean(np.array([r["_null"] for r in runs]), axis=0)
    return {"n_items": len(items), "accuracy": round(float(np.mean(accs)), 3), "accuracy_by_seed": accs,
            "accuracy_sd": round(float(np.std(accs)), 3), "chance": 0.25,
            "null_mean": round(float(np.mean(null)), 3), "null_p95": round(float(np.percentile(null, 95)), 3),
            "seeds": list(seeds)}


def single_cue_rates(items: list[dict]) -> dict[str, float]:
    """Share of items where each simple cue alone points at the key (chance = 0.25 unless ties)."""
    n = len(items)
    out = Counter()
    for it in items:
        o, a = it["options"], it["answer"]
        L = [len(x) for x in o]
        out["longest"] += L.index(max(L)) == a
        out["shortest"] += L.index(min(L)) == a
        f = option_features(it["stem"], o)
        out["most_overlap_with_others"] += int(f[:, 5].argmax()) == a
        out["least_overlap_with_others"] += int(f[:, 5].argmin()) == a
        out["most_stem_overlap"] += int(f[:, 7].argmax()) == a
        ab = [bool(ABSOLUTE.search(x)) for x in o]
        out["only_non_absolute"] += (sum(ab) == 3 and not ab[a])
        out["position_a"] += a == 0
    return {k: round(v / n, 3) for k, v in out.items()}


def audit(items: list[dict]) -> dict:
    return {"single_cues": single_cue_rates(items), "classifier": cue_classifier_accuracy_multi(items)}


def item_cue_probabilities(items: list[dict], folds: int = 5, seed: int = 0) -> dict[str, float]:
    """Out-of-fold probability that the cue-only model picks the key of each item (softmax over its options).

    A value near 0.25 means the surface cues say nothing; a value near 1 means the item can be answered without
    knowing the skill. `pathsync.assessment` uses it as a per-item guessing probability and to rank items for selection.
    """
    from sklearn.linear_model import LogisticRegression

    X, y, g = build_matrix(items)
    rng = np.random.default_rng(seed)
    ids = np.arange(len(items))
    rng.shuffle(ids)
    fold_of = {item: i % folds for i, item in enumerate(ids)}
    out: dict[str, float] = {}
    for f in range(folds):
        test = np.array([fold_of[k] == f for k in g])
        clf = LogisticRegression(C=0.5, max_iter=500, class_weight="balanced").fit(X[~test], y[~test])
        s = clf.decision_function(X[test])
        gt, yt = g[test], y[test]
        for item in np.unique(gt):
            m = gt == item
            z = np.exp(s[m] - s[m].max())
            out[items[item]["id"]] = round(float((z / z.sum())[yt[m] == 1][0]), 3)
    return out


# ----------------------------------------------------------------- per-item guessing probability
import json as _json  # noqa: E402
from functools import lru_cache  # noqa: E402

GUESS_FLOOR, GUESS_CEIL = 0.25, 0.60


@lru_cache(maxsize=1)
def _guess_table() -> dict[str, float]:
    """One table for every display language. The cue audit is run per language, but a score must not change when the
    student switches ID/EN (the answer was already given), so each item takes the larger, more conservative value."""
    ids, ens = _guess_table_for("id"), _guess_table_for("en")
    return {k: max(ids.get(k, 0.0), ens.get(k, 0.0)) for k in ids.keys() | ens.keys()}


@lru_cache(maxsize=4)
def _guess_table_for(lang: str) -> dict[str, float]:
    from .config import MODELS_DIR

    path = MODELS_DIR / ("item_cue_audit_id.json" if lang == "id" else "item_cue_audit.json")
    if not path.exists():
        return {}
    return _json.loads(path.read_text(encoding="utf-8")).get("p_cue", {})


def item_guess(item_id: str) -> float:
    """Chance that a student answers this item correctly without the skill.

    Four options give 0.25. If the cue-only model finds the key more often than that, the item is easier to game and its
    answers carry less evidence: the guess-corrected score and the knowledge-tracing update use this larger value."""
    return min(GUESS_CEIL, max(GUESS_FLOOR, _guess_table().get(item_id, GUESS_FLOOR)))
