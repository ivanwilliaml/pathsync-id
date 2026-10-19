"""Read one pasted posting against a student's existing evidence, without saving it."""
from __future__ import annotations

import re

from .engine import load_context, responses, student_states
from .extraction import lexicon_extractor
from .extraction.base import ExtractionResult, Mention, apply_gates
from .pathing import build_path, coverage, level_label
from .ranker import build_candidates
from .text import verify_quote

# Stay inside the existing required-level range (0.60..0.85). These are explicit
# posting levels, not the role-wide ESCO/frequency estimate used by the dashboard.
POSTING_LEVELS = {"dasar": 0.60, "mandiri": 0.725, "mahir": 0.85}


def _utf16_offset(text: str, index: int) -> int:
    """Browser string slices use UTF-16 offsets, unlike Python string slices."""
    return len(text[:index].encode("utf-16-le")) // 2


def _spans(text: str, mentions: list[Mention]) -> list[tuple[Mention, int, int]]:
    """Locate the extractor's actual surface in its quoted part of the pasted text."""
    out: list[tuple[Mention, int, int]] = []
    used: set[tuple[int, int]] = set()
    for mention in mentions:
        if not mention.surface:
            continue
        quote_at = text.find(mention.quote)
        bounds = (quote_at, quote_at + len(mention.quote)) if quote_at >= 0 else (0, len(text))
        matches = list(re.finditer(re.escape(mention.surface), text[bounds[0]:bounds[1]], re.I))
        for match in matches:
            start, end = bounds[0] + match.start(), bounds[0] + match.end()
            if (start, end) not in used and not any(start < b and end > a for a, b in used):
                used.add((start, end))
                out.append((mention, start, end))
                break
    return sorted(out, key=lambda row: row[1])


def analyze_job(text: str, extracted: ExtractionResult, states: dict, ctx) -> dict:
    """Pure response assembly; the caller owns authentication and input limits."""
    required = {sid: POSTING_LEVELS[m.level] for sid, m in extracted.skills.items() if sid in ctx.skills}
    demand = {sid: 1.0 for sid in required}  # one posting: each distinct requested skill gets one vote
    p = {sid: state.p for sid, state in states.items()}

    skills = []
    for mention, start, end in _spans(text, extracted.mentions):
        if mention.skill_id not in required:
            continue
        state = states[mention.skill_id]
        skills.append({
            "text": text[start:end], "start": _utf16_offset(text, start), "end": _utf16_offset(text, end),
            "skill_id": mention.skill_id, "skill_name": ctx.names[mention.skill_id],
            "level_needed": mention.level, "level_now": level_label(state.p),
            "evidence_status": "direct" if state.p_proven is not None else
                               "academic" if state.has_evidence else "none",
        })

    terms_to_review = [
        {"text": text[start:end], "start": _utf16_offset(text, start), "end": _utf16_offset(text, end),
         "status": mention.status}
        for mention, start, end in _spans(text, extracted.review + extracted.new_candidates)
    ]

    next_step = None
    gaps = []
    if required:
        gaps = sorted(
            ({"skill_id": sid, "skill_name": ctx.names[sid], "level_needed": extracted.skills[sid].level,
              "level_now": level_label(p.get(sid, 0.0)), "gap": round(max(0.0, target - p.get(sid, 0.0)), 4)}
             for sid, target in required.items() if p.get(sid, 0.0) < target),
            key=lambda row: (-row["gap"], row["skill_id"]),
        )
        if gaps:
            confidence = {sid: state.confidence for sid, state in states.items()}
            candidates = build_candidates(ctx.graph, p, required, demand,
                                          {sid: 1.0 for sid in required}, confidence, list(required))
            path = build_path(ctx.graph, ctx.model.rank(candidates), p)
            if path:
                sid = path[0].skill_id
                unlocked = sorted(set(ctx.graph.dependents.get(sid, [])) & set(required))
                next_step = {
                    "skill_id": sid, "skill_name": ctx.names[sid], "role_in_path": path[0].role_in_path,
                    "unlocks_requested": [{"skill_id": child, "skill_name": ctx.names[child]} for child in unlocked],
                    "quick_check_url": f"/assessment/{sid}",
                }

    return {
        "extractor": extracted.extractor, "n_recognized_skills": len(required),
        "readiness": {
            "score": round(coverage(p, required, demand), 4) if required else None,
            "n_with_evidence": sum(states[sid].has_evidence for sid in required),
            "meaning": "coverage_of_recognized_skills_not_hiring_probability",
        },
        "skills": skills, "gaps": gaps, "next_step": next_step,
        "terms_to_review": terms_to_review,
        "terms_note": "Candidates found by the extractor, not a complete count of unknown terms.",
    }


def check_job(s, student, text: str) -> dict:
    """Use the student's existing diagnosis and active ranking model for one posting."""
    ctx = load_context(s, student.target_role)
    states = student_states(s, student, ctx, responses(s, student.id))
    raw = lexicon_extractor().extract(text)
    valid_ids = set(ctx.skills)
    # An embedding lookup persists vectors of free phrases in the shared cache.
    # This opt-in-free endpoint keeps pasted text and its candidate terms transient.
    extracted = apply_gates(raw, text, None, valid_ids)
    extracted.extractor = "lexicon"
    for mention in raw:
        if (mention.skill_id not in valid_ids or mention.method == "pattern") and verify_quote(mention.quote, text):
            mention.skill_id = None
            mention.status = "review"
            extracted.review.append(mention)
    return analyze_job(text, extracted, states, ctx)
