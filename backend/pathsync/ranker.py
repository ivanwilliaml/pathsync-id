"""Bottleneck-aware learning-to-rank model (paper III.A.4, Table 3, eq. 4-5).

Features per skill s that still has a gap:
  G  gap               max(0, r_s - p_s)
  R  readiness         1 if every prerequisite has p >= 0.6, else 0.5
  K  confidence        evidence confidence (floored at 0.03)
  D  demand            recency-weighted share of target-role postings (floored at 0.03)
  T  trend             1 + lambda * g_s
  U  unlock value      1 + sum of D over downstream skills (s is their direct prerequisite) that still have a gap
  B  downstream block  1 + sum of D * G over those same downstream skills

Score  f_s = sum_i w_i * log x_si                                  (eq. 4)
Formula (5) G*D*T*U*R is the special case w = 1 for those five, 0 for K and B.
Weights are learned from expert pairwise orders with a logistic loss regularised
towards the formula-(5) weights, so that with little data the model stays close to it.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize

from .config import FEATURE_FLOOR, FEATURES, FORMULA5_WEIGHTS, RANKER_L2, READINESS_THRESHOLD
from .taxonomy import SkillGraph

WEIGHT_BOUNDS = {"G": (0.0, 3.0), "R": (0.0, 3.0), "K": (-1.0, 1.0), "D": (0.0, 3.0), "T": (0.0, 3.0),
                 "U": (0.0, 3.0), "B": (0.0, 3.0)}


@dataclass
class Candidate:
    skill_id: str
    G: float
    R: float
    K: float
    D: float
    T: float
    U: float
    B: float
    blocked_by: list[str]
    unlocks: list[str]

    def x(self) -> dict[str, float]:
        return {"G": self.G, "R": self.R, "K": max(self.K, FEATURE_FLOOR), "D": max(self.D, FEATURE_FLOOR),
                "T": self.T, "U": self.U, "B": self.B}

    def logx(self) -> np.ndarray:
        x = self.x()
        return np.array([math.log(max(x[f], 1e-9)) for f in FEATURES])


def build_candidates(graph: SkillGraph, p: dict[str, float], req: dict[str, float], demand: dict[str, float],
                     trend: dict[str, float], confidence: dict[str, float], skill_ids: list[str] | None = None) -> list[Candidate]:
    """Feature vectors for every skill that still has a gap (paper Table 3)."""
    ids = skill_ids or list(graph.skills)
    gap = {s: max(0.0, req.get(s, 0.0) - p.get(s, 0.0)) for s in graph.skills}
    out = []
    for s in ids:
        if gap.get(s, 0.0) <= 1e-9:
            continue
        blocked_by = [q for q in graph.prereqs.get(s, []) if p.get(q, 0.0) < READINESS_THRESHOLD]
        # downstream = skills for which s is a direct prerequisite ("prasyarat bagi keterampilan lain
        # yang masih kurang"); using the transitive closure would let generic root skills dominate.
        downstream = [t for t in graph.dependents.get(s, []) if gap.get(t, 0.0) > 1e-9 and demand.get(t, 0.0) > 0]
        out.append(Candidate(
            skill_id=s, G=gap[s], R=1.0 if not blocked_by else 0.5, K=confidence.get(s, 0.0),
            D=demand.get(s, 0.0), T=trend.get(s, 1.0),
            U=1.0 + sum(demand.get(t, 0.0) for t in downstream),
            B=1.0 + sum(demand.get(t, 0.0) * gap[t] for t in downstream),
            blocked_by=blocked_by, unlocks=sorted(downstream, key=lambda t: -demand.get(t, 0.0)),
        ))
    return out


class RankingModel:
    def __init__(self, weights: dict[str, float] | None = None, name: str = "formula5"):
        self.weights = dict(weights or FORMULA5_WEIGHTS)
        self.name = name

    @property
    def w(self) -> np.ndarray:
        return np.array([self.weights.get(f, 0.0) for f in FEATURES])

    def score(self, c: Candidate) -> float:
        return float(self.w @ c.logx())

    def contributions(self, c: Candidate) -> dict[str, float]:
        lx = c.logx()
        return {f: round(float(self.weights.get(f, 0.0) * lx[i]), 4) for i, f in enumerate(FEATURES)}

    def rank(self, cands: list[Candidate]) -> list[tuple[Candidate, float]]:
        scored = [(c, self.score(c)) for c in cands]
        return sorted(scored, key=lambda t: (-t[1], t[0].skill_id))

    @staticmethod
    def multiplicative(score: float) -> float:
        """exp(f) - equals the formula-(5) product when the weights are formula-5 weights."""
        return math.exp(score)


# ------------------------------------------------------------------ training
def pairs_from_order(order: list[str]) -> list[tuple[str, str]]:
    return [(order[i], order[j]) for i in range(len(order)) for j in range(i + 1, len(order))]


L2_GRID = (1.0, 0.2, 0.05, 0.01)


def select_l2(groups: list[tuple[dict[str, np.ndarray], list[str]]], group_ids: list[str],
              features: list[str] | None = None, k: int = 4) -> float:
    """Pick the regularisation strength by inner cross-validation grouped by base scenario."""
    bases = sorted(set(group_ids))
    if len(bases) < 3:
        return RANKER_L2
    folds = [bases[i::k] for i in range(min(k, len(bases)))]
    best, best_score = RANKER_L2, -1.0
    for lam in L2_GRID:
        scores = []
        for test in folds:
            train = [g for g, b in zip(groups, group_ids) if b not in test]
            evalg = [g for g, b in zip(groups, group_ids) if b in test]
            w = fit_pairwise(train, l2=lam, features=features)
            wv = np.array([w[f] for f in FEATURES])
            for feats, order in evalg:
                pred = sorted(order, key=lambda c: -(wv @ feats[c]))
                scores.append(ndcg_at_k(pred, order, 5))
        sc = float(np.mean(scores)) if scores else 0.0
        if sc > best_score + 1e-9:
            best, best_score = lam, sc
    return best


def fit_pairwise(groups: list[tuple[dict[str, np.ndarray], list[str]]], l2: float = RANKER_L2,
                 prior: dict[str, float] | None = None, features: list[str] | None = None) -> dict[str, float]:
    """Pairwise logistic loss (RankNet-style) with L2 pull towards the formula-(5) weights.

    groups: [(features_by_skill {skill: logx vector}, expert_order [skill, ...]), ...]
    features: optional subset of FEATURES to keep (others fixed at 0) - used for ablations.
    """
    prior = dict(prior or FORMULA5_WEIGHTS)
    active = [f for f in FEATURES if features is None or f in features]
    idx = [FEATURES.index(f) for f in active]
    diffs = []
    for feats, order in groups:
        for a, b in pairs_from_order(order):
            if a in feats and b in feats:
                diffs.append(feats[a][idx] - feats[b][idx])
    if not diffs:
        return {f: (prior.get(f, 0.0) if f in active else 0.0) for f in FEATURES}
    X = np.vstack(diffs)
    w0 = np.array([prior.get(f, 0.0) for f in active])

    def loss(w):
        m = X @ w
        val = np.mean(np.logaddexp(0.0, -m)) + l2 * np.sum((w - w0) ** 2) / len(active)
        sig = 1.0 / (1.0 + np.exp(m))
        grad = -(X * sig[:, None]).mean(axis=0) + 2 * l2 * (w - w0) / len(active)
        return val, grad

    res = minimize(loss, w0, jac=True, method="L-BFGS-B", bounds=[WEIGHT_BOUNDS[f] for f in active])
    out = {f: 0.0 for f in FEATURES}
    out.update({f: round(float(v), 4) for f, v in zip(active, res.x)})
    return out


# ------------------------------------------------------------------- metrics
def ndcg_at_k(pred: list[str], ideal: list[str], k: int = 5) -> float:
    """Graded relevance from the expert order: first item has relevance n, last has 1."""
    n = len(ideal)
    rel = {s: n - i for i, s in enumerate(ideal)}
    dcg = sum((2 ** rel.get(s, 0) - 1) / math.log2(i + 2) for i, s in enumerate(pred[:k]))
    idcg = sum((2 ** rel[s] - 1) / math.log2(i + 2) for i, s in enumerate(ideal[:k]))
    return dcg / idcg if idcg else 0.0


def kendall_tau(pred: list[str], ideal: list[str]) -> float:
    pos_p = {s: i for i, s in enumerate(pred)}
    items = [s for s in ideal if s in pos_p]
    conc = disc = 0
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            a, b = items[i], items[j]
            if pos_p[a] < pos_p[b]:
                conc += 1
            else:
                disc += 1
    tot = conc + disc
    return (conc - disc) / tot if tot else 0.0


def top3_agreement(pred: list[str], ideal: list[str]) -> float:
    return len(set(pred[:3]) & set(ideal[:3])) / 3.0


def kendalls_w(orders: list[list[str]]) -> float:
    """Kendall's coefficient of concordance among m raters ranking the same n items."""
    m = len(orders)
    if m < 2:
        return 1.0
    items = orders[0]
    n = len(items)
    ranks = np.array([[o.index(s) + 1 for s in items] for o in orders], dtype=float)
    R = ranks.sum(axis=0)
    S = float(((R - R.mean()) ** 2).sum())
    return 12 * S / (m ** 2 * (n ** 3 - n)) if n > 1 else 1.0


def aggregate_orders(orders: list[list[str]]) -> list[str]:
    """Merge expert orders by mean rank (paper III.A.4)."""
    items = orders[0]
    mean_rank = {s: float(np.mean([o.index(s) for o in orders])) for s in items}
    return sorted(items, key=lambda s: (mean_rank[s], s))
