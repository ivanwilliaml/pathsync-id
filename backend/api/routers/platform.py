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

from pathsync.db import AuditLog, Evidence, Feedback, ProductEvent, StaffAccount, Student, Waitlist, utcnow
from pathsync.i18n import tr
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
from pathsync.staff_accounts import MIN_PASSWORD, account_token, demo_account, hash_password, normalise_email, verify_password

router = APIRouter(prefix="/api", tags=["platform"])
SECURE_COOKIE = os.getenv("PATHSYNC_ENV") == "production"


# ------------------------------------------------------------------ staff sessions
class StaffLogin(BaseModel):
    token: str = Field(..., min_length=8, max_length=200)


def _start_session(s: Session, response: Response, row, how: str) -> dict:
    """Issue a browser session from a staff token and put it in an HttpOnly cookie (never in localStorage)."""
    token, session = issue_session(s, row)
    max_age = max(60, int((session.expires_at - utcnow()).total_seconds()))
    response.set_cookie(STAFF_COOKIE, token, max_age=max_age, httponly=True, secure=SECURE_COOKIE,
                        samesite="strict", path="/api")
    audit(s, f"{row.role}:{row.label or row.id}", f"staff sign-in ({how})")
    s.commit()
    return {"role": row.role, "subject_id": row.subject_id, "label": row.label, "demo": "demo:" in row.label,
            "expires_at": session.expires_at.isoformat()}


@router.post("/staff/session", dependencies=[Depends(rate_limit("staff_login", 10))])
def staff_login(body: StaffLogin, response: Response, s: Session = Depends(db_session)):
    """Sign in with a staff token (the bootstrap admin key, scripts). People use email + password (below)."""
    row = staff_token_row(s, body.token.strip())
    if row is None:
        raise HTTPException(401, "Unknown, expired or revoked staff token.")
    return _start_session(s, response, row, "token")


class AccountLogin(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=1, max_length=200)


@router.post("/staff/login", dependencies=[Depends(rate_limit("staff_login", 10))])
def account_login(body: AccountLogin, response: Response, s: Session = Depends(db_session)):
    """Email + password sign-in for staff accounts. One message for every failure, so it does not reveal which
    emails have accounts."""
    acc = s.scalars(select(StaffAccount).where(StaffAccount.email == normalise_email(body.email))).first()
    if acc is None or acc.demo or acc.disabled_at is not None or not verify_password(body.password, acc.password_hash):
        raise HTTPException(401, tr("Wrong email or password.", "Email atau password salah."))
    acc.last_login_at = utcnow()
    return _start_session(s, response, account_token(s, acc), "password")


class AcceptInvite(BaseModel):
    token: str = Field(..., min_length=8, max_length=200)
    password: str = Field(..., min_length=MIN_PASSWORD, max_length=200)


@router.get("/staff/invite")
def invite_info(token: str, s: Session = Depends(db_session)):
    """Who the invite is for, so the set-password page can greet them."""
    acc = s.scalars(select(StaffAccount).where(StaffAccount.invite_hash == hash_token(token))).first()
    if acc is None or acc.invite_expires_at is None or acc.invite_expires_at < utcnow() or acc.disabled_at is not None:
        raise HTTPException(404, tr("This invite link is invalid or has expired. Ask the admin for a new one.",
                                    "Link undangan ini tidak valid atau sudah kedaluwarsa. Minta link baru ke admin."))
    return {"email": acc.email, "name": acc.name, "role": acc.role}


@router.post("/staff/accept", dependencies=[Depends(rate_limit("staff_login", 10))])
def accept_invite(body: AcceptInvite, response: Response, s: Session = Depends(db_session)):
    """Set the password from an invite (or a reset) link, then sign in."""
    acc = s.scalars(select(StaffAccount).where(StaffAccount.invite_hash == hash_token(body.token))).first()
    if acc is None or acc.invite_expires_at is None or acc.invite_expires_at < utcnow() or acc.disabled_at is not None:
        raise HTTPException(404, tr("This invite link is invalid or has expired. Ask the admin for a new one.",
                                    "Link undangan ini tidak valid atau sudah kedaluwarsa. Minta link baru ke admin."))
    acc.password_hash = hash_password(body.password)
    acc.invite_hash, acc.invite_expires_at = None, None
    acc.last_login_at = utcnow()
    return _start_session(s, response, account_token(s, acc), "invite")


class DemoStaff(BaseModel):
    role: str = Field(..., pattern="^(advisor|expert)$")


@router.post("/staff/demo", dependencies=[Depends(rate_limit("signup", 20))])
def demo_staff(body: DemoStaff, response: Response, s: Session = Depends(db_session)):
    """One-click read-only demo: a lecturer with a demo class, or an expert who never counts as one."""
    if os.getenv("PATHSYNC_DEMO", "1") == "0":
        raise HTTPException(404, tr("The demo is turned off on this server.", "Demo dimatikan di server ini."))
    acc = demo_account(s, body.role)
    s.flush()
    return _start_session(s, response, account_token(s, acc), "demo")


@router.get("/staff/session")
def staff_me(request: Request, probe: bool = False, s: Session = Depends(db_session)):
    """The signed-in staff session. `?probe=1` is for the web app's silent check on every page: an anonymous visitor
    gets 200 {"role": null} instead of 401, so ordinary students do not fill their browser console with errors."""
    row = staff_token_row(s, request.cookies.get(STAFF_COOKIE))
    if row is None:
        if probe:
            return {"role": None}
        raise HTTPException(401, "Not signed in.")
    # the account behind the session (if it came from one), so the app can show who is signed in
    acc = None
    if row.label.startswith(SESSION_PREFIX):
        parent = row.label[len(SESSION_PREFIX):].split(" ", 1)[0]
        if parent.isdigit():
            acc = s.scalars(select(StaffAccount).where(StaffAccount.token_id == int(parent))).first()
    return {"role": row.role, "subject_id": row.subject_id, "label": row.label, "demo": "demo:" in row.label,
            "name": acc.name if acc else None, "email": None if acc is None or acc.demo else acc.email,
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
          "plan_saved", "reflection_saved", "trace_opened", "demo_started", "pilot_survey"}
# pilot targets set before the sessions; a miss is a finding to report, not a launch blocker
PILOT_TARGETS = {"quick_check_completion": 0.60, "median_minutes_to_next_step": 5.0, "survey_q1_mean": 4.0}


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
    if body.name == "pilot_survey":
        # three 1-5 ratings per condition (V3 protocol): q1 clear first step, q2 fits my level, q3 can start this week
        if props.get("condition") not in ("pathsync", "generic") or not all(
                isinstance(props.get(q), int) and 1 <= props[q] <= 5 for q in ("q1", "q2", "q3")):
            raise HTTPException(422, "pilot_survey needs condition (pathsync|generic) and q1, q2, q3 from 1 to 5.")
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
    created = {st.id: st.created_at for st in students}
    first_next = {}
    for sid, at in s.execute(select(ProductEvent.student_id, ProductEvent.created_at)
                             .where(ProductEvent.name == "next_step_viewed", ProductEvent.student_id.in_(ids))).all():
        first_next[sid] = min(at, first_next.get(sid, at))
    minutes = sorted((first_next[k] - created[k]).total_seconds() / 60 for k in first_next if k in created)
    median_min = round(minutes[len(minutes) // 2], 1) if minutes else None
    survey: dict[str, list[dict]] = {"pathsync": [], "generic": []}
    for (props,) in s.execute(select(ProductEvent.props).where(ProductEvent.name == "pilot_survey", ProductEvent.created_at >= since)).all():
        if props.get("condition") in survey:
            survey[props["condition"]].append(props)

    def mean(rows, q):
        return round(sum(r[q] for r in rows) / len(rows), 2) if rows else None

    survey_out = {c: {"n": len(rows), **{q: mean(rows, q) for q in ("q1", "q2", "q3")}} for c, rows in survey.items()}
    qc = len(by_event.get("check_completed", set()) & ids) / n
    pilot = {"targets": PILOT_TARGETS,
             "values": {"quick_check_completion": round(qc, 3), "median_minutes_to_next_step": median_min,
                        "survey_q1_mean": survey_out["pathsync"]["q1"]},
             "survey": survey_out}
    pilot["meets"] = {"quick_check_completion": qc >= PILOT_TARGETS["quick_check_completion"] if ids else None,
                      "median_minutes_to_next_step": None if median_min is None else median_min <= PILOT_TARGETS["median_minutes_to_next_step"],
                      "survey_q1_mean": None if survey_out["pathsync"]["q1"] is None else survey_out["pathsync"]["q1"] >= PILOT_TARGETS["survey_q1_mean"]}
    return {"window_days": days, "new_students": len(ids), "pilot": pilot,
            "funnel": [{"step": k, "students": len(v), "share": round(len(v) / n, 3)} for k, v in funnel],
            "north_star": {"definition": "share of new students who pass a re-check on at least one skill within 14 days",
                           "value": round(len(by_event.get("reassess_passed", set()) & ids) / n, 3)},
            "d7_retention": round(len(returned) / n, 3),
            "review_queue": {"pending": len(pending), "over_72h": len(overdue), "sla_hours": 72}}


@admin.get("/item-analysis")
def item_analysis(min_n: int = 20, s: Session = Depends(db_session)):
    """Classical item analysis from real responses (plan A5): proportion correct, point-biserial against the
    student's other answers on the same skill, distractor shares, and KR-20 per skill. Flags follow the plan's
    rule: p outside 0.20-0.90, point-biserial below 0.15, or a distractor chosen by fewer than 5% of answers.
    The full calibration (Rasch difficulty, BKT re-estimate) is `python -m pipeline.calibrate_items`."""
    from pathsync.db import AssessmentResponse
    from pathsync.item_analysis import item_stats, reliability_by_skill

    rows = s.execute(select(AssessmentResponse.student_id, AssessmentResponse.item_id, AssessmentResponse.skill_id,
                            AssessmentResponse.correct, AssessmentResponse.choice_canon)).all()
    rows = [tuple(r) for r in rows]
    out = item_stats(rows, min_n=min_n)
    for x in out:                       # names used before plan A5, kept for existing clients
        x["discrimination"], x["choices"] = x["point_biserial"], x["choice_shares"]
    return {"min_n": min_n, "items": out, "flagged": sum(bool(x["flags"]) for x in out),
            "reliability": reliability_by_skill(rows)}
