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


def test_health_is_liveness_and_runtime_reports_market_age(client):
    """/api/health only says the process answers (container healthcheck); the database and market age are in
    /api/health/ready and in the admin runtime view."""
    assert client.get("/api/health").json() == {"ok": True}
    r = client.get("/api/admin/runtime", headers=ADMIN).json()["health"]
    assert r["ok"] and r["database"] == "ok"
    assert isinstance(r["market_age_days"], int) and r["market_max_age_days"] == 45
    assert r["market_stale"] == (r["market_age_days"] > 45)


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


def test_fast_json_matches_fastapi_encoding(client):
    """Plan B4: the dashboard skips jsonable_encoder; the bytes must decode to the same document."""
    from fastapi.encoders import jsonable_encoder

    from api.common import recommend_for
    from pathsync.db import SessionLocal, Student

    r = client.post("/api/students", json={"display_name": "B4", "target_role": "business_analyst", "consent": True}).json()
    h = {"Authorization": f"Bearer {r['token']}"}
    got = client.get(f"/api/students/{r['id']}/dashboard", headers=h)
    assert got.status_code == 200 and got.headers["content-type"].startswith("application/json")
    with SessionLocal() as s:
        want = jsonable_encoder({**recommend_for(s, s.get(Student, r["id"])), "study_arm": None})
    assert got.json() == want


def test_integrity_race_is_a_409_not_a_500(client):
    """Plan B4: under load a transcript could land just after its profile was deleted; that is a conflict."""
    from sqlalchemy.exc import IntegrityError

    from api.main import app

    @app.get("/api/__test_integrity")
    def boom():
        raise IntegrityError("insert", {}, Exception("fk"))
    try:
        r = client.get("/api/__test_integrity")
        assert r.status_code == 409 and "ref" in r.json()["detail"]
    finally:
        app.router.routes[:] = [rt for rt in app.router.routes if getattr(rt, "path", "") != "/api/__test_integrity"]
