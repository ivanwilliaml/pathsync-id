"""One-click demo profile: a realistic Business Analyst student with a transcript already in, so a visitor (or a jury)
sees diagnosis -> bottleneck priority -> adaptive update in a minute instead of typing a transcript first.

Demo profiles are flagged in preferences, never enter research data, and are deleted by the retention job after
DEMO_PROFILE_DAYS (pathsync.retention). Disable with PATHSYNC_DEMO=0.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from pathsync.config import tr
from pathsync.db import Evidence, Student, utcnow
from pathsync.intake import academic_evidence
from pathsync.security import db_session, hash_token, new_token, rate_limit

from ..common import after_change

router = APIRouter(prefix="/api", tags=["demo"])

# A typical Information Systems transcript: strong on process modelling, statistics and spreadsheets, average on
# requirements and visualisation, weak on databases. The route is whatever the live model makes of it (with the
# 2026-10 market map: Requirements Elicitation first, as a bottleneck); nothing here is tuned to force a result.
DEMO_COURSES = [
    {"name": "Analisis dan Perancangan Sistem Informasi", "grade": "B"},
    {"name": "Manajemen Proses Bisnis", "grade": "A"},
    {"name": "Rekayasa Perangkat Lunak", "grade": "B"},
    {"name": "Statistika Bisnis", "grade": "A"},
    {"name": "Spreadsheet untuk Bisnis", "grade": "A"},
    {"name": "Visualisasi Data", "grade": "B"},
    {"name": "Basis Data", "grade": "C"},
    {"name": "Sistem Informasi Manajemen", "grade": "B"},
]


@router.post("/demo/profile", dependencies=[Depends(rate_limit("signup", 20))])
def demo_profile(s: Session = Depends(db_session)):
    if os.getenv("PATHSYNC_DEMO", "1") == "0":
        raise HTTPException(404, tr("The demo profile is turned off on this server.", "Profil demo dimatikan di server ini."))
    token = new_token()
    st = Student(display_name="Rani (demo)", program="Information Systems", semester=6, target_role="business_analyst",
                 consent_at=utcnow(), consent_version="demo", token_hash=hash_token(token),
                 preferences={"weekly_hours": 6, "language": "id", "demo": True})
    s.add(st)
    s.flush()
    item, detail = academic_evidence(DEMO_COURSES)
    s.add(Evidence(student_id=st.id, kind="academic", title="Transcript (demo)", scores=item.scores,
                   details={"strength": item.strength, "courses": detail}))
    s.commit()
    after_change(s, st, "evidence", "demo transcript")
    return {"id": st.id, "token": token}
