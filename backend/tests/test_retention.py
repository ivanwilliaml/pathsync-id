"""Plan B3 (retention + erasure) and C4 (readiness check)."""
from datetime import timedelta

import pytest
from test_api import new_student


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from api.main import app

    with TestClient(app) as c:
        yield c


def test_retention_removes_only_rows_past_their_period(client):
    from pathsync import retention as R
    from pathsync.db import ApiToken, AuditLog, Feedback, ProductEvent, Student, get_session, utcnow

    old_sid, _ = new_student(client)
    fresh_sid, fresh_h = new_student(client)
    now = utcnow()
    with get_session() as s:
        st = s.get(Student, old_sid)
        st.last_seen_at = st.created_at = now - timedelta(days=R.INACTIVE_PROFILE_DAYS + 1)
        s.add_all([
            ProductEvent(name="old", created_at=now - timedelta(days=R.PRODUCT_EVENT_DAYS + 1)),
            ProductEvent(name="recent", created_at=now - timedelta(days=1)),
            Feedback(kind="client_error", message="old", created_at=now - timedelta(days=R.CLIENT_ERROR_DAYS + 1)),
            Feedback(kind="feedback", message="old but written by a person", created_at=now - timedelta(days=999)),
            AuditLog(action="old", created_at=now - timedelta(days=R.AUDIT_LOG_DAYS + 1)),
            ApiToken(role="expert", token_hash="x" * 64, expires_at=now - timedelta(days=R.TOKEN_GRACE_DAYS + 1)),
        ])
        s.commit()
        dry = R.purge(s, now=now, dry_run=True)
        assert dry["inactive_profiles"] >= 1 and s.get(Student, old_sid) is not None   # dry run changes nothing
        out = R.purge(s, now=now)
        assert out["inactive_profiles"] >= 1 and out["product_events"] >= 1 and out["client_errors"] >= 1
        assert out["audit_log"] >= 1 and out["staff_tokens"] >= 1
        s.expire_all()
        assert s.get(Student, old_sid) is None
        assert s.get(Student, fresh_sid) is not None
        assert s.query(ProductEvent).filter_by(name="recent").count() == 1
        assert s.query(Feedback).filter_by(message="old but written by a person").count() == 1
    assert client.get(f"/api/students/{fresh_sid}", headers=fresh_h).status_code == 200


def test_erasure_also_removes_usage_events(client):
    from pathsync.db import ProductEvent, get_session

    sid, h = new_student(client)
    with get_session() as s:
        s.add(ProductEvent(name="page_view", student_id=sid))
        s.commit()
    assert client.delete(f"/api/students/{sid}", headers=h).json()["deleted"] is True
    with get_session() as s:
        assert s.query(ProductEvent).filter_by(student_id=sid).count() == 0


def test_readiness_reports_database_and_snapshot_age(client):
    r = client.get("/api/health/ready")
    body = r.json() if r.status_code == 200 else r.json()["detail"]
    assert body["database"] == "up" and "snapshot_age_days" in body
    assert client.get("/api/health").json() == {"ok": True}


def test_damaged_or_oversized_documents_are_refused_cleanly(client):
    import io
    import zipfile

    sid, h = new_student(client)
    url = f"/api/students/{sid}/transcript/parse"
    r = client.post(url, headers=h, files={"file": ("t.pdf", b"%PDF-1.4 not really a pdf", "application/pdf")})
    assert r.status_code == 422
    bomb = io.BytesIO()
    with zipfile.ZipFile(bomb, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("word/document.xml", b"0" * (41 * 1024 * 1024))     # ~40 KB compressed, 41 MB expanded
    r = client.post(url, headers=h, files={"file": ("t.docx", bomb.getvalue(), "application/octet-stream")})
    assert r.status_code == 413
