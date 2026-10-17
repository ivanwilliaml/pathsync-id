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


def test_staff_cookie_is_a_revocable_session_not_the_staff_token(client):
    """Sign-in puts a short-lived session token in the cookie (never the staff token itself); signing out
    revokes it server-side, so a copied cookie stops working, while the staff token keeps working."""
    from pathsync.security import STAFF_COOKIE, STAFF_SESSION_HOURS

    r = client.post("/api/staff/session", json={"token": ADMIN_TOKEN})
    session = r.cookies.get(STAFF_COOKIE) or client.cookies.get(STAFF_COOKIE)
    assert session and session != ADMIN_TOKEN and ADMIN_TOKEN not in r.headers["set-cookie"]
    import re

    max_age = int(re.search(r"max-age=(\d+)", r.headers["set-cookie"].lower()).group(1))
    assert STAFF_SESSION_HOURS * 3600 - 5 <= max_age <= STAFF_SESSION_HOURS * 3600
    client.delete("/api/staff/session")
    stolen = {"Cookie": f"{STAFF_COOKIE}={session}"}
    assert client.get("/api/admin/whoami", headers=stolen).status_code == 401
    assert client.get("/api/admin/whoami", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}).status_code == 200


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


def test_soft_skills_are_experience_only(client):
    """Soft skills show up with demand and the student's own experience, never in the ranking, path or assessment."""
    sid, h = new_student(client)
    d = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    soft_ids = {x["skill_id"] for x in d["soft_skills"]}
    assert "verbal_communication" in soft_ids and all(x["level"] == 0 for x in d["soft_skills"])
    assert any(x["demand"] > 0 for x in d["soft_skills"])
    assert not soft_ids & {r["skill_id"] for r in d["ranking"]} and not soft_ids & {p["skill_id"] for p in d["path"]}
    assert not soft_ids & {c["skill_id"] for c in d["competencies"]}
    put = lambda body: client.put(f"/api/students/{sid}/soft-experience", headers=h, json=body)  # noqa: E731
    assert put({"skill_id": "collaboration", "level": 2, "note": "Capstone team of 4"}).status_code == 200
    assert put({"skill_id": "sql", "level": 1}).status_code == 400          # hard skills are not recorded here
    assert put({"skill_id": "collaboration", "level": 9}).status_code == 400
    d = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    c = next(x for x in d["soft_skills"] if x["skill_id"] == "collaboration")
    assert c["level"] == 2 and c["note"] == "Capstone team of 4"
    assert client.get("/api/assessment/items?skill_id=collaboration", headers=h).status_code in (404, 422)


def test_governance_counts_soft_skill_phrases_as_covered():
    """Agile, project management and the other soft skills live in their own layer, so a posting phrase the
    soft layer captures is neither a missing hard skill nor a new-skill candidate (jury note: BA list final)."""
    from pathsync import governance
    from pathsync.db import SessionLocal
    from pathsync.soft import detect

    with SessionLocal() as s:
        rep = governance.report(s, "business_analyst")
    assert rep["new_skill_candidates"], "the report should still list real candidates"
    assert not [c["label"] for c in rep["new_skill_candidates"] if detect(c["label"])]
    assert rep["criteria"]["C2_no_frequent_candidate"]["pass"] and 0.5 < rep["criteria"]["C1_coverage"]["value"] <= 1


def test_frontend_cluster_order_covers_taxonomy():
    """Regression: clusters missing from CLUSTER_ORDER are silently hidden on the dashboard and Skill Map."""
    import re

    from pathsync.config import BACKEND_DIR
    from pathsync.taxonomy import load_skills

    src = (BACKEND_DIR.parent / "frontend" / "src" / "lib" / "format.ts").read_text(encoding="utf-8")
    block = src[src.index("export const CLUSTER_ORDER"):]
    listed = set(re.findall(r'"([a-z_]+)"', block[: block.index("];")]))
    missing = {s.cluster for s in load_skills().values()} - listed
    assert not missing, f"add to CLUSTER_ORDER in frontend/src/lib/format.ts: {sorted(missing)}"


def test_formula5_is_the_active_ranker_until_real_experts_beat_it(client):
    """Plan AI-06: a model trained on simulated experts is registered but never activated."""
    card = client.get("/api/model-card").json()
    assert card["decision_model"]["name"] == "Formula (5)"
    assert card["decision_model"]["type"].startswith("formula (5)")


def test_market_explains_a_missing_trend(client):
    """A role without enough postings in both windows says why, instead of showing a flat 0 trend (plan AI-09)."""
    m = client.get("/api/market/business_analyst").json()
    if m["trend_status"] != "ok":
        assert "needed" in m["trend_reason"] and str(m["n_previous"]) in m["trend_reason"]


def test_grades_alone_never_count_as_proven_readiness(client):
    """Audit AI-7: a transcript raises p but not p_proven; proven readiness stays 0 until there is direct proof."""
    sid, h = new_student(client)
    r = client.post(f"/api/students/{sid}/evidence/academic", headers=h,
                    json={"courses": [{"name": "Basis Data", "grade": "A"}, {"name": "Analisis dan Perancangan Sistem", "grade": "A"}]})
    assert r.status_code == 200, r.text
    d = client.get(f"/api/students/{sid}/dashboard", headers=h).json()
    assert d["coverage_proven"] == 0.0
    graded = [c for c in d["competencies"] if "academic" in c["evidence_kinds"]]
    assert graded and all(c["p_proven"] is None for c in graded)
    assert d["coverage"] > d["coverage_proven"]
