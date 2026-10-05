"""Decision engine: diagnosis -> features -> model ranking -> path -> explanations (paper III.A).

The engine is deterministic for a given (evidence, market snapshot, graph, model) so
every recommendation can be reproduced and audited (paper III.B). The adaptive cycle
(III.A.6) is realised by `record_history`, which stores every path change with its
trigger (new evidence, market update, role change) and a human-readable reason.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import FORMULA5_WEIGHTS, READINESS_THRESHOLD, ROLES, SEED_DIR
from .db import AssessmentResponse, Evidence, GraphEdge, Posting, PostingMention, RankerModel, RecommendationHistory, Student
from .demand import MarketMap
from .evidence import EvidenceItem, Response, SkillState, diagnose, recommendation_type
from .market import esco_status, load_market
from .pathing import blocked_steps, build_path, counterfactuals, coverage, explain, level_label
from .ranker import RankingModel, build_candidates
from .taxonomy import Edge, Skill, SkillGraph, cluster_names, load_draft_edges, load_skills

FLAG_TEXT = {
    "paparan_akademik_tanpa_bukti_langsung": "Nilai mata kuliah tinggi, tetapi belum ada bukti proyek atau asesmen.",
    "klaim_cv_belum_terbukti": "Disebut di CV, tetapi belum ada bukti yang dapat diperiksa.",
    "bukti_bertentangan": "Nilai akademik jauh lebih tinggi daripada hasil asesmen.",
    "persepsi_lebih_tinggi_dari_bukti": "Penilaian dirimu lebih tinggi daripada bukti yang terkumpul.",
}


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


# ------------------------------------------------------------------ loading
def ensure_seed(s: Session) -> None:
    if s.scalar(select(GraphEdge.id).limit(1)) is None:
        for e in load_draft_edges():
            s.add(GraphEdge(src=e.src, dst=e.dst, source=e.source, rationale=e.rationale, status="draft"))
    if s.scalar(select(RankerModel.id).limit(1)) is None:
        s.add(RankerModel(name="Formula (5)", source="formula5", weights=dict(FORMULA5_WEIGHTS), active=True,
                          metrics={"note": "G x D x T x U x R, titik awal sebelum peringkat pakar"}))
    s.commit()


def graph_from_db(s: Session) -> SkillGraph:
    rows = s.scalars(select(GraphEdge)).all()
    edges = [Edge(r.src, r.dst, r.source, r.rationale, r.status) for r in rows] or load_draft_edges()
    return SkillGraph(load_skills(), edges)


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


def load_context(s: Session, role: str) -> Context:
    ensure_seed(s)
    skills = load_skills()
    market, req, version = load_market(s, role)
    model, model_id = active_model(s)
    return Context(role=role, role_name=ROLES[role]["name"], skills=skills, names={k: v.name for k, v in skills.items()},
                   graph=graph_from_db(s), market=market, req=req, market_version=version, model=model, model_id=model_id,
                   esco=esco_status().get(role, {}), quotes=skill_quotes(s, role))


# ---------------------------------------------------------------- diagnosis
def evidence_items(student: Student) -> list[EvidenceItem]:
    items = []
    for ev in sorted(student.evidence, key=lambda e: (e.created_at, e.id)):
        if ev.kind == "cv":
            items.append(EvidenceItem("cv", ev.title, {}, {}, claims=list(ev.details.get("claim_ids", []))))
        else:
            items.append(EvidenceItem(ev.kind, ev.title, dict(ev.scores), dict(ev.details.get("strength", {}))))
    return items


def responses(s: Session, student_id: str) -> list[Response]:
    rows = s.scalars(select(AssessmentResponse).where(AssessmentResponse.student_id == student_id)
                     .order_by(AssessmentResponse.created_at, AssessmentResponse.id)).all()
    return [Response(r.skill_id, r.correct, r.phase) for r in rows]


def student_states(s: Session, student: Student, ctx: Context) -> dict[str, SkillState]:
    return diagnose(list(ctx.skills), evidence_items(student), responses(s, student.id),
                    {k: int(v) for k, v in (student.self_ratings or {}).items()})


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


def recommend(s: Session, student: Student, ctx: Context | None = None) -> dict:
    ctx = ctx or load_context(s, student.target_role)
    states = student_states(s, student, ctx)
    p = {k: st.p for k, st in states.items()}
    conf = {k: st.confidence for k, st in states.items()}
    demand = {k: ctx.market.D(k) for k in ctx.skills}
    trend = {k: ctx.market.T(k) for k in ctx.skills}
    role_skills = [k for k in ctx.skills if demand.get(k, 0) > 0 or ctx.esco.get(k)]

    cands = build_candidates(ctx.graph, p, ctx.req, demand, trend, conf, role_skills)
    ranked = ctx.model.rank(cands)
    path = build_path(ctx.graph, ranked, p)
    order = [st.skill_id for st in path]
    next_step = {order[i]: order[i + 1] for i in range(len(order) - 1)}
    prefs = student.preferences or {}
    weekly = float(prefs.get("weekly_hours") or 6)

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
            "explanation": explain(c, i + 1, ctx.model.contributions(c), ectx) if i < 6 else None,
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
        waiting = [q for q in ctx.graph.prereqs.get(sid, []) if p.get(q, 0) < READINESS_THRESHOLD and q not in learned]
        learned.add(sid)
        path_out.append({
            "skill_id": sid, "name": ctx.names[sid], "role_in_path": stp.role_in_path, "rank": stp.rank,
            "p": round(st.p, 3), "target": round(target, 3), "level_now": level_label(st.p), "level_target": level_label(target),
            "rec_type": recommendation_type(st), "hours": hours, "materials": _pick_materials(sid, st.p, prefs),
            "waiting_for": waiting, "learn_what": ctx.skills[sid].learn_what,
            "why_prereq": None if stp.role_in_path == "prioritas" else
            f"Prasyarat untuk {', '.join(ctx.names[t] for t in ctx.graph.dependents.get(sid, []) if t in order)}.",
            "explanation": rank_of.get(sid, {}).get("explanation"),
        })

    cf = counterfactuals(path, ranked, ctx.graph, p, ctx.names)
    cov = coverage(p, {k: v for k, v in ctx.req.items() if demand.get(k, 0) > 0}, demand)
    by_cluster = {}
    for cl, label in cluster_names().items():
        ids = [k for k in ctx.req if ctx.skills[k].cluster == cl and demand.get(k, 0) > 0]
        by_cluster[cl] = {"label": label, "coverage": round(coverage(p, {k: ctx.req[k] for k in ids}, demand), 4)}

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
    confirmations = [{"skill_id": c["skill_id"], "name": c["name"], "flag": f, "message": FLAG_TEXT[f]}
                     for c in competencies for f in c["flags"] if f in FLAG_TEXT]
    perception = [{"skill_id": c["skill_id"], "name": c["name"], "self_rating": c["self_rating"], "p": c["p"]}
                  for c in competencies if c["self_rating"] is not None]
    ev_count: dict[str, int] = {}
    for e in student.evidence:
        ev_count[e.kind] = ev_count.get(e.kind, 0) + 1
    n_diag = sum(1 for r in responses(s, student.id) if r.phase == "diagnostic")

    return {
        "student": {"id": student.id, "display_name": student.display_name, "program": student.program,
                    "target_role": student.target_role, "preferences": prefs},
        "role": {"id": ctx.role, "name": ctx.role_name, "n_postings": ctx.market.n_postings,
                 "trend_status": ctx.market.trend_status, "reference_date": ctx.market.reference_date},
        "market_version": ctx.market_version,
        "model": {"id": ctx.model_id, "name": ctx.model.name, "weights": ctx.model.weights},
        "coverage": round(cov, 4), "coverage_by_cluster": by_cluster,
        "ranking": ranking, "path": path_out, "path_hours": round(total_hours, 1),
        "path_weeks": round(total_hours / weekly, 1) if weekly else None,
        "counterfactual": cf, "competencies": competencies, "confirmations": confirmations[:8], "perception": perception,
        "evidence_summary": {**ev_count, "assessment_items": n_diag},
        "diagnostic_done": n_diag > 0,
        "blocked_in_path": len(blocked_steps(order, ctx.graph, p)),
    }


# ------------------------------------------------------------ adaptive cycle
def _snapshot(rec: dict) -> list[dict]:
    return [{"skill_id": r["skill_id"], "rank": r["rank"], "priority": r["priority"], "p": None, **{
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
            reasons.append(f"{nm} keluar dari daftar prioritas: kesenjangannya sudah tertutup (penguasaan {comp.get(sid, {}).get('p', 0):.2f}).")
            continue
        if b and not a:
            reasons.append(f"{nm} masuk daftar prioritas di peringkat #{b['rank']}.")
            continue
        if a["rank"] == b["rank"] and abs(a["priority"] - b["priority"]) < 0.01:
            continue
        causes = []
        if abs(a["G"] - b["G"]) >= 0.02:
            causes.append(f"kesenjangan {'mengecil' if b['G'] < a['G'] else 'membesar'} {a['G']:.2f}->{b['G']:.2f}")
        if a["R"] != b["R"]:
            causes.append("prasyaratnya kini terpenuhi" if b["R"] > a["R"] else "prasyaratnya belum terpenuhi")
        if abs(a["D"] - b["D"]) >= 0.01:
            causes.append(f"permintaan pasar {'naik' if b['D'] > a['D'] else 'turun'} {a['D']:.0%}->{b['D']:.0%}")
        if abs(a["T"] - b["T"]) >= 0.01:
            causes.append(f"tren {'menguat' if b['T'] > a['T'] else 'melemah'}")
        if not causes:
            causes.append("perubahan keterampilan lain yang bergantung padanya")
        move = "naik" if b["rank"] < a["rank"] else "turun" if b["rank"] > a["rank"] else "tetap"
        reasons.append(f"{nm} {move} #{a['rank']}->#{b['rank']}: {', '.join(causes)}.")
    top_prev = prev[0]["skill_id"] if prev else None
    top_cur = cur[0]["skill_id"] if cur else None
    label = {"initial": "Jalur awal disusun", "evidence": "Bukti baru diterima", "market": "Peta permintaan diperbarui",
             "role": "Target peran diganti", "manual": "Pembaruan manual"}[trigger]
    if top_prev and top_cur and top_prev != top_cur:
        summary = f"{label}: prioritas utama berpindah dari {names[top_prev]} ke {names[top_cur]}."
    elif top_cur:
        summary = f"{label}: prioritas utama tetap {names[top_cur]}."
    else:
        summary = f"{label}: tidak ada kesenjangan tersisa untuk peran ini."
    if note:
        summary += f" ({note})"
    return summary, reasons[:8]


def record_history(s: Session, student: Student, trigger: str, note: str = "", rec: dict | None = None,
                   force: bool = False) -> RecommendationHistory | None:
    rec = rec or recommend(s, student)
    last = s.scalars(select(RecommendationHistory).where(RecommendationHistory.student_id == student.id)
                     .order_by(RecommendationHistory.id.desc())).first()
    cur = _snapshot(rec)
    names = {c["skill_id"]: c["name"] for c in rec["competencies"]} | {r["skill_id"]: r["name"] for r in rec["ranking"]}
    if last is None:
        trigger = "initial"
        summary, reasons = _reasons([], cur, rec, names, trigger, note)
        reasons = [f"{r['name']} di peringkat #{r['rank']}." for r in rec["ranking"][:3]]
    else:
        same = [r["skill_id"] for r in last.ranking[:5]] == [r["skill_id"] for r in cur[:5]] and \
            all(abs(a["priority"] - b["priority"]) < 0.005 for a, b in zip(last.ranking[:5], cur[:5]))
        if same and not force and last.market_version == rec["market_version"]:
            return None
        summary, reasons = _reasons(last.ranking, cur, rec, names, trigger, note)
    h = RecommendationHistory(student_id=student.id, trigger=trigger, summary=summary, reasons=reasons, ranking=cur,
                              path=[{"skill_id": p["skill_id"], "name": p["name"], "role_in_path": p["role_in_path"]}
                                    for p in rec["path"]],
                              coverage=rec["coverage"], market_version=rec["market_version"], model_name=rec["model"]["name"])
    s.add(h)
    s.commit()
    return h


def check_market_trigger(s: Session, student: Student, rec: dict) -> None:
    last = s.scalars(select(RecommendationHistory).where(RecommendationHistory.student_id == student.id)
                     .order_by(RecommendationHistory.id.desc())).first()
    if last is not None and last.market_version != rec["market_version"]:
        record_history(s, student, "market", note=f"versi pasar {rec['market_version']}", rec=rec, force=True)
