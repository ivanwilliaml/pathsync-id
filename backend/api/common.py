"""Helpers shared by the routers."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from pathsync.db import RecommendationHistory, Student, Study
from pathsync.engine import load_context, recommend, record_history
from pathsync.study import arm_features


def has_history(s: Session, sid: str) -> bool:
    return s.scalar(select(RecommendationHistory.id).where(RecommendationHistory.student_id == sid).limit(1)) is not None


def student_features(s: Session, st: Student) -> dict | None:
    """Feature flags of the student's study arm (None = full product)."""
    if not st.study_id or not st.study_arm:
        return None
    study = s.get(Study, st.study_id)
    return arm_features(study.arms, st.study_arm) if study else None


def recommend_for(s: Session, st: Student) -> dict:
    return recommend(s, st, load_context(s, st.target_role), features=student_features(s, st))


def after_change(s: Session, st: Student, trigger: str, note: str) -> None:
    """Record the adaptive-cycle step that a mutation caused (dashboard GETs never write)."""
    s.refresh(st)
    rec = recommend_for(s, st)
    record_history(s, st, trigger if has_history(s, st.id) else "initial", note=note, rec=rec)
