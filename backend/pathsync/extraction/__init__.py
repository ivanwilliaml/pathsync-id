"""Skill extraction pipeline: extractor -> quote verification -> embedding normalisation."""
from __future__ import annotations

from functools import lru_cache

from ..embeddings import SkillIndex, once
from ..taxonomy import load_skills
from .base import ExtractionResult, Mention, apply_gates
from .lexicon import LexiconExtractor
from .llm import ClaudeExtractor, LLMUnavailable, llm_configured


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


__all__ = ["extract_skills", "ExtractionResult", "Mention", "skill_index", "LLMUnavailable", "llm_configured"]
