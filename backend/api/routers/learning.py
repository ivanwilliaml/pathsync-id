"""Learning loop API (pathsync.learning_loop): stage status per route step, practice tasks, and server-graded answers.

Practice answers are stored for the student's own loop and export, but they never change mastery; the prove step is the
existing re-check (/assessment/reassess/{skill}).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from pathsync.db import PracticeAttempt, ProductEvent, Student
from pathsync.engine import load_context, materials_by_skill, student_states
from pathsync.i18n import tr
from pathsync.learning_loop import TIERS, PracticeError, _latest_attempts, grade_practice, loop_status, practice_bank, public_task
from pathsync.security import db_session, rate_limit, student_access

router = APIRouter(prefix="/api/students/{sid}/loop", tags=["learning loop"])
MAX_SKILLS = 12


def _materials(st: Student, skill_id: str) -> tuple[int, int]:
    done = (st.preferences or {}).get("materials_done") or {}
    ids = [m["id"] for m in materials_by_skill().get(skill_id, [])]
    return sum(i in done for i in ids), len(ids)


@router.get("")
def statuses(skills: Annotated[str, Query(max_length=800)] = "", st: Student = Depends(student_access),
             s: Session = Depends(db_session)):
    """Loop status for the given route skills (comma separated), diagnosed once."""
    ctx = load_context(s, st.target_role)
    wanted = [k for k in dict.fromkeys(skills.split(",")) if k in ctx.skills][:MAX_SKILLS]
    states = student_states(s, st, ctx)
    return {"skills": [loop_status(s, st, ctx, states, k, _materials(st, k)) for k in wanted]}


@router.get("/{skill_id}")
def skill_loop(skill_id: str, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    ctx = load_context(s, st.target_role)
    if skill_id not in ctx.skills:
        raise HTTPException(404, tr("Unknown skill.", "Skill tidak dikenal."))
    states = student_states(s, st, ctx)
    status = loop_status(s, st, ctx, states, skill_id, _materials(st, skill_id))
    content = practice_bank().get(skill_id)
    latest = _latest_attempts(s, st.id, skill_id) if content else {}
    tasks = [public_task(st.id, t, latest.get(t["id"])) for t in content["tasks"]] if content else []
    return {**status, "tasks": sorted(tasks, key=lambda t: TIERS.index(t["tier"]))}


class PracticeIn(BaseModel):
    task_id: str = Field(max_length=40)
    answer: int | list[int]


@router.post("/{skill_id}/practice", dependencies=[Depends(rate_limit("practice", 60))])
def answer_practice(skill_id: str, body: PracticeIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    content = practice_bank().get(skill_id)
    task = next((t for t in (content or {}).get("tasks", []) if t["id"] == body.task_id), None)
    if task is None:
        raise HTTPException(404, tr("This practice task was not found.", "Latihan ini tidak ditemukan."))
    try:
        graded = grade_practice(task, body.answer)
    except PracticeError as e:
        raise HTTPException(422, str(e)) from None
    s.add(PracticeAttempt(student_id=st.id, skill_id=skill_id, task_id=task["id"], tier=task["tier"],
                          correct=graded["correct"], answer=graded["answer"]))
    s.add(ProductEvent(name="practice_answered", student_id=st.id, props={"tier": task["tier"], "correct": graded["correct"]}))
    s.commit()
    ctx = load_context(s, st.target_role)
    status = loop_status(s, st, ctx, student_states(s, st, ctx), skill_id, _materials(st, skill_id))
    return {**graded, "task_id": task["id"], "tier": task["tier"], "status": status}
