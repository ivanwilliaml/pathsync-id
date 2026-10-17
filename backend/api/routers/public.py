"""Public, read-only endpoints: catalogue, market map, postings, graph, taxonomy governance, model card."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pathsync.assessment import item_bank
from pathsync.careers import career_graph
from pathsync.config import (
    BKT_GUESS,
    BKT_SLIP,
    BKT_TRANSIT,
    EMBEDDING_MODEL,
    GRADE_SCORES,
    LLM_MODEL,
    MODELS_DIR,
    ROLES,
    SIM_AUTO,
    SIM_REVIEW,
)
from pathsync.db import Expert, GraphEdge, MarketSnapshot, Posting, PostingMention, RankerModel, active_snapshot, utcnow
from pathsync.embeddings import WARM
from pathsync.engine import graph_from_db
from pathsync.extraction.llm import llm_configured
from pathsync.roles import FAMILIES
from pathsync.security import db_session, rate_limit
from pathsync.taxonomy import cluster_names, load_skills, load_taxonomy

LIMITED_DATA_POSTINGS = 30   # below this many postings a role is shown as "limited data" (beta)
router = APIRouter(prefix="/api", tags=["public"], dependencies=[Depends(rate_limit("public", 240))])


@router.get("/health")
def health():
    """Liveness: the process answers. Used by the container healthcheck, so it never touches the database."""
    return {"ok": True}


SNAPSHOT_MAX_AGE_DAYS = 45   # the market map refreshes monthly; older than this means the refresh job is failing


@router.get("/health/ready")
def ready(s: Session = Depends(db_session)):
    """Readiness (plan C4): the database answers and the active market snapshot is fresh enough."""
    try:
        newest = s.scalar(select(func.max(MarketSnapshot.created_at)).where(MarketSnapshot.active.is_(True)))
    except Exception as e:  # pragma: no cover - only when the database is down
        raise HTTPException(503, {"ok": False, "database": "down", "error": type(e).__name__}) from e
    age = (utcnow() - newest).days if newest else None
    stale = age is None or age > SNAPSHOT_MAX_AGE_DAYS
    warm = WARM.is_set()
    body = {"ok": not stale and warm, "database": "up", "models_loaded": warm,
            "snapshot_age_days": age, "snapshot_max_age_days": SNAPSHOT_MAX_AGE_DAYS,
            "warning": ("no active market snapshot" if age is None else
                        f"market snapshot is {age} days old; check the monthly refresh") if stale else None}
    if stale or not warm:
        raise HTTPException(503, body)
    return body


def model_card(s: Session) -> dict:
    """Which AI does what (answers 'the LLM used was not named')."""
    ranker = s.scalars(select(RankerModel).where(RankerModel.active.is_(True))).first()
    ext = MODELS_DIR / "extractor_comparison.json"
    offline = json.loads(ext.read_text(encoding="utf-8")).get("llm_model") if ext.exists() else None
    gold = MODELS_DIR / "extractor_gold_eval.json"
    ev = json.loads(gold.read_text(encoding="utf-8")) if gold.exists() else {}
    blind = (ev.get("blind") or {}).get("overall")
    mpath = MODELS_DIR / "metrics.json"     # plan D2: the single source of reported numbers (python -m pipeline.report)
    metrics = json.loads(mpath.read_text(encoding="utf-8")) if mpath.exists() else {}
    return {
        "decision_model": {"type": "linear learning-to-rank (eq. 4), not an LLM",
                           "name": ranker.name if ranker else "Formula (5)", "weights": ranker.weights if ranker else None,
                           "why": "few training rankings and every weight must be inspectable and explainable"},
        "extraction_llm": {"runtime": LLM_MODEL if llm_configured() else None,
                           "runtime_provider": "Anthropic Claude API (structured output, taxonomy-constrained)",
                           "offline_run": offline or "Qwen3-8B (Apache-2.0), Kaggle T4 x2",
                           "active_for_market_map": "llm" if llm_configured() else "lexicon",
                           "gates": f"quote must exist verbatim in the posting; embedding normalisation {SIM_AUTO} / {SIM_REVIEW}"},
        "embedding_model": {"name": EMBEDDING_MODEL, "use": "map free-text skill phrases and course names to the taxonomy"},
        "knowledge_tracing": {"type": "Bayesian knowledge tracing (eq. 3)", "slip": BKT_SLIP, "guess": BKT_GUESS, "learn": BKT_TRANSIT,
                              "calibrated": False},
        "llm_is_never_used_for": ["choosing priorities", "estimating mastery", "ordering the path"],
        # what is validated today, so the UI can say "Beta" honestly (PM audit AI-6, AI-7)
        "validation": {"real_experts": s.scalar(select(func.count(Expert.id)).where(Expert.kind != "simulasi")) or 0,
                       "ranker_trained_on": "simulated experts" if ranker and "simulated" in (ranker.name or "").lower() else "expert rankings",
                       "extractor_blind_eval": ({**blind, "n_postings": ev["blind"]["n_postings"], "annotators": 1} if blind else None),
                       "metrics_file": metrics.get("generated_at"),
                       "extractor_target_met_at_lower_ci": ((metrics.get("extraction") or {}).get("target_met") or {}).get("lower_ci_bound"),
                       "status": "beta"},
        "planned": ["LLM-based reading of postings (Claude API) once the gold annotation set is complete",
                    "Ranker re-trained on a real expert panel"],
    }


@router.get("/context/bps")
def bps_context():
    """Labour-market context from BPS (proposal Bab III.B data layer). Display only, never an input to the ranking."""
    from pathsync.config import SEED_DIR

    return json.loads((SEED_DIR / "bps_context.json").read_text(encoding="utf-8"))


@router.get("/meta")
def meta(s: Session = Depends(db_session)):
    tax = load_taxonomy()
    snaps = {r: (snap.version if (snap := active_snapshot(s, r)) else None) for r in ROLES}
    skills = load_skills()
    ranker = s.scalars(select(RankerModel).where(RankerModel.active.is_(True))).first()
    role_info = []
    for k, v in ROLES.items():
        snap = active_snapshot(s, k)
        n = snap.data.get("n_postings", 0) if snap else 0
        role_info.append({"id": k, "name": v["name"], "family": v.get("family", ""), "blurb": v.get("blurb", ""),
                          "n_postings": n, "limited_data": n < LIMITED_DATA_POSTINGS})
    return {"roles": role_info, "families": FAMILIES, "clusters": cluster_names(),
            "taxonomy_version": tax["version"],
            "skills": [{"id": sk.id, "name": sk.name, "name_en": sk.name_en, "cluster": sk.cluster, "kind": sk.kind,
                        "description": sk.description, "learn_what": sk.learn_what} for sk in skills.values()],
            "extractor": "llm" if llm_configured() else "lexicon",
            "market_versions": snaps, "model": {"name": ranker.name, "weights": ranker.weights} if ranker else None,
            "models": model_card(s),
            "n_postings": s.scalar(select(func.count(Posting.id)).where(Posting.duplicate_of.is_(None))),
            "n_items": len(item_bank())}


@router.get("/catalog")
def catalog():
    """Course and certificate names for autocomplete in the evidence forms."""
    from pathsync.intake import _certs, _courses
    return {"courses": [{"name": c["name"], "programs": c.get("programs", [])} for c in _courses()],
            "certificates": [{"name": c["name"], "level": c["level"], "score_scale": c.get("score_scale")}
                             for c in _certs()["certificates"]],
            "grades": list(GRADE_SCORES)}


@router.get("/market/{role}")
def market(role: str, s: Session = Depends(db_session)):
    if role not in ROLES:
        raise HTTPException(404, "Unknown role.")
    snap = active_snapshot(s, role)
    if not snap:
        raise HTTPException(404, "No market snapshot yet. Run a market update first.")
    skills = load_skills()
    data = snap.data
    rows = [{**v, "name": skills[k].name, "cluster": skills[k].cluster, "required": snap.required.get(k)}
            for k, v in data["skills"].items() if v["count"] or k in snap.required]
    rows.sort(key=lambda r: -r["demand"])
    hist = s.scalars(select(MarketSnapshot).where(MarketSnapshot.role == role).order_by(MarketSnapshot.id.desc()).limit(10)).all()
    return {"role": role, "role_name": ROLES[role]["name"], "version": snap.version, "simulated": snap.simulated,
            "note": snap.note, "reference_date": data["reference_date"], "n_postings": data["n_postings"],
            "n_recent": data["n_recent"], "n_previous": data["n_previous"], "trend_status": data["trend_status"],
            "sources": snap.sources, "skills": rows,
            "snapshots": [{"id": h.id, "version": h.version, "created_at": h.created_at.isoformat(), "active": h.active,
                           "simulated": h.simulated, "note": h.note} for h in hist]}


@router.get("/market/{role}/skill/{skill_id}")
def market_skill(role: str, skill_id: str, s: Session = Depends(db_session)):
    skills = load_skills()
    if role not in ROLES or skill_id not in skills:
        raise HTTPException(404, "Unknown role or skill.")
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
    return {"skill_id": skill_id, "name": skills[skill_id].name, "evidence": out}


@router.get("/postings")
def postings(role: str | None = None, q: str | None = None, limit: int = 100, s: Session = Depends(db_session)):
    stmt = select(Posting).where(Posting.duplicate_of.is_(None))
    if role:
        stmt = stmt.where(Posting.role == role)
    if q:
        stmt = stmt.where(Posting.title.ilike(f"%{q[:80]}%"))
    rows = s.scalars(stmt.order_by(Posting.published_at.desc()).limit(min(max(limit, 1), 500))).all()
    ids = [p.id for p in rows]
    skills_by: dict[str, set] = {pid: set() for pid in ids}
    for pid, sid in s.execute(select(PostingMention.posting_id, PostingMention.skill_id)
                              .where(PostingMention.posting_id.in_(ids), PostingMention.status == "auto",
                                     PostingMention.skill_id.is_not(None))).all():
        skills_by[pid].add(sid)
    return [{"id": p.id, "title": p.title, "company": p.company, "source": p.source, "location": p.location, "url": p.url,
             "published_at": p.published_at.isoformat() if p.published_at else None, "role": p.role,
             "language": p.language, "in_window": p.in_window, "skills": sorted(skills_by[p.id])} for p in rows]


@router.get("/postings/{pid:path}")
def posting(pid: str, s: Session = Depends(db_session)):
    p = s.get(Posting, pid)
    if not p:
        raise HTTPException(404, "Posting not found.")
    return {"id": p.id, "title": p.title, "company": p.company, "url": p.url, "source": p.source, "description": p.description,
            "published_at": p.published_at.isoformat() if p.published_at else None, "extractor": p.extractor,
            "mentions": [{"skill_id": m.skill_id, "surface": m.surface, "quote": m.quote, "level": m.level,
                          "similarity": m.similarity, "status": m.status, "method": m.method} for m in p.mentions]}


def graph_payload(s: Session, role: str, rec: dict | None = None) -> dict:
    g = graph_from_db(s)
    skills = load_skills()
    depth = g.depth()
    snap = active_snapshot(s, role)
    D = {k: v["demand"] for k, v in snap.data["skills"].items()} if snap else {}
    comp = {c["skill_id"]: c for c in (rec or {}).get("competencies", [])}
    rank = {r["skill_id"]: r for r in (rec or {}).get("ranking", [])}
    path = {p["skill_id"]: i for i, p in enumerate((rec or {}).get("path", []))}
    active = {(e.src, e.dst) for e in g.active_edges()}
    nodes = []
    for k, sk in skills.items():
        c = comp.get(k, {})
        expl = rank.get(k, {}).get("explanation") or {}
        nodes.append({"id": k, "name": sk.name, "cluster": sk.cluster, "depth": depth[k], "demand": D.get(k, 0.0),
                      "p": c.get("p"), "required": c.get("required"), "rank": rank.get(k, {}).get("rank"),
                      "in_path": k in path, "path_index": path.get(k), "bottleneck": bool(expl.get("bottleneck"))})
    edges = [{"id": e.id, "from": e.src, "to": e.dst, "source": e.source, "rationale": e.rationale, "status": e.status,
              "active": (e.src, e.dst) in active} for e in s.scalars(select(GraphEdge)).all()]
    return {"nodes": nodes, "edges": edges, "clusters": cluster_names()}


@router.get("/graph")
def graph(role: str = "business_analyst", s: Session = Depends(db_session)):
    return graph_payload(s, role)


@router.get("/careers/graph")
def careers_graph(s: Session = Depends(db_session)):
    """Roles linked by the skills their postings share (Career Map). Market data only, same for everyone."""
    return career_graph(s)


@router.get("/taxonomy/report")
def taxonomy_report(role: str = "business_analyst", s: Session = Depends(db_session)):
    """Is the skill list final? Measured exit criteria, core vs adjacent skills, frozen hash, changelog."""
    from pathsync.governance import report
    if role not in ROLES:
        raise HTTPException(404, "Unknown role.")
    return report(s, role)


@router.get("/model-card")
def get_model_card(s: Session = Depends(db_session)):
    return model_card(s)


@router.get("/evaluation")
def evaluation():
    p = MODELS_DIR / "evaluation_report.json"
    if not p.exists():
        raise HTTPException(404, "Run python -m pipeline.expert_study first.")
    return json.loads(p.read_text(encoding="utf-8"))


@router.get("/evaluation/extractors")
def extractor_comparison():
    p = MODELS_DIR / "extractor_comparison.json"
    if not p.exists():
        raise HTTPException(404, "Run python -m pipeline.llm_jobs compare first.")
    return json.loads(p.read_text(encoding="utf-8"))


@router.get("/evaluation/weights")
def evidence_weights_report():
    """Rationale, calibration status and sensitivity of the evidence weights (eq. 2)."""
    from pathsync.calibration import WEIGHTS_FILE, active_evidence_weights, implied_error_ratios
    p = MODELS_DIR / "evidence_weights_report.json"
    return {"active_weights": active_evidence_weights(), "implied_error_ratio_vs_assessment": implied_error_ratios(),
            "calibration": json.loads(WEIGHTS_FILE.read_text(encoding="utf-8")) if WEIGHTS_FILE.exists() else None,
            "sensitivity": json.loads(p.read_text(encoding="utf-8")) if p.exists() else None}
