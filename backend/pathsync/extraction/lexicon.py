"""Offline, taxonomy-constrained skill extractor.

Used when no LLM credentials are configured, and as the always-available baseline the
LLM extractor is compared against. It produces the same `Mention` contract:

* lexical pass  - every taxonomy alias (ID + EN) found in a requirement/responsibility
                  segment becomes a mention, quoted with its sentence;
* pattern pass  - free-text phrases after cue words ("experience with ...",
                  "menguasai ...") that contain no known alias are sent to embedding
                  normalisation, where unknown skills surface as new-skill candidates.
"""
from __future__ import annotations

import re

from ..taxonomy import Skill
from ..text import is_boilerplate, split_segments, trim_quote
from .base import Mention

LEVEL_CUES = {
    "mahir": re.compile(r"\b(expert|expertise|advanced|mahir|sangat (?:menguasai|mahir|baik)|deep (?:knowledge|understanding|expertise)|"
                        r"in-depth|mastery|highly proficient|tingkat lanjut|lanjutan|excellent command|strong expertise)\b", re.I),
    "dasar": re.compile(r"\b(basic|dasar|familiar|familiarity|understanding of|basic understanding|memahami|pemahaman|mengetahui|"
                        r"exposure|awareness|pengenalan|mengenal)\b", re.I),
    "mandiri": re.compile(r"\b(proficient|proficiency|strong|solid|mampu|menguasai|experienced?|berpengalaman|pengalaman|hands-on|"
                          r"skilled|able to|working knowledge|terbiasa|competent|kompeten)\b", re.I),
}

# Generic words that only count as a skill when the segment states a requirement or duty.
WEAK_ALIASES = {
    "cloud", "oracle", "azure", "aws", "audit", "fraud", "revenue", "accounting", "akuntansi", "client", "klien",
    "timeline", "bug", "bugs", "defect", "regulatory", "regulasi", "regulation", "transformation", "transformasi",
    "rollout", "roll-out", "adopsi", "governance", "tata kelola", "spark", "hive", "notebook", "research", "riset",
    "penelitian", "insight", "insights", "analytics", "testing", "workflow", "alur kerja", "sop", "efficiency",
    "efisiensi", "documentation", "dokumentasi", "database", "basis data", "laporan", "reports", "reporting",
    "metrics", "metrik", "chart", "charts", "grafik", "survey", "survei", "sprint", "workshop", "workshops",
    "milestone", "milestones", "deliverables", "automation", "otomasi", "prototype", "mockup", "english",
    "communication", "komunikasi", "stakeholder", "stakeholders", "proses bisnis", "business process",
    "business processes", "pitch", "slides", "logika", "teliti", "retention", "anggaran", "budgeting",
    "compliance", "kepatuhan", "crm", "erp", "sap", "visualization", "visualisasi", "presentation", "presentasi",
    "pengujian", "menguji", "qa", "bilingual", "pengembangan sistem", "software development", "system development",
}
REQUIREMENT_CUE = re.compile(
    r"\b(experience|pengalaman|familiar|knowledge|pengetahuan|understand|memahami|pemahaman|mampu|kemampuan|able|ability|"
    r"skill|skills|keahlian|menguasai|proficien|strong|good|excellent|baik|responsib|bertanggung jawab|membuat|menyusun|"
    r"melakukan|conduct|perform|prepare|develop|mengembangkan|create|manage|mengelola|analy[sz]e|menganalisis|support|"
    r"mendukung|ensure|memastikan|work with|collaborat|koordinasi|handle|menangani|maintain|monitor|memantau|provide|"
    r"identify|mengidentifikasi|define|lead|memimpin|deliver|build|design|merancang|translate|document|write|menulis|"
    r"present|use|menggunakan|using|utili[sz]e|tools?|such as|seperti|e\.g\.|including|termasuk|requirement|kualifikasi|"
    r"qualification|terbiasa|minimal|minimum|preferred|plus|nilai tambah)\b", re.I)
NEGATIVE_CONTEXT = {
    "reporting": re.compile(r"\breporting (?:to|directly)\b|\breport(?:s|ing)? to\b", re.I),
    "reports": re.compile(r"\breports? to\b", re.I),
    "client": re.compile(r"\b(?:our|serving|serve)\s+(?:\w+\s+)?clients?\b", re.I),
    "english": re.compile(r"\benglish (?:name|version)\b", re.I),
}
PATTERN_CUE = re.compile(
    r"(?:experience (?:in|with|using)|knowledge (?:of|in)|familiar(?:ity)? with|proficien(?:t|cy) (?:in|with)|understanding of|"
    r"skilled in|expertise in|hands-on (?:experience )?(?:with|in)|pengalaman (?:dalam|di|menggunakan|dengan)|menguasai|"
    r"memahami|familiar dengan|terbiasa (?:dengan|menggunakan)|keahlian (?:dalam|di)?|kemampuan (?:dalam|untuk)?|"
    r"mampu (?:menggunakan|mengoperasikan)|tools? (?:such as|seperti)|such as|seperti)\s+([^.;:\n]{3,140})",
    re.I,
)
_ITEM_SPLIT = re.compile(r",|/|\band\b|\bdan\b|\batau\b|\bor\b|\(|\)|\betc\b|\bdll\b|\bdsb\b", re.I)
_STOP_ITEM = re.compile(r"^(?:the|a|an|of|in|with|yang|untuk|dengan|di|ke|dari|serta|terkait|related|other|lainnya|"
                        r"various|berbagai|similar|sejenis|tools?|tool|software|aplikasi|sistem|system|good|strong|"
                        r"solutions?|platforms?|roles?|field|enhancement|import|distribution|relationships?)$"
                        r"|\bsuch as\b|\brelated (?:field|roles?)\b|\bsimilar (?:platforms?|tools?)\b|\bthe it field\b"
                        r"|^(?:tools?|software|aplikasi)\b|nilai tambah|\bplus\b|preferred|diutamakan|advantage|"
                        r"\b(?:tahun|years?|bulan|months?)\b|\d", re.I)


# A degree field ("Bachelor in Statistics") is not a skill requirement.
DEGREE = re.compile(r"\b(?:bachelor|master|degree|diploma|s1|s2|d3|d4|sarjana|jurusan|gelar|graduate|lulusan|related field|pendidikan)\b", re.I)
FIELD_ALIASES = {"statistics", "statistik", "accounting", "akuntansi", "marketing", "mathematics", "matematika", "computer science"}
# "integrating ... APIs" / "API integration" is an api_integration mention even when the alias list has no exact form
API_INTEGRATION = re.compile(r"\bintegrat\w*\b[^.;\n]{0,70}\bAPIs?\b|\bAPIs?\b[^.;\n]{0,20}\bintegrat\w*|\bintegrasi\b[^.;\n]{0,30}\bapi\b", re.I)


class LexiconExtractor:
    name = "lexicon"

    def __init__(self, skills: dict[str, Skill]):
        self.alias_owner: dict[str, str] = {}
        for sid, sk in skills.items():
            for a in sk.aliases:
                # first owner wins; aliases are unique in the frozen taxonomy
                self.alias_owner.setdefault(a.lower(), sid)
        ordered = sorted(self.alias_owner, key=len, reverse=True)
        self.alias_re = re.compile(r"(?<![\w])(" + "|".join(re.escape(a) for a in ordered) + r")(?![\w])", re.I)

    @staticmethod
    def _level(segment: str, pos: int) -> str:
        best, best_d = "mandiri", 10**9
        found_any = False
        for level, rx in LEVEL_CUES.items():
            for m in rx.finditer(segment):
                d = min(abs(m.start() - pos), abs(m.end() - pos))
                found_any = True
                # mahir/dasar cues beat a generic mandiri cue at similar distance
                bias = -15 if level != "mandiri" else 0
                if d + bias < best_d:
                    best, best_d = level, d + bias
        return best if found_any else "mandiri"

    def extract(self, text: str) -> list[Mention]:
        out: list[Mention] = []
        for seg in split_segments(text):
            s = seg.text
            if is_boilerplate(s):
                continue
            has_cue = bool(REQUIREMENT_CUE.search(s))
            covered: list[tuple[int, int]] = []
            strong_in_seg = False
            hits = []
            for m in self.alias_re.finditer(s):
                alias = m.group(1).lower()
                hits.append((m, alias))
                if alias not in WEAK_ALIASES:
                    strong_in_seg = True
            if API_INTEGRATION.search(s) and "api_integration" in self.alias_owner.values():
                am = API_INTEGRATION.search(s)
                out.append(Mention(
                    surface=am.group(0)[:40], quote=trim_quote(s, am.start(), am.end()), level=self._level(s, am.start()),
                    skill_id="api_integration", similarity=1.0, status="auto", method="lexicon",
                ))
            degree = bool(DEGREE.search(s))
            for m, alias in hits:
                if degree and alias in FIELD_ALIASES:
                    continue
                neg = NEGATIVE_CONTEXT.get(alias)
                if neg and neg.search(s):
                    continue
                if alias in WEAK_ALIASES and not (has_cue or strong_in_seg):
                    continue
                covered.append((m.start(), m.end()))
                out.append(Mention(
                    surface=m.group(1), quote=trim_quote(s, m.start(), m.end()), level=self._level(s, m.start()),
                    skill_id=self.alias_owner[alias], similarity=1.0, status="auto", method="lexicon",
                ))
            # pattern pass: free-text items after cue words with no known alias inside
            for pm in PATTERN_CUE.finditer(s):
                chunk_start = pm.start(1)
                for raw in _ITEM_SPLIT.split(pm.group(1)):
                    item = raw.strip(" -:\"'")
                    if not (2 < len(item) <= 50) or len(item.split()) > 4 or _STOP_ITEM.search(item):
                        continue
                    if self.alias_re.search(item):
                        continue
                    pos = s.find(item, chunk_start)
                    if pos < 0 or any(a <= pos < b for a, b in covered):
                        continue
                    out.append(Mention(
                        surface=item, quote=trim_quote(s, pos, pos + len(item)), level=self._level(s, pos),
                        skill_id=None, similarity=0.0, status="pending", method="pattern",
                    ))
        return out
