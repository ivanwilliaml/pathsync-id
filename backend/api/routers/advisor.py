"""Lecturer / academic-advisor view: class-level, anonymised (k >= 5) gaps against the job market."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from pathsync.classroom import cohort_report, reflection_summary
from pathsync.db import ApiToken, Cohort, CourseEnrollment, Pulse, Student, WeeklyPlan
from pathsync.engine import load_context, recommend
from pathsync.security import db_session, require_advisor

router = APIRouter(prefix="/api/advisor", tags=["advisor"])


def _cohorts(tok: ApiToken, s: Session) -> list[Cohort]:
    if tok.role == "admin":
        return s.scalars(select(Cohort).order_by(Cohort.created_at)).all()
    c = s.get(Cohort, tok.subject_id)
    return [c] if c else []


@router.get("/cohorts")
def cohorts(tok: ApiToken = Depends(require_advisor), s: Session = Depends(db_session)):
    out = []
    for c in _cohorts(tok, s):
        n = len(s.scalars(select(Student.id).where(Student.cohort_id == c.id)).all())
        out.append({"id": c.id, "name": c.name, "institution": c.institution, "join_code": c.join_code, "n_students": n})
    return out


@router.get("/cohorts/{cid}/report")
def report(cid: str, role: str = "business_analyst", tok: ApiToken = Depends(require_advisor), s: Session = Depends(db_session)):
    if cid not in {c.id for c in _cohorts(tok, s)}:
        raise HTTPException(403, "This class is not yours.")
    ctx = load_context(s, role)
    rows = []
    for st in s.scalars(select(Student).where(Student.cohort_id == cid, Student.target_role == role)).all():
        rec = recommend(s, st, ctx)
        courses = [c.course_name for c in s.scalars(select(CourseEnrollment).where(CourseEnrollment.student_id == st.id)).all()]
        clarity = [p.value for p in s.scalars(select(Pulse).where(Pulse.student_id == st.id, Pulse.item == "clarity")).all()]
        plans = s.scalars(select(WeeklyPlan).where(WeeklyPlan.student_id == st.id)).all()
        rows.append({"p": {c["skill_id"]: c["p"] for c in rec["competencies"]},
                     "required": {c["skill_id"]: c["required"] for c in rec["competencies"] if c["required"]},
                     "demand": {c["skill_id"]: c["demand"] for c in rec["competencies"]},
                     "courses": courses, "clarity": clarity, "plans": reflection_summary(plans)})
    return {"cohort_id": cid, "role": role, **cohort_report(rows, ctx.skills)}
