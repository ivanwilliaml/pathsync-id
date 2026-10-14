"""Soft skills: experience-based, outside the hard-skill taxonomy, graph, quizzes and ranking.

They cannot be measured by multiple-choice items and no course teaches them like a tool, so PathSync only
(1) mines which ones a role asks for from its postings and (2) lets the student record real experience.
They never enter the priority ranking or the learning path.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import SEED_DIR
from .db import Posting

LEVELS = {0: "No experience yet", 1: "Tried it (class, club, event)", 2: "Regular (project, internship, job)",
          3: "Led or taught others"}
MAX_NOTE = 240


@lru_cache(maxsize=1)
def load_soft() -> dict[str, dict]:
    data = json.loads((SEED_DIR / "soft_skills.json").read_text(encoding="utf-8"))
    return {s["id"]: s for s in data["skills"]}


@lru_cache(maxsize=1)
def _patterns() -> dict[str, re.Pattern]:
    return {sid: re.compile(r"(?<![\w])(?:" + "|".join(re.escape(a) for a in sorted(s["aliases"], key=len, reverse=True)) + r")(?![\w])", re.I)
            for sid, s in load_soft().items()}


def detect(text: str) -> set[str]:
    return {sid for sid, rx in _patterns().items() if rx.search(text or "")}


def role_demand(s: Session, role: str) -> dict[str, float]:
    """Share of the role's unique postings that name each soft skill."""
    rows = s.scalars(select(Posting.description).where(Posting.role == role, Posting.duplicate_of.is_(None),
                                                       Posting.in_window.is_(True))).all()
    if not rows:
        return {sid: 0.0 for sid in load_soft()}
    counts = dict.fromkeys(load_soft(), 0)
    for text in rows:
        for sid in detect(text):
            counts[sid] += 1
    return {sid: round(c / len(rows), 4) for sid, c in counts.items()}


def clean_experience(raw: dict | None) -> dict[str, dict]:
    out = {}
    for sid, v in (raw or {}).items():
        if sid in load_soft() and isinstance(v, dict) and int(v.get("level", 0)) in LEVELS:
            out[sid] = {"level": int(v["level"]), "note": str(v.get("note", ""))[:MAX_NOTE]}
    return out


def soft_profile(demand: dict[str, float], experience: dict | None) -> list[dict]:
    exp = clean_experience(experience)
    rows = []
    for sid, sk in load_soft().items():
        e = exp.get(sid, {"level": 0, "note": ""})
        rows.append({"skill_id": sid, "name": sk["name_en"], "demand": demand.get(sid, 0.0), "level": e["level"],
                     "level_label": LEVELS[e["level"]], "note": e["note"], "how_to_build": sk["how_to_build"]})
    rows.sort(key=lambda r: -r["demand"])
    return rows
