"""Learning loop: learn -> practice -> prove -> adapt, per route skill (docs/design/LEARNING_LOOP.md).

The route says *what* to learn; the loop helps the student master it and shows the proof:

  learn     the route's free materials (marking them done never changes mastery)
  practice  short tasks in three tiers - basic, applied, and transfer (the same idea in another domain) - graded on the
            server with feedback on the misconception behind each wrong option. Practice is for learning: it decides
            which tier or next step is suggested, but never changes mastery.
  prove     a re-check with unseen items (/assessment/{skill}); only this and other evidence move mastery, and only
            direct evidence moves p_proven
  adapt     a deterministic decision from the state below, with its reason shown to the student

The decision rules are written as data-free functions so they can be tested and simulated (pipeline.simulate_loop).
Practice content lives in data/seed/practice/*.json (Indonesian; the five core BA skills also carry English). Options
may be written compactly as [text, correct, feedback]. Skills without content fall back to learn -> prove.
"""
from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import READINESS_THRESHOLD, REQUIRED_MIN, SEED_DIR
from .db import AssessmentResponse, AssessmentSession, PracticeAttempt, Student
from .i18n import get_lang, tr
from .pathing import level_label

PRACTICE_DIR = SEED_DIR / "practice"
TIERS = ("basic", "applied", "transfer")
TIER_PASS = 2 / 3        # basic and applied: at least two of three tasks right on the latest try
TRANSFER_PASS = 1.0      # transfer: every transfer task right, before a skill is called mastered


def _option(o) -> dict:
    if isinstance(o, list):                      # compact form: [text, correct, feedback]
        return {"text": o[0], "correct": bool(o[1]), "feedback": o[2]}
    return o


@lru_cache(maxsize=1)
def practice_bank() -> dict[str, dict]:
    """skill_id -> {objective, criteria, tasks, provenance}, merged from every practice file."""
    bank: dict[str, dict] = {}
    for f in sorted(PRACTICE_DIR.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        for sid, body in data["skills"].items():
            if sid in bank:
                raise ValueError(f"practice for {sid} is defined twice ({f.name})")
            tasks = [{**t, "options": [_option(o) for o in t["options"]]} if t["type"] == "choice" else t for t in body["tasks"]]
            bank[sid] = {**body, "tasks": tasks, "provenance": data.get("provenance", {})}
    return bank


def _criteria(content: dict) -> list[str]:
    c = content["criteria"]
    return list(c if isinstance(c, list) else (c.get(get_lang()) or c["id"]))


def _l(text) -> str:
    """Pick the request language from a {"id": .., "en": ..} pair."""
    if isinstance(text, dict):
        return text.get(get_lang()) or text.get("id") or ""
    return text or ""


def _rng(student_id: str, task_id: str) -> random.Random:
    return random.Random(int(hashlib.sha1(f"{student_id}:{task_id}".encode()).hexdigest(), 16))


def display_order(student_id: str, task: dict) -> list[int]:
    """Stable per-student shuffle of a task's options (choice) or steps (order). For order tasks the shown order is
    never already the answer."""
    n = len(task["options"] if task["type"] == "choice" else task["steps"])
    idx = list(range(n))
    rng = _rng(student_id, task["id"])
    rng.shuffle(idx)
    if task["type"] == "order" and idx == sorted(idx) and n > 1:
        idx = idx[1:] + idx[:1]
    return idx


def public_task(student_id: str, task: dict, last: PracticeAttempt | None = None) -> dict:
    out = {"id": task["id"], "tier": task["tier"], "type": task["type"], "context": _l(task.get("context")) or None,
           "stem": _l(task["stem"]), "last": None if last is None else {"correct": last.correct, "answer": last.answer}}
    order = display_order(student_id, task)
    if task["type"] == "choice":
        out["options"] = [{"idx": i, "text": _l(task["options"][i]["text"])} for i in order]
    else:
        out["steps"] = [{"idx": i, "text": _l(task["steps"][i])} for i in order]
    return out


class PracticeError(ValueError):
    pass


def grade_practice(task: dict, answer) -> dict:
    """Grade one answer. `answer` is the canonical option index (choice) or the list of canonical step indices in the
    order the student put them (order). Returns correctness and the feedback to show, revealing every option."""
    if task["type"] == "choice":
        if not isinstance(answer, int) or not 0 <= answer < len(task["options"]):
            raise PracticeError(tr("Pick one of the options.", "Pilih salah satu opsi."))
        key = next(i for i, o in enumerate(task["options"]) if o["correct"])
        return {"correct": answer == key, "answer": [answer], "key": key,
                "feedback": _l(task["options"][answer]["feedback"]),
                "options": [{"idx": i, "text": _l(o["text"]), "correct": o["correct"], "feedback": _l(o["feedback"])}
                            for i, o in enumerate(task["options"])],
                "takeaway": _l(task.get("takeaway"))}
    n = len(task["steps"])
    if not isinstance(answer, list) or sorted(answer) != list(range(n)):
        raise PracticeError(tr("Put every step in order once.", "Susun setiap langkah tepat sekali."))
    first_wrong = next((pos for pos, i in enumerate(answer) if i != pos), None)
    return {"correct": first_wrong is None, "answer": list(answer), "key": list(range(n)),
            "first_wrong": first_wrong, "feedback": _l(task.get("feedback")),
            "steps": [_l(x) for x in task["steps"]], "takeaway": _l(task.get("takeaway"))}


# ------------------------------------------------------------------ state and decision (pure, testable)
@dataclass
class TierState:
    total: int = 0
    done: int = 0          # tasks with at least one attempt
    correct: int = 0       # tasks whose latest attempt is right

    @property
    def share(self) -> float:
        return self.correct / self.total if self.total else 0.0


@dataclass
class LoopState:
    supported: bool
    target: float
    p: float
    p_proven: float | None
    tiers: dict[str, TierState] = field(default_factory=dict)
    unmet_prereqs: list[str] = field(default_factory=list)
    last_prove_at: datetime | None = None
    last_prove_correct: int = 0
    last_prove_total: int = 0
    last_practice_at: datetime | None = None

    @property
    def proven(self) -> bool:
        return self.p_proven is not None and self.p_proven >= self.target

    def passed(self, tier: str) -> bool:
        t = self.tiers.get(tier)
        if t is None or not t.total:
            return True
        return t.share >= (TRANSFER_PASS if tier == "transfer" else TIER_PASS) - 1e-9


def decide(st: LoopState) -> str:
    """The adapt step. Codes: mastered | transfer | prove | retry | practice_basic | review_basic | practice_applied |
    prerequisite. Order matters: a proven skill is never sent back to basics, and a missing prerequisite is named
    before more practice on something that depends on it."""
    if st.proven:
        if not st.supported or st.passed("transfer"):
            return "mastered"
        return "transfer"
    if not st.supported:
        return "prerequisite" if st.unmet_prereqs else "prove"
    if st.unmet_prereqs:
        return "prerequisite"
    basic = st.tiers.get("basic", TierState())
    if not st.passed("basic"):
        return "practice_basic" if basic.done == 0 else "review_basic"
    if not st.passed("applied"):
        return "practice_applied"
    failed_after_practice = (st.last_prove_at is not None and st.last_practice_at is not None
                             and st.last_prove_at > st.last_practice_at)
    return "retry" if failed_after_practice else "prove"


# ------------------------------------------------------------------ database view
def _latest_attempts(s: Session, student_id: str, skill_id: str) -> dict[str, PracticeAttempt]:
    rows = s.scalars(select(PracticeAttempt).where(PracticeAttempt.student_id == student_id, PracticeAttempt.skill_id == skill_id)
                     .order_by(PracticeAttempt.created_at, PracticeAttempt.id)).all()
    return {r.task_id: r for r in rows}


def _last_prove(s: Session, student_id: str, skill_id: str) -> tuple[datetime | None, int, int]:
    sess = s.scalars(select(AssessmentSession).where(AssessmentSession.student_id == student_id,
                                                     AssessmentSession.phase == "reassessment",
                                                     AssessmentSession.skill_id == skill_id,
                                                     AssessmentSession.submitted_at.is_not(None))
                     .order_by(AssessmentSession.submitted_at.desc())).first()
    if sess is None:
        return None, 0, 0
    rows = s.scalars(select(AssessmentResponse).where(AssessmentResponse.session_id == sess.id)).all()
    return sess.submitted_at, sum(r.correct for r in rows), len(rows)


def loop_state(s: Session, student: Student, ctx, states: dict, skill_id: str) -> tuple[LoopState, dict[str, PracticeAttempt]]:
    content = practice_bank().get(skill_id)
    stt = states[skill_id]
    target = ctx.req.get(skill_id) or REQUIRED_MIN
    unmet = [q for q in ctx.graph.prereqs.get(skill_id, []) if q in states and states[q].p < READINESS_THRESHOLD]
    latest = _latest_attempts(s, student.id, skill_id) if content else {}
    tiers = {}
    if content:
        for tier in TIERS:
            ids = [t["id"] for t in content["tasks"] if t["tier"] == tier]
            tiers[tier] = TierState(total=len(ids), done=sum(i in latest for i in ids),
                                    correct=sum(i in latest and latest[i].correct for i in ids))
    prove_at, prove_ok, prove_n = _last_prove(s, student.id, skill_id)
    return LoopState(supported=content is not None, target=target, p=stt.p, p_proven=stt.p_proven, tiers=tiers,
                     unmet_prereqs=unmet, last_prove_at=prove_at, last_prove_correct=prove_ok, last_prove_total=prove_n,
                     last_practice_at=max((a.created_at for a in latest.values()), default=None)), latest


def _decision_text(code: str, skill_id: str, name: str, st: LoopState, names: dict[str, str]) -> dict:
    prereqs = [{"skill_id": q, "name": names.get(q, q)} for q in st.unmet_prereqs]
    level = level_label(st.target)
    n_basic = st.tiers["basic"].total if "basic" in st.tiers else 0
    n_applied = st.tiers["applied"].total if "applied" in st.tiers else 0
    text = {
        "mastered": (tr("Mastered: move on", "Dikuasai: lanjut"),
                     tr("Your proven level meets the target and you applied it to a different case.",
                        "Level terbuktimu memenuhi target dan kamu sudah menerapkannya di kasus berbeda."),
                     "/learn", tr("Go to the next step", "Ke langkah berikutnya")),
        "transfer": (tr("Try it on a different case", "Coba di kasus berbeda"),
                     tr("The check says you have it. One different case first, to be sure it carries over.",
                        "Cek ulang menunjukkan kamu menguasainya. Satu kasus berbeda dulu, untuk memastikan bisa diterapkan di situasi lain."),
                     f"/learn/practice/{skill_id}?tier=transfer", tr("Start the transfer case", "Mulai kasus transfer")),
        "prove": (tr("Prove it", "Buktikan"),
                  tr(f"Practice looks solid. A short check with new questions shows whether you reached {level}.",
                     f"Latihanmu sudah baik. Cek singkat dengan soal baru menunjukkan apakah kamu sudah mencapai level {level}."),
                  f"/assessment/{skill_id}", tr("Take the check", "Ikuti cek ulang")),
        "retry": (tr("Not there yet: practise once more", "Belum tercapai: latihan sekali lagi"),
                  tr(f"The last check scored {st.last_prove_correct}/{st.last_prove_total}. Redo the applied tasks, read the feedback, then check again.",
                     f"Cek terakhir {st.last_prove_correct}/{st.last_prove_total} benar. Ulangi latihan terapan, baca umpan baliknya, lalu cek lagi."),
                  f"/learn/practice/{skill_id}?tier=applied", tr("Practise again", "Latihan lagi")),
        "practice_basic": (tr("Start with the basics", "Mulai dari latihan dasar"),
                           tr(f"{n_basic} short tasks on the core idea, with feedback on every answer.",
                              f"{n_basic} latihan singkat tentang konsep inti, dengan umpan balik untuk setiap jawaban."),
                           f"/learn/practice/{skill_id}?tier=basic", tr("Start practice", "Mulai latihan")),
        "review_basic": (tr("Review, then redo the basics", "Ulas materi, lalu ulangi latihan dasar"),
                         tr("Some basics are still off. Read the feedback and one material, then try the basic tasks again.",
                            "Beberapa konsep dasar belum tepat. Baca umpan balik dan satu materi, lalu ulangi latihan dasar."),
                         f"/learn/practice/{skill_id}?tier=basic", tr("Redo the basics", "Ulangi latihan dasar")),
        "practice_applied": (tr("Apply it to a case", "Terapkan di kasus"),
                             tr(f"Basics done. Now {n_applied} tasks from realistic situations.",
                                f"Dasar sudah. Sekarang {n_applied} latihan dari situasi nyata."),
                             f"/learn/practice/{skill_id}?tier=applied", tr("Start applied tasks", "Mulai latihan terapan")),
        "prerequisite": (tr("Learn the prerequisite first", "Pelajari prasyaratnya dulu"),
                         tr(f"{name} builds on {', '.join(p['name'] for p in prereqs)}. That one is not solid yet.",
                            f"{name} dibangun di atas {', '.join(p['name'] for p in prereqs)}, yang belum kuat."),
                         f"/learn#step-{st.unmet_prereqs[0]}" if st.unmet_prereqs else "/learn",
                         tr("Go to the prerequisite", "Ke prasyarat")),
    }[code]
    title, reason, href, cta = text
    return {"code": code, "title": title, "reason": reason, "href": href, "cta": cta, "prereqs": prereqs}


def loop_status(s: Session, student: Student, ctx, states: dict, skill_id: str, materials: tuple[int, int] = (0, 0)) -> dict:
    """Everything the Learn page needs for one step: stages, numbers and the next decision with its reason."""
    st, latest = loop_state(s, student, ctx, states, skill_id)
    content = practice_bank().get(skill_id)
    code = decide(st)
    stt = states[skill_id]
    return {
        "skill_id": skill_id, "name": ctx.names[skill_id], "supported": st.supported,
        "objective": _l(content["objective"]) if content else None,
        "criteria": _criteria(content) if content else [],
        "provenance": _l(content.get("provenance")) if content else None,
        "target": round(st.target, 3), "level_target": level_label(st.target),
        "p": round(st.p, 3), "level_now": level_label(st.p),
        "p_proven": None if st.p_proven is None else round(st.p_proven, 3),
        "confidence": round(stt.confidence, 3), "low_confidence": stt.low_confidence,
        "stages": {
            "learn": {"done": materials[0], "total": materials[1]},
            "practice": {t: {"total": v.total, "done": v.done, "correct": v.correct, "passed": st.passed(t)} for t, v in st.tiers.items()},
            "prove": {"proven": st.proven,
                      "last": None if st.last_prove_at is None else {"at": st.last_prove_at.isoformat(),
                                                                     "correct": st.last_prove_correct, "total": st.last_prove_total}},
        },
        "decision": _decision_text(code, skill_id, ctx.names[skill_id], st, ctx.names),
    }
