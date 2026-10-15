"""Plan C4: health checks the database and the market snapshot age, the admin runtime view reports
p95 and error rate per route template, and log lines are JSON when asked."""
from __future__ import annotations

import json
import logging

import pytest
from conftest import ADMIN_TOKEN, HAVE_DB

from pathsync.observability import JsonFormatter, RouteStats

pytestmark = pytest.mark.skipif(not HAVE_DB, reason="run pipeline.build_market and pipeline.expert_study first")
ADMIN = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def test_health_reports_database_and_market_age(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] and j["database"] == "ok"
    assert isinstance(j["market_age_days"], int) and j["market_max_age_days"] == 45
    assert j["market_stale"] == (j["market_age_days"] > 45)


def test_runtime_view_groups_by_route_template(client):
    from pathsync.observability import STATS

    STATS.reset()
    for _ in range(3):
        client.get("/api/postings/does-not-exist")
    client.get("/api/meta")
    r = client.get("/api/admin/runtime", headers=ADMIN)
    assert r.status_code == 200
    routes = r.json()["routes"]
    assert any(k.startswith("GET /api/postings/{") for k in routes), routes   # ids never become separate routes
    assert routes["GET /api/meta"]["requests"] == 1 and "p95_ms" in routes["GET /api/meta"]
    assert client.get("/api/admin/runtime").status_code == 401


def test_route_stats_and_json_formatter():
    st = RouteStats()
    for ms in range(1, 101):
        st.record("GET /x", 200 if ms < 100 else 500, float(ms))
    snap = st.snapshot()["GET /x"]
    assert snap["requests"] == 100 and snap["errors_5xx"] == 1 and snap["p95_ms"] == 96.0
    rec = logging.LogRecord("pathsync", logging.INFO, __file__, 1, '{"rid":"abc","status":200}', None, None)
    line = json.loads(JsonFormatter().format(rec))
    assert line["rid"] == "abc" and line["status"] == 200 and line["level"] == "INFO"
