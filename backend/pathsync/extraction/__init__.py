"""Skill extraction pipeline: extractor -> quote verification -> embedding normalisation."""
from __future__ import annotations

import hashlib
from functools import lru_cache
from pathlib import Path

from ..embeddings import SkillIndex, once
from ..taxonomy import load_skills
from .base import ExtractionResult, Mention, apply_gates
from .lexicon import LexiconExtractor
from .llm import ClaudeExtractor, LLMUnavailable, llm_configured

_HERE = Path(__file__).resolve().parent


@lru_cache(maxsize=4)
def cache_tag(extractor: str) -> str:
    """Extraction-cache key suffix: extractor, taxonomy version and a hash of everything that changes
    the output (taxonomy file with its aliases, and for the lexicon its code and the gates). Editing
    aliases without bumping the taxonomy version used to reuse stale cached extractions."""
    from ..config import SEED_DIR
    from ..taxonomy import load_taxonomy

    files = [SEED_DIR / "taxonomy.json"]
    if extractor != "llm":                      # llm results are gated at import; the prompt is the taxonomy
        files += [_HERE / "lexicon.py", _HERE / "base.py", _HERE / "requirement.py"]
    h = hashlib.sha256()
    for f in files:
        h.update(f.read_bytes().replace(b"\r\n", b"\n"))
    return f"{extractor}|{load_taxonomy()['version']}|{h.hexdigest()[:12]}"


@once
def skill_index() -> SkillIndex:
    return SkillIndex(load_skills())


@lru_cache(maxsize=1)
def lexicon_extractor() -> LexiconExtractor:
    return LexiconExtractor(load_skills())


@lru_cache(maxsize=1)
def llm_extractor() -> ClaudeExtractor:
    return ClaudeExtractor(load_skills())


def extract_skills(text: str, prefer: str | None = None, kind: str = "posting") -> ExtractionResult:
    """Run the configured extractor on `text` and apply both gates.

    prefer: "llm" | "lexicon" | None (auto: LLM when credentials are configured).
    kind:   "posting" or "cv" (changes only the LLM instructions).
    """
    skills = load_skills()
    use_llm = prefer == "llm" or (prefer is None and llm_configured())
    raw: list[Mention]
    name = "lexicon"
    if use_llm:
        try:
            ex = llm_extractor()
            raw = ex.extract_cv(text) if kind == "cv" else ex.extract(text)
            name = "llm"
        except LLMUnavailable:
            raw = lexicon_extractor().extract(text)
    else:
        raw = lexicon_extractor().extract(text)
    res = apply_gates(raw, text, skill_index(), set(skills))
    res.extractor = name
    return res


__all__ = ["cache_tag", "extract_skills", "ExtractionResult", "Mention", "skill_index", "LLMUnavailable", "llm_configured"]
