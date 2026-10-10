"""Student profile, evidence, dashboard, history, decision trace and personal-data rights.

Every route below /students/{sid} requires the student's bearer token (pathsync.security.student_access).
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from pathsync.config import GRADE_SCORES, ROLES
from pathsync.db import (
    AssessmentResponse,
    AssessmentSession,
    CourseEnrollment,
    Evidence,
    Pulse,
    RecommendationHistory,
    Student,
    StudyPlan,
    WeeklyPlan,
    utcnow,
)
from pathsync.engine import decision_trace, record_history
from pathsync.intake import (
    academic_evidence,
    certificate_evidence,
    cv_evidence,
    document_to_text,
    parse_transcript,
    project_evidence,
)
from pathsync.security import clip_text, db_session, hash_token, new_token, rate_limit, read_upload, student_access

from ..common import after_change, has_history, recommend_for
from .public import graph_payload

router = APIRouter(prefix="/api", tags=["students"])
CONSENT_VERSION = "2026-10"


class StudentIn(BaseModel):
    display_name: str = Field("Student", max_length=120)
    program: str = Field("", max_length=120)
    semester: int | None = Field(None, ge=1, le=14)
    target_role: str = "business_analyst"
    consent: bool = False


class StudentPatch(BaseModel):
    display_name: str | None = Field(None, max_length=120)
    program: str | None = Field(None, max_length=120)
    semester: int | None = Field(None, ge=1, le=14)
    target_role: str | None = None
    preferences: dict | None = None
    self_ratings: dict[str, int] | None = None


@router.post("/students", dependencies=[Depends(rate_limit("signup", 10))])
def create_student(body: StudentIn, s: Session = Depends(db_session)):
    if not body.consent:
        raise HTTPException(400, "Please accept the data consent to continue.")
    if body.target_role not in ROLES:
        raise HTTPException(400, "Unknown target role.")
    token = new_token()
    st = Student(display_name=body.display_name.strip() or "Student", program=body.program, semester=body.semester,
                 target_role=body.target_role, consent_at=utcnow(), consent_version=CONSENT_VERSION,
                 token_hash=hash_token(token), preferences={"weekly_hours": 6, "language": "id"})
    s.add(st)
    s.commit()
    # the token is shown once; the server keeps only its hash
    return {"id": st.id, "token": token}


def _student_out(s: Session, st: Student) -> dict:
    return {"id": st.id, "display_name": st.display_name, "program": st.program, "semester": st.semester,
            "target_role": st.target_role, "preferences": st.preferences, "self_ratings": st.self_ratings,
            "cohort_id": st.cohort_id, "study_arm": st.study_arm if st.study_id else None,
            "consent_at": st.consent_at.isoformat() if st.consent_at else None, "consent_version": st.consent_version,
            "evidence": [{"id": e.id, "kind": e.kind, "title": e.title, "scores": e.scores, "details": e.details,
                          "review_status": e.review_status, "created_at": e.created_at.isoformat()} for e in st.evidence],
            "n_responses": len(s.scalars(select(AssessmentResponse.id).where(AssessmentResponse.student_id == st.id)).all())}


@router.get("/students/{sid}")
def get_student(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    return _student_out(s, st)


@router.patch("/students/{sid}")
def patch_student(body: StudentPatch, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    st = s.merge(st)
    if body.target_role and body.target_role not in ROLES:
        raise HTTPException(400, "Unknown target role.")
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
        st.self_ratings = {k: max(1, min(5, int(v))) for k, v in body.self_ratings.items()}
    s.commit()
    if role_changed and has_history(s, st.id):
        record_history(s, st, "role", note=f"new role {ROLES[st.target_role]['name']}", rec=recommend_for(s, st), force=True)
    return {"ok": True}


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
            "study_plans": rows(StudyPlan)}


@router.delete("/students/{sid}")
def erase(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Right to erasure: delete the profile and every record linked to it."""
    for model in (AssessmentResponse, AssessmentSession, RecommendationHistory, CourseEnrollment, WeeklyPlan, Pulse, StudyPlan,
                  Evidence):
        s.execute(delete(model).where(model.student_id == st.id))
    s.execute(delete(Student).where(Student.id == st.id))
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
        return clip_text(document_to_text(data, name)), file.filename
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
        raise HTTPException(400, "Add at least one course with a letter grade (A to E).")
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
    certs = [{"name": str(c.get("name", ""))[:200], "score": c.get("score")} for c in body.certificates if c.get("name")]
    if not certs:
        raise HTTPException(400, "Add at least one certificate name.")
    item, detail = certificate_evidence(certs)
    s.add(Evidence(student_id=st.id, kind="certificate", title=", ".join(c["name"] for c in certs)[:290],
                   scores=item.scores, details={"strength": item.strength, "certificates": detail}))
    s.commit()
    after_change(s, st, "evidence", "new certificate")
    return {"scores": item.scores, "certificates": detail}


@router.post("/students/{sid}/evidence/cv", dependencies=[Depends(rate_limit("upload", 30))])
def add_cv(st: Student = Depends(student_access), text: str = Form(""), file: UploadFile | None = File(None),
           s: Session = Depends(db_session)):
    st = s.merge(st)
    body, fname = _text_from(text, file)
    if len(body.strip()) < 20:
        raise HTTPException(400, "The CV text is too short. Paste the full CV or upload the file.")
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
    body, _ = _text_from(text, file)
    if len(body.strip()) < 30:
        raise HTTPException(400, "The project text is too short. Paste more of it or upload the file.")
    item, detail = project_evidence(body, title[:200])
    if course:
        detail["course"] = course[:200]           # coursework used as evidence (classroom link)
    if detail["review_status"] == "rejected":
        raise HTTPException(422, detail["message"])
    s.add(Evidence(student_id=st.id, kind="project", title=title[:290], scores=item.scores,
                   details={"strength": item.strength, **detail}, review_status=detail["review_status"]))
    s.commit()
    after_change(s, st, "evidence", f"project '{title[:60]}'")
    return {"scores": item.scores, **detail}


@router.delete("/students/{sid}/evidence/{eid}")
def delete_evidence(eid: int, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    st = s.merge(st)
    e = s.get(Evidence, eid)
    if not e or e.student_id != st.id:
        raise HTTPException(404, "Evidence not found.")
    s.delete(e)
    s.commit()
    after_change(s, st, "evidence", "evidence removed")
    return {"ok": True}


# ------------------------------------------------------------ dashboard
@router.get("/students/{sid}/dashboard")
def dashboard(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """Read-only: history is written by the mutations and by market updates, never by a page view."""
    rec = recommend_for(s, st)
    rec["study_arm"] = st.study_arm if st.study_id else None
    return rec


@router.get("/students/{sid}/history")
def history(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    rows = s.scalars(select(RecommendationHistory).where(RecommendationHistory.student_id == st.id)
                     .order_by(RecommendationHistory.id.desc())).all()
    return [{"id": h.id, "created_at": h.created_at.isoformat(), "trigger": h.trigger, "summary": h.summary,
             "reasons": h.reasons, "ranking": h.ranking, "path": h.path, "coverage": h.coverage,
             "market_version": h.market_version, "model_name": h.model_name} for h in rows]


@router.get("/students/{sid}/graph")
def student_graph(st: Student = Depends(student_access), s: Session = Depends(db_session)):
    return graph_payload(s, st.target_role, recommend_for(s, st))


@router.get("/students/{sid}/trace/{skill_id}")
def trace(skill_id: str, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    """How the decision engine reached this recommendation, step by step with the actual numbers."""
    try:
        return decision_trace(s, st, skill_id)
    except KeyError:
        raise HTTPException(404, "Unknown skill.") from None
