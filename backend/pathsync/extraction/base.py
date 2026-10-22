"""Shared contract for skill extractors (paper III.A.1, Fig. 4).

Every extractor - the LLM one and the offline lexicon one - returns `Mention`s with
the skill, a verbatim evidence quote and the requested level. The same two gates are
then applied to both:

1. quote verification: a mention whose quote is not in the source text is rejected, and a mention the posting
   explicitly does not need (requirement.py) is set aside instead of counted;
2. embedding normalisation: free-text skill names are mapped to the taxonomy by
   cosine similarity: >= 0.85 automatic, 0.70-0.85 manual review, < 0.70 new-skill
   candidate (logged separately).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

from ..config import EMBEDDING_AUTO, SIM_AUTO, SIM_REVIEW
from ..text import verify_quote
from .requirement import NOT_COUNTED

LEVELS = ("dasar", "mandiri", "mahir")


@dataclass
class Mention:
    surface: str                  # how the text names the skill
    quote: str                    # verbatim sentence from the source text
    level: str = "mandiri"        # dasar | mandiri | mahir
    skill_id: str | None = None   # taxonomy id proposed by the extractor (None = free text)
    similarity: float = 1.0       # cosine similarity to the taxonomy form it was mapped to
    status: str = "auto"          # auto | review | new | rejected
    method: str = "lexicon"       # lexicon | pattern | llm
    reason: str = ""
    requirement: str = "required"  # required | preferred | alternative | excluded | uncertain | mention_only
    group: str = ""               # shared id of the options in one "A atau B" alternative

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ExtractionResult:
    mentions: list[Mention] = field(default_factory=list)
    rejected: list[Mention] = field(default_factory=list)
    new_candidates: list[Mention] = field(default_factory=list)
    review: list[Mention] = field(default_factory=list)
    excluded: list[Mention] = field(default_factory=list)    # named but not needed (DATA-01): never demand
    extractor: str = "lexicon"

    @property
    def skills(self) -> dict[str, Mention]:
        """One mention per skill: the strongest requirement wins (required > alternative > preferred), then the most
        demanding level."""
        best: dict[str, Mention] = {}
        for m in self.mentions:
            cur = best.get(m.skill_id)
            if cur is None or _rank(m) > _rank(cur):
                best[m.skill_id] = m
        return best


_STRENGTH = {"preferred": 0, "alternative": 1, "required": 2}


def _rank(m: Mention) -> tuple[int, int]:
    return _STRENGTH.get(m.requirement, 2), LEVELS.index(m.level)


def _trigrams(t: str) -> set[str]:
    t = f"  {t.lower()} "
    return {t[i:i + 3] for i in range(len(t) - 2)}


# Words too general to show that a phrase and a skill form mean the same thing: sharing "data" or "bisnis" let
# "Data Science" map to data warehousing and "bisnis komersial" to business process modelling (audit AI-3).
GENERIC_WORDS = {
    "data", "media", "bisnis", "business", "security", "keamanan", "bidang", "proses", "process", "processes",
    "system", "systems", "sistem", "management", "manajemen", "analysis", "analisis", "analisa", "development",
    "pengembangan", "report", "reports", "reporting", "laporan", "design", "desain", "digital", "online", "tools",
    "tool", "skills", "skill", "kemampuan", "information", "informasi", "service", "services", "layanan", "project",
    "projects", "proyek", "financial", "keuangan", "basic", "dasar", "advanced", "lanjutan", "and", "dan", "of", "the",
    "untuk", "for", "with", "dengan", "di", "in", "planning", "perencanaan", "solution", "solutions", "operation",
    "operations", "operasional", "technical", "teknis", "application", "applications", "aplikasi", "software",
    "inventory", "payment", "payments", "logistics", "metrics", "revenue", "algorithms", "customer", "sales",
}


def lexical_support(surface: str, form: str) -> float:
    """Character-trigram Jaccard, 1.0 when they share a meaningful whole word (not one of GENERIC_WORDS). Embeddings
    alone rate unrelated short words ("teliti", "ollama", "odi") close to some skill name; a mapping must also look like
    the form it maps to."""
    if (set(surface.lower().split()) & set(form.lower().split())) - GENERIC_WORDS:
        return 1.0
    a, b = _trigrams(surface), _trigrams(form)
    return len(a & b) / len(a | b) if a | b else 0.0


MIN_LEXICAL_SUPPORT = 0.35   # below this an embedding match goes to review, not to the market map (recalibrate with V4 labels)


def apply_gates(raw: list[Mention], source_text: str, index, valid_ids: set[str]) -> ExtractionResult:
    res = ExtractionResult()
    free: list[Mention] = []
    for m in raw:
        if not verify_quote(m.quote, source_text):
            m.status, m.reason = "rejected", "kutipan tidak ditemukan di teks asli"
            res.rejected.append(m)
            continue
        if m.requirement in NOT_COUNTED:
            m.status = "excluded"
            res.excluded.append(m)
            continue
        if m.skill_id in valid_ids and m.method != "pattern":
            res.mentions.append(m)          # extractor already constrained to the taxonomy
        else:
            free.append(m)

    if free and index is not None:
        for m, (sid, sim, form) in zip(free, index.nearest([m.surface for m in free]), strict=False):
            m.similarity = round(sim, 4)
            if sim >= SIM_AUTO and lexical_support(m.surface, form) < MIN_LEXICAL_SUPPORT:
                sim = min(sim, SIM_AUTO - 1e-3)       # looks similar to the embedding but not to the text: needs a human
                m.reason = f"embedding match without textual overlap with '{form}'"
            if sim >= SIM_AUTO and EMBEDDING_AUTO:
                m.skill_id, m.status = sid, "auto"
                res.mentions.append(m)
            elif sim >= SIM_AUTO:          # automatic band disabled by the labelled evaluation: a human decides
                m.skill_id, m.status, m.reason = sid, "review", f"mirip '{form}' ({sim:.2f}); otomatis dimatikan"
                res.review.append(m)
            elif sim >= SIM_REVIEW:
                m.skill_id, m.status, m.reason = sid, "review", f"mirip '{form}' ({sim:.2f})"
                res.review.append(m)
            else:
                m.skill_id, m.status, m.reason = None, "new", f"terdekat '{form}' ({sim:.2f})"
                res.new_candidates.append(m)
    return res
