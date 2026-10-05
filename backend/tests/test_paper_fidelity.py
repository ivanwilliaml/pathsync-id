"""Checks that the implementation reproduces the worked examples in the paper."""
from __future__ import annotations

import math

import pytest

from pathsync.evidence import EvidenceItem, Response, bkt_update, diagnose
from pathsync.ranker import RankingModel, build_candidates, kendalls_w, ndcg_at_k
from pathsync.taxonomy import Edge, SkillGraph, load_skills
from pathsync.demand import recency_weight

# Fig. 6 sub-graph: SQL is a prerequisite of data analysis and data visualisation.
EDGES = [Edge("sql", "data_analysis"), Edge("statistics", "data_analysis"), Edge("excel", "data_analysis"),
         Edge("sql", "data_visualization"), Edge("excel", "data_visualization")]
IDS = ["sql", "data_analysis", "statistics", "data_visualization", "requirements_elicitation", "excel"]
REQ = {"sql": 0.80, "data_analysis": 0.85, "statistics": 0.75, "data_visualization": 0.80,
       "requirements_elicitation": 0.75, "excel": 0.75}
# demand values consistent with Table 4 (SQL appears in 78% of postings, Fig. 7)
DEMAND = {"sql": 0.78, "data_analysis": 0.91, "statistics": 0.55, "data_visualization": 0.80,
          "requirements_elicitation": 0.65, "excel": 0.70}


@pytest.fixture(scope="module")
def graph():
    skills = load_skills()
    return SkillGraph({k: skills[k] for k in IDS}, EDGES)


def _rank(graph, p):
    model = RankingModel()   # formula (5) weights
    cands = build_candidates(graph, p, REQ, DEMAND, {s: 1.0 for s in IDS}, {s: 0.5 for s in IDS}, IDS)
    ranked = model.rank(cands)
    return [(c.skill_id, round(model.multiplicative(sc), 2)) for c, sc in ranked]


def test_table4_cycle1(graph):
    p = {"sql": 0.35, "data_analysis": 0.30, "statistics": 0.60, "data_visualization": 0.45,
         "requirements_elicitation": 0.55, "excel": 0.80}
    ranked = _rank(graph, p)
    assert [s for s, _ in ranked] == ["sql", "data_analysis", "statistics", "data_visualization", "requirements_elicitation"]
    scores = dict(ranked)
    assert scores["sql"] == pytest.approx(0.95, abs=0.01)
    assert scores["data_analysis"] == pytest.approx(0.25, abs=0.01)
    assert scores["data_visualization"] == pytest.approx(0.14, abs=0.01)
    assert scores["requirements_elicitation"] == pytest.approx(0.13, abs=0.01)
    assert "excel" not in scores          # no gap -> not ranked (score 0 in the paper)


def test_table4_cycle2_after_sql_reassessment(graph):
    p = {"sql": 0.72, "data_analysis": 0.30, "statistics": 0.60, "data_visualization": 0.45,
         "requirements_elicitation": 0.55, "excel": 0.80}
    ranked = _rank(graph, p)
    order = [s for s, _ in ranked]
    assert order[:3] == ["data_analysis", "data_visualization", "sql"]
    scores = dict(ranked)
    assert scores["sql"] == pytest.approx(0.17, abs=0.01)
    assert scores["data_analysis"] == pytest.approx(0.49, abs=0.02)
    assert scores["data_visualization"] == pytest.approx(0.28, abs=0.01)


def test_formula5_is_special_case_of_eq4(graph):
    p = {"sql": 0.35, "data_analysis": 0.30, "statistics": 0.60, "data_visualization": 0.45,
         "requirements_elicitation": 0.55, "excel": 0.80}
    cands = build_candidates(graph, p, REQ, DEMAND, {s: 1.0 for s in IDS}, {s: 0.5 for s in IDS}, IDS)
    m = RankingModel()
    for c in cands:
        assert math.exp(m.score(c)) == pytest.approx(c.G * c.D * c.T * c.U * c.R, rel=1e-9)


def test_bkt_gradual_update():
    p = 0.35
    p1 = bkt_update(p, True)
    assert p < p1 < 1.0
    assert bkt_update(p, False) < p + 0.1        # a wrong answer cannot raise mastery much


def test_equation2_weighted_average_and_self_rating_excluded():
    ev = [EvidenceItem("academic", "Basis Data (A)", {"sql": 1.0}),
          EvidenceItem("project", "Analisis penjualan", {"sql": 0.70})]
    resp = [Response("sql", True, "diagnostic"), Response("sql", False, "diagnostic")]
    st = diagnose(["sql"], ev, resp, self_ratings={"sql": 5})["sql"]
    e_assess = (1 + 1) / (2 + 2)
    expected = (0.2 * 1.0 + 0.3 * 0.7 + 0.5 * e_assess) / (0.2 + 0.3 + 0.5)
    assert st.p0 == pytest.approx(expected)
    assert st.self_rating == 5 and "self" not in st.components


def test_recency_weight_half_life():
    assert recency_weight(6) == pytest.approx(0.5)
    assert recency_weight(0) == pytest.approx(1.0)


def test_metrics():
    ideal = list("abcdefgh")
    assert ndcg_at_k(ideal, ideal) == pytest.approx(1.0)
    assert kendalls_w([ideal, ideal, ideal]) == pytest.approx(1.0)
