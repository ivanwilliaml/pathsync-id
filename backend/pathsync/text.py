"""Text helpers shared by extraction, quote verification and document parsing."""
from __future__ import annotations

import re
from dataclasses import dataclass

_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
                         " ": " ", "•": " ", "�": " ", "●": " ", "▪": " ", "": " "})
_WS = re.compile(r"\s+")


def normalize_for_match(s: str) -> str:
    """Lower-case and canonicalise quotes, dashes, bullets and whitespace.

    Used for quote verification so that a quote copied with a straight apostrophe
    still matches a curly apostrophe in the source, but the words must be identical.
    """
    s = (s or "").translate(_QUOTES).lower()
    s = re.sub(r"^[\-\*•\s]+", "", s)
    return _WS.sub(" ", s).strip()


@dataclass
class Segment:
    start: int
    end: int
    text: str
    paragraph: int


_SPLIT = re.compile(r"(?<=[.!?;])\s+(?=[A-Z0-9À-ɏ\"'(])|\n+")


def split_segments(text: str) -> list[Segment]:
    """Split a posting into sentence / bullet segments with character offsets."""
    segs: list[Segment] = []
    para = 0
    pos = 0
    for block in re.split(r"(\n\s*\n)", text):
        if re.fullmatch(r"\n\s*\n", block or ""):
            pos += len(block)
            para += 1
            continue
        cursor = 0
        for piece in _SPLIT.split(block):
            if piece is None:
                continue
            idx = block.find(piece, cursor)
            if idx < 0:
                continue
            cursor = idx + len(piece)
            stripped = piece.strip()
            if len(stripped) < 3:
                continue
            lead = len(piece) - len(piece.lstrip())
            segs.append(Segment(pos + idx + lead, pos + idx + lead + len(stripped), stripped, para))
        pos += len(block)
    return segs


def verify_quote(quote: str, source: str) -> bool:
    """Paper III.A.1: an extraction whose quote is not found in the original text is rejected."""
    q = normalize_for_match(quote)
    if len(q) < 3:
        return False
    return q in normalize_for_match(source)


def trim_quote(segment: str, start: int, end: int, max_len: int = 220) -> str:
    """Return a verbatim window of `segment` around [start, end) cut at word boundaries."""
    if len(segment) <= max_len:
        return segment
    half = (max_len - (end - start)) // 2
    a = max(0, start - half)
    b = min(len(segment), end + half)
    while a > 0 and segment[a - 1] not in " ,;:(":
        a -= 1
    while b < len(segment) and segment[b] not in " ,;:)":
        b += 1
    return segment[a:b].strip(" ,;:")


ABOUT_COMPANY = re.compile(
    r"\b(we are|we're|kami adalah|kami merupakan|merupakan perusahaan|is a leading|is one of the|founded in|didirikan|"
    r"about us|tentang kami|our mission|misi kami|visi kami|our vision|what we offer|benefit[s]?\b|keuntungan|"
    r"fasilitas|why join|mengapa bergabung|equal opportunity|we offer|kami menawarkan|salary|gaji|tunjangan|"
    r"bpjs|asuransi kesehatan|health insurance|annual leave|cuti)\b",
    re.I,
)


def is_boilerplate(segment: str) -> bool:
    """Company description, benefits and legal boilerplate carry no skill demand."""
    return bool(ABOUT_COMPANY.search(segment))
