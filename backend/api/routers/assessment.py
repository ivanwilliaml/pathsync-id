"""Short assessment with issued sessions.

A GET issues items and records them in an AssessmentSession; a submission must reference that open
session, answer only issued items, each once, and the session closes. Items already answered are never
served again, so revealing the correct answer after submission cannot be replayed into evidence.
"""
from __future__ import annotations

import os
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from pathsync.assessment import (
    SubmissionError,
    diagnostic_plan,
    grade,
    item_bank,
    public_item,
    reassessment_items,
    validate_submission,
)
from pathsync.config import READINESS_THRESHOLD
from pathsync.db import AssessmentResponse, AssessmentSession, ProductEvent, Student, utcnow
from pathsync.engine import load_context, record_history, responses, student_states
from pathsync.security import db_session, rate_limit, student_access

from ..common import has_history, recommend_for

router = APIRouter(prefix="/api/students/{sid}/assessment", tags=["assessment"],
                   dependencies=[Depends(rate_limit("assessment", 60))])
SESSION_TTL = timedelta(hours=2)
MIN_SECONDS_PER_ITEM = float(os.getenv("PATHSYNC_MIN_SECONDS_PER_ITEM", "3"))


def _answered(s: Session, sid: str) -> set[str]:
    return set(s.scalars(select(AssessmentResponse.item_id).where(AssessmentResponse.student_id == sid)).all())


def _issue(s: Session, st: Student, phase: str, items: list[dict], skill_id: str | None) -> AssessmentSession:
    # one open session per (phase, skill): re-opening the page returns the same items
    now = utcnow()
    for old in s.scalars(select(AssessmentSession).where(AssessmentSession.student_id == st.id,
                                                         AssessmentSession.phase == phase,
                                                         AssessmentSession.submitted_at.is_(None))).all():
        if old.skill_id == skill_id and old.expires_at > now:
            return old
    sess = AssessmentSession(student_id=st.id, phase=phase, skill_id=skill_id, item_ids=[i["id"] for i in items],
                             expires_at=now + SESSION_TTL)
    s.add(sess)
    s.commit()
    return sess


def _items_payload(sess: AssessmentSession, names: dict) -> list[dict]:
    bank = item_bank()
    return [{**public_item(bank[i], sess.id), "skill_name": names[bank[i]["skill_id"]]} for i in sess.item_ids if i in bank]


@router.get("/diagnostic")
def diagnostic(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    ctx = load_context(s, st.target_role)
    plan = diagnostic_plan(ctx.market, student_states(s, st, ctx), _answered(s, st.id))
    if not plan:
        raise HTTPException(409, "You have answered every quick-check question for your role's key skills.")
    sess = _issue(s, st, "diagnostic", plan, None)
    return {"session_id": sess.id, "expires_at": sess.expires_at.isoformat(), "items": _items_payload(sess, ctx.names)}


@router.get("/reassess/{skill_id}")
def reassess(skill_id: str, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    ctx = load_context(s, st.target_role)
    if skill_id not in ctx.skills:
        raise HTTPException(404, "Unknown skill.")
    p = student_states(s, st, ctx)[skill_id].p
    items = reassessment_items(skill_id, p, _answered(s, st.id))
    if not items:
        raise HTTPException(409, f"No unseen questions left for {ctx.names[skill_id]}. "
                                 "Show this skill with a project from a course or your own work instead.")
    sess = _issue(s, st, "reassessment", items, skill_id)
    return {"session_id": sess.id, "skill_id": skill_id, "skill_name": ctx.names[skill_id], "p": p,
            "expires_at": sess.expires_at.isoformat(), "items": _items_payload(sess, ctx.names)}


class SubmitIn(BaseModel):
    session_id: str
    answers: list[dict] = Field(..., max_length=40)


@router.post("/submit")
def submit(body: SubmitIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    sess = s.get(AssessmentSession, body.session_id)
    if sess is None or sess.student_id != st.id:
        raise HTTPException(404, "This check session was not found. Start the check again.")
    if sess.submitted_at is not None:
        raise HTTPException(409, "This check was already submitted.")
    if sess.expires_at < utcnow():
        raise HTTPException(410, "This check expired. Start it again to get fresh questions.")
    try:
        answers = validate_submission(sess.item_ids, body.answers)
    except SubmissionError as e:
        raise HTTPException(400, str(e)) from None
    if not answers:
        raise HTTPException(400, "Answer at least one question.")
    ctx = load_context(s, st.target_role)
    before = student_states(s, st, ctx)
    elapsed = (utcnow() - sess.created_at).total_seconds()
    if elapsed < MIN_SECONDS_PER_ITEM * len(sess.item_ids):
        # a real read-and-answer takes seconds per question; a bot or an answer-sheet run does not (PM audit P0-1)
        raise HTTPException(422, "That was very fast. Read each question, then submit again.")
    graded = grade(answers, sess.id)
    for g in graded:
        s.add(AssessmentResponse(student_id=st.id, item_id=g["item_id"], skill_id=g["skill_id"], correct=g["correct"],
                                 choice_canon=g["choice_canon"], phase=sess.phase, session_id=sess.id))
    sess.submitted_at = utcnow()
    s.commit()
    s.refresh(st)
    after = student_states(s, st, ctx, responses(s, st.id))
    changed = {g["skill_id"]: {"name": ctx.names[g["skill_id"]], "p_before": round(before[g["skill_id"]].p, 3),
                               "p_after": round(after[g["skill_id"]].p, 3),
                               "trace": [round(x, 3) for x in after[g["skill_id"]].bkt_trace]} for g in graded}
    # server-side funnel events: trusted, because the client cannot claim a pass (PM audit §6.6)
    proved = [k for k, v in changed.items() if v["p_before"] < READINESS_THRESHOLD <= v["p_after"]]
    s.add(ProductEvent(name="check_completed", student_id=st.id, props={"phase": sess.phase, "correct": sum(g["correct"] for g in graded), "total": len(graded)}))
    if sess.phase == "reassessment" and proved:
        s.add(ProductEvent(name="reassess_passed", student_id=st.id, props={"skills": ",".join(proved)[:100]}))
    s.commit()
    trigger = "evidence" if has_history(s, st.id) else "initial"
    record_history(s, st, trigger, note=("skill check: " + ", ".join(v["name"] for v in changed.values()))[:200],
                   rec=recommend_for(s, st))
    return {"results": graded, "skills": changed, "correct": sum(g["correct"] for g in graded), "total": len(graded)}
