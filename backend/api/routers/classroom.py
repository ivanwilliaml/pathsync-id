"""Classroom companion, weekly plan/reflection cycle, clarity pulse, cohort and study enrolment."""
from __future__ import annotations

import random
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pathsync.classroom import course_companion, reflection_summary, suggest_week, week_start
from pathsync.db import Cohort, CourseEnrollment, Pulse, Student, Study, StudyPlan, WeeklyPlan, utcnow
from pathsync.engine import load_context
from pathsync.intake import map_course
from pathsync.security import db_session, student_access
from pathsync.study import assign_arm

from ..common import after_change, recommend_for

router = APIRouter(prefix="/api/students/{sid}", tags=["classroom"])
PULSE_ITEMS = {"clarity": "I know which skill to learn next and why.",
               "relevance": "What I am learning feels relevant to my courses and goals.",
               "actionable": "I know the concrete next step I will take this week."}


class CourseIn(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    term: str = Field("", max_length=20)
    status: str = "ongoing"


@router.get("/courses")
def list_courses(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    rows = s.scalars(select(CourseEnrollment).where(CourseEnrollment.student_id == st.id).order_by(CourseEnrollment.id)).all()
    return [{"id": c.id, "name": c.course_name, "term": c.term, "status": c.status, "mapping": c.mapping} for c in rows]


@router.post("/courses")
def add_course(body: CourseIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    n = s.scalar(select(func.count(CourseEnrollment.id)).where(CourseEnrollment.student_id == st.id))
    if n >= 15:
        raise HTTPException(400, "You can track up to 15 courses at a time.")
    m = map_course(body.name)
    row = CourseEnrollment(student_id=st.id, course_name=body.name.strip(), term=body.term,
                           status=body.status if body.status in ("ongoing", "completed") else "ongoing", mapping=m["skills"])
    s.add(row)
    s.commit()
    return {"id": row.id, "mapping": m}


@router.delete("/courses/{cid}")
def remove_course(cid: int, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    row = s.get(CourseEnrollment, cid)
    if not row or row.student_id != st.id:
        raise HTTPException(404, "Course not found.")
    s.delete(row)
    s.commit()
    return {"ok": True}


def _plan_out(p: WeeklyPlan | None) -> dict | None:
    if p is None:
        return None
    return {"id": p.id, "week_start": p.week_start.isoformat(), "goals": p.goals, "planned_minutes": p.planned_minutes,
            "reflection": p.reflection, "reflected_at": p.reflected_at.isoformat() if p.reflected_at else None}


@router.get("/classroom")
def classroom(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Courses -> skills -> path alignment, this week's plan (or a suggestion) and the reflection history."""
    ctx = load_context(s, st.target_role)
    rec = recommend_for(s, st)
    courses = [{"name": c.course_name, "mapping": c.mapping, "status": c.status}
               for c in s.scalars(select(CourseEnrollment).where(CourseEnrollment.student_id == st.id)).all()]
    comp = course_companion(courses, rec, ctx.skills)
    plans = s.scalars(select(WeeklyPlan).where(WeeklyPlan.student_id == st.id).order_by(WeeklyPlan.week_start.desc())).all()
    current = next((p for p in plans if p.week_start == week_start()), None)
    last_open = next((p for p in plans if p.week_start < week_start() and p.reflected_at is None), None)
    clarity = s.scalars(select(Pulse).where(Pulse.student_id == st.id, Pulse.item == "clarity").order_by(Pulse.id)).all()
    weekly_hours = float((st.preferences or {}).get("weekly_hours") or 6)
    return {"courses": comp, "week_start": week_start().isoformat(), "plan": _plan_out(current),
            "suggested_goals": suggest_week(rec, comp, weekly_hours) if current is None else None,
            "needs_reflection": _plan_out(last_open), "summary": reflection_summary(plans),
            "clarity": [{"value": p.value, "at": p.created_at.isoformat(), "context": p.context} for p in clarity],
            "pulse_items": PULSE_ITEMS, "unlinked_path_steps": [p["skill_id"] for p in rec["path"]
                                                               if not any(p["skill_id"] in c["aligned_skills"] for c in comp)]}


class PlanIn(BaseModel):
    goals: list[dict] = Field(..., min_length=1, max_length=8)


@router.post("/plans")
def save_plan(body: PlanIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    ws = week_start()
    goals = [{"skill_id": str(g.get("skill_id", ""))[:60], "name": str(g.get("name", ""))[:120],
              "kind": g.get("kind", "learn"), "course": (str(g["course"])[:200] if g.get("course") else None),
              "minutes": max(0, min(2400, int(g.get("minutes", 0) or 0))), "done": bool(g.get("done", False)),
              "material": g.get("material")} for g in body.goals]
    plan = s.scalars(select(WeeklyPlan).where(WeeklyPlan.student_id == st.id, WeeklyPlan.week_start == ws)).first()
    if plan is None:
        plan = WeeklyPlan(student_id=st.id, week_start=ws)
        s.add(plan)
    plan.goals = goals
    plan.planned_minutes = sum(g["minutes"] for g in goals)
    s.commit()
    return _plan_out(plan)


class ReflectIn(BaseModel):
    done_minutes: int = Field(..., ge=0, le=6000)
    confidence: int = Field(..., ge=1, le=5)
    goals_done: list[int] = Field(default_factory=list)     # indexes of completed goals
    obstacle: str = Field("", max_length=300)
    note: str = Field("", max_length=600)
    clarity: int | None = Field(None, ge=1, le=5)


@router.post("/plans/{pid}/reflect")
def reflect(pid: int, body: ReflectIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    plan = s.get(WeeklyPlan, pid)
    if not plan or plan.student_id != st.id:
        raise HTTPException(404, "Plan not found.")
    goals = [dict(g, done=i in set(body.goals_done)) for i, g in enumerate(plan.goals)]
    plan.goals = goals
    plan.reflection = {"done_minutes": body.done_minutes, "confidence": body.confidence, "obstacle": body.obstacle,
                       "note": body.note}
    plan.reflected_at = utcnow()
    if body.clarity is not None:
        s.add(Pulse(student_id=st.id, item="clarity", value=body.clarity, context="weekly_reflection"))
    s.commit()
    # completed "learn" goals become prompts to prove progress (closes the self-regulated learning loop)
    prove = [g["skill_id"] for g in goals if g.get("done") and g.get("kind") == "learn"]
    return {"ok": True, "suggest_skill_checks": prove}


class PulseIn(BaseModel):
    item: str
    value: int = Field(..., ge=1, le=5)
    context: str = Field("", max_length=40)


@router.post("/pulse")
def pulse(body: PulseIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    if body.item not in PULSE_ITEMS:
        raise HTTPException(400, "Unknown survey item.")
    s.add(Pulse(student_id=st.id, item=body.item, value=body.value, context=body.context))
    s.commit()
    return {"ok": True}


class JoinIn(BaseModel):
    join_code: str = Field(..., min_length=4, max_length=12)


@router.post("/cohort")
def join_cohort(body: JoinIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    c = s.scalars(select(Cohort).where(Cohort.join_code == body.join_code.strip().upper())).first()
    if c is None:
        raise HTTPException(404, "No class matches this code.")
    st.cohort_id = c.id
    s.commit()
    return {"cohort": {"id": c.id, "name": c.name, "institution": c.institution},
            "privacy": "Your lecturer sees class-level summaries only, never your individual results."}


@router.delete("/cohort")
def leave_cohort(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    st.cohort_id = None
    s.commit()
    return {"ok": True}


# ------------------------------------------------------------------ study
@router.post("/study")
def join_study(body: JoinIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    study = s.scalars(select(Study).where(Study.join_code == body.join_code.strip().upper(), Study.active.is_(True))).first()
    if study is None:
        raise HTTPException(404, "No active study matches this code.")
    if st.study_id == study.id:
        return {"study": study.name, "arm": st.study_arm}
    if st.study_id:
        raise HTTPException(409, "You are already enrolled in a study.")
    counts = dict(s.execute(select(Student.study_arm, func.count()).where(Student.study_id == study.id,
                                                                          Student.program == st.program)
                            .group_by(Student.study_arm)).all())
    st.study_id, st.study_arm = study.id, assign_arm(study.arms, counts, random.Random())
    s.commit()
    after_change(s, st, "manual", f"joined study {study.name}")
    return {"study": study.name, "arm": st.study_arm}


@router.post("/study/plan/start")
def start_plan(st: Student = Depends(student_access)):
    if not st.study_id:
        raise HTTPException(400, "Join a study first.")
    return {"started_at": utcnow().isoformat()}


class StudyPlanIn(BaseModel):
    plan_text: str = Field(..., min_length=40, max_length=8000)
    started_at: datetime


@router.post("/study/plan")
def submit_study_plan(body: StudyPlanIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Learning plan for H2 (quality, rated blind) and H3 (minutes to finish)."""
    if not st.study_id:
        raise HTTPException(400, "Join a study first.")
    started = body.started_at.replace(tzinfo=None)
    if not (0 <= (utcnow() - started).total_seconds() < 6 * 3600):
        raise HTTPException(400, "The plan timer is invalid. Start the plan again.")
    row = StudyPlan(student_id=st.id, study_id=st.study_id, plan_text=body.plan_text, started_at=started,
                    blind_code=secrets.token_hex(4).upper())
    s.add(row)
    s.commit()
    return {"ok": True, "minutes": round((row.submitted_at - started).total_seconds() / 60, 1)}
