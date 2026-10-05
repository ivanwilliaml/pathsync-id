"""PathSync REST API (FastAPI). Run: uvicorn api.main:app --port 8000"""
from __future__ import annotations

import json
import threading
from datetime import date, datetime

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from pathsync.assessment import diagnostic_plan, grade, item_bank, public_item, reassessment_items
from pathsync.config import MODELS_DIR, PROCESSED_DIR, ROLES
from pathsync.db import (Annotation, AssessmentResponse, EdgeVote, Evidence, Expert, GraphEdge, MarketSnapshot, Posting,
                         PostingMention, RankerModel, RecommendationHistory, Scenario, ScenarioRanking, Student,
                         active_snapshot, get_session, init_db, utcnow)
from pathsync.demand import MarketMap, apply_market_shift
from pathsync.engine import (check_market_trigger, ensure_seed, graph_from_db, load_context, recommend, record_history,
                             student_states)
from pathsync.extraction.llm import llm_configured
from pathsync.intake import (academic_evidence, certificate_evidence, cv_evidence, document_to_text, parse_transcript,
                             project_evidence)
from pathsync.taxonomy import CycleError, Edge, SkillGraph, cluster_names, load_skills, load_taxonomy

app = FastAPI(title="PathSync API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def db():
    s = get_session()
    try:
        yield s
    finally:
        s.close()


@app.on_event("startup")
def _startup():
    init_db()
    with get_session() as s:
        ensure_seed(s)


def _student(s: Session, sid: str) -> Student:
    st = s.get(Student, sid)
    if not st:
        raise HTTPException(404, "mahasiswa tidak ditemukan")
    return st


# ------------------------------------------------------------------- meta
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/meta")
def meta(s: Session = Depends(db)):
    tax = load_taxonomy()
    model = s.scalars(select(RankerModel).where(RankerModel.active.is_(True))).first()
    snaps = {r: (active_snapshot(s, r).version if active_snapshot(s, r) else None) for r in ROLES}
    return {"roles": [{"id": k, "name": v["name"]} for k, v in ROLES.items()], "clusters": tax["clusters"],
            "taxonomy_version": tax["version"],
            "skills": [{k: sk[k] for k in ("id", "name", "name_en", "cluster", "kind", "description", "learn_what")} for sk in tax["skills"]],
            "extractor": "llm" if llm_configured() else "lexicon",
            "market_versions": snaps, "model": {"name": model.name, "weights": model.weights} if model else None,
            "n_postings": s.scalar(select(func.count(Posting.id)).where(Posting.duplicate_of.is_(None))),
            "n_items": len(item_bank())}


# --------------------------------------------------------------- students
class StudentIn(BaseModel):
    display_name: str = "Mahasiswa"
    program: str = ""
    target_role: str = "business_analyst"
    consent: bool = False


class StudentPatch(BaseModel):
    display_name: str | None = None
    program: str | None = None
    target_role: str | None = None
    preferences: dict | None = None
    self_ratings: dict | None = None


@app.post("/api/students")
def create_student(body: StudentIn, s: Session = Depends(db)):
    if not body.consent:
        raise HTTPException(400, "persetujuan penggunaan data diperlukan")
    if body.target_role not in ROLES:
        raise HTTPException(400, "peran tidak dikenal")
    st = Student(display_name=body.display_name or "Mahasiswa", program=body.program, target_role=body.target_role,
                 consent_at=utcnow(), preferences={"weekly_hours": 6, "language": "id"})
    s.add(st)
    s.commit()
    return {"id": st.id}


@app.get("/api/students/{sid}")
def get_student(sid: str, s: Session = Depends(db)):
    st = _student(s, sid)
    return {"id": st.id, "display_name": st.display_name, "program": st.program, "target_role": st.target_role,
            "preferences": st.preferences, "self_ratings": st.self_ratings,
            "evidence": [{"id": e.id, "kind": e.kind, "title": e.title, "scores": e.scores, "details": e.details,
                          "created_at": e.created_at.isoformat()} for e in st.evidence],
            "n_responses": s.scalar(select(func.count(AssessmentResponse.id)).where(AssessmentResponse.student_id == sid))}


@app.patch("/api/students/{sid}")
def patch_student(sid: str, body: StudentPatch, s: Session = Depends(db)):
    st = _student(s, sid)
    role_changed = body.target_role and body.target_role != st.target_role
    if body.target_role and body.target_role not in ROLES:
        raise HTTPException(400, "peran tidak dikenal")
    for k in ("display_name", "program", "target_role"):
        if getattr(body, k) is not None:
            setattr(st, k, getattr(body, k))
    if body.preferences is not None:
        st.preferences = {**(st.preferences or {}), **body.preferences}
    if body.self_ratings is not None:
        st.self_ratings = {k: int(v) for k, v in body.self_ratings.items()}
    s.commit()
    if role_changed and s.scalar(select(RecommendationHistory.id).where(RecommendationHistory.student_id == sid)):
        record_history(s, st, "role", note=f"peran baru {ROLES[st.target_role]['name']}", force=True)
    return {"ok": True}


# --------------------------------------------------------------- evidence
def _after_evidence(s: Session, st: Student, note: str):
    s.refresh(st)
    if s.scalar(select(RecommendationHistory.id).where(RecommendationHistory.student_id == st.id)):
        record_history(s, st, "evidence", note=note)


class CoursesIn(BaseModel):
    courses: list[dict]


@app.post("/api/students/{sid}/transcript/parse")
async def parse_tr(sid: str, text: str = Form(""), file: UploadFile | None = File(None)):
    if file is not None:
        text = document_to_text(await file.read(), file.filename or "x.txt")
    return {"courses": parse_transcript(text)}


@app.post("/api/students/{sid}/evidence/academic")
def add_academic(sid: str, body: CoursesIn, s: Session = Depends(db)):
    st = _student(s, sid)
    item, detail = academic_evidence(body.courses)
    for e in [e for e in st.evidence if e.kind == "academic"]:
        s.delete(e)
    s.add(Evidence(student_id=sid, kind="academic", title="Transkrip", scores=item.scores,
                   details={"strength": item.strength, "courses": detail}))
    s.commit()
    _after_evidence(s, st, "transkrip diperbarui")
    return {"scores": item.scores, "courses": detail}


class CertsIn(BaseModel):
    certificates: list[dict]


@app.post("/api/students/{sid}/evidence/certificate")
def add_cert(sid: str, body: CertsIn, s: Session = Depends(db)):
    st = _student(s, sid)
    item, detail = certificate_evidence(body.certificates)
    s.add(Evidence(student_id=sid, kind="certificate", title=", ".join(c["name"] for c in body.certificates)[:290],
                   scores=item.scores, details={"strength": item.strength, "certificates": detail}))
    s.commit()
    _after_evidence(s, st, "sertifikat baru")
    return {"scores": item.scores, "certificates": detail}


@app.post("/api/students/{sid}/evidence/cv")
async def add_cv(sid: str, text: str = Form(""), file: UploadFile | None = File(None), s: Session = Depends(db)):
    st = _student(s, sid)
    if file is not None:
        text = document_to_text(await file.read(), file.filename or "cv.txt")
    if len(text.strip()) < 20:
        raise HTTPException(400, "teks CV terlalu pendek")
    item, detail = cv_evidence(text)
    for e in [e for e in st.evidence if e.kind == "cv"]:
        s.delete(e)
    s.add(Evidence(student_id=sid, kind="cv", title=file.filename if file else "CV", scores={},
                   details={"claim_ids": item.claims, **detail}))
    s.commit()
    _after_evidence(s, st, "CV diperbarui")
    return detail


@app.post("/api/students/{sid}/evidence/project")
async def add_project(sid: str, title: str = Form("Proyek"), text: str = Form(""), file: UploadFile | None = File(None),
                      s: Session = Depends(db)):
    st = _student(s, sid)
    if file is not None:
        text = document_to_text(await file.read(), file.filename or "proyek.txt")
    if len(text.strip()) < 30:
        raise HTTPException(400, "artefak proyek terlalu pendek")
    item, detail = project_evidence(text, title)
    s.add(Evidence(student_id=sid, kind="project", title=title[:290], scores=item.scores,
                   details={"strength": item.strength, **detail}))
    s.commit()
    _after_evidence(s, st, f"proyek '{title}'")
    return {"scores": item.scores, **detail}


@app.delete("/api/students/{sid}/evidence/{eid}")
def delete_evidence(sid: str, eid: int, s: Session = Depends(db)):
    st = _student(s, sid)
    e = s.get(Evidence, eid)
    if not e or e.student_id != sid:
        raise HTTPException(404)
    s.delete(e)
    s.commit()
    _after_evidence(s, st, "bukti dihapus")
    return {"ok": True}


# ------------------------------------------------------------- assessment
def _answered(s: Session, sid: str) -> set[str]:
    return set(s.scalars(select(AssessmentResponse.item_id).where(AssessmentResponse.student_id == sid)).all())


@app.get("/api/students/{sid}/assessment/diagnostic")
def diag(sid: str, s: Session = Depends(db)):
    st = _student(s, sid)
    ctx = load_context(s, st.target_role)
    plan = diagnostic_plan(ctx.market, student_states(s, st, ctx), _answered(s, sid))
    names = ctx.names
    return {"items": [{**public_item(i), "skill_name": names[i["skill_id"]]} for i in plan]}


@app.get("/api/students/{sid}/assessment/reassess/{skill_id}")
def reassess(sid: str, skill_id: str, s: Session = Depends(db)):
    st = _student(s, sid)
    ctx = load_context(s, st.target_role)
    p = student_states(s, st, ctx)[skill_id].p
    return {"skill_id": skill_id, "skill_name": ctx.names[skill_id], "p": p,
            "items": [{**public_item(i), "skill_name": ctx.names[skill_id]} for i in reassessment_items(skill_id, p, _answered(s, sid))]}


class SubmitIn(BaseModel):
    phase: str = "diagnostic"
    answers: list[dict]


@app.post("/api/students/{sid}/assessment/submit")
def submit(sid: str, body: SubmitIn, s: Session = Depends(db)):
    st = _student(s, sid)
    if body.phase not in ("diagnostic", "reassessment"):
        raise HTTPException(400, "fase tidak dikenal")
    ctx = load_context(s, st.target_role)
    before = student_states(s, st, ctx)
    graded = grade(body.answers)
    session_id = datetime.now().strftime("%Y%m%d%H%M%S")
    for g in graded:
        s.add(AssessmentResponse(student_id=sid, item_id=g["item_id"], skill_id=g["skill_id"], correct=g["correct"],
                                 phase=body.phase, session_id=session_id))
    s.commit()
    s.refresh(st)
    after = student_states(s, st, ctx)
    changed = {}
    for g in graded:
        k = g["skill_id"]
        changed[k] = {"name": ctx.names[k], "p_before": round(before[k].p, 3), "p_after": round(after[k].p, 3),
                      "trace": [round(x, 3) for x in after[k].bkt_trace]}
    if body.phase == "diagnostic" and not s.scalar(select(RecommendationHistory.id).where(RecommendationHistory.student_id == sid)):
        record_history(s, st, "initial")
    else:
        record_history(s, st, "evidence", note=("asesmen ulang " + ", ".join(v["name"] for v in changed.values()))[:200])
    return {"results": graded, "skills": changed, "correct": sum(g["correct"] for g in graded), "total": len(graded)}


# -------------------------------------------------------------- dashboard
@app.get("/api/students/{sid}/dashboard")
def dashboard(sid: str, s: Session = Depends(db)):
    st = _student(s, sid)
    rec = recommend(s, st)
    check_market_trigger(s, st, rec)
    if not s.scalar(select(RecommendationHistory.id).where(RecommendationHistory.student_id == sid)) and \
            (st.evidence or rec["diagnostic_done"]):
        record_history(s, st, "initial", rec=rec)
    return rec


@app.get("/api/students/{sid}/history")
def history(sid: str, s: Session = Depends(db)):
    _student(s, sid)
    rows = s.scalars(select(RecommendationHistory).where(RecommendationHistory.student_id == sid)
                     .order_by(RecommendationHistory.id.desc())).all()
    return [{"id": h.id, "created_at": h.created_at.isoformat(), "trigger": h.trigger, "summary": h.summary,
             "reasons": h.reasons, "ranking": h.ranking, "path": h.path, "coverage": h.coverage,
             "market_version": h.market_version, "model_name": h.model_name} for h in rows]


@app.get("/api/students/{sid}/graph")
def student_graph(sid: str, s: Session = Depends(db)):
    st = _student(s, sid)
    rec = recommend(s, st)
    return _graph_payload(s, st.target_role, rec)


# ------------------------------------------------------------------ market
@app.get("/api/market/{role}")
def market(role: str, s: Session = Depends(db)):
    if role not in ROLES:
        raise HTTPException(404)
    snap = active_snapshot(s, role)
    if not snap:
        raise HTTPException(404, "belum ada snapshot pasar")
    skills = load_skills()
    data = snap.data
    rows = []
    for k, v in data["skills"].items():
        if v["count"] == 0 and k not in snap.required:
            continue
        rows.append({**v, "name": skills[k].name, "cluster": skills[k].cluster, "required": snap.required.get(k)})
    rows.sort(key=lambda r: -r["demand"])
    hist = s.scalars(select(MarketSnapshot).where(MarketSnapshot.role == role).order_by(MarketSnapshot.id.desc()).limit(10)).all()
    return {"role": role, "role_name": ROLES[role]["name"], "version": snap.version, "simulated": snap.simulated,
            "note": snap.note, "reference_date": data["reference_date"], "n_postings": data["n_postings"],
            "n_recent": data["n_recent"], "n_previous": data["n_previous"], "trend_status": data["trend_status"],
            "sources": snap.sources, "skills": rows,
            "snapshots": [{"id": h.id, "version": h.version, "created_at": h.created_at.isoformat(), "active": h.active,
                           "simulated": h.simulated, "note": h.note} for h in hist]}


@app.get("/api/market/{role}/skill/{skill_id}")
def market_skill(role: str, skill_id: str, s: Session = Depends(db)):
    rows = s.execute(select(PostingMention, Posting).join(Posting, Posting.id == PostingMention.posting_id)
                     .where(Posting.role == role, Posting.duplicate_of.is_(None), Posting.in_window.is_(True),
                            PostingMention.skill_id == skill_id, PostingMention.status == "auto")
                     .order_by(Posting.published_at.desc())).all()
    seen, out = set(), []
    for m, p in rows:
        if p.id in seen:
            continue
        seen.add(p.id)
        out.append({"posting_id": p.id, "title": p.title, "company": p.company, "source": p.source, "url": p.url,
                    "published_at": p.published_at.isoformat() if p.published_at else None, "quote": m.quote,
                    "level": m.level, "surface": m.surface, "method": m.method})
    return {"skill_id": skill_id, "name": load_skills()[skill_id].name, "evidence": out}


@app.get("/api/postings")
def postings(role: str | None = None, q: str | None = None, limit: int = 100, s: Session = Depends(db)):
    stmt = select(Posting).where(Posting.duplicate_of.is_(None))
    if role:
        stmt = stmt.where(Posting.role == role)
    if q:
        stmt = stmt.where(Posting.title.ilike(f"%{q}%"))
    rows = s.scalars(stmt.order_by(Posting.published_at.desc()).limit(limit)).all()
    return [{"id": p.id, "title": p.title, "company": p.company, "source": p.source, "location": p.location, "url": p.url,
             "published_at": p.published_at.isoformat() if p.published_at else None, "role": p.role,
             "language": p.language, "in_window": p.in_window,
             "skills": sorted({m.skill_id for m in p.mentions if m.status == "auto" and m.skill_id})} for p in rows]


@app.get("/api/postings/{pid:path}")
def posting(pid: str, s: Session = Depends(db)):
    p = s.get(Posting, pid)
    if not p:
        raise HTTPException(404)
    return {"id": p.id, "title": p.title, "company": p.company, "url": p.url, "source": p.source, "description": p.description,
            "published_at": p.published_at.isoformat() if p.published_at else None, "extractor": p.extractor,
            "mentions": [{"skill_id": m.skill_id, "surface": m.surface, "quote": m.quote, "level": m.level,
                          "similarity": m.similarity, "status": m.status, "method": m.method} for m in p.mentions]}


# ------------------------------------------------------------------- graph
def _graph_payload(s: Session, role: str, rec: dict | None = None) -> dict:
    g = graph_from_db(s)
    skills = load_skills()
    depth = g.depth()
    snap = active_snapshot(s, role)
    D = {k: v["demand"] for k, v in snap.data["skills"].items()} if snap else {}
    comp = {c["skill_id"]: c for c in (rec or {}).get("competencies", [])}
    rank = {r["skill_id"]: r for r in (rec or {}).get("ranking", [])}
    path = {p["skill_id"] for p in (rec or {}).get("path", [])}
    nodes = []
    for k, sk in skills.items():
        c = comp.get(k, {})
        nodes.append({"id": k, "name": sk.name, "cluster": sk.cluster, "depth": depth[k], "demand": D.get(k, 0.0),
                      "p": c.get("p"), "required": c.get("required"), "rank": rank.get(k, {}).get("rank"),
                      "in_path": k in path, "bottleneck": bool(rank.get(k, {}).get("explanation", {}) and
                                                               rank[k]["explanation"].get("bottleneck"))})
    rows = s.scalars(select(GraphEdge)).all()
    edges = [{"id": e.id, "from": e.src, "to": e.dst, "source": e.source, "rationale": e.rationale, "status": e.status,
              "active": any(a.src == e.src and a.dst == e.dst for a in g.active_edges())} for e in rows]
    return {"nodes": nodes, "edges": edges, "clusters": cluster_names()}


@app.get("/api/graph")
def graph(role: str = "business_analyst", s: Session = Depends(db)):
    return _graph_payload(s, role)


# ------------------------------------------------------------ expert panel
class ExpertIn(BaseModel):
    name: str
    affiliation: str = ""
    kind: str = "dosen"
    validates_graph: bool = True


@app.get("/api/experts")
def experts(s: Session = Depends(db)):
    return [{"id": e.id, "name": e.name, "affiliation": e.affiliation, "kind": e.kind, "validates_graph": e.validates_graph}
            for e in s.scalars(select(Expert).where(Expert.kind != "simulasi")).all()]


@app.post("/api/experts")
def add_expert(body: ExpertIn, s: Session = Depends(db)):
    e = Expert(name=body.name, affiliation=body.affiliation, kind=body.kind, validates_graph=body.validates_graph)
    s.add(e)
    s.commit()
    return {"id": e.id}


@app.get("/api/expert/edges")
def expert_edges(s: Session = Depends(db)):
    skills = load_skills()
    out = []
    for e in s.scalars(select(GraphEdge).order_by(GraphEdge.id)).all():
        votes = [v for v in e.votes]
        out.append({"id": e.id, "from": e.src, "to": e.dst, "from_name": skills[e.src].name, "to_name": skills[e.dst].name,
                    "source": e.source, "rationale": e.rationale, "status": e.status,
                    "approve": sum(v.approve for v in votes), "reject": sum(not v.approve for v in votes),
                    "votes": [{"expert_id": v.expert_id, "approve": v.approve, "comment": v.comment} for v in votes]})
    return out


class VoteIn(BaseModel):
    expert_id: str
    approve: bool
    comment: str = ""


@app.post("/api/expert/edges/{eid}/vote")
def vote(eid: int, body: VoteIn, s: Session = Depends(db)):
    e = s.get(GraphEdge, eid)
    if not e or not s.get(Expert, body.expert_id):
        raise HTTPException(404)
    old = s.scalars(select(EdgeVote).where(EdgeVote.edge_id == eid, EdgeVote.expert_id == body.expert_id)).first()
    if old:
        old.approve, old.comment = body.approve, body.comment
    else:
        s.add(EdgeVote(edge_id=eid, expert_id=body.expert_id, approve=body.approve, comment=body.comment))
    s.commit()
    return {"ok": True}


class EdgeIn(BaseModel):
    src: str
    dst: str
    rationale: str = ""


@app.post("/api/expert/edges")
def propose_edge(body: EdgeIn, s: Session = Depends(db)):
    skills = load_skills()
    if body.src not in skills or body.dst not in skills or body.src == body.dst:
        raise HTTPException(400, "keterampilan tidak valid")
    edges = [Edge(r.src, r.dst) for r in s.scalars(select(GraphEdge)).all()] + [Edge(body.src, body.dst)]
    try:
        SkillGraph(skills, edges)
    except CycleError:
        raise HTTPException(400, "sisi ini membuat siklus pada graf")
    s.add(GraphEdge(src=body.src, dst=body.dst, source="pakar", rationale=body.rationale, status="draft"))
    s.commit()
    return {"ok": True}


@app.post("/api/expert/edges/finalize")
def finalize_edges(s: Session = Depends(db)):
    """Keep an edge when at least two of three experts approve it (paper III.A.3)."""
    summary = {"approved": 0, "rejected": 0, "draft": 0}
    for e in s.scalars(select(GraphEdge)).all():
        a = sum(v.approve for v in e.votes)
        r = sum(not v.approve for v in e.votes)
        e.status = "approved" if a >= 2 else "rejected" if r >= 2 else "draft"
        summary[e.status] += 1
    try:
        g = graph_from_db(s)
        g.check_acyclic()
    except CycleError:
        s.rollback()
        raise HTTPException(400, "graf hasil validasi memiliki siklus")
    s.commit()
    return summary


@app.get("/api/expert/scenarios")
def scenarios(expert_id: str | None = None, s: Session = Depends(db)):
    rows = s.scalars(select(Scenario).order_by(Scenario.base_id, Scenario.id)).all()
    done = set()
    if expert_id:
        done = set(s.scalars(select(ScenarioRanking.scenario_id).where(ScenarioRanking.expert_id == expert_id)).all())
    counts = dict(s.execute(select(ScenarioRanking.scenario_id, func.count()).where(ScenarioRanking.simulated.is_(False))
                            .group_by(ScenarioRanking.scenario_id)).all())
    return [{"id": r.id, "base_id": r.base_id, "variant": r.variant, "title": r.title, "done": r.id in done,
             "n_rankings": counts.get(r.id, 0)} for r in rows]


@app.get("/api/expert/scenarios/{scid}")
def scenario(scid: str, s: Session = Depends(db)):
    r = s.get(Scenario, scid)
    if not r:
        raise HTTPException(404)
    skills = load_skills()
    pl = r.payload
    cands = [{"skill_id": c, "name": skills[c].name, "p": pl["student"][c]["p"], "r": pl["student"][c]["r"],
              "K": pl["student"][c]["K"], "D": pl["market"][c]["D"], "T": pl["market"][c]["T"],
              "prereqs": [{"skill_id": q, "name": skills[q].name, "p": pl["student"].get(q, {}).get("p")}
                          for q in graph_from_db(s).prereqs.get(c, [])]}
             for c in pl["candidates"]]
    # experts must rank without seeing system output: candidates shuffled deterministically, no scores shown
    import random
    random.Random(scid).shuffle(cands)
    return {"id": r.id, "base_id": r.base_id, "variant": r.variant, "title": r.title, "changed": pl.get("changed", {}),
            "candidates": cands}


class RankIn(BaseModel):
    expert_id: str
    order: list[str]


@app.post("/api/expert/scenarios/{scid}/rank")
def rank_scenario(scid: str, body: RankIn, s: Session = Depends(db)):
    r = s.get(Scenario, scid)
    if not r or not s.get(Expert, body.expert_id):
        raise HTTPException(404)
    if sorted(body.order) != sorted(r.payload["candidates"]):
        raise HTTPException(400, "urutan harus memuat seluruh kandidat tepat satu kali")
    old = s.scalars(select(ScenarioRanking).where(ScenarioRanking.scenario_id == scid,
                                                  ScenarioRanking.expert_id == body.expert_id)).first()
    if old:
        old.order = body.order
    else:
        s.add(ScenarioRanking(scenario_id=scid, expert_id=body.expert_id, order=body.order, simulated=False))
    s.commit()
    return {"ok": True}


def _collected(s: Session, simulated: bool):
    from collections import defaultdict
    by = defaultdict(list)
    for rr in s.scalars(select(ScenarioRanking).where(ScenarioRanking.simulated.is_(simulated))).all():
        by[rr.scenario_id].append(rr.order)
    return by


@app.get("/api/expert/agreement")
def agreement(simulated: bool = False, s: Session = Depends(db)):
    from pathsync.ranker import kendalls_w
    by = _collected(s, simulated)
    per = {k: round(kendalls_w(v), 4) for k, v in by.items() if len(v) >= 2}
    return {"per_scenario": per, "mean_w": round(sum(per.values()) / len(per), 4) if per else None,
            "n_scenarios_ranked": len(by), "n_with_2plus": len(per)}


class TrainIn(BaseModel):
    use_simulated: bool = False
    activate_if_passes: bool = True


@app.post("/api/expert/train")
def train(body: TrainIn, s: Session = Depends(db)):
    from pathsync.evaluation import NON_INFERIORITY, adaptivity, cross_validate, passes_rule, train_full
    from pathsync.ranker import aggregate_orders
    by = _collected(s, body.use_simulated)
    scen = {r.id: r.payload for r in s.scalars(select(Scenario)).all()}
    data = [scen[k] for k in by if k in scen]
    if len({d["base_id"] for d in data}) < 3:
        raise HTTPException(400, "butuh peringkat pakar untuk minimal 3 skenario dasar")
    refs = {k: aggregate_orders(v) for k, v in by.items() if k in scen}
    cv = cross_validate(data, refs, k=min(5, len({d["base_id"] for d in data})))
    w, lam = train_full(data, refs)
    ok = passes_rule(cv)
    activate = ok and body.activate_if_passes
    if activate:
        s.execute(update(RankerModel).values(active=False))
    m = RankerModel(name=f"LTR {'simulasi' if body.use_simulated else 'pakar'} {datetime.now():%Y-%m-%d %H:%M}",
                    source="simulated" if body.use_simulated else "expert", weights=w, active=activate,
                    metrics={"cv": cv["methods"], "l2": lam, "passes_rule": ok, "margin": NON_INFERIORITY,
                             "adaptivity": adaptivity(data, refs, w)})
    s.add(m)
    s.commit()
    return {"model_id": m.id, "weights": w, "active": activate, "passes_rule": ok, "cv": cv["methods"]}


@app.get("/api/models")
def models(s: Session = Depends(db)):
    return [{"id": m.id, "name": m.name, "source": m.source, "weights": m.weights, "metrics": m.metrics,
             "active": m.active, "created_at": m.created_at.isoformat()}
            for m in s.scalars(select(RankerModel).order_by(RankerModel.id.desc())).all()]


@app.post("/api/models/{mid}/activate")
def activate_model(mid: int, s: Session = Depends(db)):
    m = s.get(RankerModel, mid)
    if not m:
        raise HTTPException(404)
    s.execute(update(RankerModel).values(active=False))
    m.active = True
    s.commit()
    return {"ok": True}


@app.get("/api/evaluation")
def evaluation():
    p = MODELS_DIR / "evaluation_report.json"
    if not p.exists():
        raise HTTPException(404, "jalankan python -m pipeline.expert_study")
    return json.loads(p.read_text(encoding="utf-8"))


# -------------------------------------------------------------------- admin
_job = {"running": False, "log": [], "started": None, "finished": None, "ok": None}


def _run_refresh():
    import subprocess
    import sys
    from pathsync.config import BACKEND_DIR
    _job.update(running=True, log=[], started=datetime.now().isoformat(timespec="seconds"), finished=None, ok=None)
    ok = True
    for mod in ("scrapers.karirhub", "scrapers.ats", "pipeline.build_market"):
        _job["log"].append(f"$ python -m {mod}")
        proc = subprocess.run([sys.executable, "-m", mod] + (["--extractor", "lexicon"] if mod == "pipeline.build_market" and not llm_configured() else []),
                              cwd=BACKEND_DIR, capture_output=True, text=True, encoding="utf-8", errors="replace")
        _job["log"] += [ln for ln in (proc.stdout + proc.stderr).splitlines() if ln.startswith("[")][-15:]
        if proc.returncode != 0:
            ok = False
            _job["log"].append(f"gagal: {mod} (kode {proc.returncode})")
            break
    _job.update(running=False, finished=datetime.now().isoformat(timespec="seconds"), ok=ok)


@app.post("/api/admin/market/refresh")
def refresh_market():
    if _job["running"]:
        raise HTTPException(409, "pembaruan sedang berjalan")
    threading.Thread(target=_run_refresh, daemon=True).start()
    return {"started": True}


@app.get("/api/admin/market/refresh")
def refresh_status():
    return _job


class ShiftIn(BaseModel):
    role: str = "business_analyst"
    skill_id: str
    demand_delta: float = 0.2
    trend: float | None = 0.5


@app.post("/api/admin/market/simulate")
def simulate_market(body: ShiftIn, s: Session = Depends(db)):
    """Simulated market change (evaluation of adaptivity trigger 2); clearly marked as simulated."""
    snap = active_snapshot(s, body.role)
    if not snap:
        raise HTTPException(404)
    m = apply_market_shift(MarketMap.from_dict(snap.data), body.skill_id, body.demand_delta, body.trend)
    if m.trend_status != "ok":
        m.trend_status = "simulasi"
    s.execute(update(MarketSnapshot).where(MarketSnapshot.role == body.role).values(active=False))
    name = load_skills()[body.skill_id].name
    new = MarketSnapshot(version=f"{snap.version.split('+')[0]}+sim{datetime.now():%H%M%S}", role=body.role,
                         reference_date=snap.reference_date, data=m.to_dict(), required=snap.required, sources=snap.sources,
                         note=f"SIMULASI: permintaan {name} {body.demand_delta:+.0%}", simulated=True, active=True)
    s.add(new)
    s.commit()
    return {"version": new.version}


@app.post("/api/admin/market/reset")
def reset_market(role: str = "business_analyst", s: Session = Depends(db)):
    real = s.scalars(select(MarketSnapshot).where(MarketSnapshot.role == role, MarketSnapshot.simulated.is_(False))
                     .order_by(MarketSnapshot.id.desc())).first()
    if not real:
        raise HTTPException(404)
    s.execute(update(MarketSnapshot).where(MarketSnapshot.role == role).values(active=False))
    real.active = True
    s.commit()
    return {"version": real.version}


@app.get("/api/admin/stats")
def stats(s: Session = Depends(db)):
    def cnt(stmt):
        return s.scalar(stmt) or 0
    by_source = dict(s.execute(select(Posting.source, func.count()).where(Posting.duplicate_of.is_(None)).group_by(Posting.source)).all())
    by_role = dict(s.execute(select(Posting.role, func.count()).where(Posting.duplicate_of.is_(None), Posting.in_window.is_(True))
                             .group_by(Posting.role)).all())
    by_status = dict(s.execute(select(PostingMention.status, func.count()).group_by(PostingMention.status)).all())
    report = {}
    p = PROCESSED_DIR / "market_latest.json"
    if p.exists():
        report = json.loads(p.read_text(encoding="utf-8"))
    return {"postings_total": cnt(select(func.count(Posting.id))),
            "duplicates": cnt(select(func.count(Posting.id)).where(Posting.duplicate_of.is_not(None))),
            "by_source": by_source, "in_window_by_role": by_role, "mentions_by_status": by_status,
            "students": cnt(select(func.count(Student.id))), "experts": cnt(select(func.count(Expert.id)).where(Expert.kind != "simulasi")),
            "scenarios": cnt(select(func.count(Scenario.id))),
            "annotations": cnt(select(func.count(Annotation.id))), "extractor": "llm" if llm_configured() else "lexicon",
            "last_build": report.get("version")}


@app.get("/api/admin/review-queue")
def review_queue(status: str = "review", limit: int = 100, s: Session = Depends(db)):
    rows = s.execute(select(PostingMention, Posting.title).join(Posting, Posting.id == PostingMention.posting_id)
                     .where(PostingMention.status == status, PostingMention.review_decision.is_(None)).limit(limit)).all()
    return [{"id": m.id, "posting_id": m.posting_id, "title": t, "surface": m.surface, "quote": m.quote,
             "skill_id": m.skill_id, "similarity": m.similarity} for m, t in rows]


class ReviewIn(BaseModel):
    decision: str      # accept | reject | <skill_id>


@app.post("/api/admin/review-queue/{mid}")
def review(mid: int, body: ReviewIn, s: Session = Depends(db)):
    m = s.get(PostingMention, mid)
    if not m:
        raise HTTPException(404)
    m.review_decision = body.decision
    if body.decision == "accept" and m.skill_id:
        m.status = "auto"
    elif body.decision in load_skills():
        m.skill_id, m.status = body.decision, "auto"
    else:
        m.status = "rejected"
    s.commit()
    return {"ok": True}


# --------------------------------------------- extraction annotation (Table 7, level 1)
@app.get("/api/annotation/next")
def annotation_next(annotator: str, s: Session = Depends(db)):
    done = set(s.scalars(select(Annotation.posting_id).where(Annotation.annotator == annotator)).all())
    for p in s.scalars(select(Posting).where(Posting.duplicate_of.is_(None)).order_by(Posting.id)).all():
        if p.id not in done:
            return {"posting_id": p.id, "title": p.title, "company": p.company, "description": p.description,
                    "remaining": s.scalar(select(func.count(Posting.id)).where(Posting.duplicate_of.is_(None))) - len(done)}
    return {"posting_id": None}


class AnnotIn(BaseModel):
    posting_id: str
    annotator: str
    skill_ids: list[str]


@app.post("/api/annotation")
def annotate(body: AnnotIn, s: Session = Depends(db)):
    old = s.scalars(select(Annotation).where(Annotation.posting_id == body.posting_id, Annotation.annotator == body.annotator)).first()
    if old:
        old.skill_ids = body.skill_ids
    else:
        s.add(Annotation(posting_id=body.posting_id, annotator=body.annotator, skill_ids=body.skill_ids))
    s.commit()
    return {"ok": True}


@app.get("/api/annotation/eval")
def annotation_eval(s: Session = Depends(db)):
    """Precision / recall / F1 of the extractor against gold annotations (target F1 >= 0.75)."""
    from collections import defaultdict
    gold = defaultdict(set)
    for a in s.scalars(select(Annotation)).all():
        gold[a.posting_id] |= set(a.skill_ids)
    tp = fp = fn = 0
    for pid, g in gold.items():
        p = s.get(Posting, pid)
        pred = {m.skill_id for m in p.mentions if m.status == "auto" and m.skill_id}
        tp += len(pred & g)
        fp += len(pred - g)
        fn += len(g - pred)
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return {"n_postings": len(gold), "precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4),
            "target_f1": 0.75, "tp": tp, "fp": fp, "fn": fn}
