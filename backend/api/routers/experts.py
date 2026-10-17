"""Expert panel: prerequisite validation (2 of 3 rule), blind scenario ranking, blind plan rating.

Experts sign in with a personal token issued by an admin; the expert id comes from the token, so one
expert cannot vote or rank on behalf of another. Admin tokens may act for a named expert (facilitated
sessions) by passing expert_id.
"""
from __future__ import annotations

import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from pathsync.db import NON_EXPERT_KINDS, ApiToken, EdgeVote, Expert, GraphEdge, Scenario, ScenarioRanking, StudyPlan, bump_epoch
from pathsync.engine import graph_from_db
from pathsync.security import db_session, require_expert
from pathsync.taxonomy import CycleError, Edge, SkillGraph, load_skills

router = APIRouter(prefix="/api/expert", tags=["experts"])


def _who(tok: ApiToken, s: Session, expert_id: str | None) -> str:
    eid = tok.subject_id if tok.role == "expert" else expert_id
    if not eid or s.get(Expert, eid) is None:
        raise HTTPException(400, "Choose which expert you are acting for.")
    return eid


@router.get("/me")
def me(tok: ApiToken = Depends(require_expert), s: Session = Depends(db_session)):
    if tok.role == "admin":
        return {"role": "admin", "experts": [{"id": e.id, "name": e.name} for e in
                                             s.scalars(select(Expert).where(Expert.kind.not_in(NON_EXPERT_KINDS))).all()]}
    e = s.get(Expert, tok.subject_id)
    return {"role": "expert", "expert": {"id": e.id, "name": e.name, "affiliation": e.affiliation,
                                         "validates_graph": e.validates_graph}}


@router.get("/edges")
def edges(expert_id: str | None = None, tok: ApiToken = Depends(require_expert), s: Session = Depends(db_session)):
    who = tok.subject_id if tok.role == "expert" else expert_id
    skills = load_skills()
    out = []
    for e in s.scalars(select(GraphEdge).order_by(GraphEdge.id)).all():
        votes = list(e.votes)
        out.append({"id": e.id, "from": e.src, "to": e.dst, "from_name": skills[e.src].name, "to_name": skills[e.dst].name,
                    "source": e.source, "rationale": e.rationale, "status": e.status,
                    "approve": sum(v.approve for v in votes), "reject": sum(not v.approve for v in votes),
                    "my_vote": next((v.approve for v in votes if v.expert_id == who), None)})
    return out


class VoteIn(BaseModel):
    approve: bool
    comment: str = Field("", max_length=500)
    expert_id: str | None = None


@router.post("/edges/{eid}/vote")
def vote(eid: int, body: VoteIn, tok: ApiToken = Depends(require_expert), s: Session = Depends(db_session)):
    who = _who(tok, s, body.expert_id)
    e = s.get(GraphEdge, eid)
    if e is None:
        raise HTTPException(404, "Link not found.")
    old = s.scalars(select(EdgeVote).where(EdgeVote.edge_id == eid, EdgeVote.expert_id == who)).first()
    if old:
        old.approve, old.comment = body.approve, body.comment
    else:
        s.add(EdgeVote(edge_id=eid, expert_id=who, approve=body.approve, comment=body.comment))
    s.commit()
    return {"ok": True}


class EdgeIn(BaseModel):
    src: str
    dst: str
    rationale: str = Field("", max_length=500)


@router.post("/edges")
def propose_edge(body: EdgeIn, tok: ApiToken = Depends(require_expert), s: Session = Depends(db_session)):
    skills = load_skills()
    if body.src not in skills or body.dst not in skills or body.src == body.dst:
        raise HTTPException(400, "Pick two different skills.")
    try:
        SkillGraph(skills, [Edge(r.src, r.dst) for r in s.scalars(select(GraphEdge)).all()] + [Edge(body.src, body.dst)])
    except CycleError:
        raise HTTPException(400, "This link would create a loop in the prerequisite map.") from None
    s.add(GraphEdge(src=body.src, dst=body.dst, source="pakar", rationale=body.rationale, status="draft"))
    bump_epoch(s)
    s.commit()
    return {"ok": True}


@router.get("/scenarios")
def scenarios(expert_id: str | None = None, role: str = "business_analyst", tok: ApiToken = Depends(require_expert),
              s: Session = Depends(db_session)):
    """Scenarios of one role family (plan A4: experts rank per role, Business Analyst by default)."""
    who = tok.subject_id if tok.role == "expert" else expert_id
    rows = s.scalars(select(Scenario).where(Scenario.role == role).order_by(Scenario.base_id, Scenario.id)).all()
    done = set(s.scalars(select(ScenarioRanking.scenario_id).where(ScenarioRanking.expert_id == who)).all()) if who else set()
    counts = dict(s.execute(select(ScenarioRanking.scenario_id, func.count()).where(ScenarioRanking.simulated.is_(False))
                            .group_by(ScenarioRanking.scenario_id)).all())
    return [{"id": r.id, "base_id": r.base_id, "variant": r.variant, "title": r.title, "role": r.role,
             "done": r.id in done, "n_rankings": counts.get(r.id, 0)} for r in rows]


@router.get("/scenarios/{scid}")
def scenario(scid: str, tok: ApiToken = Depends(require_expert), s: Session = Depends(db_session)):
    r = s.get(Scenario, scid)
    if not r:
        raise HTTPException(404, "Scenario not found.")
    skills = load_skills()
    pl = r.payload
    g = graph_from_db(s)
    cands = [{"skill_id": c, "name": skills[c].name, "p": pl["student"][c]["p"], "r": pl["student"][c]["r"],
              "K": pl["student"][c]["K"], "D": pl["market"][c]["D"], "T": pl["market"][c]["T"],
              "prereqs": [{"skill_id": q, "name": skills[q].name, "p": pl["student"].get(q, {}).get("p")}
                          for q in g.prereqs.get(c, [])]} for c in pl["candidates"]]
    random.Random(scid).shuffle(cands)      # ranked blind: deterministic shuffle, no system scores shown
    return {"id": r.id, "base_id": r.base_id, "variant": r.variant, "title": r.title, "changed": pl.get("changed", {}),
            "candidates": cands}


class RankIn(BaseModel):
    order: list[str]
    expert_id: str | None = None


@router.post("/scenarios/{scid}/rank")
def rank_scenario(scid: str, body: RankIn, tok: ApiToken = Depends(require_expert), s: Session = Depends(db_session)):
    who = _who(tok, s, body.expert_id)
    r = s.get(Scenario, scid)
    if not r:
        raise HTTPException(404, "Scenario not found.")
    if sorted(body.order) != sorted(r.payload["candidates"]):
        raise HTTPException(400, "Rank every skill exactly once.")
    old = s.scalars(select(ScenarioRanking).where(ScenarioRanking.scenario_id == scid, ScenarioRanking.expert_id == who)).first()
    if old:
        old.order = body.order
    else:
        s.add(ScenarioRanking(scenario_id=scid, expert_id=who, order=body.order, simulated=False))
    s.commit()
    return {"ok": True}


# ---------------------------------------------- blind rating of study plans (H2)
@router.get("/plans")
def plans_to_rate(tok: ApiToken = Depends(require_expert), s: Session = Depends(db_session)):
    """Plans written by study participants, identified only by a blind code (arm hidden)."""
    rows = s.scalars(select(StudyPlan).order_by(StudyPlan.blind_code)).all()
    return [{"blind_code": p.blind_code, "plan_text": p.plan_text,
             "my_score": next((r["score"] for r in p.ratings if r["expert_id"] == tok.subject_id), None)} for p in rows]


class PlanRateIn(BaseModel):
    score: int = Field(..., ge=1, le=5)
    expert_id: str | None = None


@router.post("/plans/{code}/rate")
def rate_plan(code: str, body: PlanRateIn, tok: ApiToken = Depends(require_expert), s: Session = Depends(db_session)):
    who = _who(tok, s, body.expert_id)
    p = s.scalars(select(StudyPlan).where(StudyPlan.blind_code == code)).first()
    if p is None:
        raise HTTPException(404, "Plan not found.")
    p.ratings = [r for r in p.ratings if r["expert_id"] != who] + [{"expert_id": who, "score": body.score}]
    s.commit()
    return {"ok": True}
