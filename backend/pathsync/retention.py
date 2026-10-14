"""Data retention (plan B3). The periods below are the ones stated on the Privacy page;
tests/test_retention.py checks that the page quotes these same numbers.

    python -m pathsync.retention          # run once (the compose `retention` service runs it daily)
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from .db import (
    ApiToken,
    AssessmentResponse,
    AssessmentSession,
    AuditLog,
    CourseEnrollment,
    Evidence,
    ProductEvent,
    Pulse,
    RecommendationHistory,
    Student,
    StudyPlan,
    WeeklyPlan,
    utcnow,
)

INACTIVE_PROFILE_MONTHS = 24     # profiles unused this long are erased
PRODUCT_EVENT_DAYS = 365         # first-party analytics
AUDIT_LOG_DAYS = 730             # staff actions
SESSION_GRACE_DAYS = 7           # unsubmitted assessment sessions, after they expire
TOKEN_GRACE_DAYS = 90            # revoked or expired staff tokens
BACKUP_KEEP_DAYS = 14            # deploy/backup.sh default

STUDENT_TABLES = (AssessmentResponse, AssessmentSession, RecommendationHistory, CourseEnrollment, WeeklyPlan, Pulse,
                  StudyPlan, Evidence, ProductEvent)


def erase_student(s: Session, sid: str) -> None:
    """Right to erasure: the profile and every record linked to it, analytics events included."""
    for model in STUDENT_TABLES:
        s.execute(delete(model).where(model.student_id == sid))
    s.execute(delete(Student).where(Student.id == sid))


def purge(s: Session, now: datetime | None = None) -> dict[str, int]:
    """Delete what is past its retention period. Active students are never touched."""
    now = now or utcnow()
    inactive_before = now - timedelta(days=INACTIVE_PROFILE_MONTHS * 30)
    stale = s.scalars(select(Student.id).where(
        or_(Student.last_seen_at < inactive_before,
            Student.last_seen_at.is_(None) & (Student.created_at < inactive_before)))).all()
    for sid in stale:
        erase_student(s, sid)
    out = {"inactive_profiles": len(stale)}
    out["product_events"] = s.execute(delete(ProductEvent).where(
        ProductEvent.created_at < now - timedelta(days=PRODUCT_EVENT_DAYS))).rowcount
    out["audit_log"] = s.execute(delete(AuditLog).where(
        AuditLog.created_at < now - timedelta(days=AUDIT_LOG_DAYS))).rowcount
    out["assessment_sessions"] = s.execute(delete(AssessmentSession).where(
        AssessmentSession.submitted_at.is_(None),
        AssessmentSession.expires_at < now - timedelta(days=SESSION_GRACE_DAYS))).rowcount
    out["api_tokens"] = s.execute(delete(ApiToken).where(
        or_(ApiToken.revoked_at < now - timedelta(days=TOKEN_GRACE_DAYS),
            ApiToken.expires_at < now - timedelta(days=TOKEN_GRACE_DAYS)))).rowcount
    s.commit()
    return out


if __name__ == "__main__":
    from .db import get_session, init_db
    from .security import audit

    init_db()
    with get_session() as s:
        result = purge(s)
        audit(s, "system", "retention purge", "ok", result)
        s.commit()
    print(result)
