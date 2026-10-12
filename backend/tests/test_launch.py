"""PM audit launch hardening: staff cookie sessions, CSRF, audit log, analytics, feedback, waitlist, key rotation,
research consent, hard-skill taxonomy."""
import pytest
from conftest import ADMIN_TOKEN
from test_api import new_student

ADMIN = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def test_staff_cookie_session_and_csrf(client):
    assert client.post("/api/staff/session", json={"token": "wrong-token-123"}).status_code == 401
    r = client.post("/api/staff/session", json={"token": ADMIN_TOKEN})
    assert r.status_code == 200 and r.json()["role"] == "admin"
    set_cookie = r.headers["set-cookie"].lower()
    assert "httponly" in set_cookie and "samesite=strict" in set_cookie
    # the cookie alone authenticates reads...
    assert client.get("/api/admin/whoami").status_code == 200
    assert client.get("/api/staff/session").json()["role"] == "admin"
    # ...but a cookie-authenticated write without the custom header is refused (CSRF guard)
    assert client.post("/api/admin/feedback/999999/resolve").status_code == 403
    assert client.post("/api/admin/feedback/999999/resolve", headers={"X-PathSync": "1"}).status_code == 404
    client.delete("/api/staff/session")
    assert client.get("/api/admin/whoami").status_code == 401


def test_admin_writes_are_audited(client):
    client.post("/api/admin/feedback/999999/resolve", headers={**ADMIN})
    log = client.get("/api/admin/audit-log", headers=ADMIN).json()
    assert any("feedback" in row["action"] for row in log)


def test_expired_staff_token_is_refused(client):
    from datetime import timedelta

    from pathsync.db import ApiToken, get_session, utcnow
    from pathsync.security import hash_token

    with get_session() as s:
        s.add(ApiToken(role="advisor", token_hash=hash_token("expired-token-abcdefgh"), label="old",
                       expires_at=utcnow() - timedelta(days=1)))
        s.commit()
    assert client.post("/api/staff/session", json={"token": "expired-token-abcdefgh"}).status_code == 401


def test_rotate_key_invalidates_the_old_one(client):
    sid, h = new_student(client)
    new = client.post(f"/api/students/{sid}/rotate-key", headers=h).json()
    assert client.get(f"/api/students/{sid}", headers=h).status_code == 403
    assert client.get(f"/api/students/{sid}", headers={"Authorization": f"Bearer {new['token']}"}).status_code == 200


def test_research_consent_is_separate_and_optional(client):
    sid, h = new_student(client)
    assert client.get(f"/api/students/{sid}", headers=h).json()["research_consent_at"] is None
    assert client.put(f"/api/students/{sid}/research-consent", headers=h, json={"consent": True}).json() == {"research_consent": True}
    assert client.get(f"/api/students/{sid}", headers=h).json()["research_consent_at"]
    client.put(f"/api/students/{sid}/research-consent", headers=h, json={"consent": False})
    assert client.get(f"/api/students/{sid}", headers=h).json()["research_consent_at"] is None


def test_events_feedback_waitlist_and_metrics(client):
    sid, h = new_student(client)
    assert client.post("/api/events", headers=h, json={"name": "signup", "student_id": sid}).status_code == 204
    assert client.post("/api/events", json={"name": "nonsense"}).status_code == 400
    # an event naming a student without that student's token is stored anonymously, never attributed
    client.post("/api/events", json={"name": "next_step_viewed", "student_id": sid})
    assert client.post("/api/feedback", json={"message": "tombol tidak jalan", "page": "/evidence", "request_id": "abc123"}).status_code == 200
    assert client.post("/api/waitlist", json={"email": "bukan-email"}).status_code == 400
    assert client.post("/api/waitlist", json={"email": "Rani@Kampus.ac.id", "role": "UI/UX Designer"}).status_code == 200
    m = client.get("/api/admin/metrics?days=7", headers=ADMIN).json()
    assert m["new_students"] >= 1 and m["funnel"][0]["step"] == "signed up" and "north_star" in m
    assert client.get("/api/admin/waitlist", headers=ADMIN).json()["by_role"]["UI/UX Designer"] >= 1
    assert any(r["message"] == "tombol tidak jalan" for r in client.get("/api/admin/feedback", headers=ADMIN).json())


def test_taxonomy_is_hard_skills_only_and_every_skill_is_testable(client):
    from pathsync.assessment import item_bank
    from pathsync.taxonomy import load_skills

    skills = load_skills()
    assert all(s.kind in ("hard", "tool") for s in skills.values())
    soft = {"stakeholder_management", "critical_thinking", "collaboration", "agile_scrum", "verbal_communication",
            "presentation_storytelling", "business_writing", "english_proficiency", "change_management", "facilitation_negotiation"}
    assert not soft & set(skills)
    per_skill = {}
    for it in item_bank().values():
        per_skill[it["skill_id"]] = per_skill.get(it["skill_id"], 0) + 1
    assert set(per_skill) == set(skills) and min(per_skill.values()) >= 5


def test_every_career_has_a_market_map_and_a_route(client):
    roles = client.get("/api/meta").json()["roles"]
    assert len(roles) >= 12
    for r in roles:
        assert r["n_postings"] > 0, r["id"]
    for role in ("backend_developer", "accountant", "devops_engineer"):
        sid, h = new_student(client, target_role=role)
        d = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
        assert d["path"] and d["ranking"] and d["role"]["id"] == role
        assert all(step["skill_id"] in {c["skill_id"] for c in d["competencies"]} for step in d["path"])


def test_production_refuses_weak_admin_token(monkeypatch):
    from pathsync.db import get_session
    from pathsync.security import ensure_admin_token

    monkeypatch.setenv("PATHSYNC_ENV", "production")
    monkeypatch.setenv("PATHSYNC_ADMIN_TOKEN", "demo-admin-key-2026")
    with get_session() as s, pytest.raises(RuntimeError):
        ensure_admin_token(s)


def test_self_ratings_validated(client):
    sid, h = new_student(client)
    assert client.patch(f"/api/students/{sid}", headers=h, json={"self_ratings": {"sql": 9}}).status_code == 422
    assert client.patch(f"/api/students/{sid}", headers=h, json={"self_ratings": {"sql": "x"}}).status_code == 422
    assert client.patch(f"/api/students/{sid}", headers=h, json={"self_ratings": {"sql": 4, "no_such_skill": 3}}).status_code == 200
    assert client.get(f"/api/students/{sid}", headers=h).json()["self_ratings"] == {"sql": 4}


def test_option_order_differs_per_session_and_grading_follows_it(client):
    from pathsync.assessment import item_bank, public_item, session_order

    it = next(iter(item_bank().values()))
    orders = {tuple(session_order(f"session-{i}", it["id"])) for i in range(40)}
    assert len(orders) > 6                                  # not one fixed answer sheet
    assert session_order("s1", it["id"]) == session_order("s1", it["id"])   # stable within a session
    assert sorted(public_item(it, "s1")["options"]) == sorted(it["options"])

    sid, h = new_student(client)
    d = client.get(f"/api/students/{sid}/assessment/diagnostic", headers=h).json()
    first = d["items"][0]
    bank = item_bank()[first["id"]]
    from pathsync.assessment import canonical_options

    key_text = canonical_options(bank)[0]
    shown_key = first["options"].index(key_text)             # what the student sees is what the server grades
    r = client.post(f"/api/students/{sid}/assessment/submit", headers=h, json={"session_id": d["session_id"], "answers": [
        {"item_id": first["id"], "choice": shown_key}]}).json()
    assert r["results"][0]["correct"] is True and r["results"][0]["answer"] == shown_key


def test_rushed_submission_is_refused(client, monkeypatch):
    import api.routers.assessment as a

    monkeypatch.setattr(a, "MIN_SECONDS_PER_ITEM", 3.0)
    sid, h = new_student(client)
    d = client.get(f"/api/students/{sid}/assessment/diagnostic", headers=h).json()
    r = client.post(f"/api/students/{sid}/assessment/submit", headers=h, json={"session_id": d["session_id"], "answers": [
        {"item_id": d["items"][0]["id"], "choice": 0}]})
    assert r.status_code == 422 and "fast" in r.json()["detail"]
    # the session stays open, so a real attempt can still be submitted
    monkeypatch.setattr(a, "MIN_SECONDS_PER_ITEM", 0.0)
    assert client.post(f"/api/students/{sid}/assessment/submit", headers=h, json={"session_id": d["session_id"], "answers": [
        {"item_id": d["items"][0]["id"], "choice": 0}]}).status_code == 200


def test_item_analysis_endpoint(client):
    r = client.get("/api/admin/item-analysis?min_n=1", headers=ADMIN).json()
    assert "items" in r and r["items"] and {"p_correct", "choices", "flags"} <= set(r["items"][0])
