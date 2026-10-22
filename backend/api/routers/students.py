"""Student profile, evidence, dashboard, history, decision trace and personal-data rights.

Every route below /students/{sid} requires the student's bearer token (pathsync.security.student_access).
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from pathsync import soft
from pathsync.careers import careers_for
from pathsync.config import GRADE_SCORES, ROLES
from pathsync.db import (
    AssessmentResponse,
    CourseEnrollment,
    Evidence,
    PracticeAttempt,
    Pulse,
    RecommendationHistory,
    Student,
    StudyPlan,
    WeeklyPlan,
    utcnow,
)
from pathsync.engine import decision_trace, materials_by_skill, record_history
from pathsync.i18n import tr
from pathsync.intake import (
    DocumentRejected,
    DocumentTooLarge,
    academic_evidence,
    artifact_signature,
    certificate_evidence,
    cv_evidence,
    document_to_text,
    parse_transcript,
    project_evidence,
    signature_similarity,
    verification_link,
)
from pathsync.job_check import check_job
from pathsync.retention import erase_students
from pathsync.security import clip_text, db_session, hash_token, issue_token, new_token, rate_limit, read_upload, student_access
from pathsync.staff_accounts import hash_password, normalise_email, verify_password
from pathsync.taxonomy import load_skills

from ..common import after_change, fast_json, has_history, recommend_for
from .public import graph_payload

router = APIRouter(prefix="/api", tags=["students"])
MAX_PROJECTS_PER_DAY = 5
DUPLICATE_THRESHOLD = 0.9
CONSENT_VERSION = "2026-10b"


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_STUDENT_PASSWORD = 8
LOGIN_DAYS = 180


class StudentIn(BaseModel):
    display_name: str = Field("Student", max_length=120)
    email: str | None = Field(None, max_length=254)
    password: str | None = Field(None, max_length=200)
    program: str = Field("", max_length=120)
    semester: int | None = Field(None, ge=1, le=14)
    target_role: str = "business_analyst"
    consent: bool = False


class LoginIn(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=1, max_length=200)


class AccountIn(BaseModel):
    email: str | None = Field(None, max_length=254)
    password: str = Field(..., max_length=200)
    current_password: str | None = Field(None, max_length=200)


def _check_credentials(s: Session, email: str, password: str, sid: str | None = None) -> str:
    email = normalise_email(email)
    if not EMAIL_RE.match(email):
        raise HTTPException(400, tr("Enter a valid email address.", "Masukkan alamat email yang valid."))
    if len(password) < MIN_STUDENT_PASSWORD:
        raise HTTPException(400, tr(f"Use a password of at least {MIN_STUDENT_PASSWORD} characters.",
                                    f"Gunakan password minimal {MIN_STUDENT_PASSWORD} karakter."))
    owner = s.scalar(select(Student.id).where(Student.email == email))
    if owner is not None and owner != sid:
        raise HTTPException(409, tr("This email is already registered. Sign in instead.", "Email ini sudah terdaftar. Silakan masuk."))
    return email


class StudentPatch(BaseModel):
    display_name: str | None = Field(None, max_length=120)
    program: str | None = Field(None, max_length=120)
    semester: int | None = Field(None, ge=1, le=14)
    target_role: str | None = None
    preferences: dict | None = None
    self_ratings: dict[str, Annotated[int, Field(ge=1, le=5)]] | None = None


class JobCheckIn(BaseModel):
    text: str = Field(min_length=30, max_length=12_000)


@router.post("/students", dependencies=[Depends(rate_limit("signup", 20))])
def create_student(body: StudentIn, s: Session = Depends(db_session)):
    if not body.consent:
        raise HTTPException(400, tr("Please accept the data consent to continue.", "Setujui persetujuan data untuk melanjutkan."))
    if body.target_role not in ROLES:
        raise HTTPException(400, tr("Unknown target role.", "Target role tidak dikenal."))
    email = _check_credentials(s, body.email or "", body.password or "") if (body.email or body.password) else None
    token = new_token()
    st = Student(display_name=body.display_name.strip() or "Student", program=body.program, semester=body.semester,
                 target_role=body.target_role, consent_at=utcnow(), consent_version=CONSENT_VERSION,
                 token_hash=hash_token(token), preferences={"weekly_hours": 6, "language": "id"},
                 email=email, password_hash=hash_password(body.password) if email else None)
    s.add(st)
    s.commit()
    # the token is shown once; the server keeps only its hash
    return {"id": st.id, "token": token}


@router.post("/students/login", dependencies=[Depends(rate_limit("student_login", 10))])
def login_student(body: LoginIn, s: Session = Depends(db_session)):
    """Email + password sign-in. One message for every failure so it does not reveal which emails are registered.
    Each sign-in gets its own session token, so other devices stay signed in."""
    st = s.scalars(select(Student).where(Student.email == normalise_email(body.email))).first()
    if st is None or not verify_password(body.password, st.password_hash):
        raise HTTPException(401, tr("Wrong email or password.", "Email atau password salah."))
    token = issue_token(s, "student", st.id, "login", utcnow() + timedelta(days=LOGIN_DAYS))
    st.last_seen_at = utcnow()
    s.commit()
    return {"id": st.id, "token": token}


@router.put("/students/{sid}/account")
def set_account(body: AccountIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Add email + password to a profile made before accounts existed, or change the password (needs the current one)."""
    st = s.merge(st)
    if st.password_hash and not verify_password(body.current_password or "", st.password_hash):
        raise HTTPException(403, tr("Your current password is not correct.", "Password lama tidak sesuai."))
    st.email = _check_credentials(s, body.email or st.email or "", body.password, st.id)
    st.password_hash = hash_password(body.password)
    s.commit()
    return {"email": st.email}


def _student_out(s: Session, st: Student) -> dict:
    return {"id": st.id, "email": st.email, "display_name": st.display_name, "program": st.program, "semester": st.semester,
            "target_role": st.target_role, "preferences": st.preferences, "self_ratings": st.self_ratings,
            "cohort_id": st.cohort_id, "study_arm": st.study_arm if st.study_id else None,
            "consent_at": st.consent_at.isoformat() if st.consent_at else None, "consent_version": st.consent_version,
            "research_consent_at": st.research_consent_at.isoformat() if st.research_consent_at else None,
            "evidence": [{"id": e.id, "kind": e.kind, "title": e.title, "scores": e.scores,
                          "details": {k: v for k, v in (e.details or {}).items() if k != "signature"},
                          "review_status": e.review_status, "created_at": e.created_at.isoformat()} for e in st.evidence],
            "n_responses": len(s.scalars(select(AssessmentResponse.id).where(AssessmentResponse.student_id == st.id)).all())}


@router.get("/students/{sid}")
def get_student(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    return _student_out(s, st)


@router.patch("/students/{sid}")
def patch_student(body: StudentPatch, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    st = s.merge(st)
    if body.target_role and body.target_role not in ROLES:
        raise HTTPException(400, tr("Unknown target role.", "Target role tidak dikenal."))
    role_changed = bool(body.target_role and body.target_role != st.target_role)
    for k in ("display_name", "program", "semester", "target_role"):
        if getattr(body, k) is not None:
            setattr(st, k, getattr(body, k))
    if body.preferences is not None:
        allowed = {k: v for k, v in body.preferences.items() if k in ("weekly_hours", "format", "language")}
        if "weekly_hours" in allowed:
            allowed["weekly_hours"] = max(1, min(40, float(allowed["weekly_hours"])))
        st.preferences = {**(st.preferences or {}), **allowed}
    if body.self_ratings is not None:
        known = load_skills()
        st.self_ratings = {k: v for k, v in body.self_ratings.items() if k in known}
    s.commit()
    if role_changed and has_history(s, st.id):
        record_history(s, st, "role", note=f"new role {ROLES[st.target_role]['name']}", rec=recommend_for(s, st), force=True)
    return {"ok": True}


class SoftExperienceIn(BaseModel):
    skill_id: str
    level: int
    note: str = ""


@router.put("/students/{sid}/soft-experience")
def put_soft_experience(body: SoftExperienceIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Soft skills are recorded as experience (no quiz); they never enter the ranking or the path."""
    if body.skill_id not in soft.load_soft():
        raise HTTPException(400, tr("Unknown soft skill.", "Soft skill tidak dikenal."))
    if body.level not in soft.LEVELS:
        raise HTTPException(400, tr("Level must be 0-3.", "Level harus 0-3."))
    st = s.merge(st)
    prefs = dict(st.preferences or {})
    exp = soft.clean_experience(prefs.get("soft_experience"))
    exp[body.skill_id] = {"level": body.level, "note": body.note[: soft.MAX_NOTE]}
    prefs["soft_experience"] = exp
    st.preferences = prefs
    s.commit()
    return {"ok": True, "soft_experience": exp}


class MaterialIn(BaseModel):
    done: bool


@router.put("/students/{sid}/materials/{mid}")
def put_material(mid: str, body: MaterialIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Ticks a free learning material as done (Learn page). Study progress only: finishing a material never raises
    mastery, the skill check or a project does."""
    if not any(m["id"] == mid for mats in materials_by_skill().values() for m in mats):
        raise HTTPException(404, tr("Unknown material.", "Materi tidak dikenal."))
    st = s.merge(st)
    prefs = dict(st.preferences or {})
    done = dict(prefs.get("materials_done") or {})
    if body.done:
        done.setdefault(mid, utcnow().date().isoformat())
    else:
        done.pop(mid, None)
    prefs["materials_done"] = done
    st.preferences = prefs
    s.commit()
    return {"ok": True, "materials_done": done}


# ----------------------------------------------------------- personal data (UU PDP No. 27/2022)
@router.get("/students/{sid}/export")
def export_data(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Right of access: everything PathSync stores about this student, as JSON."""
    def rows(model):
        return [{c.name: (v.isoformat() if isinstance(v := getattr(r, c.name), datetime) else v) for c in model.__table__.columns
                 if c.name != "token_hash"} for r in s.scalars(select(model).where(model.student_id == st.id)).all()]
    return {"exported_at": utcnow().isoformat(), "profile": _student_out(s, st),
            "assessment_responses": rows(AssessmentResponse), "history": rows(RecommendationHistory),
            "courses": rows(CourseEnrollment), "weekly_plans": rows(WeeklyPlan), "pulses": rows(Pulse),
            "study_plans": rows(StudyPlan), "practice_attempts": rows(PracticeAttempt)}


@router.delete("/students/{sid}")
def erase(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Right to erasure: delete the profile and every record linked to it (usage events included)."""
    erase_students(s, [st.id])
    s.commit()
    return {"deleted": True}


# --------------------------------------------------------------- evidence
class CoursesIn(BaseModel):
    courses: list[dict] = Field(..., max_length=120)


class CertsIn(BaseModel):
    certificates: list[dict] = Field(..., max_length=40)


def _text_from(text: str, file: UploadFile | None) -> tuple[str, str | None]:
    if file is not None and file.filename:
        data, name = read_upload(file)
        try:
            text = document_to_text(data, name)
        except DocumentTooLarge as e:
            raise HTTPException(413, str(e)) from e
        except DocumentRejected as e:
            raise HTTPException(422, str(e)) from e
        except Exception as e:  # a damaged PDF/DOCX/notebook is the student's file problem, not a server error
            raise HTTPException(422, tr("We couldn't read this file. Try exporting it again as PDF, or paste the text instead.", "File ini tidak bisa kami baca. Coba ekspor ulang sebagai PDF, atau tempel teksnya.")) from e
        return clip_text(text), file.filename
    return clip_text(text), None


@router.post("/students/{sid}/transcript/parse", dependencies=[Depends(rate_limit("upload", 30))])
def parse_tr(st: Student = Depends(student_access), text: str = Form(""), file: UploadFile | None = File(None)):
    body, _ = _text_from(text, file)
    return {"courses": parse_transcript(body)}


@router.post("/students/{sid}/evidence/academic")
def add_academic(body: CoursesIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    st = s.merge(st)
    courses = [{"name": str(c.get("name", ""))[:200], "grade": str(c.get("grade", "")).upper()[:2]} for c in body.courses]
    if not any(c["grade"] in GRADE_SCORES for c in courses):
        raise HTTPException(400, tr("Add at least one course with a letter grade (A to E).", "Tambahkan minimal satu mata kuliah dengan nilai huruf (A sampai E)."))
    item, detail = academic_evidence(courses)
    s.execute(delete(Evidence).where(Evidence.student_id == st.id, Evidence.kind == "academic"))
    s.add(Evidence(student_id=st.id, kind="academic", title="Transcript", scores=item.scores,
                   details={"strength": item.strength, "courses": detail}))
    s.commit()
    after_change(s, st, "evidence", "transcript updated")
    return {"scores": item.scores, "courses": detail}


@router.post("/students/{sid}/evidence/certificate")
def add_cert(body: CertsIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    st = s.merge(st)
    certs = [{"name": str(c.get("name", ""))[:200], "score": c.get("score"), "url": str(c.get("url") or "")[:500]}
             for c in body.certificates if c.get("name")]
    if not certs:
        raise HTTPException(400, tr("Add at least one certificate name.", "Tambahkan minimal satu nama sertifikat."))
    # a credential link from a known issuer counts fully; a typed name alone is a claim at half weight (PM audit AI-3)
    groups = {"auto": [c for c in certs if verification_link(c["url"])], "claimed": [c for c in certs if not verification_link(c["url"])]}
    scores, details = {}, []
    for status, group in groups.items():
        if not group:
            continue
        item, detail = certificate_evidence(group)
        s.add(Evidence(student_id=st.id, kind="certificate", title=", ".join(c["name"] for c in group)[:290],
                       scores=item.scores, details={"strength": item.strength, "certificates": detail}, review_status=status))
        details += detail
        for k, v in item.scores.items():
            scores[k] = max(scores.get(k, 0.0), v)
    s.commit()
    after_change(s, st, "evidence", "new certificate")
    return {"scores": scores, "certificates": details, "claimed": len(groups["claimed"])}


@router.post("/students/{sid}/evidence/cv", dependencies=[Depends(rate_limit("upload", 30))])
def add_cv(st: Student = Depends(student_access), text: str = Form(""), file: UploadFile | None = File(None),
           s: Session = Depends(db_session)):
    st = s.merge(st)
    body, fname = _text_from(text, file)
    if len(body.strip()) < 20:
        raise HTTPException(400, tr("The CV text is too short. Paste the full CV or upload the file.", "Teks CV terlalu pendek. Tempel CV lengkap atau unggah file-nya."))
    item, detail = cv_evidence(body)
    s.execute(delete(Evidence).where(Evidence.student_id == st.id, Evidence.kind == "cv"))
    s.add(Evidence(student_id=st.id, kind="cv", title=fname or "CV", scores={}, details={"claim_ids": item.claims, **detail}))
    s.commit()
    after_change(s, st, "evidence", "CV updated")
    return detail


@router.post("/students/{sid}/evidence/project", dependencies=[Depends(rate_limit("upload", 30))])
def add_project(st: Student = Depends(student_access), title: str = Form("Project"), text: str = Form(""),
                course: str = Form(""), file: UploadFile | None = File(None), s: Session = Depends(db_session)):
    st = s.merge(st)
    since = utcnow() - timedelta(days=1)
    today = s.scalar(select(func.count(Evidence.id)).where(Evidence.student_id == st.id, Evidence.kind == "project",
                                                           Evidence.created_at >= since))
    if today >= MAX_PROJECTS_PER_DAY:
        raise HTTPException(429, tr(f"You can add up to {MAX_PROJECTS_PER_DAY} projects per day. Try again tomorrow.",
                                    f"Kamu bisa menambah maksimal {MAX_PROJECTS_PER_DAY} project per hari. Coba lagi besok."))
    body, _ = _text_from(text, file)
    if len(body.strip()) < 30:
        raise HTTPException(400, tr("The project text is too short. Paste more of it or upload the file.", "Teks project terlalu pendek. Tempel lebih banyak atau unggah file-nya."))
    sig = artifact_signature(body)
    for e in s.scalars(select(Evidence).where(Evidence.kind == "project")):
        if signature_similarity(sig, (e.details or {}).get("signature") or []) >= DUPLICATE_THRESHOLD:
            mine = e.student_id == st.id
            raise HTTPException(409, tr("You already added this project.", "Project ini sudah kamu tambahkan.") if mine else
                                tr("This document matches one another student already submitted. Upload your own work.", "Dokumen ini sama dengan yang sudah dikirim mahasiswa lain. Unggah karyamu sendiri."))
    item, detail = project_evidence(body, title[:200])
    detail["signature"] = sig
    if course:
        detail["course"] = course[:200]           # coursework used as evidence (classroom link)
    if detail["review_status"] == "rejected":
        raise HTTPException(422, detail["message"])
    s.add(Evidence(student_id=st.id, kind="project", title=title[:290], scores=item.scores,
                   details={"strength": item.strength, **detail}, review_status=detail["review_status"]))
    s.commit()
    after_change(s, st, "evidence", f"project '{title[:60]}'")
    return {"scores": item.scores, **{k: v for k, v in detail.items() if k != "signature"}}


@router.delete("/students/{sid}/evidence/{eid}")
def delete_evidence(eid: int, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    st = s.merge(st)
    e = s.get(Evidence, eid)
    if not e or e.student_id != st.id:
        raise HTTPException(404, tr("Evidence not found.", "Evidence tidak ditemukan."))
    s.delete(e)
    s.commit()
    after_change(s, st, "evidence", "evidence removed")
    return {"ok": True}


# ------------------------------------------------------------ dashboard
@router.post("/students/{sid}/check-job", dependencies=[Depends(rate_limit("check_job", 10))])
def check_pasted_job(body: JobCheckIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Analyze a pasted posting without writing its text or extracted skills to the database."""
    if not body.text.strip():
        raise HTTPException(422, tr("Paste the job requirements first.", "Tempel persyaratan lowongan dulu."))
    return check_job(s, st, body.text)


@router.get("/students/{sid}/dashboard")
def dashboard(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Read-only: history is written by the mutations and by market updates, never by a page view."""
    rec = recommend_for(s, st)
    rec["study_arm"] = st.study_arm if st.study_id else None
    return fast_json(rec)


@router.get("/students/{sid}/history")
def history(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    rows = s.scalars(select(RecommendationHistory).where(RecommendationHistory.student_id == st.id)
                     .order_by(RecommendationHistory.id.desc())).all()
    return [{"id": h.id, "created_at": h.created_at.isoformat(), "trigger": h.trigger, "summary": h.summary,
             "reasons": h.reasons, "ranking": h.ranking, "path": h.path, "coverage": h.coverage,
             "market_version": h.market_version, "model_name": h.model_name, "careers": h.careers} for h in rows]


@router.get("/students/{sid}/graph")
def student_graph(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    return fast_json(graph_payload(s, st.target_role, recommend_for(s, st)))


@router.get("/students/{sid}/careers")
def student_careers(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Readiness for every role from the same evidence (Career Map)."""
    return careers_for(s, st)


@router.get("/students/{sid}/trace/{skill_id}")
def trace(skill_id: str, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """How the decision engine reached this recommendation, step by step with the actual numbers."""
    try:
        return decision_trace(s, st, skill_id)
    except KeyError:
        raise HTTPException(404, tr("Unknown skill.", "Skill tidak dikenal.")) from None
