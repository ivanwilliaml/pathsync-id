"""Requirement status of a skill mention (audit DATA-01).

Finding a skill name in a posting is not the same as the posting requiring it: "SQL tidak diperlukan" names SQL and
excludes it. Every lexicon mention therefore gets one status, decided from its own clause:

  required     - stated as needed, or named as a duty with no qualifier (the default)
  preferred    - nice to have / nilai tambah / tidak wajib: shown, never in a posting's required set
  alternative  - one of several options ("Python atau R"): one of the group is needed, not all
  excluded     - explicitly not needed for this position ("tidak diperlukan", "kami tidak menggunakan", "bukan posisi ini")
  uncertain    - only a possibility ("tidak menutup kemungkinan")
  mention_only - named without asking for prior skill ("pelatihan SQL akan diberikan")

Policy: excluded, uncertain and mention_only never count as demand or as a requirement. Preferred and alternative count
in the role-wide demand map (employers value the skill) but not in a single posting's required set. Negation is scoped:
a cue only reaches the skill names it is directly attached to, so "Wajib SQL, Python tidak diperlukan" excludes Python
only, and "Tidak hanya SQL, tetapi juga Python" excludes neither.
"""
from __future__ import annotations

import re

COUNTED = ("required", "preferred", "alternative")
NOT_COUNTED = ("excluded", "uncertain", "mention_only")

_SENTENCE = re.compile(r"[.;!?](?=\s|$)|\n")
_CONTRAST = re.compile(r",?\s*\b(?:tetapi|tapi|namun|melainkan|sedangkan|but|however|whereas)\b", re.I)

_NOT_ONLY = re.compile(r"\b(?:tidak hanya|tak hanya|bukan hanya|bukan sekadar|not only|not just)\b", re.I)
_OTHER_POSITION = re.compile(r"\bbukan\s+(?:untuk\s+)?(?:posisi|peran|jabatan|role)\s+ini\b|"
                             r"\bnot\s+(?:for\s+)?this\s+(?:role|position)\b", re.I)
_TRAINING = re.compile(r"\b(?:pelatihan|training)\b[^.;]{0,40}\b(?:akan diberikan|diberikan|disediakan|will be provided|"
                       r"is provided|provided)\b|\b(?:akan|will)\s+(?:dilatih|diajarkan|be trained|be taught)\b|"
                       r"\bdiberikan pelatihan\b", re.I)
_UNCERTAIN = re.compile(r"\b(?:tidak menutup kemungkinan|tak menutup kemungkinan|kemungkinan akan|mungkin akan|"
                        r"may (?:also )?(?:use|involve)|might (?:use|involve)|possibly)\b", re.I)
_PREFERRED = re.compile(r"\b(?:preferred|preferably|nice[- ]to[- ]have|(?:is |a |an |sebagai )?plus(?: point)?\b(?! plus)|"
                        r"nilai tambah|nilai plus|menjadi (?:nilai )?(?:tambah|plus)|diutamakan|lebih disukai|"
                        r"advantage(?:ous)?|bonus|tidak wajib|tak wajib|bukan (?:syarat )?wajib|not mandatory|"
                        r"non-mandatory|optional|opsional|akan membantu|would be helpful|is helpful)\b", re.I)
# A cue right after the skill names: "SQL (dan Python) tidak diperlukan", "Python is not required".
_NEG_AFTER = re.compile(r"\b(?:tidak|tak|not|isn'?t|aren'?t|bukan)\s+(?:terlalu\s+|begitu\s+|a\s+)?"
                        r"(?:diperlukan|dibutuhkan|perlu|disyaratkan|diharuskan|harus|required|needed|necessary|"
                        r"requirement|syarat|prasyarat|persyaratan)\b"
                        r"(?=\s*(?:[.,;:)!]|$|untuk|for|di|pada|in|dalam|bagi))", re.I)
# A cue right before the skill names: "tidak perlu Python", "kami tidak menggunakan Java", "no prior Python experience".
_NEG_BEFORE = re.compile(r"\b(?:tidak|tak)\s+(?:perlu|memerlukan|membutuhkan|mensyaratkan|menggunakan|memakai|wajib)\b|"
                         r"\btanpa\s+(?:perlu\s+)?(?:pengalaman|menguasai|kemampuan)\b|"
                         r"\b(?:do(?:es)?\s+not|don'?t|doesn'?t|we\s+do\s+not)\s+(?:require|need|use|expect)\b|"
                         r"\bno\s+(?:prior|previous)\b|\bno\s+need\s+(?:for|to\s+know)\b|\bno\s+(?:experience|knowledge)\s+"
                         r"(?:in|with|of)\b", re.I)
# Words allowed between a cue and the skill names it governs (besides other skill names and list separators).
_FILLER = {"dan", "and", "atau", "or", "serta", "maupun", "&", "/", ",", "pengalaman", "experience", "prior", "previous",
           "kemampuan", "knowledge", "pengetahuan", "skill", "skills", "keahlian", "menguasai", "bahasa", "pemrograman",
           "programming", "language", "dengan", "with", "in", "di", "dalam", "of", "kerja", "working", "tools", "tool",
           "juga", "also", "seperti", "such", "as", "e.g.", "misalnya", "yang", "kami", "we", "is", "are", "itu",
           "the", "a", "an", "-", "menggunakan", "using", "use"}
_TOKEN = re.compile(r"[\w.+#'-]+|[,/&()]")
_ALT_JOIN = re.compile(r"^\s*(?:,\s*)?(?:atau|or)\s*$|^\s*,\s*$", re.I)


_CONJ = re.compile(r"\b(?:dan|and|atau|or|serta|maupun)\b|&|/", re.I)


def _only_filler(text: str) -> bool:
    """Only list words between a cue and a name. A bare comma ends the cue's reach ("Wajib SQL, Python tidak
    diperlukan" excludes Python only); a list joined by dan/atau carries it ("SQL, Excel, dan Python tidak diperlukan")."""
    if ("," in text and not _CONJ.search(text)) or "(" in text or ")" in text:
        return False                   # a bracket starts or ends an aside: "Python (Flask is not required)"
    return all(tok.lower() in _FILLER for tok in _TOKEN.findall(text))


def _blank(text: str, spans: list[tuple[int, int]], lo: int, hi: int) -> str:
    """text[lo:hi] with other skill names replaced by spaces."""
    chars = list(text[lo:hi])
    for a, b in spans:
        for i in range(max(a, lo), min(b, hi)):
            chars[i - lo] = " "
    return "".join(chars)


def _clauses(segment: str) -> list[tuple[int, int, int]]:
    """(sentence_start, clause_start, clause_end) for each clause of a segment."""
    out = []
    start = 0
    bounds = [m.end() for m in _SENTENCE.finditer(segment)] + [len(segment)]
    for end in bounds:
        if end <= start:
            continue
        cs = start
        for m in _CONTRAST.finditer(segment, start, end):
            if m.start() > cs:
                out.append((start, cs, m.start()))
            cs = m.end()
        out.append((start, cs, end))
        start = end
    return out


def classify(segment: str, spans: list[tuple[int, int]]) -> list[tuple[str, str, str]]:
    """(status, reason, group) for every skill-name span in a segment (spans in segment offsets, any order)."""
    result: list[tuple[str, str, str]] = [("required", "", "")] * len(spans)
    clauses = _clauses(segment)
    for idx, (a, b) in enumerate(spans):
        sent_start, cs, ce = next(((s, c, e) for s, c, e in clauses if c <= a < e), (0, 0, len(segment)))
        sent_end = max((e for s, c, e in clauses if s == sent_start), default=len(segment))
        clause = segment[cs:ce]
        sentence = segment[sent_start:sent_end]
        before, after = segment[cs:a], segment[b:ce]
        if _OTHER_POSITION.search(sentence):
            result[idx] = ("excluded", "disebut untuk tim/posisi lain", "")
        elif _NOT_ONLY.search(before):
            continue
        elif _TRAINING.search(clause):
            result[idx] = ("mention_only", "pelatihan diberikan; bukan syarat awal", "")
        elif any(_only_filler(_blank(segment, spans, m.end() + cs, a)) for m in _NEG_BEFORE.finditer(before)):
            result[idx] = ("excluded", "dinyatakan tidak diperlukan", "")
        elif any(_only_filler(_blank(segment, spans, b, b + m.start())) for m in _NEG_AFTER.finditer(after)):
            result[idx] = ("excluded", "dinyatakan tidak diperlukan", "")
        elif _PREFERRED.search(clause):
            result[idx] = ("preferred", "nilai tambah, tidak wajib", "")
        elif _UNCERTAIN.search(clause):
            result[idx] = ("uncertain", "hanya kemungkinan", "")
    # alternatives: names chained by "atau"/"or" (commas allowed) with nothing else between them
    order = sorted(range(len(spans)), key=lambda i: spans[i][0])
    chain: list[int] = []
    joins: list[str] = []

    def close():
        if len(chain) > 1 and any(re.search(r"\b(?:atau|or)\b", j, re.I) for j in joins):
            gid = f"alt{spans[chain[0]][0]}"
            for i in chain:
                if result[i][0] in ("required", "preferred"):
                    result[i] = ("alternative", "salah satu dari beberapa pilihan", gid)

    for i in order:
        if chain:
            between = segment[spans[chain[-1]][1]:spans[i][0]]
            if _ALT_JOIN.match(between):
                chain.append(i)
                joins.append(between)
                continue
            close()
        chain, joins = [i], []
    close()
    return result
