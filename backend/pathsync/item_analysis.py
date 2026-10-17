"""Calibrating the assessment from real answers (plan A5).

* classical item analysis: proportion correct, point-biserial against the rest of the same skill,
  distractor shares; flags by the rule written in the plan (p outside 0.20-0.90, r < 0.15, a
  distractor chosen by fewer than 5% of answers)
* reliability per skill: KR-20, and the Spearman-Brown length needed for 0.6
* empirical difficulty: a Rasch model fitted by joint maximum likelihood, compared with the
  difficulty the item author wrote
* BKT slip / guess / learn re-estimated by grid search on next-answer log loss, starting from the
  current constants

Nothing here changes the live assessment until `pipeline.calibrate_items` finds enough answers
(MIN_ANSWERS_PER_ITEM) and writes data/models/item_calibration.json.
"""
from __future__ import annotations

import math
from collections import defaultdict
from itertools import product

import numpy as np

P_RANGE = (0.20, 0.90)
MIN_DISCRIMINATION = 0.15
DEAD_DISTRACTOR_SHARE = 0.05
MIN_ANSWERS_PER_ITEM = 30
KR20_TARGET = 0.6


def item_stats(rows: list[tuple], min_n: int = 20) -> list[dict]:
    """rows: (student_id, item_id, skill_id, correct, choice_canon). choice_canon 0 is the key."""
    by_ss: dict[tuple[str, str], list[tuple[str, bool]]] = defaultdict(list)
    per_item: dict[str, dict] = {}
    for sid, iid, skill, ok, canon in rows:
        by_ss[(sid, skill)].append((iid, bool(ok)))
        d = per_item.setdefault(iid, {"skill_id": skill, "n": 0, "right": 0, "choices": defaultdict(int), "pairs": []})
        d["n"] += 1
        d["right"] += bool(ok)
        if canon is not None:
            d["choices"][int(canon)] += 1
    for answers in by_ss.values():                    # rest score: the same student's other items of this skill
        for iid, ok in answers:
            rest = [o for j, o in answers if j != iid]
            if rest:
                per_item[iid]["pairs"].append((float(ok), sum(rest) / len(rest)))
    out = []
    for iid, d in per_item.items():
        p = d["right"] / d["n"]
        xs = [a for a, _ in d["pairs"]]
        ys = [b for _, b in d["pairs"]]
        r = float(np.corrcoef(xs, ys)[0, 1]) if len(xs) >= 3 and len(set(xs)) > 1 and len(set(ys)) > 1 else None
        wrong = {k: v for k, v in d["choices"].items() if k != 0}
        total = sum(d["choices"].values())
        shares = {str(k): round(d["choices"].get(k, 0) / total, 3) for k in range(4)} if total else {}
        flags = []
        if d["n"] >= min_n:
            if not P_RANGE[0] <= p <= P_RANGE[1]:
                flags.append("p_out_of_range")
            if r is not None and r < MIN_DISCRIMINATION:
                flags.append("low_discrimination")
            if total and any(wrong.get(k, 0) / total < DEAD_DISTRACTOR_SHARE for k in (1, 2, 3)):
                flags.append("dead_distractor")
        out.append({"item_id": iid, "skill_id": d["skill_id"], "n": d["n"], "p_correct": round(p, 3),
                    "point_biserial": None if r is None else round(r, 3), "choice_shares": shares, "flags": flags})
    out.sort(key=lambda x: (-len(x["flags"]), x["item_id"]))
    return out


def kr20(matrix: np.ndarray) -> float | None:
    """KR-20 for a students x items 0/1 matrix with no missing cells."""
    n_items = matrix.shape[1]
    if matrix.shape[0] < 2 or n_items < 2:
        return None
    p = matrix.mean(axis=0)
    var = matrix.sum(axis=1).var(ddof=1)
    if var == 0:
        return None
    return float(n_items / (n_items - 1) * (1 - (p * (1 - p)).sum() / var))


def spearman_brown_items(r: float, n_items: int, target: float = KR20_TARGET) -> int | None:
    """Items needed to reach `target` reliability if items like the current ones were added."""
    if r is None or r <= 0 or r >= target:
        return None if r is None or r <= 0 else n_items
    k = target * (1 - r) / (r * (1 - target))
    return math.ceil(k * n_items)


def reliability_by_skill(rows: list[tuple]) -> dict[str, dict]:
    """KR-20 per skill over students who answered every item of that skill that anyone answered often."""
    by_skill: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(dict))
    for sid, iid, skill, ok, _ in rows:
        by_skill[skill][sid][iid] = int(bool(ok))
    out = {}
    for skill, students in by_skill.items():
        items = sorted({i for a in students.values() for i in a})
        full = [a for a in students.values() if all(i in a for i in items)]
        m = np.array([[a[i] for i in items] for a in full]) if full else np.zeros((0, len(items)))
        r = kr20(m) if len(full) >= 5 else None
        out[skill] = {"n_students": len(full), "n_items": len(items), "kr20": None if r is None else round(r, 3),
                      "items_for_0.6": spearman_brown_items(r, len(items)) if r is not None else None,
                      "indicative_only": r is None or r < KR20_TARGET}
    return out


def fit_rasch(rows: list[tuple], iters: int = 200, tol: float = 1e-5) -> tuple[dict[str, float], dict[str, float]]:
    """Joint maximum likelihood Rasch fit. Returns (item difficulty b, person ability theta), item
    difficulties centred at 0. Perfect and zero scores are pulled in by a half-point correction."""
    people = sorted({r[0] for r in rows})
    items = sorted({r[1] for r in rows})
    pi = {p: i for i, p in enumerate(people)}
    ii = {t: i for i, t in enumerate(items)}
    pidx, iidx = np.array([pi[r[0]] for r in rows]), np.array([ii[r[1]] for r in rows])
    y = np.array([float(bool(r[3])) for r in rows])
    theta, b = np.zeros(len(people)), np.zeros(len(items))
    n_p = np.bincount(pidx, minlength=len(people)).astype(float)
    n_i = np.bincount(iidx, minlength=len(items)).astype(float)
    s_p = np.clip(np.bincount(pidx, weights=y, minlength=len(people)), 0.5, n_p - 0.5)
    s_i = np.clip(np.bincount(iidx, weights=y, minlength=len(items)), 0.5, n_i - 0.5)
    for _ in range(iters):
        pr = 1 / (1 + np.exp(-(theta[pidx] - b[iidx])))
        w = pr * (1 - pr)
        d_theta = (s_p - np.bincount(pidx, weights=pr, minlength=len(people))) / np.maximum(np.bincount(pidx, weights=w, minlength=len(people)), 1e-6)
        theta += np.clip(d_theta, -1, 1)
        pr = 1 / (1 + np.exp(-(theta[pidx] - b[iidx])))
        w = pr * (1 - pr)
        d_b = (np.bincount(iidx, weights=pr, minlength=len(items)) - s_i) / np.maximum(np.bincount(iidx, weights=w, minlength=len(items)), 1e-6)
        b += np.clip(d_b, -1, 1)
        b -= b.mean()
        if max(np.abs(d_theta).max(), np.abs(d_b).max()) < tol:
            break
    return {t: round(float(b[ii[t]]), 4) for t in items}, {p: round(float(theta[pi[p]]), 4) for p in people}


def item_information(theta: float, b: float) -> float:
    p = 1 / (1 + math.exp(-(theta - b)))
    return p * (1 - p)


def theta_from_mastery(p: float) -> float:
    """Map a mastery probability onto the Rasch scale (logit), clipped to a sensible range."""
    p = min(0.97, max(0.03, p))
    return math.log(p / (1 - p))


def bkt_log_loss(sequences: list[list[bool]], slip: float, guess: float, transit: float, prior: float) -> float:
    """Mean log loss of predicting each answer from the BKT state before it (plan A5 step 6)."""
    from .evidence import bkt_update

    loss, n = 0.0, 0
    for seq in sequences:
        p = prior
        for ok in seq:
            pc = p * (1 - slip) + (1 - p) * guess
            pc = min(1 - 1e-6, max(1e-6, pc))
            loss -= math.log(pc if ok else 1 - pc)
            n += 1
            p = bkt_update(p, ok, slip, guess, transit)
    return loss / n if n else float("nan")


def fit_bkt(sequences: list[list[bool]], prior: float, start: tuple[float, float, float]) -> dict:
    """Grid search around the literature constants; keeps them unless a fit lowers held-out loss."""
    grid = {"slip": [0.05, 0.10, 0.15, 0.20], "guess": [0.15, 0.20, 0.25, 0.30, 0.35], "transit": [0.05, 0.10, 0.15, 0.25]}
    cut = max(1, int(len(sequences) * 0.7))
    train, test = sequences[:cut], sequences[cut:] or sequences
    best = min(product(grid["slip"], grid["guess"], grid["transit"]),
               key=lambda g: bkt_log_loss(train, g[0], g[1], g[2], prior))
    before = bkt_log_loss(test, *start, prior)
    after = bkt_log_loss(test, *best, prior)
    return {"start": dict(zip(("slip", "guess", "transit"), start, strict=True)),
            "fitted": dict(zip(("slip", "guess", "transit"), best, strict=True)),
            "held_out_log_loss": {"start": round(before, 4), "fitted": round(after, 4)},
            "use_fitted": after < before, "n_sequences": len(sequences)}
