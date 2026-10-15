"""Data retention (plan B3) and the shared right-to-erasure routine.

Every period is a constant here and is quoted on the Privacy page, so the policy text and the code cannot drift.
Run on startup and from the monthly refresh: `python -m pipeline.retention` (add --dry-run to only count).
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from .db import (
    ApiToken,
    AssessmentResponse,
    AssessmentSession,
    AuditLog,
    CourseEnrollment,
    Evidence,
    Feedback,
    ProductEvent,
    Pulse,
    RecommendationHistory,
    Student,
    StudyPlan,
    WeeklyPlan,
    utcnow,
)

INACTIVE_PROFILE_DAYS = 730        # "profiles unused for more than 24 months are deleted" (Privacy §6)
PRODUCT_EVENT_DAYS = 180           # first-party usage events
CLIENT_ERROR_DAYS = 90             # automatic client error reports (user-written feedback is kept)
AUDIT_LOG_DAYS = 365               # staff activity log
TOKEN_GRACE_DAYS = 30              # expired or revoked staff tokens are removed after this grace period
SESSION_GRACE_DAYS = 7             # unsubmitted assessment sessions, counted from their expiry

STUDENT_TABLES = (AssessmentResponse, AssessmentSession, RecommendationHistory, CourseEnrollment, WeeklyPlan, Pulse,
                  StudyPlan, Evidence)


def erase_students(s: Session, ids: list[str]) -> int:
    """Delete profiles and every linked record. Usage events and error reports are unlinked, not kept per person."""
    if not ids:
        return 0
    for model in STUDENT_TABLES:
        s.execute(delete(model).where(model.student_id.in_(ids)))
    s.execute(delete(ProductEvent).where(ProductEvent.student_id.in_(ids)))
    s.execute(update(Feedback).where(Feedback.student_id.in_(ids)).values(student_id=None))
    return s.execute(delete(Student).where(Student.id.in_(ids))).rowcount or 0


def purge(s: Session, now: datetime | None = None, dry_run: bool = False) -> dict[str, int]:
    """Apply every retention period once. Returns the number of rows removed (or that would be) per category."""
    now = now or utcnow()

    def ago(days: int) -> datetime:
        return now - timedelta(days=days)

    last_active = func.coalesce(Student.last_seen_at, Student.created_at)
    inactive = list(s.scalars(select(Student.id).where(last_active < ago(INACTIVE_PROFILE_DAYS))))
    rules = {
        "product_events": (ProductEvent, ProductEvent.created_at < ago(PRODUCT_EVENT_DAYS)),
        "client_errors": (Feedback, (Feedback.kind == "client_error") & (Feedback.created_at < ago(CLIENT_ERROR_DAYS))),
        "audit_log": (AuditLog, AuditLog.created_at < ago(AUDIT_LOG_DAYS)),
        "staff_tokens": (ApiToken, or_(ApiToken.expires_at < ago(TOKEN_GRACE_DAYS), ApiToken.revoked_at < ago(TOKEN_GRACE_DAYS))),
        "assessment_sessions": (AssessmentSession, AssessmentSession.submitted_at.is_(None)
                                & (AssessmentSession.expires_at < ago(SESSION_GRACE_DAYS))),
    }
    out: dict[str, int] = {"inactive_profiles": len(inactive)}
    for name, (model, cond) in rules.items():
        if dry_run:
            out[name] = s.scalar(select(func.count()).select_from(model).where(cond)) or 0
        else:
            out[name] = s.execute(delete(model).where(cond)).rowcount or 0
    if not dry_run:
        erase_students(s, inactive)
        s.commit()
    return out
