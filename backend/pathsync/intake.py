"""Turning student uploads into evidence (paper III.A.2, Fig. 5).

transcript  -> course x grade x mapping strength       -> academic exposure
certificate -> completion level x mapping strength      -> completion evidence
project     -> rubric 0-3 per skill with verbatim quotes -> demonstrated skill
CV          -> claimed skills with quotes                -> confirmation only (not mastery)
"""
from __future__ import annotations

import hashlib
import io
import json
import re
from functools import lru_cache

from .config import GRADE_SCORES, RUBRIC_LABELS, SEED_DIR
from .embeddings import encode
from .evidence import EvidenceItem, rubric_score
from .extraction import extract_skills, skill_index
from .extraction.llm import LLMUnavailable, llm_configured
from .taxonomy import load_skills
from .text import normalize_for_match, verify_quote

COURSE_MATCH = 0.80       # embedding similarity to accept a catalogue course
SKILL_FALLBACK = 0.60     # direct course-name -> skill similarity for unknown courses


# ------------------------------------------------------------------ documents
def document_to_text(data: bytes, filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages)
    if name.endswith(".docx"):
        import docx

        d = docx.Document(io.BytesIO(data))
        parts = [p.text for p in d.paragraphs]
        for t in d.tables:
            for row in t.rows:
                parts.append(" | ".join(c.text for c in row.cells))
        return "\n".join(parts)
    if name.endswith(".ipynb"):
        nb = json.loads(data.decode("utf-8", errors="replace"))
        cells = []
        for c in nb.get("cells", []):
            src = "".join(c.get("source", []))
            cells.append(src)
        return "\n\n".join(cells)
    return data.decode("utf-8", errors="replace")


# ------------------------------------------------------------------ catalogue
@lru_cache(maxsize=1)
def _courses() -> list[dict]:
    return json.loads((SEED_DIR / "courses.json").read_text(encoding="utf-8"))["courses"]


@lru_cache(maxsize=1)
def _certs() -> dict:
    return json.loads((SEED_DIR / "certificates.json").read_text(encoding="utf-8"))


def _catalog_index(entries: list[dict]):
    forms, owner = [], []
    for i, e in enumerate(entries):
        for f in [e["name"], *e.get("aliases", [])]:
            forms.append(f)
            owner.append(i)
    return forms, owner, encode(forms)


@lru_cache(maxsize=1)
def _course_index():
    return _catalog_index(_courses())


@lru_cache(maxsize=1)
def _cert_index():
    return _catalog_index(_certs()["certificates"])


def _match(name: str, entries: list[dict], index) -> tuple[dict | None, float, str]:
    norm = normalize_for_match(name)
    for e in entries:
        if norm in {normalize_for_match(f) for f in [e["name"], *e.get("aliases", [])]}:
            return e, 1.0, e["name"]
    forms, owner, mat = index
    sims = (encode([name]) @ mat.T)[0]
    j = int(sims.argmax())
    return (entries[owner[j]], float(sims[j]), forms[j]) if sims[j] >= COURSE_MATCH else (None, float(sims[j]), forms[j])


def map_course(name: str) -> dict:
    entry, sim, form = _match(name, _courses(), _course_index())
    if entry is not None:
        factor = 1.0 if sim >= 0.999 else round(sim, 3)
        return {"input": name, "matched": entry["name"], "similarity": round(sim, 3), "method": "katalog",
                "skills": {k: round(v * factor, 3) for k, v in entry["skills"].items()}}
    tops = [(s, v) for s, v in skill_index().top_k(name, 3) if v >= SKILL_FALLBACK][:2]
    return {"input": name, "matched": None, "similarity": round(sim, 3), "method": "embedding" if tops else "tidak_terpetakan",
            "skills": {s: round(min(0.6, v - 0.1), 3) for s, v in tops}}


GRADE_RE = re.compile(r"(?<![A-Za-z])(A-|A|B\+|B-|B|C\+|C|D|E)(?![A-Za-z+\-])")


def parse_transcript(text: str) -> list[dict]:
    """Parse 'nama mata kuliah ... nilai' lines from pasted text, CSV or a PDF transcript."""
    out = []
    for raw in text.splitlines():
        line = raw.strip()
        if len(line) < 4:
            continue
        if "," in line or ";" in line or "\t" in line:
            parts = [p.strip() for p in re.split(r"[,;\t]", line) if p.strip()]
            grades = [p for p in parts if p.upper() in GRADE_SCORES]
            names = [p for p in parts if p.upper() not in GRADE_SCORES and not re.fullmatch(r"[\d.]+|[A-Z]{2,4}\d{3,6}", p)]
            if grades and names:
                out.append({"name": max(names, key=len), "grade": grades[-1].upper()})
            continue
        m = list(GRADE_RE.finditer(line))
        if not m:
            continue
        g = m[-1]
        name = line[:g.start()]
        name = re.sub(r"\b[A-Z]{2,5}\d{3,6}\b", "", name)          # course codes
        name = re.sub(r"\b\d+(\.\d+)?\s*(sks|SKS|credits?)?\b", "", name)
        name = re.sub(r"\s{2,}", " ", name).strip(" -:|.")
        if len(name) >= 4 and not name.lower().startswith(("ipk", "gpa", "total", "semester")):
            out.append({"name": name, "grade": g.group(1).upper()})
    return out


def academic_evidence(courses: list[dict]) -> tuple[EvidenceItem, list[dict]]:
    scores: dict[str, float] = {}
    strength: dict[str, float] = {}
    detail = []
    for c in courses:
        grade = str(c.get("grade", "")).upper().strip()
        if grade not in GRADE_SCORES:
            continue
        m = map_course(c["name"])
        gs = GRADE_SCORES[grade]
        contrib = {}
        for s, st in m["skills"].items():
            e = gs * st
            contrib[s] = round(e, 3)
            scores[s] = max(scores.get(s, 0.0), e)
            strength[s] = max(strength.get(s, 0.0), st)
        detail.append({**m, "grade": grade, "grade_score": gs, "contribution": contrib})
    return EvidenceItem("academic", "Transkrip", {k: round(v, 4) for k, v in scores.items()}, strength), detail


def _english_score(scale: str | None, score: float | None) -> float:
    if not scale or score is None:
        return 0.75
    if scale == "toeic":
        return 0.9 if score >= 785 else 0.75 if score >= 605 else 0.55
    if scale == "toefl":
        return 0.9 if score >= 550 else 0.75 if score >= 500 else 0.55
    if scale == "ielts":
        return 0.9 if score >= 6.5 else 0.75 if score >= 5.5 else 0.55
    return 0.75


def certificate_evidence(certs: list[dict]) -> tuple[EvidenceItem, list[dict]]:
    levels = _certs()["levels"]
    scores, strength, detail = {}, {}, []
    for c in certs:
        entry, sim, form = _match(c["name"], _certs()["certificates"], _cert_index())
        if entry is not None:
            lvl = levels[entry["level"]]
            mapping = entry["skills"]
            method = "katalog"
        else:
            lvl = levels["kursus"]
            mapping = {s: round(min(0.6, v - 0.1), 3) for s, v in skill_index().top_k(c["name"], 2) if v >= SKILL_FALLBACK}
            method = "embedding" if mapping else "tidak_terpetakan"
        contrib = {}
        for s, st in mapping.items():
            e = lvl * st
            if entry is not None and entry.get("score_scale") and s == "english_proficiency":
                e = _english_score(entry["score_scale"], c.get("score"))
            contrib[s] = round(e, 3)
            scores[s] = max(scores.get(s, 0.0), e)
            strength[s] = max(strength.get(s, 0.0), st)
        detail.append({"input": c["name"], "matched": entry["name"] if entry else None, "similarity": round(sim, 3),
                       "method": method, "level": entry["level"] if entry else "kursus", "contribution": contrib})
    return EvidenceItem("certificate", "Sertifikat", {k: round(v, 4) for k, v in scores.items()}, strength), detail


def cv_evidence(text: str) -> tuple[EvidenceItem, dict]:
    res = extract_skills(text, kind="cv")
    claims = sorted(res.skills)
    detail = {"extractor": res.extractor,
              "claims": [{"skill_id": s, "quote": m.quote, "level": m.level, "surface": m.surface} for s, m in res.skills.items()],
              "new_candidates": [m.surface for m in res.new_candidates][:20]}
    return EvidenceItem("cv", "CV", {}, {}, claims=claims), detail


# ---------------------------------------------------------------- project rubric
_SQL_L1 = re.compile(r"\bselect\b[\s\S]{1,200}?\bfrom\b", re.I)
_SQL_L2 = re.compile(r"\b(join|group\s+by|having)\b", re.I)
_SQL_L3 = re.compile(r"\bover\s*\(|\bwith\s+\w+\s+as\s*\(|\bpartition\s+by\b|\bcase\s+when\b", re.I)
_PY_L1 = re.compile(r"import\s+pandas|\bpd\.read_|import\s+numpy", re.I)
_PY_L2 = re.compile(r"\.groupby\(|\.merge\(|\.pivot_table\(|\.agg\(", re.I)
_PY_L3 = re.compile(r"\bdef\s+\w+\(|from\s+sklearn|statsmodels|scipy\.stats", re.I)
_VIZ = re.compile(r"plt\.|sns\.|plotly|\.plot\(|chart|grafik|visualisasi|dashboard", re.I)


def _heuristic_rubric(text: str) -> list[dict]:
    """Transparent fallback when no LLM is configured: level from depth of evidence, always quoted."""
    res = extract_skills(text, prefer="lexicon")
    by_skill: dict[str, list] = {}
    for m in res.mentions:
        by_skill.setdefault(m.skill_id, []).append(m)
    ratings = []
    for s, ms in by_skill.items():
        n_quotes = len({m.quote for m in ms})
        level = 1 if n_quotes == 1 else 2 if n_quotes <= 3 else 3
        quote = max(ms, key=lambda m: len(m.quote)).quote
        rationale = f"{n_quotes} bagian artefak menunjukkan keterampilan ini."
        if s == "sql":
            level = 3 if _SQL_L3.search(text) else 2 if _SQL_L2.search(text) else 1 if _SQL_L1.search(text) else min(level, 1)
            m = _SQL_L3.search(text) or _SQL_L2.search(text) or _SQL_L1.search(text)
            if m:
                quote = _line_at(text, m.start())
            rationale = "Kedalaman kueri: " + {1: "SELECT dasar", 2: "JOIN/agregasi", 3: "window function/CTE"}.get(level, "-")
        elif s == "python_analytics":
            level = 3 if _PY_L3.search(text) else 2 if _PY_L2.search(text) else 1 if _PY_L1.search(text) else min(level, 1)
            m = _PY_L3.search(text) or _PY_L2.search(text) or _PY_L1.search(text)
            if m:
                quote = _line_at(text, m.start())
        ratings.append({"skill_id": s, "level": min(level, 3), "quote": quote, "rationale": rationale})
    rated = {r["skill_id"] for r in ratings}
    if "sql" not in rated and _SQL_L1.search(text):
        lvl = 3 if _SQL_L3.search(text) else 2 if _SQL_L2.search(text) else 1
        m = _SQL_L3.search(text) or _SQL_L2.search(text) or _SQL_L1.search(text)
        ratings.append({"skill_id": "sql", "level": lvl, "quote": _line_at(text, m.start()),
                        "rationale": "Kedalaman kueri: " + {1: "SELECT dasar", 2: "JOIN/agregasi", 3: "window function/CTE"}[lvl]})
    if "python_analytics" not in rated and _PY_L1.search(text):
        lvl = 3 if _PY_L3.search(text) else 2 if _PY_L2.search(text) else 1
        m = _PY_L3.search(text) or _PY_L2.search(text) or _PY_L1.search(text)
        ratings.append({"skill_id": "python_analytics", "level": lvl, "quote": _line_at(text, m.start()),
                        "rationale": "Kode analisis data dengan Python."})
    if _VIZ.search(text) and "data_visualization" not in by_skill:
        m = _VIZ.search(text)
        ratings.append({"skill_id": "data_visualization", "level": 1, "quote": _line_at(text, m.start()),
                        "rationale": "Artefak memuat pembuatan grafik."})
    return ratings


def _line_at(text: str, pos: int) -> str:
    a = text.rfind("\n", 0, pos) + 1
    b = text.find("\n", pos)
    return text[a: b if b != -1 else len(text)].strip()[:220]


def project_evidence(text: str, title: str, candidate_ids: list[str] | None = None) -> tuple[EvidenceItem, dict]:
    method = "heuristik"
    ratings: list[dict] = []
    if llm_configured():
        try:
            from .extraction import llm_extractor

            cands = candidate_ids or sorted({m.skill_id for m in extract_skills(text, prefer="lexicon").mentions})
            if cands:
                ratings = llm_extractor().rate_project(text, cands)
                method = "llm"
        except LLMUnavailable:
            ratings = []
    if not ratings:
        ratings = _heuristic_rubric(text)
        method = "heuristik"
    skills = load_skills()
    scores, strength, accepted, rejected = {}, {}, [], []
    for r in ratings:
        if r["skill_id"] not in skills or int(r["level"]) <= 0:
            continue
        if not verify_quote(r.get("quote", ""), text):        # quote must come from the artifact
            rejected.append({**r, "reason": "kutipan tidak ditemukan di artefak"})
            continue
        e = rubric_score(int(r["level"]))
        scores[r["skill_id"]] = max(scores.get(r["skill_id"], 0.0), e)
        strength[r["skill_id"]] = 1.0
        accepted.append({**r, "label": RUBRIC_LABELS[int(r["level"])], "score": e})
    # paper: human re-check on a 20% sample of rubric ratings
    digest = int(hashlib.sha1((title + text[:500]).encode("utf-8")).hexdigest(), 16)
    detail = {"method": method, "ratings": accepted, "rejected": rejected, "needs_human_review": digest % 5 == 0}
    return EvidenceItem("project", title or "Proyek", scores, strength), detail
