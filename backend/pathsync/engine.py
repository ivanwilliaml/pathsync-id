"""Decision engine: diagnosis -> features -> model ranking -> path -> explanations (paper III.A).

The engine is deterministic for a given (evidence, market snapshot, graph, model) so
every recommendation can be reproduced and audited (paper III.B). The adaptive cycle
(III.A.6) is realised by `record_history`, which stores every path change with its
trigger (new evidence, market update, role change) and a human-readable reason.
"""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from functools import lru_cache

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from . import soft
from .calibration import active_evidence_weights
from .config import FORMULA5_WEIGHTS, READINESS_THRESHOLD, ROLES, SEED_DIR
from .db import (
    NON_EXPERT_KINDS,
    AssessmentResponse,
    Expert,
    GraphEdge,
    Posting,
    PostingMention,
    RankerModel,
    RecommendationHistory,
    Student,
    active_snapshot,
    cache_epoch,
)
from .demand import MarketMap
from .evidence import EvidenceItem, Response, SkillState, diagnose, recommendation_type
from .i18n import get_lang, t, tr
from .market import esco_status, load_market
from .pathing import blocked_steps, build_path, counterfactuals, coverage, explain, level_label
from .ranker import RankingModel, build_candidates
from .taxonomy import (
    Edge,
    Skill,
    SkillGraph,
    cluster_names,
    display_rationale,
    display_skills,
    load_draft_edges,
    seed_rationales,
)

FLAGS = ("paparan_akademik_tanpa_bukti_langsung", "klaim_cv_belum_terbukti", "bukti_bertentangan",
         "persepsi_lebih_tinggi_dari_bukti")


@lru_cache(maxsize=1)
def materials_by_skill() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for m in json.loads((SEED_DIR / "materials.json").read_text(encoding="utf-8"))["materials"]:
        out.setdefault(m["skill_id"], []).append(m)
    return out


@dataclass
class Context:
    role: str
    role_name: str
    skills: dict[str, Skill]
    names: dict[str, str]
    graph: SkillGraph
    market: MarketMap
    req: dict[str, float]
    market_version: str
    model: RankingModel
    model_id: int | None
    esco: dict[str, str]
    quotes: dict[str, list[dict]]
    soft_demand: dict[str, float]


# ------------------------------------------------------------------ loading
def ensure_seed(s: Session) -> None:
    if s.scalar(select(GraphEdge.id).limit(1)) is None:
        for e in load_draft_edges():
            s.add(GraphEdge(src=e.src, dst=e.dst, source=e.source, rationale=e.rationale, status="draft"))
    else:
        # databases seeded before the display language existed still hold the original rationale
        seed = seed_rationales()
        for row in s.scalars(select(GraphEdge)).all():
            orig, shown = seed.get((row.src, row.dst), (None, None))
            if orig is not None and row.rationale == orig and shown != orig:
                row.rationale = shown
    if s.scalar(select(RankerModel.id).limit(1)) is None:
        s.add(RankerModel(name="Formula (5)", source="formula5", weights=dict(FORMULA5_WEIGHTS), active=True,
                          metrics={"note": "G x D x T x U x R, starting point before expert rankings"}))
    s.commit()


def graph_from_db(s: Session) -> SkillGraph:
    rows = s.scalars(select(GraphEdge)).all()
    edges = [Edge(r.src, r.dst, r.source, display_rationale(r.src, r.dst, r.rationale), r.status) for r in rows] or load_draft_edges()
    return SkillGraph(display_skills(), edges)


def finalize_edges(s: Session) -> dict:
    """Keep a link when at least two experts approve it and drop it when two reject it (paper III.A.3). Internal team
    and simulated reviews never count. Raises CycleError (nothing committed by the caller) if approved links form a loop."""
    summary = {"approved": 0, "rejected": 0, "draft": 0}
    counted = {x.id for x in s.scalars(select(Expert).where(Expert.kind.not_in(NON_EXPERT_KINDS))).all()}
    for e in s.scalars(select(GraphEdge)).all():
        votes = [v for v in e.votes if v.expert_id in counted]
        a = sum(v.approve for v in votes)
        r = sum(not v.approve for v in votes)
        e.status = "approved" if a >= 2 else "rejected" if r >= 2 else "draft"
        summary[e.status] += 1
    graph_from_db(s).check_acyclic()
    return summary


def active_model(s: Session) -> tuple[RankingModel, int | None]:
    row = s.scalars(select(RankerModel).where(RankerModel.active.is_(True)).order_by(RankerModel.id.desc())).first()
    if row is None:
        return RankingModel(), None
    return RankingModel(row.weights, row.name), row.id


def skill_quotes(s: Session, role: str, per_skill: int = 3) -> dict[str, list[dict]]:
    rows = s.execute(
        select(PostingMention.skill_id, PostingMention.quote, Posting.title, Posting.company, Posting.url, Posting.source,
               Posting.id)
        .join(Posting, Posting.id == PostingMention.posting_id)
        .where(Posting.role == role, Posting.duplicate_of.is_(None), Posting.in_window.is_(True),
               PostingMention.status == "auto", PostingMention.skill_id.is_not(None))
        .order_by(Posting.published_at.desc())
    ).all()
    out: dict[str, list[dict]] = {}
    seen: dict[str, set] = {}
    for sid, quote, title, company, url, source, pid in rows:
        lst = out.setdefault(sid, [])
        if len(lst) >= per_skill or pid in seen.setdefault(sid, set()) or len(quote) < 20:
            continue
        seen[sid].add(pid)
        lst.append({"quote": quote, "title": title, "company": company, "url": url, "source": source, "posting_id": pid})
    return out


_CTX_CACHE: dict[tuple, Context] = {}
_CTX_LOCK = threading.Lock()


@event.listens_for(Session, "after_commit")
@event.listens_for(Session, "after_rollback")
def _clear_key_memo(s: Session) -> None:
    s.info.pop("ctx_keys", None)


def load_context(s: Session, role: str) -> Context:
    """Shared, read-only decision context for a role.

    Built once per (role, active snapshot, active model, cache epoch, display language) and reused by every student:
    the paper notes the demand map is computed once per update and shared, so adding users does not
    add proportional compute (III.B). Any change to snapshot, model or graph bumps the epoch.
    """
    # the key lookups are memoised per transaction: careers_for asks for every role, and three round trips per role
    # to a remote database added ~20 s per call on the hosted demo. Cleared on commit/rollback (_clear_key_memo).
    memo = s.info.setdefault("ctx_keys", {})
    if "shared" not in memo:
        memo["shared"] = (s.scalars(select(RankerModel.id).where(RankerModel.active.is_(True))
                                    .order_by(RankerModel.id.desc())).first(), cache_epoch(s))
    if role not in memo:
        snap = active_snapshot(s, role)
        memo[role] = snap.id if snap else None
    model_row, epoch = memo["shared"]
    key = (role, memo[role], model_row, epoch, get_lang())   # names are per language
    with _CTX_LOCK:
        hit = _CTX_CACHE.get(key)
    if hit is not None:
        return hit
    skills = display_skills()
    market, req, version = load_market(s, role)
    model, model_id = active_model(s)
    ctx = Context(role=role, role_name=ROLES[role]["name"], skills=skills, names={k: v.name for k, v in skills.items()},
                  graph=graph_from_db(s), market=market, req=req, market_version=version, model=model, model_id=model_id,
                  esco=esco_status().get(role, {}), quotes=skill_quotes(s, role), soft_demand=soft.role_demand(s, role))
    with _CTX_LOCK:
        # room for every role in both languages: careers_for walks all roles, and a smaller cap cleared the cache
        # mid-walk, rebuilding every context on each call (~50 s per demo profile on a 0.1-CPU host)
        if len(_CTX_CACHE) >= 2 * len(ROLES) + 4:
            _CTX_CACHE.clear()
        _CTX_CACHE[key] = ctx
    return ctx


def clear_context_cache() -> None:
    with _CTX_LOCK:
        _CTX_CACHE.clear()


# ---------------------------------------------------------------- diagnosis
# pending = waiting for a human reviewer; claimed = certificate typed in without a verification link (counts like a CV claim)
REVIEW_RELIABILITY = {"auto": 1.0, "approved": 1.0, "pending": 0.5, "claimed": 0.5}


def evidence_items(student: Student) -> list[EvidenceItem]:
    items = []
    for ev in sorted(student.evidence, key=lambda e: (e.created_at, e.id)):
        if ev.kind == "cv":
            items.append(EvidenceItem("cv", ev.title, {}, {}, claims=list(ev.details.get("claim_ids", []))))
        elif ev.review_status in REVIEW_RELIABILITY:     # rejected uploads never count
            items.append(EvidenceItem(ev.kind, ev.title, dict(ev.scores), dict(ev.details.get("strength", {})),
                                      reliability=REVIEW_RELIABILITY[ev.review_status]))
    return items


def responses(s: Session, student_id: str) -> list[Response]:
    rows = s.scalars(select(AssessmentResponse).where(AssessmentResponse.student_id == student_id)
                     .order_by(AssessmentResponse.created_at, AssessmentResponse.id)).all()
    from .item_audit import item_guess

    return [Response(r.skill_id, r.correct, r.phase, item_guess(r.item_id)) for r in rows]


def student_states(s: Session, student: Student, ctx: Context, resp: list[Response] | None = None) -> dict[str, SkillState]:
    return diagnose(list(ctx.skills), evidence_items(student), resp if resp is not None else responses(s, student.id),
                    {k: int(v) for k, v in (student.self_ratings or {}).items()}, weights=active_evidence_weights())


# Study arms switch parts of the engine off so each component's contribution can be measured (paper III.D.3).
FULL_FEATURES = {"evidence": True, "graph": True, "adaptive": True, "explanations": True, "path": True}


# ----------------------------------------------------------------- recommend
def _pick_materials(skill_id: str, p: float, prefs: dict) -> list[dict]:
    mats = materials_by_skill().get(skill_id, [])
    want = "dasar" if p < 0.35 else "menengah" if p < 0.6 else "lanjut"
    order = {"dasar": ["dasar", "menengah", "lanjut"], "menengah": ["menengah", "dasar", "lanjut"],
             "lanjut": ["lanjut", "menengah", "dasar"]}[want]
    fmt, lang = prefs.get("format"), prefs.get("language", "id")

    def key(m):
        return (order.index(m["difficulty"]), 0 if m.get("language") == lang else 1,
                0 if fmt and m.get("format") == fmt else 1, 0 if m.get("verified") else 1, m["hours"])
    picked, seen = [], set()
    for m in sorted(mats, key=key):
        if m["url"] in seen:
            continue
        seen.add(m["url"])
        picked.append(m)
        if len(picked) == 3:
            break
    return picked


def frozen_order(s: Session, student: Student) -> list[str] | None:
    first = s.scalars(select(RecommendationHistory).where(RecommendationHistory.student_id == student.id)
                      .order_by(RecommendationHistory.id)).first()
    return [r["skill_id"] for r in first.ranking] if first else None


def recommend(s: Session, student: Student, ctx: Context | None = None, features: dict | None = None) -> dict:
    ctx = ctx or load_context(s, student.target_role)
    feats = {**FULL_FEATURES, **(features or {})}
    resp = responses(s, student.id)
    if feats["evidence"]:
        states = student_states(s, student, ctx, resp)
    else:   # control arms: no diagnosis, every skill sits at the no-evidence prior
        states = diagnose(list(ctx.skills), [], [], {})
    p = {k: st.p for k, st in states.items()}
    conf = {k: st.confidence for k, st in states.items()}
    demand = {k: ctx.market.D(k) for k in ctx.skills}
    trend = {k: ctx.market.T(k) for k in ctx.skills}
    role_skills = [k for k in ctx.skills if demand.get(k, 0) > 0 or ctx.esco.get(k)]

    graph = ctx.graph if feats["graph"] else SkillGraph(ctx.skills, [])
    # groundwork the role depends on is part of the role's map even if postings rarely name it (e.g. programming basics)
    needed = set(role_skills)
    for k in role_skills:
        needed |= graph.ancestors(k)
    role_skills = [k for k in ctx.skills if k in needed]
    cands = build_candidates(graph, p, ctx.req, demand, trend, conf, role_skills)
    ranked = ctx.model.rank(cands)
    if not feats["adaptive"]:
        # static arm: keep the first path's order; skills only drop out once their gap closes
        frozen = frozen_order(s, student)
        if frozen:
            pos = {sid: i for i, sid in enumerate(frozen)}
            ranked = sorted(ranked, key=lambda t: (pos.get(t[0].skill_id, len(pos)), -t[1]))
    path = build_path(graph, ranked, p) if feats["path"] else []
    order = [st.skill_id for st in path]
    next_step = {order[i]: order[i + 1] for i in range(len(order) - 1)}
    prefs = student.preferences or {}
    weekly = float(prefs.get("weekly_hours") or 6)
    done_materials = prefs.get("materials_done") or {}

    ectx = {"skills": ctx.skills, "names": ctx.names, "market": ctx.market, "role_name": ctx.role_name, "p": p,
            "req": ctx.req, "esco": ctx.esco, "quotes": ctx.quotes, "next_step": next_step}
    ranking = []
    for i, (c, sc) in enumerate(ranked):
        st = states[c.skill_id]
        ranking.append({
            "skill_id": c.skill_id, "name": ctx.names[c.skill_id], "cluster": ctx.skills[c.skill_id].cluster,
            "rank": i + 1, "score": round(sc, 4), "priority": round(RankingModel.multiplicative(sc), 4),
            "features": {k: round(v, 4) for k, v in c.x().items()},
            "contributions": ctx.model.contributions(c), "rec_type": recommendation_type(st),
            "blocked_by": c.blocked_by, "unlocks": c.unlocks[:6],
            "explanation": explain(c, i + 1, ctx.model.contributions(c), ectx) if i < 6 and feats["explanations"] else None,
        })
    rank_of = {r["skill_id"]: r for r in ranking}

    learned: set[str] = set()
    path_out, total_hours = [], 0.0
    for stp in path:
        sid = stp.skill_id
        st = states[sid]
        target = ctx.req.get(sid, READINESS_THRESHOLD) if stp.role_in_path == "prioritas" else max(
            READINESS_THRESHOLD, min(ctx.req.get(sid, READINESS_THRESHOLD), 0.7))
        gap = max(0.0, target - st.p)
        hours = round(ctx.skills[sid].hours * gap / max(target, 0.1), 1)
        total_hours += hours
        waiting = [q for q in graph.prereqs.get(sid, []) if p.get(q, 0) < READINESS_THRESHOLD and q not in learned]
        learned.add(sid)
        path_out.append({
            "skill_id": sid, "name": ctx.names[sid], "role_in_path": stp.role_in_path, "rank": stp.rank,
            "p": round(st.p, 3), "target": round(target, 3), "level_now": level_label(st.p), "level_target": level_label(target),
            "rec_type": recommendation_type(st), "hours": hours,
            "materials": (mats := [{**m, "done": m["id"] in done_materials} for m in _pick_materials(sid, st.p, prefs)]),
            # the commitment now is the first module, not "beginner to advanced" (PM audit AI-2)
            "first_module_hours": round(min(hours, mats[0]["hours"]) if mats else min(hours, 2.0), 1),
            "waiting_for": waiting, "learn_what": ctx.skills[sid].learn_what,
            "why_prereq": None if stp.role_in_path == "prioritas" else
            t("path.needed_before", names=", ".join(ctx.names[d] for d in graph.dependents.get(sid, []) if d in order)),
            "explanation": rank_of.get(sid, {}).get("explanation"),
        })

    cf = counterfactuals(path, ranked, graph, p, ctx.names)
    cov = coverage(p, {k: v for k, v in ctx.req.items() if demand.get(k, 0) > 0}, demand)
    # readiness from direct proof only (Quick Check, reviewed projects, certificates); grades never count here
    p_proven = {k: (st.p_proven or 0.0) for k, st in states.items()}
    cov_proven = coverage(p_proven, {k: v for k, v in ctx.req.items() if demand.get(k, 0) > 0}, demand)
    by_cluster = {}
    for cl, label in cluster_names().items():
        ids = [k for k in ctx.req if ctx.skills[k].cluster == cl and demand.get(k, 0) > 0]
        if not ids:      # areas this role's postings never ask for are noise on the dashboard (was: shown as 0%)
            continue
        by_cluster[cl] = {"label": label, "coverage": round(coverage(p, {k: ctx.req[k] for k in ids}, demand), 4),
                          "n_skills": len(ids),
                          # False = every skill in the area is still at the no-evidence prior, so the number is not a measurement
                          "measured": any(states[k].has_evidence for k in ids if k in states)}

    competencies = []
    for k, st in states.items():
        if k not in role_skills:
            continue
        competencies.append({
            "skill_id": k, "name": ctx.names[k], "cluster": ctx.skills[k].cluster, **st.to_dict(),
            "required": ctx.req.get(k), "gap": round(max(0.0, ctx.req.get(k, 0) - st.p), 4), "demand": round(demand.get(k, 0), 4),
            "rec_type": recommendation_type(st), "level": level_label(st.p), "esco": ctx.esco.get(k, ""),
        })
    competencies.sort(key=lambda c: -c["demand"])
    confirmations = [{"skill_id": c["skill_id"], "name": c["name"], "flag": f, "message": t(f"flag.{f}")}
                     for c in competencies for f in c["flags"] if f in FLAGS]
    perception = [{"skill_id": c["skill_id"], "name": c["name"], "self_rating": c["self_rating"], "p": c["p"]}
                  for c in competencies if c["self_rating"] is not None]
    ev_count: dict[str, int] = {}
    for e in student.evidence:
        ev_count[e.kind] = ev_count.get(e.kind, 0) + 1
    n_diag = sum(1 for r in resp if r.phase == "diagnostic")

    return {
        "student": {"id": student.id, "display_name": student.display_name, "program": student.program,
                    "target_role": student.target_role, "preferences": prefs},
        "role": {"id": ctx.role, "name": ctx.role_name, "n_postings": ctx.market.n_postings,
                 "trend_status": ctx.market.trend_status, "reference_date": ctx.market.reference_date},
        "market_version": ctx.market_version,
        "model": {"id": ctx.model_id, "name": ctx.model.name, "weights": ctx.model.weights},
        "coverage": round(cov, 4), "coverage_proven": round(cov_proven, 4), "coverage_by_cluster": by_cluster,
        "ranking": ranking, "path": path_out, "path_hours": round(total_hours, 1),
        "path_weeks": round(total_hours / weekly, 1) if weekly else None,
        "counterfactual": cf, "competencies": competencies, "confirmations": confirmations[:8], "perception": perception,
        # experience-based, never ranked: shown on the Skill Map next to the hard skills
        "soft_skills": soft.soft_profile(ctx.soft_demand, prefs.get("soft_experience")),
        "evidence_summary": {**ev_count, "assessment_items": n_diag},
        "diagnostic_done": n_diag > 0,
        "blocked_in_path": len(blocked_steps(order, graph, p)),
        "features": feats,
    }


# ------------------------------------------------------------ adaptive cycle
def _snapshot(rec: dict) -> list[dict]:
    p = {c["skill_id"]: c["p"] for c in rec["competencies"]}
    return [{"skill_id": r["skill_id"], "rank": r["rank"], "priority": r["priority"], "p": p.get(r["skill_id"]), **{
        k: r["features"][k] for k in ("G", "R", "D", "T")}} for r in rec["ranking"][:10]]


def _reasons(prev: list[dict], cur: list[dict], rec: dict, names: dict[str, str], trigger: str, note: str) -> tuple[str, list[str]]:
    pm = {r["skill_id"]: r for r in prev}
    cm = {r["skill_id"]: r for r in cur}
    comp = {c["skill_id"]: c for c in rec["competencies"]}
    reasons = []
    for sid in list(dict.fromkeys([r["skill_id"] for r in cur[:5]] + [r["skill_id"] for r in prev[:5]])):
        a, b = pm.get(sid), cm.get(sid)
        nm = names.get(sid, sid)
        if a and not b:
            reasons.append(t("history.left", name=nm, p=comp.get(sid, {}).get("p", 0)))
            continue
        if b and not a:
            reasons.append(t("history.joined", name=nm, rank=b["rank"]))
            continue
        if a["rank"] == b["rank"] and abs(a["priority"] - b["priority"]) < 0.01:
            continue
        causes = []
        if a.get("p") is not None and b.get("p") is not None and abs(a["p"] - b["p"]) >= 0.02:
            causes.append(t("history.cause.mastery_up" if b["p"] > a["p"] else "history.cause.mastery_down", a=a["p"], b=b["p"]))
        elif abs(a["G"] - b["G"]) >= 0.02:
            causes.append(t("history.cause.gap_narrowed" if b["G"] < a["G"] else "history.cause.gap_widened", a=a["G"], b=b["G"]))
        if a["R"] != b["R"]:
            causes.append(t("history.cause.prereq_met" if b["R"] > a["R"] else "history.cause.prereq_not_met"))
        if abs(a["D"] - b["D"]) >= 0.01:
            causes.append(t("history.cause.demand_up" if b["D"] > a["D"] else "history.cause.demand_down", a=a["D"], b=b["D"]))
        if abs(a["T"] - b["T"]) >= 0.01:
            causes.append(t("history.cause.trend_up" if b["T"] > a["T"] else "history.cause.trend_down"))
        if not causes:
            causes.append(t("history.cause.dependents"))
        move = t("history.move_up") if b["rank"] < a["rank"] else t("history.move_down") if b["rank"] > a["rank"] else t("history.stayed")
        reasons.append(t("history.moved", name=nm, move=move, a=a["rank"], b=b["rank"], causes=", ".join(causes)))
    top_prev = prev[0]["skill_id"] if prev else None
    top_cur = cur[0]["skill_id"] if cur else None
    label = t(f"history.trigger.{trigger}")
    if top_cur and not top_prev:
        summary = t("history.summary.first", label=label, name=names[top_cur])
    elif top_prev and top_cur and top_prev != top_cur:
        summary = t("history.summary.moved", label=label, a=names[top_prev], b=names[top_cur])
    elif top_cur:
        summary = t("history.summary.same", label=label, name=names[top_cur])
    else:
        summary = t("history.summary.none", label=label)
    if note:
        summary += f" ({note})"
    return summary, reasons[:8]


def record_history(s: Session, student: Student, trigger: str, note: str = "", rec: dict | None = None,
                   force: bool = False) -> RecommendationHistory | None:
    from .careers import career_readiness  # local import: careers builds on this module

    rec = rec or recommend(s, student)
    last = s.scalars(select(RecommendationHistory).where(RecommendationHistory.student_id == student.id)
                     .order_by(RecommendationHistory.id.desc())).first()
    cur = _snapshot(rec)
    careers = career_readiness(s, student)
    names = {c["skill_id"]: c["name"] for c in rec["competencies"]} | {r["skill_id"]: r["name"] for r in rec["ranking"]}
    if last is None:
        trigger = "initial"
        summary, reasons = _reasons([], cur, rec, names, trigger, note)
        reasons = [t("history.initial_reason", name=r["name"], rank=r["rank"]) for r in rec["ranking"][:3]]
    else:
        same = [r["skill_id"] for r in last.ranking[:5]] == [r["skill_id"] for r in cur[:5]] and \
            all(abs(a["priority"] - b["priority"]) < 0.005 for a, b in zip(last.ranking[:5], cur[:5], strict=False))
        # entries written before careers were tracked have no snapshot: record one so later changes have a baseline
        careers_moved = last.careers is None or any(abs(careers.get(r, 0.0) - v) >= 0.01 for r, v in last.careers.items())
        if same and not careers_moved and not force and last.market_version == rec["market_version"]:
            return None
        summary, reasons = _reasons(last.ranking, cur, rec, names, trigger, note)
    h = RecommendationHistory(student_id=student.id, trigger=trigger, summary=summary, reasons=reasons, ranking=cur,
                              path=[{"skill_id": p["skill_id"], "name": p["name"], "role_in_path": p["role_in_path"]}
                                    for p in rec["path"]],
                              coverage=rec["coverage"], market_version=rec["market_version"], model_name=rec["model"]["name"],
                              careers=careers)
    s.add(h)
    s.commit()
    return h


def check_market_trigger(s: Session, student: Student, rec: dict) -> None:
    last = s.scalars(select(RecommendationHistory).where(RecommendationHistory.student_id == student.id)
                     .order_by(RecommendationHistory.id.desc())).first()
    if last is not None and last.market_version != rec["market_version"]:
        record_history(s, student, "market", note=tr("market version", "versi pasar") + f" {rec['market_version']}", rec=rec, force=True)


# ------------------------------------------------------------ decision trace
FEATURE_DEFS = {
    "G": "Gap = max(0, required level r_s - mastery p_s)",
    "R": "Readiness = 1 if every prerequisite has p >= 0.6, else 0.5",
    "K": "Evidence confidence (floored at 0.03)",
    "D": "Demand = recency-weighted share of target-role postings mentioning the skill (floored at 0.03)",
    "T": "Trend = 1 + 0.5 x relative change in share, last 6 vs previous 6 months",
    "U": "Unlock value = 1 + sum of D over skills this one is a direct prerequisite for that still have a gap",
    "B": "Downstream block = 1 + sum of D x G over those same skills",
}


def decision_trace(s: Session, student: Student, skill_id: str) -> dict:
    """Every number behind one recommendation, in the order the engine computes it (paper III.A.2-A.5)."""
    import math

    from .calibration import implied_error_ratios

    ctx = load_context(s, student.target_role)
    if skill_id not in ctx.skills:
        raise KeyError(skill_id)
    rec = recommend(s, student, ctx)
    resp = responses(s, student.id)
    st = student_states(s, student, ctx, resp)[skill_id]
    w = active_evidence_weights()
    comps = st.components
    used = {k: w[k] for k in comps}
    row = next((r for r in rec["ranking"] if r["skill_id"] == skill_id), None)
    step = next((p for p in rec["path"] if p["skill_id"] == skill_id), None)
    weights = ctx.model.weights

    stages = [
        {"stage": "1. Evidence -> starting mastery p0 (eq. 2)",
         "formula": "p0 = sum_k w_k e_k / sum_k w_k over the evidence types that exist",
         "inputs": [{"evidence": k, "score_e": round(v, 3), "weight_w": used[k], "sources": st.sources.get(k, [])}
                    for k, v in comps.items()],
         "result": round(st.p0, 4),
         "note": tr("No evidence yet: prior 0.10.", "Belum ada evidence: prior 0.10.") if not comps else
                 tr("CV claims and self-ratings are shown for confirmation only and never enter this sum.",
                    "Klaim CV dan penilaian diri hanya ditampilkan untuk konfirmasi dan tidak pernah masuk ke penjumlahan ini.")},
        {"stage": "2. New answers -> mastery p (eq. 3, Bayesian knowledge tracing)",
         "formula": "correct: p' = p(1-S)/(p(1-S)+(1-p)G); wrong: p' = pS/(pS+(1-p)(1-G)); then p = p' + (1-p')T",
         "inputs": {"S_slip": 0.10, "G_guess": 0.25, "T_learn": 0.10, "trace": [round(x, 4) for x in st.bkt_trace]},
         "result": round(st.p, 4)},
    ]
    if row:
        x = row["features"]
        stages.append({"stage": "3. Features (paper Table 3)",
                       "inputs": [{"feature": f, "value": x[f], "definition": FEATURE_DEFS[f]} for f in x],
                       "result": {"required_level_r": ctx.req.get(skill_id), "blocked_by": row["blocked_by"],
                                  "unlocks": row["unlocks"]}})
        stages.append({"stage": "4. Ranking model score (eq. 4)",
                       "formula": "f_s = sum_i w_i log x_i  (formula 5 = all w_i = 1 for G, D, T, U, R)",
                       "inputs": [{"feature": f, "weight": weights.get(f, 0.0), "log_value": round(math.log(max(x[f], 1e-9)), 4),
                                   "contribution": row["contributions"][f]} for f in x],
                       "result": {"score": row["score"], "priority_exp_score": row["priority"], "rank": row["rank"],
                                  "of_candidates": len(rec["ranking"]), "model": ctx.model.name}})
    else:
        stages.append({"stage": "3. Ranking", "result": tr("Not ranked: no gap left for this role (p >= required level).",
                                                          "Tidak diranking: tidak ada gap tersisa untuk role ini (p >= level yang dibutuhkan).")})
    stages.append({"stage": "5. Learning path rule (III.A.5)",
                   "formula": "top-3 ranked skills + their prerequisites with p < 0.6, in topological order",
                   "result": {"in_path": step is not None, "position": rec["path"].index(step) + 1 if step else None,
                              "role_in_path": step["role_in_path"] if step else None,
                              "waiting_for": step["waiting_for"] if step else []}})
    return {"skill_id": skill_id, "name": ctx.names[skill_id], "market_version": ctx.market_version,
            "evidence_weights": w, "implied_error_ratio_vs_assessment": implied_error_ratios(w), "stages": stages}


def propagate_market_change(s: Session, role: str, note: str = "") -> int:
    """Adaptive trigger 2: when the active market snapshot changes, re-rank every student of that role
    and store the change with its reasons (written once at update time, not on page views)."""
    from .db import Study
    from .study import arm_features

    ctx = load_context(s, role)
    n = 0
    students = s.scalars(select(Student).where(Student.target_role == role)).all()
    for st in students:
        if s.scalar(select(RecommendationHistory.id).where(RecommendationHistory.student_id == st.id).limit(1)) is None:
            continue
        feats = None
        if st.study_id and st.study_arm:
            study = s.get(Study, st.study_id)
            feats = arm_features(study.arms, st.study_arm) if study else None
            if feats and not feats.get("adaptive", True):
                continue
        rec = recommend(s, st, ctx, features=feats)
        if record_history(s, st, "market", note=note or f"market version {rec['market_version']}", rec=rec, force=True):
            n += 1
    return n
