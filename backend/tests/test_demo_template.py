"""The demo profile is built once as a template and copied per click (api.routers.demo)."""
import pytest
from sqlalchemy import func, select

from pathsync.db import AssessmentResponse, AssessmentSession, Evidence, RecommendationHistory, Student, WeeklyPlan, get_session


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def test_demo_clicks_copy_the_template(client):
    a, b = client.post("/api/demo/profile").json(), client.post("/api/demo/profile").json()
    assert a["id"] != b["id"] and a["token"] != b["token"]
    with get_session() as s:
        for model in (Evidence, AssessmentSession, AssessmentResponse, RecommendationHistory, WeeklyPlan):
            counts = [s.scalar(select(func.count()).select_from(model).where(model.student_id == x["id"])) for x in (a, b)]
            assert counts[0] == counts[1] > 0, (model.__name__, counts)
        sessions = {r.id for r in s.scalars(select(AssessmentSession).where(AssessmentSession.student_id == b["id"]))}
        assert {r.session_id for r in s.scalars(select(AssessmentResponse).where(AssessmentResponse.student_id == b["id"]))} <= sessions
        st = s.get(Student, b["id"])
        assert st.consent_version == "demo" and "template" not in st.preferences
    r = client.get(f"/api/students/{b['id']}/dashboard", headers={"Authorization": f"Bearer {b['token']}"})
    assert r.status_code == 200


def test_template_is_outside_the_two_day_demo_rule(client):
    """retention deletes consent_version == "demo" after DEMO_PROFILE_DAYS; the template must not match, or every
    second day one visitor would wait for a full rebuild."""
    client.post("/api/demo/profile")
    with get_session() as s:
        tpl = s.scalars(select(Student).where(Student.consent_version == "demo-template")).first()
        assert tpl is not None and tpl.token_hash is None and tpl.preferences.get("template")
