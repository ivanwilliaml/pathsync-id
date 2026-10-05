"""Evidence-based competency diagnosis (paper III.A.2, Fig. 5, eq. 2-3).

Evidence types are treated according to what they can show:
  academic    (transcript x syllabus mapping)   -> exposure,            weight 0.20
  certificate (course completion)               -> completion,          weight 0.25
  project     (artifact rated with the rubric)  -> demonstrated skill,  weight 0.30
  assessment  (short diagnostic test)           -> measured mastery,    weight 0.50
CV claims and self-ratings are never mastery evidence: they only drive confirmation
prompts and the "learn" vs "prove" recommendation type.

The competency state is derived deterministically by replaying a student's evidence:
  p0_s  = sum_k w_k e_sk / sum_k w_k              (eq. 2, over available evidence only)
  p_s   = BKT(p0_s, re-assessment answers ...)     (eq. 3, in chronological order)
so every number on the dashboard can be traced back to the evidence that produced it.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .config import (BKT_GUESS, BKT_SLIP, BKT_TRANSIT, EVIDENCE_WEIGHTS, LOW_CONFIDENCE, PRIOR_NO_EVIDENCE,
                     RUBRIC_SCORES)

# confidence contribution of one piece of evidence of each kind (scaled by mapping strength)
CONFIDENCE_STRENGTH = {"academic": 0.20, "certificate": 0.30, "project": 0.45}


def bkt_update(p: float, correct: bool, slip: float = BKT_SLIP, guess: float = BKT_GUESS,
               transit: float = BKT_TRANSIT) -> float:
    """Bayesian knowledge tracing, eq. (3) followed by the learning transition."""
    if correct:
        post = p * (1 - slip) / (p * (1 - slip) + (1 - p) * guess)
    else:
        post = p * slip / (p * slip + (1 - p) * (1 - guess))
    return post + (1 - post) * transit


def smoothed_accuracy(correct: int, total: int) -> float:
    """Laplace-smoothed share of correct answers so 1/1 is not read as full mastery."""
    return (correct + 1) / (total + 2)


@dataclass
class SkillState:
    skill_id: str
    p: float = PRIOR_NO_EVIDENCE
    p0: float = PRIOR_NO_EVIDENCE
    confidence: float = 0.0
    components: dict[str, float] = field(default_factory=dict)     # kind -> e_sk
    sources: dict[str, list[str]] = field(default_factory=dict)    # kind -> evidence titles
    n_items: int = 0
    n_correct: int = 0
    bkt_trace: list[float] = field(default_factory=list)
    claimed: bool = False
    self_rating: int | None = None
    flags: list[str] = field(default_factory=list)

    @property
    def has_evidence(self) -> bool:
        return bool(self.components) or self.n_items > 0

    @property
    def low_confidence(self) -> bool:
        return self.confidence < LOW_CONFIDENCE

    def to_dict(self) -> dict:
        return {
            "skill_id": self.skill_id, "p": round(self.p, 4), "p0": round(self.p0, 4),
            "confidence": round(self.confidence, 4), "low_confidence": self.low_confidence,
            "components": {k: round(v, 4) for k, v in self.components.items()}, "sources": self.sources,
            "n_items": self.n_items, "n_correct": self.n_correct, "bkt_trace": [round(x, 4) for x in self.bkt_trace],
            "claimed": self.claimed, "self_rating": self.self_rating, "flags": self.flags,
        }


@dataclass
class EvidenceItem:
    kind: str                     # academic | certificate | project | assessment | cv
    title: str
    scores: dict[str, float]      # skill -> e in [0,1] (strength already applied)
    strength: dict[str, float] = field(default_factory=dict)   # mapping strength per skill (for confidence)
    claims: list[str] = field(default_factory=list)            # cv only


@dataclass
class Response:
    skill_id: str
    correct: bool
    phase: str                    # diagnostic | reassessment


def diagnose(skill_ids: list[str], evidence: list[EvidenceItem], responses: list[Response],
             self_ratings: dict[str, int] | None = None) -> dict[str, SkillState]:
    """Replay evidence (chronological order) into a competency state per skill."""
    states = {s: SkillState(s) for s in skill_ids}
    conf_terms: dict[str, list[float]] = {s: [] for s in skill_ids}

    for ev in evidence:
        if ev.kind == "cv":
            for s in ev.claims:
                if s in states:
                    states[s].claimed = True
                    states[s].sources.setdefault("cv", []).append(ev.title)
            continue
        for s, e in ev.scores.items():
            if s not in states:
                continue
            st = states[s]
            # the strongest piece of evidence of each kind counts (re-uploading never double counts)
            st.components[ev.kind] = max(st.components.get(ev.kind, 0.0), float(e))
            st.sources.setdefault(ev.kind, []).append(ev.title)
            conf_terms[s].append(CONFIDENCE_STRENGTH.get(ev.kind, 0.2) * ev.strength.get(s, 1.0))

    diag: dict[str, list[bool]] = {}
    reassess: dict[str, list[bool]] = {}
    for r in responses:
        if r.skill_id not in states:
            continue
        (diag if r.phase == "diagnostic" else reassess).setdefault(r.skill_id, []).append(r.correct)

    for s, st in states.items():
        d = diag.get(s, [])
        if d:
            st.components["assessment"] = smoothed_accuracy(sum(d), len(d))
            st.sources.setdefault("assessment", []).append(f"Asesmen diagnostik ({sum(d)}/{len(d)} benar)")
        # eq. (2): weighted mean over the evidence that exists
        if st.components:
            num = sum(EVIDENCE_WEIGHTS[k] * v for k, v in st.components.items())
            den = sum(EVIDENCE_WEIGHTS[k] for k in st.components)
            st.p0 = num / den
        st.p = st.p0
        st.bkt_trace = [st.p]
        for correct in reassess.get(s, []):              # eq. (3) for every new answer
            st.p = bkt_update(st.p, correct)
            st.bkt_trace.append(st.p)
        answers = d + reassess.get(s, [])
        st.n_items, st.n_correct = len(answers), sum(answers)
        if answers:
            conf_terms[s].append(1 - 0.75 ** len(answers))
        prod = 1.0
        for c in conf_terms[s]:
            prod *= (1 - min(0.95, c))
        st.confidence = 1 - prod
        if self_ratings and s in self_ratings:
            st.self_rating = int(self_ratings[s])
        _flag(st)
    return states


def _flag(st: SkillState) -> None:
    """Confirmation prompts of Fig. 5 (weak or conflicting evidence)."""
    comps = st.components
    direct = "project" in comps or st.n_items > 0
    if comps.get("academic", 0) >= 0.75 and not direct:
        st.flags.append("paparan_akademik_tanpa_bukti_langsung")
    if st.claimed and not direct:
        st.flags.append("klaim_cv_belum_terbukti")
    if "assessment" in comps and "academic" in comps and comps["academic"] - comps["assessment"] >= 0.45:
        st.flags.append("bukti_bertentangan")
    if st.self_rating is not None and st.self_rating >= 4 and st.has_evidence and st.p < 0.45:
        st.flags.append("persepsi_lebih_tinggi_dari_bukti")


def recommendation_type(st: SkillState) -> str:
    """'buktikan' (prove) when indirect signals suggest the skill may already be there
    but nothing direct confirms it; otherwise 'pelajari' (learn)."""
    direct = "project" in st.components or st.n_items > 0
    indirect = st.claimed or st.components.get("academic", 0) >= 0.6 or "certificate" in st.components \
        or (st.self_rating or 0) >= 4
    if indirect and not direct:
        return "buktikan"
    if "bukti_bertentangan" in st.flags:
        return "buktikan"
    return "pelajari"


def rubric_score(level: int) -> float:
    return RUBRIC_SCORES.get(int(level), 0.0)
