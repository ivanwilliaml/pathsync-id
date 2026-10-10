"""Dynamic skill-demand map (paper III.A.1, eq. 1 and Table 3).

    D_s = sum_j w_j x_js / sum_j w_j ,   w_j = 0.5 ** (a_j / 6)

a_j is the posting age in months. The trend g_s is the relative change of the
share of postings mentioning s in the last 6 months versus the 6 months before;
it is clipped to [-0.5, 0.5] and enters the ranker as T_s = 1 + lambda * g_s.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from datetime import date

from .config import (
    DEMAND_HALF_LIFE_MONTHS,
    DEMAND_WINDOW_MONTHS,
    REQUIRED_MAX,
    REQUIRED_MIN,
    TREND_CLIP,
    TREND_LAMBDA,
    TREND_MIN_POSTINGS,
    TREND_WINDOW_MONTHS,
)


def months_between(a: date, b: date) -> float:
    return (b - a).days / 30.4375


def recency_weight(age_months: float) -> float:
    return 0.5 ** (max(age_months, 0.0) / DEMAND_HALF_LIFE_MONTHS)


def wilson(k: float, n: float, z: float = 1.96) -> tuple[float, float]:
    if n <= 0:
        return (0.0, 0.0)
    p = k / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


@dataclass
class PostingSkills:
    posting_id: str
    published: date
    skills: set[str]


@dataclass
class SkillDemand:
    skill_id: str
    demand: float            # D_s (recency weighted share)
    share: float             # unweighted share
    count: int               # postings mentioning s
    ci_low: float
    ci_high: float
    trend: float             # g_s, clipped
    trend_factor: float      # T_s
    recent_share: float | None = None
    previous_share: float | None = None


@dataclass
class MarketMap:
    role: str
    reference_date: str
    n_postings: int
    n_recent: int
    n_previous: int
    trend_status: str        # ok | insufficient
    skills: dict[str, SkillDemand] = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["skills"] = {k: asdict(v) for k, v in self.skills.items()}
        return d

    @classmethod
    def from_dict(cls, d: dict) -> MarketMap:
        m = cls(**{k: v for k, v in d.items() if k != "skills"})
        m.skills = {k: SkillDemand(**v) for k, v in d.get("skills", {}).items()}
        return m

    def D(self, s: str) -> float:
        return self.skills[s].demand if s in self.skills else 0.0

    def T(self, s: str) -> float:
        return self.skills[s].trend_factor if s in self.skills else 1.0


def compute_market(postings: list[PostingSkills], skill_ids: list[str], role: str, ref: date) -> MarketMap:
    window = [p for p in postings if 0 <= months_between(p.published, ref) <= DEMAND_WINDOW_MONTHS]
    n = len(window)
    weights = [recency_weight(months_between(p.published, ref)) for p in window]
    wsum = sum(weights) or 1.0
    recent = [p for p in window if months_between(p.published, ref) <= TREND_WINDOW_MONTHS]
    previous = [p for p in window if months_between(p.published, ref) > TREND_WINDOW_MONTHS]
    trend_ok = len(recent) >= TREND_MIN_POSTINGS and len(previous) >= TREND_MIN_POSTINGS
    mm = MarketMap(role=role, reference_date=ref.isoformat(), n_postings=n, n_recent=len(recent),
                   n_previous=len(previous), trend_status="ok" if trend_ok else "insufficient")
    for s in skill_ids:
        k = sum(1 for p in window if s in p.skills)
        d = sum(w for p, w in zip(window, weights, strict=False) if s in p.skills) / wsum if n else 0.0
        lo, hi = wilson(k, n)
        g, rs, ps = 0.0, None, None
        if recent or previous:
            rs = sum(1 for p in recent if s in p.skills) / len(recent) if recent else None
            ps = sum(1 for p in previous if s in p.skills) / len(previous) if previous else None
        if trend_ok and ps:
            g = max(-TREND_CLIP, min(TREND_CLIP, (rs - ps) / ps))
        elif trend_ok and rs and not ps:
            g = TREND_CLIP                      # newly appearing skill
        mm.skills[s] = SkillDemand(s, round(d, 4), round(k / n, 4) if n else 0.0, k, round(lo, 4), round(hi, 4),
                                   round(g, 4), round(1 + TREND_LAMBDA * g, 4),
                                   None if rs is None else round(rs, 4), None if ps is None else round(ps, 4))
    return mm


def required_levels(market: MarketMap, esco_status: dict[str, str], overrides: dict[str, float] | None = None) -> dict[str, float]:
    """r_s in [0.60, 0.85] from ESCO essential/optional status and posting frequency (paper III.A.4).

    r_s = 0.60 + 0.25 * (0.5 * esco + 0.5 * D_s / max D), esco = 1 essential, 0.5 optional, 0 otherwise.
    Expert-confirmed values in `overrides` take precedence.
    """
    maxd = max((sd.demand for sd in market.skills.values()), default=0.0) or 1.0
    out = {}
    for s, sd in market.skills.items():
        e = {"essential": 1.0, "optional": 0.5}.get(esco_status.get(s, ""), 0.0)
        r = REQUIRED_MIN + (REQUIRED_MAX - REQUIRED_MIN) * (0.5 * e + 0.5 * sd.demand / maxd)
        out[s] = round(min(REQUIRED_MAX, max(REQUIRED_MIN, r)), 3)
    if overrides:
        out.update({k: float(v) for k, v in overrides.items() if k in out})
    return out


def apply_market_shift(market: MarketMap, skill_id: str, demand_delta: float = 0.0, trend: float | None = None) -> MarketMap:
    """Scenario helper for the 'market changed' derivative (evaluation and admin simulation)."""
    m = MarketMap.from_dict(market.to_dict())
    sd = m.skills[skill_id]
    sd.demand = round(min(1.0, max(0.0, sd.demand + demand_delta)), 4)
    if trend is not None:
        sd.trend = max(-TREND_CLIP, min(TREND_CLIP, trend))
        sd.trend_factor = round(1 + TREND_LAMBDA * sd.trend, 4)
    return m
