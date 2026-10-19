"""Sync, the in-app assistant: the PathSync chameleon answering questions across the app with a hosted LLM (Groq,
OpenAI-compatible chat completions with tool calling).

Grounding rules:
- every fact comes from a tool, and the tools only read: this student's own profile, route and career fit, and the
  public job postings. Sync cannot change anything (target, evidence, plans).
- numbers (levels, readiness, fit) are computed by the PathSync engine, never by the model; the model only phrases.
- the posting text and the skill-match table reach the student as "cards" built from the database, not from the
  model's words, so the posting is shown verbatim and cannot be paraphrased into something it did not say.
- privacy: nothing that identifies the student (name, id, contact) is sent; only skills, levels and postings.

Configuration: GROQ_API_KEY (required to enable Sync), GROQ_MODEL (default openai/gpt-oss-120b).
"""
from __future__ import annotations

import json
import os
import re
from collections.abc import Callable
from dataclasses import dataclass, field

import httpx
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .config import ROLES
from .db import Posting, PostingMention, Student
from .engine import load_context, responses, student_states
from .i18n import get_lang
from .pathing import level_label

GROQ_URL = os.getenv("GROQ_URL", "https://api.groq.com/openai/v1/chat/completions")
DEFAULT_MODEL = "openai/gpt-oss-120b"
MAX_TURNS = 12              # conversation turns kept from the client
MAX_TOOL_ROUNDS = 4
MAX_POSTING_CHARS = 2500    # what the model reads of a posting; the card always carries the full text
MAX_PROFILE_SKILLS = 12
RELEVANT_DEMAND = 0.15


def sync_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY"))


def _model() -> str:
    return os.getenv("GROQ_MODEL", DEFAULT_MODEL)


LEVELS = {"awal": ("Beginner", "Pemula"), "dasar": ("Basic", "Dasar"), "mandiri": ("Proficient", "Mandiri"),
          "mahir": ("Advanced", "Mahir")}


def _lvl(p: float) -> str:
    en, id_ = LEVELS.get(level_label(p), (level_label(p), level_label(p)))
    return id_ if get_lang() == "id" else en


# ------------------------------------------------------------------ tools (read only, this student only)
TOOLS = [
    {"type": "function", "function": {
        "name": "my_profile",
        "description": "The student's target career, role readiness, evidence so far and their in-demand skills with level now vs the level the target role needs.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "my_route",
        "description": "The student's learning route: the steps in order, why each comes now, hours, and free materials.",
        "parameters": {"type": "object", "properties": {}}}},
    {"type": "function", "function": {
        "name": "career_fit",
        "description": "How close the student is to each career (readiness), or the details of one career (its biggest gaps).",
        "parameters": {"type": "object", "properties": {
            "career": {"type": "string", "description": "Optional career name or id, e.g. 'Data Analyst'."}}}}},
    {"type": "function", "function": {
        "name": "search_postings",
        "description": "Find real job postings by words in the title or description, optionally within one career. Returns ids to open.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "Words to look for, e.g. 'business analyst bank' or 'SQL'."},
            "career": {"type": "string", "description": "Optional career name or id."}},
            "required": ["query"]}}},
    {"type": "function", "function": {
        "name": "open_posting",
        "description": "The full original text of one job posting (shown to the student verbatim).",
        "parameters": {"type": "object", "properties": {"posting_id": {"type": "string"}}, "required": ["posting_id"]}}},
    {"type": "function", "function": {
        "name": "match_posting",
        "description": "Compare one job posting with the student's skills: each skill the posting asks for, the student's level, the level the career needs, and whether it is met.",
        "parameters": {"type": "object", "properties": {"posting_id": {"type": "string"}}, "required": ["posting_id"]}}},
]


class SyncBusy(Exception):
    """Groq's rate limit was reached; `seconds` until a retry can work."""

    def __init__(self, seconds: int):
        super().__init__(f"busy for {seconds}s")
        self.seconds = seconds


def _plain(text: str) -> str:
    """The panel renders short paragraphs, '- ' bullets and **bold**; anything else a model adds (headings, stray
    emphasis, extra blank lines) is removed so replies stay calm."""
    text = re.sub(r"(?m)^#{1,6}\s*", "", text)
    text = re.sub(r"(?m)^\s*[*•]\s+", "- ", text)                       # other bullet styles -> '- '
    text = re.sub(r"\*\*(\s*)\*\*", r"\1", text)
    if text.count("**") % 2:                                            # an unpaired marker would show as-is
        text = text.replace("**", "")
    text = re.sub(r"(?<![*\w])\*(?!\*)([^*\n]+?)\*(?![*\w])", r"\1", text)  # *single* emphasis -> plain
    text = re.sub(r"[ \t]+\n", "\n", text)
    return _shape(re.sub(r"\n{3,}", "\n\n", text).strip())


MAX_BULLETS = 3
_NEXT = re.compile(r"^(?:langkah (?:berikutnya|selanjutnya)|next step)[^:\n]*:\s*", re.I)
_LIST = re.compile(r"^\s*(?:[-•]|\d+[.)])\s+")


def _shape(text: str) -> str:
    """Models drift from the asked shape (extra paragraphs, long lists, a numbered plan as the next step). Whatever
    came back is cut to: the answer, at most a few bullets, and one next step, so every reply reads the same way."""
    answer: list[str] = []
    bullets: list[str] = []
    nxt = ""
    lines = [ln.strip() for ln in text.split("\n")]
    for k, ln in enumerate(lines):
        if not ln:
            continue
        head = _NEXT.match(ln)
        if head:
            rest = " ".join([ln[head.end():]] + [x for x in lines[k + 1:] if x])
            step = next((p.strip() for p in re.split(r"(?:^|\s)\d+[.)]\s+", rest) if p.strip()), "")
            step = re.split(r"(?<=[.!?])\s", step)[0]            # a numbered plan keeps its first step only
            label = "Next step:" if head.group(0).lower().startswith("next") else "Langkah berikutnya:"
            nxt = f"{label} {step}" if step else ""
            break
        if _LIST.match(ln):
            if len(bullets) < MAX_BULLETS:
                bullets.append("- " + _LIST.sub("", ln))
        elif not bullets and (not answer or lines[k - 1]):       # the opening paragraph; later ones are dropped
            answer.append(ln)
    if not answer and not bullets:
        return text
    parts = [" ".join(answer)] if answer else []
    if bullets:
        parts.append("\n".join(bullets))
    if nxt:
        parts.append(nxt)
    return "\n\n".join(parts)


@dataclass
class Turn:
    reply: str
    cards: list[dict] = field(default_factory=list)


def _role_id(career: str | None) -> str | None:
    if not career:
        return None
    c = career.strip().lower()
    for rid, cfg in ROLES.items():
        if c in (rid, rid.replace("_", " "), cfg["name"].lower()) or c in cfg["name"].lower():
            return rid
    return None


class Tools:
    def __init__(self, s: Session, st: Student, recommend: Callable[[Session, Student], dict]):
        self.s, self.st, self.recommend = s, st, recommend
        self.cards: list[dict] = []
        self._states = None

    def states(self):
        if self._states is None:
            self._states = student_states(self.s, self.st, load_context(self.s, self.st.target_role), responses(self.s, self.st.id))
        return self._states

    def _rec(self) -> dict:
        return self.recommend(self.s, self.st)      # the same recommendation the dashboard shows

    def my_profile(self) -> dict:
        rec = self._rec()
        rank = {r["skill_id"]: r["rank"] for r in rec["ranking"]}
        skills = [{"skill": c["name"], "now": _lvl(c["p"]), "needs": _lvl(c["required"]), "met": c["p"] >= c["required"],
                   "asked": f"{c['demand']:.0%}", "priority": rank.get(c["skill_id"]), "thin_evidence": c["low_confidence"]}
                  for c in rec["competencies"] if c["demand"] >= RELEVANT_DEMAND or rank.get(c["skill_id"], 99) <= 5]
        ev = rec.get("evidence_summary", {})
        return {"target_career": rec["role"]["name"], "role_readiness": f"{rec['coverage']:.0%}",
                "evidence": {k: v for k, v in ev.items() if v}, "skill_check_done": rec.get("diagnostic_done"),
                "skills": sorted(skills, key=lambda x: (x["priority"] or 99))[:MAX_PROFILE_SKILLS]}

    def my_route(self) -> dict:
        rec = self._rec()
        return {"total_hours": rec["path_hours"], "steps": [
            {"step": i + 1, "skill": p["name"], "why_now": (p.get("explanation") or {}).get("why_now") or p.get("why_prereq"),
             "focus": p.get("learn_what"), "hours": p.get("hours"),
             "materials": [m["title"] for m in p.get("materials", [])][:3]} for i, p in enumerate(rec["path"])]}

    def career_fit(self, career: str | None = None) -> dict:
        from .careers import careers_for

        data = careers_for(self.s, self.st)["careers"]
        rid = _role_id(career)
        if rid:
            c = next(x for x in data if x["id"] == rid)
            return {"career": c["name"], "readiness": f"{c['readiness']:.0%}", "is_target": c["is_target"],
                    "postings": c["n_postings"], "skills_measured": f"{c['n_measured']} of {c['n_skills']}",
                    "biggest_gaps": [f"{g['name']}: {g['level_now']} -> {g['level_needed']}" for g in c["top_gaps"]]}
        return {"careers": [{"career": c["name"], "readiness": f"{c['readiness']:.0%}", "is_target": c["is_target"]} for c in data[:8]]}

    def search_postings(self, query: str, career: str | None = None) -> dict:
        stmt = select(Posting).where(Posting.duplicate_of.is_(None))
        rid = _role_id(career)
        if rid:
            stmt = stmt.where(Posting.role == rid)
        words = [w for w in (query or "").split() if len(w) > 1][:4]
        for w in words:
            stmt = stmt.where(or_(Posting.title.ilike(f"%{w}%"), Posting.description.ilike(f"%{w}%"), Posting.company.ilike(f"%{w}%")))
        rows = self.s.scalars(stmt.order_by(Posting.published_at.desc()).limit(5)).all()
        if not rows and words:      # loosen: any of the words in the title
            stmt = select(Posting).where(Posting.duplicate_of.is_(None), or_(*[Posting.title.ilike(f"%{w}%") for w in words]))
            rows = self.s.scalars(stmt.order_by(Posting.published_at.desc()).limit(5)).all()
        return {"postings": [{"posting_id": p.id, "title": p.title, "company": p.company, "career": ROLES.get(p.role, {}).get("name", p.role),
                              "published": p.published_at.isoformat() if p.published_at else None} for p in rows]}

    def _posting(self, pid: str) -> Posting | None:
        return self.s.get(Posting, pid)

    def open_posting(self, posting_id: str) -> dict:
        p = self._posting(posting_id)
        if p is None:
            return {"error": "No posting with this id. Search first."}
        self.cards.append({"type": "posting", "id": p.id, "title": p.title, "company": p.company, "location": p.location,
                           "source": p.source, "url": p.url, "published_at": p.published_at.isoformat() if p.published_at else None,
                           "description": p.description})
        return {"title": p.title, "company": p.company, "career": ROLES.get(p.role, {}).get("name", p.role),
                "text": p.description[:MAX_POSTING_CHARS], "note": "The student sees the full text in a card under your reply."}

    def match_posting(self, posting_id: str) -> dict:
        from .careers import _role_requirements

        p = self._posting(posting_id)
        if p is None:
            return {"error": "No posting with this id. Search first."}
        ctx = load_context(self.s, p.role)
        req = _role_requirements(ctx)
        states = self.states()
        ids = sorted({m.skill_id for m in self.s.scalars(select(PostingMention).where(
            PostingMention.posting_id == p.id, PostingMention.status == "auto", PostingMention.skill_id.is_not(None))).all()
            if m.skill_id in ctx.skills})
        rows = []
        for k in ids:
            now = states[k].p if k in states else 0.0
            need = req.get(k)
            proven = k in states and states[k].has_evidence
            status = "unproven" if not proven else ("met" if need is not None and now >= need else ("close" if need is not None and need - now <= 0.15 else "gap"))
            rows.append({"skill_id": k, "skill": ctx.names[k], "level_now": _lvl(now) if proven else None, "score_now": round(now, 2),
                         "needed": _lvl(need) if need is not None else None, "status": status})
        order = {"gap": 0, "close": 1, "unproven": 2, "met": 3}
        rows.sort(key=lambda r: (order[r["status"]], r["skill"]))
        summary = {k: sum(1 for r in rows if r["status"] == k) for k in order}
        self.cards.append({"type": "match", "posting_id": p.id, "title": p.title, "company": p.company, "rows": rows, "summary": summary})
        return {"posting": p.title, "company": p.company, "skills_asked": len(rows), "summary": summary,
                "rows": [{k: r[k] for k in ("skill", "level_now", "needed", "status")} for r in rows],
                "note": "The student sees this table as a card; refer to it instead of repeating every row."}

    def run(self, name: str, args: dict) -> dict:
        fn = getattr(self, name, None)
        if name not in {t["function"]["name"] for t in TOOLS} or fn is None:
            return {"error": f"Unknown tool {name}"}
        try:
            return fn(**{k: v for k, v in (args or {}).items() if isinstance(v, str)})
        except TypeError:
            return {"error": "Bad arguments."}


# ------------------------------------------------------------------ the conversation
# where things are in the app; Sync may only point to these, so it never invents a menu
PLACES = {
    "id": ["Kenali Skill (level tiap skill, tambah bukti, Cek Kemampuan)", "Pilih Karier (bandingkan karier, ganti target)",
           "Belajar → Rute (langkah dan materi)", "Belajar → Minggu Ini (rencana mingguan)", "Tambah Bukti (transkrip, sertifikat, project)"],
    "en": ["Understand Your Skills (levels, add evidence, skill check)", "Choose a Career (compare careers, change target)",
           "Learn → Route (steps and materials)", "Learn → This Week (weekly plan)", "Add Evidence (transcript, certificates, projects)"],
}


def _system(lang: str) -> str:
    language = "Bahasa Indonesia (santai, sopan)" if lang == "id" else "English (friendly)"
    places = "; ".join(PLACES["id" if lang == "id" else "en"])
    return (
        "You are Sync, the chameleon guide of PathSync, an app that helps Indonesian students see which skills employers "
        "ask for, how close they are, and what to learn next. You talk with one student. Answer in " + language + ", even "
        "when tool results are in English.\n"
        "Facts: use the tools for every fact about the student, careers or job postings; never invent numbers, levels, "
        "postings, quotes or app menus. For a question about fitting a job posting: search it, open it, then match it. The "
        "original posting and the match table are shown under your reply as cards, so never repeat their rows.\n"
        "Shape of every reply (short, easy to scan, at most about 60 words):\n"
        "1. One sentence with the answer itself (e.g. how close they are, in plain words).\n"
        "2. At most 2 bullet points starting with '- ', each one short line, with only what matters most (name at most "
        "two skills; mark a skill name with **bold**).\n"
        "3. One line starting with 'Langkah berikutnya:' (or 'Next step:' in English) naming exactly one place from this "
        "list: " + places + ".\n"
        "Example:\n"
        "Kamu sudah dekat, tinggal dua skill yang perlu dikejar.\n\n"
        "- **SQL & Kueri Basis Data** – sekarang Dasar, perlu Mandiri\n"
        "- **Dokumentasi Kebutuhan** – sekarang Dasar, perlu Mahir\n\n"
        "Langkah berikutnya: Belajar → Rute, mulai dari SQL.\n"
        "Use a blank line between the three parts. No headings, no tables, no other markdown. You cannot change anything "
        "in the app. If a question is not about careers, skills, learning or job postings, decline in one sentence and "
        "steer back."
    )


def _groq(messages: list[dict], tools: bool = True) -> dict:
    body = {"model": _model(), "messages": messages, "temperature": 0.3, "max_tokens": 600}
    if tools:
        body |= {"tools": TOOLS, "tool_choice": "auto"}
    r = httpx.post(GROQ_URL, headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"}, json=body, timeout=40)
    if r.status_code == 429:      # the free tier counts tokens per minute: tell the student when to try again
        try:
            wait = float(r.headers.get("retry-after") or 20)
        except ValueError:
            wait = 20.0
        raise SyncBusy(int(wait) + 1)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]


def chat(s: Session, st: Student, history: list[dict], recommend: Callable[[Session, Student], dict]) -> Turn:
    lang = get_lang()
    tools = Tools(s, st, recommend)
    msgs = [{"role": "system", "content": _system(lang)}]
    for m in history[-MAX_TURNS:]:
        if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str):
            msgs.append({"role": m["role"], "content": m["content"][:2000]})
    for _ in range(MAX_TOOL_ROUNDS):
        msg = _groq(msgs)
        calls = msg.get("tool_calls") or []
        if not calls:
            return Turn(_plain(msg.get("content") or ""), tools.cards)
        msgs.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls})
        for c in calls:
            try:
                args = json.loads(c["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            out = tools.run(c["function"]["name"], args)
            msgs.append({"role": "tool", "tool_call_id": c["id"], "content": json.dumps(out, ensure_ascii=False, separators=(",", ":"))[:6000]})
    final = _groq(msgs, tools=False)
    return Turn(_plain(final.get("content") or ""), tools.cards)
