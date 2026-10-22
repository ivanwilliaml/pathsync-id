"""One-click demo profile: a realistic Business Analyst student a few weeks into using PathSync, so a visitor (or a
jury) sees every part filled in: evidence of several kinds, a skill check, a route that changed over time, a weekly
plan with a reflection, finished materials and recorded soft-skill experience.

Everything goes through the same scoring code as a real student (transcript, certificate catalog, project rubric,
skill-check items and the engine); only the answers to the check are simulated, from her own skill estimates, and
nothing is tuned to force a result. Demo profiles are flagged in preferences, never enter research data, and are
deleted by the retention job after DEMO_PROFILE_DAYS (pathsync.retention). Disable with PATHSYNC_DEMO=0.
"""
from __future__ import annotations

import os
import random
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from pathsync.assessment import diagnostic_plan, grade
from pathsync.classroom import week_start
from pathsync.db import (
    AssessmentResponse,
    AssessmentSession,
    CourseEnrollment,
    Evidence,
    Pulse,
    RecommendationHistory,
    Student,
    WeeklyPlan,
    utcnow,
)
from pathsync.engine import load_context, materials_by_skill, student_states
from pathsync.i18n import tr
from pathsync.intake import academic_evidence, certificate_evidence, map_course, project_evidence, verification_link
from pathsync.security import db_session, hash_token, new_token, rate_limit

from ..common import after_change, recommend_for

router = APIRouter(prefix="/api", tags=["demo"])

# A typical Information Systems transcript: strong on process modelling, statistics and spreadsheets, average on
# requirements and visualisation, weak on databases.
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
# What she takes this semester (semester 6), so the week view shows how coursework can prove route skills.
DEMO_CURRENT = ["Rekayasa Kebutuhan", "Business Intelligence", "Sistem Enterprise", "Interaksi Manusia dan Komputer"]
# Two catalog certificates: one with a credential link (counts fully), one typed in (a claim at half weight).
DEMO_CERTS = [
    {"name": "Google Data Analytics Professional Certificate", "url": "https://www.coursera.org/account/accomplishments/professional-cert/DEMO"},
    {"name": "Dicoding: Belajar Dasar Structured Query Language (SQL)", "url": ""},
]
# A course assignment she wrote herself: a short requirements document. Scored by the rubric heuristic.
DEMO_PROJECT_TITLE = "Dokumen Kebutuhan: Sistem Peminjaman Ruang Kampus"
DEMO_PROJECT = """Dokumen Kebutuhan Bisnis (BRD) - Sistem Peminjaman Ruang Kampus
Tugas mata kuliah Rekayasa Kebutuhan, kelompok 3.

1. Latar belakang
Peminjaman ruang saat ini memakai formulir kertas dan grup WhatsApp. Kami melakukan wawancara stakeholder dengan
staf bagian umum, dua ketua himpunan dan dosen pengampu, lalu observasi proses selama satu minggu.

2. Proses bisnis
Kami memodelkan proses as-is dan to-be dengan BPMN: pengajuan, pengecekan jadwal, persetujuan, dan pengembalian kunci.
Bottleneck ada di pengecekan jadwal manual yang memakan rata-rata dua hari.

3. User story dan acceptance criteria
- Sebagai ketua himpunan, saya ingin melihat ruang yang kosong agar bisa mengajukan peminjaman tanpa datang ke kantor.
  Acceptance criteria: daftar ruang menampilkan status per jam; pengajuan tersimpan dan mendapat nomor.
- Sebagai staf bagian umum, saya ingin menyetujui pengajuan dalam satu layar agar antrean tidak menumpuk.
  Acceptance criteria: persetujuan atau penolakan mengirim notifikasi email ke pemohon.

4. Kebutuhan fungsional dan non-fungsional
Kebutuhan fungsional dirinci per modul; kebutuhan non-fungsional mencakup waktu respons di bawah dua detik.
Kami menyusun traceability matrix dari kebutuhan ke user story dan ke skenario uji.

5. Rencana UAT
Skenario user acceptance testing ditulis bersama staf bagian umum: 12 skenario, termasuk bentrok jadwal.
Hasil uji coba prototipe di Figma: 9 dari 12 skenario lolos, tiga dicatat sebagai perbaikan.
"""
DEMO_SOFT = {
    "collaboration": (2, "Tim capstone 4 orang, pembagian modul dan review mingguan"),
    "verbal_communication": (2, "Wawancara stakeholder untuk tugas Rekayasa Kebutuhan"),
    "presentation_storytelling": (1, "Presentasi hasil UAT di kelas"),
}


def _age(s: Session, model, student_id: str, days: float) -> None:
    """Moves the newest row of a table back in time, so the demo reads like a few weeks of real use."""
    row = s.scalars(select(model).where(model.student_id == student_id).order_by(model.id.desc())).first()
    if row is not None:
        row.created_at = utcnow() - timedelta(days=days)


@router.post("/demo/profile", dependencies=[Depends(rate_limit("signup", 20))])
def demo_profile(s: Session = Depends(db_session)):
    if os.getenv("PATHSYNC_DEMO", "1") == "0":
        raise HTTPException(404, tr("The demo profile is turned off on this server.", "Profil demo dimatikan di server ini."))
    token = new_token()
    st = Student(display_name="Rani", program="Information Systems", semester=6, target_role="business_analyst",
                 consent_at=utcnow() - timedelta(days=16), consent_version="demo", token_hash=hash_token(token),
                 preferences={"weekly_hours": 6, "language": "id", "format": "kursus", "demo": True})
    s.add(st)
    s.flush()
    for name in DEMO_CURRENT:
        s.add(CourseEnrollment(student_id=st.id, course_name=name, term="2026/2027 Ganjil", status="ongoing",
                               mapping=map_course(name)["skills"]))

    # 1. transcript (16 days ago): the first route
    item, detail = academic_evidence(DEMO_COURSES)
    s.add(Evidence(student_id=st.id, kind="academic", title="Transkrip", scores=item.scores,
                   details={"strength": item.strength, "courses": detail}, created_at=utcnow() - timedelta(days=16)))
    s.commit()
    after_change(s, st, "evidence", "demo transcript")
    _age(s, RecommendationHistory, st.id, 16)

    # 2. certificates (12 days ago), split by whether the credential link is from a known issuer
    for status, group in (("auto", [c for c in DEMO_CERTS if verification_link(c["url"])]),
                          ("claimed", [c for c in DEMO_CERTS if not verification_link(c["url"])])):
        if group:
            ci, cd = certificate_evidence(group)
            s.add(Evidence(student_id=st.id, kind="certificate", title=", ".join(c["name"] for c in group)[:290],
                           scores=ci.scores, details={"strength": ci.strength, "certificates": cd}, review_status=status,
                           created_at=utcnow() - timedelta(days=12)))
    s.commit()
    after_change(s, st, "evidence", "new certificate")
    _age(s, RecommendationHistory, st.id, 12)

    # 3. a skill check (8 days ago): answers simulated from her current estimates (higher level, more often right)
    ctx = load_context(s, st.target_role)
    states = student_states(s, st, ctx)
    plan = diagnostic_plan(ctx.market, states, set())[:16]
    if plan:
        sess = AssessmentSession(student_id=st.id, phase="diagnostic", item_ids=[i["id"] for i in plan],
                                 expires_at=utcnow(), created_at=utcnow() - timedelta(days=8), submitted_at=utcnow() - timedelta(days=8))
        s.add(sess)
        s.flush()
        answers = []
        for it in plan:
            p = states[it["skill_id"]].p if it["skill_id"] in states else 0.3
            right = random.Random(it["id"]).random() < 0.3 + 0.6 * p
            answers.append({"item_id": it["id"], "choice": it["answer"] if right else (it["answer"] + 1) % len(it["options"])})
        for g in grade(answers):
            s.add(AssessmentResponse(student_id=st.id, item_id=g["item_id"], skill_id=g["skill_id"], correct=g["correct"],
                                     choice_canon=g["choice_canon"], phase="diagnostic", session_id=sess.id,
                                     created_at=utcnow() - timedelta(days=8)))
        s.commit()
        after_change(s, st, "evidence", "skill check")
        _age(s, RecommendationHistory, st.id, 8)

    # 4. a course project (3 days ago), scored by the rubric heuristic (no model call on a demo click)
    pi, pd = project_evidence(DEMO_PROJECT, DEMO_PROJECT_TITLE, use_llm=False)
    if pi.scores:
        pd["course"] = "Rekayasa Kebutuhan"
        s.add(Evidence(student_id=st.id, kind="project", title=DEMO_PROJECT_TITLE, scores=pi.scores,
                       details={"strength": pi.strength, **pd}, review_status="auto", created_at=utcnow() - timedelta(days=3)))
        s.commit()
        after_change(s, st, "evidence", "new project")
        _age(s, RecommendationHistory, st.id, 3)

    # 5. study habits: last week planned and reflected, this week planned, one material finished, soft skills noted
    rec = recommend_for(s, st)
    steps = rec.get("path", [])[:2]
    mats = materials_by_skill()
    goals = [{"skill_id": p["skill_id"], "name": p["name"], "kind": "learn", "course": None, "minutes": 180, "done": False,
              "material": None} for p in steps]
    if goals:
        last = WeeklyPlan(student_id=st.id, week_start=week_start() - timedelta(days=7),
                          goals=[dict(g, done=i == 0) for i, g in enumerate(goals)], planned_minutes=360,
                          reflection={"done_minutes": 250, "confidence": 3, "obstacle": "Minggu UTS, waktu belajar terpotong", "note": ""},
                          created_at=utcnow() - timedelta(days=9), reflected_at=utcnow() - timedelta(days=2))
        s.add(last)
        s.add(WeeklyPlan(student_id=st.id, week_start=week_start(), goals=goals, planned_minutes=360,
                         created_at=utcnow() - timedelta(days=1)))
        s.add(Pulse(student_id=st.id, item="clarity", value=4, context="weekly_reflection"))
    prefs = dict(st.preferences or {})
    first = next((m for p in steps for m in mats.get(p["skill_id"], [])), None)
    if first:
        prefs["materials_done"] = {first["id"]: (utcnow() - timedelta(days=5)).date().isoformat()}
    prefs["soft_experience"] = {k: {"level": lvl, "note": note} for k, (lvl, note) in DEMO_SOFT.items()}
    st.preferences = prefs
    s.commit()
    return {"id": st.id, "token": token}
