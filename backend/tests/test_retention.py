"""Retention (plan B3): only data past its period is removed, active students stay intact, and
the Privacy page quotes the same periods as pathsync/retention.py."""
from __future__ import annotations

import re
from datetime import timedelta

from sqlalchemy import func, select

from pathsync import retention
from pathsync.config import BACKEND_DIR
from pathsync.db import ApiToken, AssessmentSession, AuditLog, ProductEvent, SessionLocal, Student, utcnow


def test_purge_removes_only_expired_rows():
    now = utcnow()
    old = now - timedelta(days=retention.INACTIVE_PROFILE_MONTHS * 30 + 5)
    with SessionLocal() as s:
        gone = Student(display_name="lama", created_at=old, last_seen_at=old)
        kept = Student(display_name="aktif", created_at=old, last_seen_at=now)
        s.add_all([gone, kept])
        s.flush()
        s.add_all([
            ProductEvent(name="old", student_id=kept.id, created_at=now - timedelta(days=retention.PRODUCT_EVENT_DAYS + 1)),
            ProductEvent(name="new", student_id=kept.id, created_at=now),
            ProductEvent(name="of-gone", student_id=gone.id, created_at=now),
            AuditLog(actor="t", action="old", created_at=now - timedelta(days=retention.AUDIT_LOG_DAYS + 1)),
            AssessmentSession(student_id=kept.id, phase="diagnostic", expires_at=now - timedelta(days=30)),
            AssessmentSession(student_id=kept.id, phase="diagnostic", expires_at=now + timedelta(hours=1)),
            ApiToken(role="expert", token_hash="x" * 64, revoked_at=now - timedelta(days=retention.TOKEN_GRACE_DAYS + 1)),
        ])
        s.commit()
        gone_id, kept_id = gone.id, kept.id

        out = retention.purge(s, now)
        assert out["inactive_profiles"] >= 1 and out["product_events"] >= 1 and out["audit_log"] >= 1
        assert out["assessment_sessions"] >= 1 and out["api_tokens"] >= 1
        assert s.get(Student, gone_id) is None
        assert s.get(Student, kept_id) is not None
        names = set(s.scalars(select(ProductEvent.name).where(ProductEvent.student_id.in_([gone_id, kept_id]))).all())
        assert names == {"new"}
        assert s.scalar(select(func.count()).select_from(AssessmentSession)
                        .where(AssessmentSession.student_id == kept_id)) == 1
        retention.erase_student(s, kept_id)
        s.commit()


def test_privacy_page_quotes_the_retention_constants():
    page = (BACKEND_DIR.parent / "frontend" / "src" / "app" / "privacy" / "page.tsx").read_text(encoding="utf-8")
    section = re.search(r"Berapa lama data disimpan(.*?)</Section>", page, re.S).group(1)
    for n in (retention.INACTIVE_PROFILE_MONTHS, retention.PRODUCT_EVENT_DAYS, retention.AUDIT_LOG_DAYS,
              retention.BACKUP_KEEP_DAYS):
        assert re.search(rf"\b{n}\b", section), n
    backup = (BACKEND_DIR.parent / "deploy" / "backup.sh").read_text(encoding="utf-8")
    assert f"BACKUP_KEEP_DAYS:-{retention.BACKUP_KEEP_DAYS}" in backup
