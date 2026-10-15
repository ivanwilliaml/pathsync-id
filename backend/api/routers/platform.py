"""Launch plumbing: staff sessions (HttpOnly cookie), access-key rotation, research consent, first-party product
analytics, problem reports, client error capture and the role waitlist (PM audit P0-4, P0-7, BE-2, BE-3, §6, §7)."""
from __future__ import annotations

import os
import re
from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pathsync.db import AuditLog, Evidence, Feedback, ProductEvent, Student, Waitlist, utcnow
from pathsync.security import (
    SESSION_PREFIX,
    STAFF_COOKIE,
    audit,
    audit_admin_writes,
    db_session,
    hash_token,
    issue_session,
    new_token,
    rate_limit,
    require_admin,
    staff_token_row,
    student_access,
)

router = APIRouter(prefix="/api", tags=["platform"])
SECURE_COOKIE = os.getenv("PATHSYNC_ENV") == "production"


# ------------------------------------------------------------------ staff sessions
class StaffLogin(BaseModel):
    token: str = Field(..., min_length=8, max_length=200)


@router.post("/staff/session", dependencies=[Depends(rate_limit("staff_login", 10))])
def staff_login(body: StaffLogin, response: Response, s: Session = Depends(db_session)):
    """Exchange a staff token for an HttpOnly cookie, so the token never sits in localStorage (XSS-safe)."""
    row = staff_token_row(s, body.token.strip())
    if row is None:
        raise HTTPException(401, "Unknown, expired or revoked staff token.")
    token, session = issue_session(s, row)
    max_age = max(60, int((session.expires_at - utcnow()).total_seconds()))
    response.set_cookie(STAFF_COOKIE, token, max_age=max_age, httponly=True, secure=SECURE_COOKIE,
                        samesite="strict", path="/api")
    audit(s, f"{row.role}:{row.label or row.id}", "staff sign-in")
    s.commit()
    return {"role": row.role, "subject_id": row.subject_id, "label": row.label,
            "expires_at": session.expires_at.isoformat()}


@router.get("/staff/session")
def staff_me(request: Request, s: Session = Depends(db_session)):
    row = staff_token_row(s, request.cookies.get(STAFF_COOKIE))
    if row is None:
        raise HTTPException(401, "Not signed in.")
    return {"role": row.role, "subject_id": row.subject_id, "label": row.label,
            "expires_at": row.expires_at.isoformat() if row.expires_at else None}


@router.delete("/staff/session")
def staff_logout(request: Request, response: Response, s: Session = Depends(db_session)):
    """Sign out: the session token behind the cookie is revoked server-side, not only forgotten by the browser."""
    row = staff_token_row(s, request.cookies.get(STAFF_COOKIE))
    if row is not None and row.label.startswith(SESSION_PREFIX):
        row.revoked_at = utcnow()
        s.commit()
    response.delete_cookie(STAFF_COOKIE, path="/api")
    return {"ok": True}


# --------------------------------------------------------------- student account
@router.post("/students/{sid}/rotate-key")
def rotate_key(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Issue a new access key and invalidate the old one (lost device, shared key)."""
    st = s.merge(st)
    token = new_token()
    st.token_hash = hash_token(token)
    s.commit()
    return {"id": st.id, "token": token}


class ResearchConsent(BaseModel):
    consent: bool


@router.put("/students/{sid}/research-consent")
def research_consent(body: ResearchConsent, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Separate opt-in for research use (user studies, anonymised calibration). Withdrawing leaves any study."""
    st = s.merge(st)
    st.research_consent_at = utcnow() if body.consent else None
    if not body.consent:
        st.study_id, st.study_arm = None, None
    s.commit()
    return {"research_consent": body.consent}


# ------------------------------------------------------------------ analytics
EVENTS = {"signup", "evidence_saved", "check_started", "check_completed", "next_step_viewed", "why_opened",
          "material_clicked", "reassess_started", "reassess_passed", "key_saved", "key_restored", "page_view",
          "plan_saved", "reflection_saved", "trace_opened"}


class EventIn(BaseModel):
    name: str = Field(..., max_length=40)
    student_id: str | None = Field(None, max_length=40)
    props: dict = Field(default_factory=dict)


@router.post("/events", status_code=204, dependencies=[Depends(rate_limit("events", 240))])
def track(body: EventIn, authorization: str | None = Header(default=None), s: Session = Depends(db_session)):
    """First-party event log (no third-party tracker). The student id is kept only with that student's token."""
    if body.name not in EVENTS:
        raise HTTPException(400, "Unknown event.")
    sid = None
    if body.student_id and authorization:
        st = s.get(Student, body.student_id)
        if st is not None and st.token_hash == hash_token(authorization.partition(" ")[2].strip()):
            sid = st.id
            st.last_seen_at = utcnow()
    props = {k: v for k, v in list(body.props.items())[:8] if isinstance(v, (str, int, float, bool)) and len(str(v)) <= 120}
    s.add(ProductEvent(name=body.name, student_id=sid, props=props))
    s.commit()
    return Response(status_code=204)


# --------------------------------------------------------- feedback & errors
class FeedbackIn(BaseModel):
    message: str = Field(..., min_length=3, max_length=4000)
    page: str = Field("", max_length=300)
    request_id: str = Field("", max_length=64)
    contact: str = Field("", max_length=200)
    student_id: str | None = Field(None, max_length=40)
    kind: str = Field("feedback", pattern="^(feedback|client_error)$")


@router.post("/feedback", dependencies=[Depends(rate_limit("feedback", 20))])
def feedback(body: FeedbackIn, s: Session = Depends(db_session)):
    s.add(Feedback(kind=body.kind, message=body.message, page=body.page, request_id=body.request_id,
                   contact=body.contact, student_id=body.student_id))
    s.commit()
    return {"ok": True}


# ------------------------------------------------------------------ waitlist
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,}$", re.I)


class WaitlistIn(BaseModel):
    email: str = Field(..., max_length=200)
    role: str = Field("", max_length=120)


@router.post("/waitlist", dependencies=[Depends(rate_limit("waitlist", 10))])
def join_waitlist(body: WaitlistIn, s: Session = Depends(db_session)):
    email = body.email.strip().lower()
    if not _EMAIL.match(email):
        raise HTTPException(400, "Please enter a valid email address.")
    if s.scalar(select(Waitlist.id).where(Waitlist.email == email, Waitlist.role == body.role.strip())) is None:
        s.add(Waitlist(email=email, role=body.role.strip()))
        s.commit()
    return {"ok": True}


# ---------------------------------------------------------- admin read models
admin = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin), Depends(audit_admin_writes)])


@admin.get("/audit-log")
def audit_log(limit: int = 200, s: Session = Depends(db_session)):
    rows = s.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(min(limit, 1000))).all()
    return [{"id": r.id, "at": r.created_at.isoformat(), "actor": r.actor, "action": r.action, "target": r.target,
             "detail": r.detail} for r in rows]


@admin.get("/feedback")
def feedback_list(s: Session = Depends(db_session)):
    rows = s.scalars(select(Feedback).order_by(Feedback.id.desc()).limit(300)).all()
    return [{"id": r.id, "at": r.created_at.isoformat(), "kind": r.kind, "message": r.message, "page": r.page,
             "request_id": r.request_id, "contact": r.contact, "resolved": r.resolved} for r in rows]


@admin.post("/feedback/{fid}/resolve")
def feedback_resolve(fid: int, s: Session = Depends(db_session)):
    r = s.get(Feedback, fid)
    if r is None:
        raise HTTPException(404, "Not found.")
    r.resolved = True
    s.commit()
    return {"ok": True}


@admin.get("/waitlist")
def waitlist(s: Session = Depends(db_session)):
    rows = s.execute(select(Waitlist.role, func.count(Waitlist.id)).group_by(Waitlist.role)).all()
    return {"total": sum(n for _, n in rows), "by_role": {r or "unspecified": n for r, n in rows}}


@admin.get("/metrics")
def metrics(days: int = 14, s: Session = Depends(db_session)):
    """Launch funnel and the North Star: share of new students who prove at least one new skill within 14 days."""
    since = utcnow() - timedelta(days=max(1, min(days, 90)))
    students = s.scalars(select(Student).where(Student.created_at >= since)).all()
    ids = {st.id for st in students}
    by_event: dict[str, set[str]] = {}
    for name, sid in s.execute(select(ProductEvent.name, ProductEvent.student_id)
                               .where(ProductEvent.created_at >= since, ProductEvent.student_id.is_not(None))).all():
        by_event.setdefault(name, set()).add(sid)
    with_evidence = {sid for (sid,) in s.execute(select(Evidence.student_id).where(Evidence.student_id.in_(ids))).all()}
    funnel = [("signed up", ids), ("saved evidence", with_evidence & ids),
              ("finished Quick Check", by_event.get("check_completed", set()) & ids),
              ("viewed next step", by_event.get("next_step_viewed", set()) & ids),
              ("opened a material", by_event.get("material_clicked", set()) & ids),
              ("proved a skill (re-check passed)", by_event.get("reassess_passed", set()) & ids)]
    returned = {st.id for st in students if st.last_seen_at and (st.last_seen_at - st.created_at).days >= 7}
    n = max(1, len(ids))
    pending = s.scalars(select(Evidence).where(Evidence.review_status == "pending")).all()
    overdue = [e for e in pending if (utcnow() - e.created_at).total_seconds() > 72 * 3600]
    return {"window_days": days, "new_students": len(ids),
            "funnel": [{"step": k, "students": len(v), "share": round(len(v) / n, 3)} for k, v in funnel],
            "north_star": {"definition": "share of new students who pass a re-check on at least one skill within 14 days",
                           "value": round(len(by_event.get("reassess_passed", set()) & ids) / n, 3)},
            "d7_retention": round(len(returned) / n, 3),
            "review_queue": {"pending": len(pending), "over_72h": len(overdue), "sla_hours": 72}}


@admin.get("/item-analysis")
def item_analysis(min_n: int = 20, s: Session = Depends(db_session)):
    """Classical item analysis from real responses: difficulty, discrimination and how often each distractor is chosen.

    Discrimination is the point-biserial correlation between getting the item right and the student's accuracy on the
    other items. Items that almost everyone gets right, that nobody gets right, or that do not separate stronger from
    weaker students (r < 0.10) are flagged for rewriting."""
    import numpy as np

    from pathsync.db import AssessmentResponse

    rows = s.execute(select(AssessmentResponse.student_id, AssessmentResponse.item_id, AssessmentResponse.skill_id,
                            AssessmentResponse.correct, AssessmentResponse.choice_canon)).all()
    by_student: dict[str, list] = {}
    for sid, iid, skill, ok, canon in rows:
        by_student.setdefault(sid, []).append((iid, skill, bool(ok), canon))
    per_item: dict[str, dict] = {}
    for answers in by_student.values():
        total = sum(a[2] for a in answers)
        for iid, skill, ok, canon in answers:
            d = per_item.setdefault(iid, {"skill_id": skill, "n": 0, "right": 0, "rest": [], "ok": [], "choices": {0: 0, 1: 0, 2: 0, 3: 0}})
            d["n"] += 1
            d["right"] += ok
            if len(answers) > 1:
                d["rest"].append((total - ok) / (len(answers) - 1))
                d["ok"].append(float(ok))
            if canon is not None:
                d["choices"][canon] = d["choices"].get(canon, 0) + 1
    out = []
    for iid, d in per_item.items():
        r = None
        if d["n"] >= min_n and len(set(d["ok"])) > 1 and len(set(d["rest"])) > 1:
            r = float(np.corrcoef(d["ok"], d["rest"])[0, 1])
        p = d["right"] / d["n"]
        flags = []
        if d["n"] >= min_n:
            if p > 0.92:
                flags.append("too_easy")
            if p < 0.15:
                flags.append("too_hard_or_miskeyed")
            if r is not None and r < 0.10:
                flags.append("low_discrimination")
            wrong = [d["choices"].get(i, 0) for i in (1, 2, 3)]
            if sum(wrong) >= 10 and min(wrong) == 0:
                flags.append("dead_distractor")
        out.append({"item_id": iid, "skill_id": d["skill_id"], "n": d["n"], "p_correct": round(p, 3),
                    "discrimination": None if r is None else round(r, 3), "choices": d["choices"], "flags": flags})
    out.sort(key=lambda x: (-len(x["flags"]), x["item_id"]))
    return {"min_n": min_n, "items": out, "flagged": sum(bool(x["flags"]) for x in out)}
