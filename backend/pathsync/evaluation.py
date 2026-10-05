"""Level-3 evaluation of the ranking model (paper III.D.2, Table 7).

* agreement with the expert reference order: NDCG@5, Kendall tau, top-3 agreement
* four baselines: largest gap, gap x demand, formula (5), generic LLM (needs credentials)
* cross-validation grouped by base scenario so a scenario and its derivatives never
  sit in both train and test; 95% CIs by bootstrapping base scenarios
* ablation: drop the graph features (U, B, R) and the trend feature (T) one at a time
* adaptivity: does the rank move in the expected direction when competency or market changes?
"""
from __future__ import annotations

import math
import random
from collections import defaultdict

import numpy as np

from .config import FEATURES, FORMULA5_WEIGHTS
from .ranker import fit_pairwise, kendall_tau, ndcg_at_k, select_l2, top3_agreement

NON_INFERIORITY = 0.01   # "minimal setara formula (5)": model NDCG@5 >= formula-5 NDCG@5 - 0.01


def logx(features: dict[str, float]) -> np.ndarray:
    return np.array([math.log(max(features[f], 1e-9)) for f in FEATURES])


def order_by_weights(scn: dict, w: dict[str, float]) -> list[str]:
    wv = np.array([w.get(f, 0.0) for f in FEATURES])
    return sorted(scn["candidates"], key=lambda c: (-(wv @ logx(scn["features"][c])), c))


def order_baseline(scn: dict, name: str) -> list[str]:
    f = scn["features"]
    if name == "kesenjangan_terbesar":
        key = lambda c: -f[c]["G"]
    elif name == "kesenjangan_x_permintaan":
        key = lambda c: -(f[c]["G"] * f[c]["D"])
    elif name == "formula5":
        key = lambda c: -(f[c]["G"] * f[c]["D"] * f[c]["T"] * f[c]["U"] * f[c]["R"])
    else:
        raise KeyError(name)
    return sorted(scn["candidates"], key=lambda c: (key(c), c))


def metrics(pred: list[str], ref: list[str]) -> dict[str, float]:
    return {"ndcg5": ndcg_at_k(pred, ref, 5), "kendall_tau": kendall_tau(pred, ref), "top3": top3_agreement(pred, ref)}


def bootstrap_ci(per_base: dict[str, float], n: int = 1000, seed: int = 0) -> tuple[float, float, float]:
    vals = list(per_base.values())
    if not vals:
        return (0.0, 0.0, 0.0)
    rng = random.Random(seed)
    means = sorted(float(np.mean([rng.choice(vals) for _ in vals])) for _ in range(n))
    return (float(np.mean(vals)), means[int(0.025 * n)], means[int(0.975 * n) - 1])


def _groups(scenarios, refs):
    return [({c: logx(s["features"][c]) for c in s["candidates"]}, refs[s["id"]]) for s in scenarios]


def cross_validate(scenarios: list[dict], refs: dict[str, list[str]], k: int = 5, features: list[str] | None = None,
                   seed: int = 0, extra_orders: dict[str, dict[str, list[str]]] | None = None) -> dict:
    """Grouped k-fold CV. Returns per-method mean metrics with bootstrap CIs and fold weights."""
    bases = sorted({s["base_id"] for s in scenarios})
    rng = random.Random(seed)
    rng.shuffle(bases)
    folds = [bases[i::k] for i in range(min(k, len(bases)))]
    per: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    per_base: dict[str, dict[str, dict[str, list[float]]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    fold_weights = []
    lambdas = []
    for test_bases in folds:
        train = [s for s in scenarios if s["base_id"] not in test_bases]
        test = [s for s in scenarios if s["base_id"] in test_bases]
        lam = select_l2(_groups(train, refs), [s["base_id"] for s in train], features=features)
        lambdas.append(lam)
        w = fit_pairwise(_groups(train, refs), l2=lam, features=features)
        fold_weights.append(w)
        for s in test:
            ref = refs[s["id"]]
            preds = {"model": order_by_weights(s, w)}
            for b in ("kesenjangan_terbesar", "kesenjangan_x_permintaan", "formula5"):
                preds[b] = order_baseline(s, b)
            for name, orders in (extra_orders or {}).items():
                if s["id"] in orders:
                    preds[name] = orders[s["id"]]
            for name, pred in preds.items():
                for m, v in metrics(pred, ref).items():
                    per[name][m].append(v)
                    per_base[name][m][s["base_id"]].append(v)
    summary = {}
    for name, ms in per.items():
        summary[name] = {}
        for m, vals in ms.items():
            pb = {b: float(np.mean(v)) for b, v in per_base[name][m].items()}
            mean, lo, hi = bootstrap_ci(pb)
            summary[name][m] = {"mean": round(mean, 4), "ci95": [round(lo, 4), round(hi, 4)], "n": len(vals)}
    avg_w = {f: round(float(np.mean([fw[f] for fw in fold_weights])), 4) for f in FEATURES}
    return {"methods": summary, "fold_weights_mean": avg_w, "n_folds": len(folds), "n_scenarios": len(scenarios),
            "n_base": len(bases), "l2_selected": lambdas}


def adaptivity(scenarios: list[dict], refs: dict[str, list[str]], w: dict[str, float]) -> dict:
    """Paper III.D.2: competency up -> that skill should drop; market up -> that skill should rise."""
    by_id = {s["id"]: s for s in scenarios}
    out = {"competency": {"n": 0, "model_moved_expected": 0, "agrees_with_experts": 0},
           "market": {"n": 0, "model_moved_expected": 0, "agrees_with_experts": 0}}
    for s in scenarios:
        if s["variant"] == "base":
            continue
        base = by_id.get(f"{s['base_id']}-base")
        sk = s["changed"].get("skill_id")
        if not base or not sk or sk not in s["candidates"]:
            continue
        key = "competency" if s["variant"] == "competency" else "market"
        out[key]["n"] += 1
        mb, md = order_by_weights(base, w), order_by_weights(s, w)
        rb, rd = mb.index(sk), md.index(sk) if sk in md else len(md)
        eb, ed = refs[base["id"]].index(sk), refs[s["id"]].index(sk) if sk in refs[s["id"]] else len(refs[s["id"]])
        expected = (rd > rb) if key == "competency" else (rd < rb)
        out[key]["model_moved_expected"] += int(expected)
        out[key]["agrees_with_experts"] += int(np.sign(rd - rb) == np.sign(ed - eb))
    for key in out:
        n = out[key]["n"] or 1
        out[key]["share_expected"] = round(out[key]["model_moved_expected"] / n, 4)
        out[key]["share_agree"] = round(out[key]["agrees_with_experts"] / n, 4)
    return out


def train_full(scenarios: list[dict], refs: dict[str, list[str]], features: list[str] | None = None) -> tuple[dict[str, float], float]:
    groups = _groups(scenarios, refs)
    lam = select_l2(groups, [s["base_id"] for s in scenarios], features=features)
    return fit_pairwise(groups, l2=lam, features=features), lam


def passes_rule(cv: dict) -> bool:
    m = cv["methods"]["model"]["ndcg5"]["mean"]
    f5 = cv["methods"]["formula5"]["ndcg5"]["mean"]
    return m >= f5 - NON_INFERIORITY


def formula5() -> dict[str, float]:
    return dict(FORMULA5_WEIGHTS)
