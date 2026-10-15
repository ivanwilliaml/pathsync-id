"""Expert-study machinery (paper III.A.4, III.D.2; plan A4 and C5): scenario generation per role,
simulated experts, grouped CV, adaptivity and the real-expert decision rule."""
from __future__ import annotations

import numpy as np
import pytest
from conftest import HAVE_DB

from pathsync.evaluation import (
    EXPERT_MARGIN,
    adaptivity,
    bootstrap_ci,
    cross_validate,
    leave_one_expert_out,
    metrics,
    passes_rule,
    train_full,
)
from pathsync.scenarios import STYLES, archetypes_for, build_scenarios, simulate_expert

pytestmark = pytest.mark.skipif(not HAVE_DB, reason="run pipeline.build_market and pipeline.expert_study first")


@pytest.fixture(scope="module")
def ctx():
    from pathsync.db import SessionLocal
    from pathsync.engine import load_context

    with SessionLocal() as s:
        return {r: load_context(s, r) for r in ("business_analyst", "data_analyst")}


@pytest.fixture(scope="module")
def ba(ctx):
    c = ctx["business_analyst"]
    return build_scenarios(c.graph, c.market, c.req, n_base=6, seed=3)


def test_each_base_has_two_derivatives_that_change_one_thing(ba):
    by_base: dict[str, dict[str, dict]] = {}
    for s in ba:
        by_base.setdefault(s["base_id"], {})[s["variant"]] = s
        assert 6 <= len(s["candidates"]) <= 8
    for b, v in by_base.items():
        assert set(v) == {"base", "competency", "market"}, b
        comp, mkt, base = v["competency"]["changed"], v["market"]["changed"], v["base"]
        assert comp["p_to"] >= comp["p_from"]
        assert mkt["D_to"] > mkt["D_from"]
        sk = mkt["skill_id"]
        assert v["market"]["market"][sk]["D"] > base["market"][sk]["D"]


def test_scenarios_are_reproducible_and_role_aware(ctx, ba):
    c = ctx["business_analyst"]
    assert build_scenarios(c.graph, c.market, c.req, n_base=6, seed=3) == ba
    d = ctx["data_analyst"]
    profiles, biases = archetypes_for(d.graph, d.market, "data_analyst")
    assert len(profiles) == 5 and all(b == {} for b in biases.values())
    da = build_scenarios(d.graph, d.market, d.req, n_base=5, seed=3, role="data_analyst", id_prefix="data_analyst:")
    assert da and all(s["id"].startswith("data_analyst:S") for s in da)
    assert max(len(s["id"]) for s in da) <= 40                     # fits Scenario.id


def test_simulated_experts_follow_their_style(ba):
    rng = np.random.default_rng(0)
    s = ba[0]
    noiseless = simulate_expert(s, "kesenjangan_permintaan", rng, noise=0.0)
    gd = sorted(s["candidates"], key=lambda c: -(np.log(s["features"][c]["G"]) + np.log(s["features"][c]["D"])))
    assert noiseless == gd
    assert set(STYLES) == {"titik_hambat", "kesenjangan_permintaan", "kesiapan"}


def test_cross_validation_baselines_and_rule(ba):
    rng = np.random.default_rng(1)
    refs = {s["id"]: simulate_expert(s, "titik_hambat", rng, noise=0.05) for s in ba}
    cv = cross_validate(ba, refs, k=3)
    assert {"model", "formula5", "kesenjangan_terbesar", "kesenjangan_x_permintaan"} <= set(cv["methods"])
    for m in cv["methods"].values():
        lo, hi = m["ndcg5"]["ci95"]
        assert 0.0 <= lo <= m["ndcg5"]["mean"] <= hi <= 1.0
    assert cv["n_base"] == 6 and cv["n_folds"] == 3
    assert passes_rule(cv) == (cv["methods"]["model"]["ndcg5"]["mean"] >= cv["methods"]["formula5"]["ndcg5"]["mean"] - 0.01)
    w, _ = train_full(ba, refs)
    ad = adaptivity(ba, refs, w)
    assert ad["competency"]["n"] >= 1 and 0.0 <= ad["competency"]["share_expected"] <= 1.0


def test_leave_one_expert_out_needs_a_clear_margin(ba):
    rng = np.random.default_rng(2)
    same = {f"e{i}": {s["id"]: simulate_expert(s, "kesenjangan_permintaan", rng, noise=0.05) for s in ba} for i in range(3)}
    r = leave_one_expert_out(ba, same, k=3, n_boot=300)
    assert r["n_experts"] == 3 and r["n_units"] == 18
    assert r["diff_ci95"][0] <= r["diff"] <= r["diff_ci95"][1]
    assert r["passes"] == (r["diff"] >= EXPERT_MARGIN and r["diff_ci95"][0] > 0)
    assert leave_one_expert_out(ba, {"only": same["e0"]})["status"] == "needs at least two experts"


def test_metric_helpers():
    m = metrics(["a", "b", "c", "d", "e"], ["a", "b", "c", "d", "e"])
    assert m["ndcg5"] == pytest.approx(1.0) and m["kendall_tau"] == pytest.approx(1.0) and m["top3"] == pytest.approx(1.0)
    mean, lo, hi = bootstrap_ci({"x": 0.5, "y": 0.7, "z": 0.9}, n=200)
    assert lo <= mean <= hi and mean == pytest.approx(0.7)
