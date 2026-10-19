"""Admin console API: data pipeline, market simulation, reviews, annotation, models, staff accounts,
classes, studies and calibration. Every route requires an admin token."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from pathsync.config import BACKEND_DIR, PROCESSED_DIR, ROLES
from pathsync.db import (
    NON_EXPERT_KINDS,
    Annotation,
    ApiToken,
    Cohort,
    Evidence,
    Expert,
    MarketSnapshot,
    Posting,
    PostingMention,
    Pulse,
    RankerModel,
    Scenario,
    ScenarioRanking,
    StaffAccount,
    Student,
    Study,
    StudyPlan,
    active_snapshot,
    bump_epoch,
    utcnow,
)
from pathsync.demand import MarketMap, apply_market_shift
from pathsync.engine import finalize_edges as engine_finalize_edges
from pathsync.engine import propagate_market_change
from pathsync.extraction.llm import llm_configured
from pathsync.gold import agreement as annotator_agreement
from pathsync.gold import load_split_all, prf
from pathsync.security import audit_admin_writes, db_session, issue_token, require_admin, revoke
from pathsync.staff_accounts import INVITE_DAYS, new_invite, normalise_email
from pathsync.study import DEFAULT_ARMS, analyse, join_code
from pathsync.taxonomy import CycleError, load_skills

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin), Depends(audit_admin_writes)])


@router.get("/whoami")
def whoami():
    return {"role": "admin"}


# ------------------------------------------------------------------- stats
@router.get("/runtime")
def runtime(s: Session = Depends(db_session)):
    """Plan C4: p95 and error rate per route (this worker), database and market-snapshot health,
    and the alerts an operator should act on."""
    from pathsync.observability import STATS, health

    ok, h = health(s)
    routes = STATS.snapshot()
    alerts = []
    if not ok:
        alerts.append("database unreachable")
    if h.get("market_stale"):
        alerts.append(f"market snapshot older than {h.get('market_max_age_days')} days (age {h.get('market_age_days')})")
    alerts += [f"{r}: p95 {v['p95_ms']} ms" for r, v in routes.items() if v["requests"] >= 20 and v["p95_ms"] > 1000]
    alerts += [f"{r}: error rate {v['error_rate']:.1%}" for r, v in routes.items() if v["requests"] >= 20 and v["error_rate"] > 0.01]
    from pathsync.security import limiter

    if limiter.fallbacks:
        alerts.append(f"rate limiter fell back to per-worker memory {limiter.fallbacks} times (Redis unreachable)")
    return {"worker_pid": os.getpid(), "health": {"ok": ok, **h}, "routes": routes, "alerts": alerts,
            "rate_limiter": {"backend": limiter.backend, "fallbacks": limiter.fallbacks}}


@router.get("/stats")
def stats(s: Session = Depends(db_session)):
    def cnt(stmt):
        return s.scalar(stmt) or 0
    by_source = dict(s.execute(select(Posting.source, func.count()).where(Posting.duplicate_of.is_(None)).group_by(Posting.source)).all())
    by_role = dict(s.execute(select(Posting.role, func.count()).where(Posting.duplicate_of.is_(None), Posting.in_window.is_(True))
                             .group_by(Posting.role)).all())
    by_status = dict(s.execute(select(PostingMention.status, func.count()).group_by(PostingMention.status)).all())
    p = PROCESSED_DIR / "market_latest.json"
    report = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    return {"postings_total": cnt(select(func.count(Posting.id))),
            "duplicates": cnt(select(func.count(Posting.id)).where(Posting.duplicate_of.is_not(None))),
            "by_source": by_source, "in_window_by_role": by_role, "mentions_by_status": by_status,
            "students": cnt(select(func.count(Student.id))), "experts": cnt(select(func.count(Expert.id)).where(Expert.kind.not_in(NON_EXPERT_KINDS))),
            "scenarios": cnt(select(func.count(Scenario.id))), "annotations": cnt(select(func.count(Annotation.id))),
            "pending_project_reviews": cnt(select(func.count(Evidence.id)).where(Evidence.review_status == "pending")),
            "cohorts": cnt(select(func.count(Cohort.id))), "studies": cnt(select(func.count(Study.id))),
            "extractor": "llm" if llm_configured() else "lexicon", "last_build": report.get("version")}


# -------------------------------------------------------------- market job
REFRESH_STEPS = [("scrapers.karirhub", "Collecting Karirhub postings"), ("scrapers.ats", "Collecting company career-site postings"),
                 ("pipeline.build_market", "Rebuilding the market map")]
job = {"running": False, "log": [], "started": None, "finished": None, "ok": None, "cancelled": False,
       "step": None, "step_index": None, "n_steps": len(REFRESH_STEPS)}
proc_ref = {"p": None}
_lock = threading.Lock()


def _run_refresh(steps):
    ok = True
    for i, (mod, label) in enumerate(steps):
        if job["cancelled"]:
            ok = False
            break
        job.update(step=label, step_index=i)
        job["log"].append(f"$ python -m {mod}")
        args = [sys.executable, "-m", mod]
        if mod == "pipeline.build_market" and not llm_configured():
            args += ["--extractor", "lexicon"]
        proc = subprocess.Popen(args, cwd=BACKEND_DIR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                encoding="utf-8", errors="replace", env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        proc_ref["p"] = proc
        for line in proc.stdout:
            if line.startswith("["):
                job["log"] = (job["log"] + [line.rstrip()])[-40:]
        proc.wait()
        proc_ref["p"] = None
        if job["cancelled"]:
            job["log"].append(f"stopped during: {label}")
            ok = False
            break
        if proc.returncode != 0:
            ok = False
            job["log"].append(f"failed: {mod} (exit code {proc.returncode})")
            break
    job.update(running=False, finished=datetime.now().isoformat(timespec="seconds"), ok=ok, step=None)


@router.post("/market/refresh")
def refresh_market():
    with _lock:
        if job["running"]:
            raise HTTPException(409, "A market update is already running.")
        job.update(running=True, log=[], started=datetime.now().isoformat(timespec="seconds"), finished=None, ok=None,
                   cancelled=False, step=REFRESH_STEPS[0][1], step_index=0, n_steps=len(REFRESH_STEPS))
    threading.Thread(target=_run_refresh, args=(list(REFRESH_STEPS),), daemon=True).start()
    return {"started": True}


@router.post("/market/refresh/cancel")
def cancel_refresh():
    if not job["running"]:
        raise HTTPException(409, "No market update is running.")
    job["cancelled"] = True
    p = proc_ref["p"]
    if p is not None and p.poll() is None:
        p.terminate()
    return {"cancelled": True}


@router.get("/market/refresh")
def refresh_status():
    return job


class ShiftIn(BaseModel):
    role: str = "business_analyst"
    skill_id: str
    demand_delta: float = Field(0.2, ge=-1, le=1)
    trend: float | None = Field(0.5, ge=-0.5, le=0.5)


@router.post("/market/simulate")
def simulate_market(body: ShiftIn, s: Session = Depends(db_session)):
    """Simulated market change (evaluation of adaptivity trigger 2); clearly marked as simulated."""
    snap = active_snapshot(s, body.role)
    if not snap or body.skill_id not in load_skills():
        raise HTTPException(404, "Unknown role, skill or no snapshot.")
    m = apply_market_shift(MarketMap.from_dict(snap.data), body.skill_id, body.demand_delta, body.trend)
    if m.trend_status != "ok":
        m.trend_status = "simulasi"
    s.execute(update(MarketSnapshot).where(MarketSnapshot.role == body.role).values(active=False))
    name = load_skills()[body.skill_id].name
    new = MarketSnapshot(version=f"{snap.version.split('+')[0]}+sim{datetime.now():%H%M%S}", role=body.role,
                         reference_date=snap.reference_date, data=m.to_dict(), required=snap.required, sources=snap.sources,
                         note=f"SIMULATION: demand for {name} {body.demand_delta:+.0%}", simulated=True, active=True,
                         provenance={**(snap.provenance or {}), "simulated_from": snap.version})
    s.add(new)
    bump_epoch(s)
    s.commit()
    n = propagate_market_change(s, body.role, note=f"simulated change: {name}")
    return {"version": new.version, "students_updated": n}


@router.post("/market/reset")
def reset_market(role: str = "business_analyst", s: Session = Depends(db_session)):
    real = s.scalars(select(MarketSnapshot).where(MarketSnapshot.role == role, MarketSnapshot.simulated.is_(False))
                     .order_by(MarketSnapshot.id.desc())).first()
    if not real:
        raise HTTPException(404, "No real snapshot for this role.")
    s.execute(update(MarketSnapshot).where(MarketSnapshot.role == role).values(active=False))
    real.active = True
    bump_epoch(s)
    s.commit()
    propagate_market_change(s, role, note="back to the real market map")
    return {"version": real.version}


# --------------------------------------------------------- extraction review
@router.get("/review-queue")
def review_queue(status: str = "review", limit: int = 100, s: Session = Depends(db_session)):
    rows = s.execute(select(PostingMention, Posting.title).join(Posting, Posting.id == PostingMention.posting_id)
                     .where(PostingMention.status == status, PostingMention.review_decision.is_(None)).limit(min(limit, 500))).all()
    return [{"id": m.id, "posting_id": m.posting_id, "title": t, "surface": m.surface, "quote": m.quote,
             "skill_id": m.skill_id, "similarity": m.similarity} for m, t in rows]


class ReviewIn(BaseModel):
    decision: str      # accept | reject | <skill_id>


@router.post("/review-queue/{mid}")
def review(mid: int, body: ReviewIn, s: Session = Depends(db_session)):
    m = s.get(PostingMention, mid)
    if not m:
        raise HTTPException(404, "Mention not found.")
    skills = load_skills()
    if body.decision not in ("accept", "reject") and body.decision not in skills:
        raise HTTPException(400, "Decision must be accept, reject or a skill id.")
    m.review_decision = body.decision
    if body.decision == "accept" and m.skill_id:
        m.status = "auto"
    elif body.decision in skills:
        m.skill_id, m.status = body.decision, "auto"
    else:
        m.status = "rejected"
    s.commit()
    return {"ok": True}


# ------------------------------------------------- project rubric review (20%)
@router.get("/project-reviews")
def project_reviews(s: Session = Depends(db_session)):
    rows = s.scalars(select(Evidence).where(Evidence.kind == "project", Evidence.review_status == "pending")
                     .order_by(Evidence.created_at)).all()
    return [{"id": e.id, "title": e.title, "created_at": e.created_at.isoformat(), "ratings": e.details.get("ratings", []),
             "checks": e.details.get("checks", {}), "reason": e.details.get("review_reason", ""),
             "method": e.details.get("method")} for e in rows]


class ProjectReviewIn(BaseModel):
    decision: str                       # approve | reject
    levels: dict[str, int] | None = None   # optional corrected rubric levels per skill


@router.post("/project-reviews/{eid}")
def decide_project(eid: int, body: ProjectReviewIn, s: Session = Depends(db_session)):
    from pathsync.config import RUBRIC_SCORES
    from pathsync.engine import recommend, record_history
    e = s.get(Evidence, eid)
    if not e or e.kind != "project":
        raise HTTPException(404, "Project evidence not found.")
    if body.decision not in ("approve", "reject"):
        raise HTTPException(400, "Decision must be approve or reject.")
    if body.levels:
        e.scores = {k: RUBRIC_SCORES[max(0, min(3, int(v)))] for k, v in body.levels.items() if int(v) > 0}
    e.review_status = "approved" if body.decision == "approve" else "rejected"
    e.details = {**e.details, "reviewed_at": utcnow().isoformat(), "reviewer_levels": body.levels}
    s.commit()
    st = s.get(Student, e.student_id)
    record_history(s, st, "evidence", note=f"project review: {body.decision}", rec=recommend(s, st))
    return {"ok": True}


# ---------------------------------------------------------------- annotation
@router.get("/annotation/next")
def annotation_next(annotator: str, s: Session = Depends(db_session)):
    """Next posting for this annotator. The locked gold split (plan A1) is served first, in a fixed
    order, so every annotator labels the same postings; only the posting text is returned, never the
    extractor output."""
    done = set(s.scalars(select(Annotation.posting_id).where(Annotation.annotator == annotator)).all())
    split = load_split_all()
    if split:
        todo = [pid for pid in split["dev"] + split["test"] if pid not in done]
        if todo:
            p = s.get(Posting, todo[0])
            return {"posting_id": p.id, "title": p.title, "company": p.company, "description": p.description,
                    "remaining": len(todo), "set": "gold_split"}
    p = s.scalars(select(Posting).where(Posting.duplicate_of.is_(None), Posting.id.not_in(done)).order_by(Posting.id)).first()
    if p is None:
        return {"posting_id": None}
    remaining = s.scalar(select(func.count(Posting.id)).where(Posting.duplicate_of.is_(None), Posting.id.not_in(done)))
    return {"posting_id": p.id, "title": p.title, "company": p.company, "description": p.description, "remaining": remaining}


class AnnotIn(BaseModel):
    posting_id: str
    annotator: str = Field(..., min_length=1, max_length=80)
    skill_ids: list[str]


@router.post("/annotation")
def annotate(body: AnnotIn, s: Session = Depends(db_session)):
    skills = load_skills()
    if s.get(Posting, body.posting_id) is None or any(k not in skills for k in body.skill_ids):
        raise HTTPException(400, "Unknown posting or skill.")
    old = s.scalars(select(Annotation).where(Annotation.posting_id == body.posting_id, Annotation.annotator == body.annotator)).first()
    if old:
        old.skill_ids = body.skill_ids
    else:
        s.add(Annotation(posting_id=body.posting_id, annotator=body.annotator, skill_ids=body.skill_ids))
    s.commit()
    return {"ok": True}


@router.get("/annotation/eval")
def annotation_eval(s: Session = Depends(db_session)):
    """P/R/F1 vs gold (target F1 >= 0.75) and Cohen's kappa between annotators per (posting, skill)."""
    by_post: dict[str, dict[str, set]] = defaultdict(dict)
    for a in s.scalars(select(Annotation)).all():
        by_post[a.posting_id][a.annotator] = set(a.skill_ids)
    pred: dict[str, set] = defaultdict(set)
    for pid, sid in s.execute(select(PostingMention.posting_id, PostingMention.skill_id)
                              .where(PostingMention.posting_id.in_(list(by_post)), PostingMention.status == "auto",
                                     PostingMention.skill_id.is_not(None))).all():
        pred[pid].add(sid)
    tp = fp = fn = 0
    for pid, anns in by_post.items():
        gold = set().union(*anns.values()) if len(anns) == 1 else {k for k in set().union(*anns.values())
                                                                     if sum(k in v for v in anns.values()) * 2 >= len(anns)}
        tp += len(pred[pid] & gold)
        fp += len(pred[pid] - gold)
        fn += len(gold - pred[pid])
    m = prf(tp, fp, fn)
    return {"n_postings": len(by_post), "precision": m["precision"], "recall": m["recall"], "f1": m["f1"],
            "precision_ci95": m["precision_ci95"], "recall_ci95": m["recall_ci95"],
            "target_f1": 0.75, "tp": tp, "fp": fp, "fn": fn, "gold_rule": "majority of annotators",
            "inter_annotator": annotator_agreement(by_post, list(load_skills())), "target_kappa": 0.70}


# ------------------------------------------------------------------- models
@router.get("/models")
def models(s: Session = Depends(db_session)):
    return [{"id": m.id, "name": m.name, "source": m.source, "weights": m.weights, "metrics": m.metrics,
             "active": m.active, "created_at": m.created_at.isoformat()}
            for m in s.scalars(select(RankerModel).order_by(RankerModel.id.desc())).all()]


@router.post("/models/{mid}/activate")
def activate_model(mid: int, s: Session = Depends(db_session)):
    m = s.get(RankerModel, mid)
    if not m:
        raise HTTPException(404, "Model not found.")
    s.execute(update(RankerModel).values(active=False))
    m.active = True
    bump_epoch(s)
    s.commit()
    return {"ok": True}


class TrainIn(BaseModel):
    use_simulated: bool = False
    activate_if_passes: bool = True
    role: str = "business_analyst"     # the active ranker serves Business Analyst; other roles are report-only


@router.post("/train")
def train(body: TrainIn, s: Session = Depends(db_session)):
    from pathsync.evaluation import (
        NON_INFERIORITY,
        adaptivity,
        cross_validate,
        leave_one_expert_out,
        passes_rule,
        train_full,
    )
    from pathsync.ranker import aggregate_orders
    by = defaultdict(list)
    per_expert: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for rr in s.scalars(select(ScenarioRanking).where(ScenarioRanking.simulated.is_(body.use_simulated))).all():
        by[rr.scenario_id].append(rr.order)
        per_expert[rr.expert_id][rr.scenario_id] = rr.order
    scen = {r.id: r.payload for r in s.scalars(select(Scenario).where(Scenario.role == body.role)).all()}
    data = [scen[k] for k in by if k in scen]
    if len({d["base_id"] for d in data}) < 3:
        raise HTTPException(400, "Expert rankings are needed for at least 3 base scenarios before training.")
    refs = {k: aggregate_orders(v) for k, v in by.items() if k in scen}
    cv = cross_validate(data, refs, k=min(5, len({d["base_id"] for d in data})))
    w, lam = train_full(data, refs)
    # simulated experts: non-inferiority to formula (5); real experts: plan A4, leave-one-expert-out,
    # LTR must beat formula (5) by >= 0.02 with a bootstrap CI that excludes zero
    loeo = None if body.use_simulated else leave_one_expert_out(data, per_expert)
    ok = passes_rule(cv) if body.use_simulated else bool(loeo and loeo.get("passes"))
    # models trained on simulated experts are never activated (plan AI-06); they only exercise the pipeline
    activate = ok and body.activate_if_passes and body.role == "business_analyst" and not body.use_simulated
    if activate:
        s.execute(update(RankerModel).values(active=False))
        bump_epoch(s)
    m = RankerModel(name=f"LTR {'simulated' if body.use_simulated else 'expert'} {datetime.now():%Y-%m-%d %H:%M}",
                    source="simulated" if body.use_simulated else "expert", weights=w, active=activate,
                    metrics={"cv": cv["methods"], "l2": lam, "passes_rule": ok, "margin": NON_INFERIORITY,
                             "leave_one_expert_out": loeo, "adaptivity": adaptivity(data, refs, w)})
    s.add(m)
    s.commit()
    return {"model_id": m.id, "weights": w, "active": activate, "passes_rule": ok, "cv": cv["methods"],
            "leave_one_expert_out": loeo}


@router.get("/expert-agreement")
def agreement(simulated: bool = False, s: Session = Depends(db_session)):
    from pathsync.ranker import kendalls_w
    by = defaultdict(list)
    for rr in s.scalars(select(ScenarioRanking).where(ScenarioRanking.simulated.is_(simulated))).all():
        by[rr.scenario_id].append(rr.order)
    per = {k: round(kendalls_w(v), 4) for k, v in by.items() if len(v) >= 2}
    return {"per_scenario": per, "mean_w": round(sum(per.values()) / len(per), 4) if per else None,
            "n_scenarios_ranked": len(by), "n_with_2plus": len(per)}


@router.post("/edges/finalize")
def finalize_edges(s: Session = Depends(db_session)):
    """Keep an edge when at least two of three experts approve it (paper III.A.3)."""
    try:
        summary = engine_finalize_edges(s)          # internal and simulated reviews never validate a link
    except CycleError:
        s.rollback()
        raise HTTPException(400, "The approved links form a loop. Reject one of them and try again.") from None
    bump_epoch(s)
    s.commit()
    return summary


# ------------------------------------------------------- staff and classes
class ExpertIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    affiliation: str = Field("", max_length=200)
    kind: str = "dosen"
    validates_graph: bool = True


@router.get("/experts")
def experts(s: Session = Depends(db_session)):
    return [{"id": e.id, "name": e.name, "affiliation": e.affiliation, "kind": e.kind, "validates_graph": e.validates_graph}
            for e in s.scalars(select(Expert).where(Expert.kind.not_in(NON_EXPERT_KINDS))).all()]


@router.post("/experts")
def add_expert(body: ExpertIn, s: Session = Depends(db_session)):
    e = Expert(name=body.name, affiliation=body.affiliation, kind=body.kind, validates_graph=body.validates_graph)
    s.add(e)
    s.flush()
    token = issue_token(s, "expert", e.id, f"expert {body.name}")
    s.commit()
    return {"id": e.id, "token": token, "note": "Share this sign-in token with the expert; it is shown only once."}


class CohortIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    institution: str = Field("", max_length=200)


@router.get("/cohorts")
def list_cohorts(s: Session = Depends(db_session)):
    return [{"id": c.id, "name": c.name, "institution": c.institution, "join_code": c.join_code,
             "n_students": s.scalar(select(func.count(Student.id)).where(Student.cohort_id == c.id))}
            for c in s.scalars(select(Cohort).order_by(Cohort.created_at)).all()]


@router.post("/cohorts")
def create_cohort(body: CohortIn, s: Session = Depends(db_session)):
    c = Cohort(name=body.name, institution=body.institution, join_code=join_code())
    s.add(c)
    s.flush()
    token = issue_token(s, "advisor", c.id, f"advisor {body.name}")
    s.commit()
    return {"id": c.id, "join_code": c.join_code, "advisor_token": token,
            "note": "Students join with the code; give the advisor token to the lecturer (shown once)."}


@router.get("/tokens")
def tokens(s: Session = Depends(db_session)):
    return [{"id": t.id, "role": t.role, "subject_id": t.subject_id, "label": t.label, "created_at": t.created_at.isoformat(),
             "revoked": t.revoked_at is not None} for t in s.scalars(select(ApiToken).order_by(ApiToken.id)).all()]


@router.delete("/tokens/{tid}")
def revoke_token(tid: int, s: Session = Depends(db_session)):
    revoke(s, tid)
    s.commit()
    return {"ok": True}


# ------------------------------------------------------------------ studies
class StudyIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    arms: list[str] = Field(default_factory=lambda: [a["id"] for a in DEFAULT_ARMS])


@router.post("/studies")
def create_study(body: StudyIn, s: Session = Depends(db_session)):
    arms = [a for a in DEFAULT_ARMS if a["id"] in body.arms]
    if len(arms) < 2:
        raise HTTPException(400, "A study needs at least two arms.")
    st = Study(name=body.name, join_code=join_code(), arms=arms)
    s.add(st)
    s.commit()
    return {"id": st.id, "join_code": st.join_code, "arms": arms}


@router.get("/studies")
def list_studies(s: Session = Depends(db_session)):
    return [{"id": x.id, "name": x.name, "join_code": x.join_code, "active": x.active, "arms": x.arms,
             "participants": dict(s.execute(select(Student.study_arm, func.count()).where(Student.study_id == x.id)
                                            .group_by(Student.study_arm)).all())}
            for x in s.scalars(select(Study).order_by(Study.created_at)).all()]


@router.get("/studies/{study_id}/results")
def study_results(study_id: str, s: Session = Depends(db_session)):
    """H1 clarity, H2 blind plan quality, H3 minutes to plan, by arm - Kruskal-Wallis + Holm-corrected pairs."""
    study = s.get(Study, study_id)
    if not study:
        raise HTTPException(404, "Study not found.")
    members = s.scalars(select(Student).where(Student.study_id == study_id)).all()
    arm_of = {m.id: m.study_arm for m in members}
    quality, minutes = defaultdict(list), defaultdict(list)
    latest = {}                                               # one value per participant: their latest clarity answer
    for p in s.scalars(select(Pulse).where(Pulse.student_id.in_(list(arm_of)), Pulse.item == "clarity").order_by(Pulse.id)).all():
        latest[p.student_id] = p.value
    clarity = defaultdict(list)
    for sid, v in latest.items():
        clarity[arm_of[sid]].append(v)
    for pl in s.scalars(select(StudyPlan).where(StudyPlan.study_id == study_id)).all():
        arm = arm_of.get(pl.student_id)
        minutes[arm].append(round((pl.submitted_at - pl.started_at).total_seconds() / 60, 2))
        if pl.ratings:
            quality[arm].append(sum(r["score"] for r in pl.ratings) / len(pl.ratings))
    return {"study": study.name, "arms": study.arms, "participants": {a["id"]: sum(v == a["id"] for v in arm_of.values())
                                                                       for a in study.arms},
            "H1_clarity": analyse(dict(clarity)), "H2_plan_quality": analyse(dict(quality)),
            "H3_minutes_to_plan": analyse(dict(minutes))}


# --------------------------------------------------------------- calibration
@router.post("/calibration/run")
def run_calibration(s: Session = Depends(db_session)):
    from pipeline.calibrate_weights import run
    return run(s)


@router.get("/roles")
def roles():
    return [{"id": k, "name": v["name"]} for k, v in ROLES.items()]


# ------------------------------------------------------------------ staff accounts (email + password)
class StaffAccountIn(BaseModel):
    email: str = Field(..., min_length=3, max_length=200, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    name: str = Field(..., min_length=2, max_length=120)
    role: str = Field(..., pattern="^(admin|expert|advisor)$")
    cohort_id: str | None = Field(None, max_length=40)      # lecturers: the class they see
    affiliation: str = Field("", max_length=200)             # experts


def _account_out(a: StaffAccount) -> dict:
    status = "disabled" if a.disabled_at else ("active" if a.password_hash else "invited")
    return {"id": a.id, "email": a.email, "name": a.name, "role": a.role, "subject_id": a.subject_id, "status": status,
            "last_login_at": a.last_login_at.isoformat() if a.last_login_at else None, "created_at": a.created_at.isoformat()}


@router.get("/staff-accounts")
def list_staff_accounts(s: Session = Depends(db_session)):
    return [_account_out(a) for a in s.scalars(select(StaffAccount).where(StaffAccount.demo.is_(False)).order_by(StaffAccount.id)).all()]


@router.post("/staff-accounts")
def invite_staff(body: StaffAccountIn, s: Session = Depends(db_session)):
    """Create an account and return its invite link (valid 7 days). The admin sends the link; the invitee sets a
    password from it. Experts get their own expert record; lecturers are tied to one class."""
    email = normalise_email(body.email)
    if s.scalars(select(StaffAccount).where(StaffAccount.email == email)).first() is not None:
        raise HTTPException(409, "An account with this email already exists.")
    subject = ""
    if body.role == "expert":
        e = Expert(name=body.name, affiliation=body.affiliation, kind="dosen", validates_graph=True)
        s.add(e)
        s.flush()
        subject = e.id
    elif body.role == "advisor":
        if not body.cohort_id or s.get(Cohort, body.cohort_id) is None:
            raise HTTPException(400, "Pick the class this lecturer will see.")
        subject = body.cohort_id
    acc = StaffAccount(email=email, name=body.name, role=body.role, subject_id=subject)
    s.add(acc)
    s.flush()
    raw = new_invite(acc)
    s.commit()
    return {**_account_out(acc), "invite_path": f"/staff/accept?token={raw}", "expires_in_days": INVITE_DAYS}


@router.post("/staff-accounts/{aid}/invite")
def reinvite_staff(aid: int, s: Session = Depends(db_session)):
    """A fresh link to set (or reset) the password. The old password keeps working until the new one is set."""
    acc = s.get(StaffAccount, aid)
    if acc is None or acc.demo:
        raise HTTPException(404, "No such account.")
    raw = new_invite(acc)
    s.commit()
    return {**_account_out(acc), "invite_path": f"/staff/accept?token={raw}", "expires_in_days": INVITE_DAYS}


@router.delete("/staff-accounts/{aid}")
def disable_staff(aid: int, s: Session = Depends(db_session)):
    """Disable an account: it can no longer sign in, and its open sessions end now."""
    acc = s.get(StaffAccount, aid)
    if acc is None or acc.demo:
        raise HTTPException(404, "No such account.")
    acc.disabled_at = utcnow()
    acc.invite_hash, acc.invite_expires_at = None, None
    if acc.token_id:
        revoke(s, acc.token_id)
    s.commit()
    return _account_out(acc)
