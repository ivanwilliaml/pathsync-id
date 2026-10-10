"""Shared helpers for the job-posting scrapers.

All scrapers only touch public endpoints that the job boards themselves expose for
listing vacancies (Karirhub Kemnaker, public ATS posting APIs). Requests are rate
limited and identify themselves with a research User-Agent.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import time
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RAW_DIR = DATA_DIR / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

USER_AGENT = "Mozilla/5.0 (compatible; PathSync-research/0.1; academic prototype, ICC 2026)"


class PoliteClient:
    """httpx client with a minimum delay between calls and simple retry/backoff."""

    def __init__(self, min_interval: float = 0.4, headers: dict | None = None, timeout: float = 30):
        base = {"User-Agent": USER_AGENT, "Accept": "application/json, text/html;q=0.9"}
        base.update(headers or {})
        self.client = httpx.Client(headers=base, timeout=timeout, follow_redirects=True)
        self.min_interval = min_interval
        self._last = 0.0

    def get(self, url: str, params: dict | None = None, retries: int = 3) -> httpx.Response | None:
        for attempt in range(retries):
            wait = self.min_interval - (time.time() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()
            try:
                r = self.client.get(url, params=params)
            except httpx.HTTPError:
                time.sleep(1.5 * (attempt + 1))
                continue
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(2.0 * (attempt + 1))
                continue
            return r
        return None

    def close(self):
        self.client.close()


# --------------------------------------------------------------------------- text

_WS = re.compile(r"[ \t ]+")


def html_to_text(raw: str | None) -> str:
    """Convert posting HTML to plain text while keeping list items / paragraphs as lines."""
    if not raw:
        return ""
    raw = html.unescape(raw) if "&lt;" in raw else raw
    soup = BeautifulSoup(raw, "lxml")
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for tag in soup.find_all(["p", "li", "div", "h1", "h2", "h3", "h4", "h5", "tr"]):
        tag.insert_before("\n")
        if tag.name == "li":
            tag.insert_before("- ")
    text = soup.get_text()
    lines = [_WS.sub(" ", ln).strip() for ln in text.splitlines()]
    out, prev_blank = [], False
    for ln in lines:
        if not ln:
            if not prev_blank:
                out.append("")
            prev_blank = True
            continue
        out.append(ln)
        prev_blank = False
    return "\n".join(out).strip()


# ------------------------------------------------------------------ role filters

# Titles that count as the target role "Business Analyst" and its Indonesian /
# equivalent designations (paper III.C.1: "Business Analyst dan sebutan setara").
BA_TITLE = re.compile(
    # business analyst, business systems/process/operations analyst, "Business Process and Improvement Analyst"
    r"business\s+(?:[\w&/-]+\s+){0,3}analy[sz]|businessanalyst",
    re.I,
)
BA_TITLE_EXTRA = re.compile(
    r"analis\s+bisnis|\bit\s*ba\b|\bba\s*(?:-|–|\(|$)|\bbusiness\s+analysis\b|^business\s+process\b|"
    r"system[s]?\s+analy[sz]|analis\s+sistem|functional\s+(?:analyst|consultant)|"
    r"requirement[s]?\s+analyst|process\s+analyst|solution[s]?\s+analyst",
    re.I,
)
# Adjacent role used to exercise the "change target role" trigger of the adaptive cycle
DA_TITLE = re.compile(
    r"data\s+analy[sz]|data\s+analis|analis\s+data|\bbi\s+(?:analyst|developer|specialist)|business\s+intelligence|"
    r"reporting\s+analyst|insight[s]?\s+(?:analyst|associate)|customer\s+insight|product\s+analyst|"
    r"analytics\s+(?:analyst|specialist|associate)|digital\s+analyst|"
    r"\bmis\s+(?:analyst|staff|officer|specialist)|data\s*(?:&|and)\s*reporting|data\s+insight",
    re.I,
)
EXCLUDE_TITLE = re.compile(
    r"credit\s+analyst|security|soc\b|network|pentest|claim|quality\s+control|\bqc\b|laborator|"
    r"chemist|research\s+chemist|financial\s+analyst|investment|equity|underwrit|risk\s+analyst|"
    r"tax\s+analyst|treasury|actuar",
    re.I,
)


def classify_role(title: str) -> str | None:
    t = title or ""
    if EXCLUDE_TITLE.search(t) and not (BA_TITLE.search(t) or DA_TITLE.search(t)):
        return None
    if DA_TITLE.search(t):
        return "data_analyst"
    if BA_TITLE.search(t) or BA_TITLE_EXTRA.search(t):
        return "business_analyst"
    return None


ID_LOCATION = re.compile(
    r"indonesia|jakarta|surabaya|bandung|tangerang|bekasi|depok|bogor|yogyakarta|jogja|semarang|"
    r"medan|makassar|bali|denpasar|batam|malang|palembang|balikpapan|cikarang|karawang|\bbsd\b|serpong",
    re.I,
)


def is_indonesia(location: str | None) -> bool:
    return bool(location and ID_LOCATION.search(location))


# ------------------------------------------------------------------- records


@dataclass
class Posting:
    source: str               # karirhub | workable | greenhouse | lever | ...
    source_id: str
    url: str
    title: str
    company: str
    location: str
    published_at: str | None  # ISO date (YYYY-MM-DD)
    description_text: str
    role: str | None = None
    language: str | None = None
    raw_meta: dict = field(default_factory=dict)
    fetched_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat(timespec="seconds"))

    @property
    def fingerprint(self) -> str:
        norm = re.sub(r"\W+", " ", (self.title + " " + self.description_text[:1500]).lower()).strip()
        return hashlib.sha1(norm.encode("utf-8")).hexdigest()

    def to_dict(self) -> dict:
        d = asdict(self)
        d["fingerprint"] = self.fingerprint
        return d


def detect_language(text: str) -> str:
    """Tiny ID/EN detector based on function-word frequency (good enough for routing)."""
    words = re.findall(r"[a-zA-Z]+", text.lower())
    if not words:
        return "unknown"
    id_words = {"dan", "yang", "untuk", "dengan", "dalam", "atau", "memiliki", "mampu", "pengalaman",
                "minimal", "kerja", "di", "ke", "dari", "pada", "bisa", "dapat", "menguasai", "tahun"}
    en_words = {"and", "the", "with", "for", "to", "of", "in", "you", "experience", "skills", "ability",
                "will", "our", "we", "years", "strong", "work", "team", "your"}
    i = sum(w in id_words for w in words)
    e = sum(w in en_words for w in words)
    if i == e == 0:
        return "unknown"
    if i > 1.4 * e:
        return "id"
    if e > 1.4 * i:
        return "en"
    return "mixed"


def write_jsonl(path: Path, rows: Iterable[dict]) -> int:
    n = 0
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
            n += 1
    return n


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def ts_to_date(value) -> str | None:
    """Accept unix seconds/ms or ISO strings and return YYYY-MM-DD."""
    if value in (None, "", 0):
        return None
    try:
        if isinstance(value, (int, float)):
            v = float(value)
            if v > 1e12:
                v /= 1000.0
            return datetime.fromtimestamp(v, tz=UTC).date().isoformat()
        s = str(value).strip()
        if s.isdigit():
            return ts_to_date(int(s))
        return datetime.fromisoformat(s.replace("Z", "+00:00").replace(" ", "T")[:25]).date().isoformat()
    except (ValueError, OverflowError, OSError):
        m = re.match(r"(\d{4}-\d{2}-\d{2})", str(value))
        return m.group(1) if m else None
