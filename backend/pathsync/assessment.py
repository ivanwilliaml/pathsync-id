"""Short assessment (paper III.A.2): 20-30 items chosen from a bank of ~5 items per skill.

The diagnostic picks the target role's most demanded skills where confidence is lowest;
re-assessment ("buktikan kemajuan") serves unseen items for one skill and feeds the
answers to Bayesian knowledge tracing.
"""
from __future__ import annotations

import hashlib
import json
import random
from functools import lru_cache

from .config import SEED_DIR
from .demand import MarketMap
from .evidence import SkillState
from .i18n import get_lang, tr


def item_bank(lang: str | None = None) -> dict[str, dict]:
    """All items in the request's display language. The key's position is the same in both languages, because the
    shuffle is seeded by the item id and both files list the correct option first."""
    return _item_bank(lang or get_lang())


item_bank.cache_clear = lambda: _item_bank.cache_clear()     # callers that reload the bank after editing it


@lru_cache(maxsize=4)
def _item_bank(lang: str) -> dict[str, dict]:
    bank = {}
    for f in sorted((SEED_DIR / "items").glob("*.json")):
        overlay = {}
        tr = SEED_DIR / "items_en" / f.name
        if lang == "en" and tr.exists():
            overlay = json.loads(tr.read_text(encoding="utf-8"))
        for it in json.loads(f.read_text(encoding="utf-8")):
            if it["id"] in overlay:
                # same option order as the original (correct option first), so the shuffle and answer key match
                t = overlay[it["id"]]
                assert len(t["options"]) == len(it["options"]), it["id"]
                it = {**it, "stem": t["stem"], "options": t["options"], "explanation": t["explanation"]}
            opts = list(it["options"])
            correct = opts[0]
            rng = random.Random(int(hashlib.sha1(it["id"].encode()).hexdigest(), 16))
            rng.shuffle(opts)
            bank[it["id"]] = {**it, "options": opts, "answer": opts.index(correct)}
    return bank


def session_order(session_id: str, item_id: str, n: int = 4) -> list[int]:
    """Per-session permutation of an item's options (indices into the canonical bank order).

    Seeded by (session id, item id): the same student sees a stable order if the page reloads, but two sessions never
    share one, so "item 7 is C" cannot circulate as an answer sheet (PM audit P0-1)."""
    digest = hashlib.sha256(f"{session_id}|{item_id}".encode()).digest()
    order = list(range(n))
    random.Random(int.from_bytes(digest[:8], "big")).shuffle(order)
    return order


def public_item(it: dict, session_id: str | None = None) -> dict:
    out = {k: it[k] for k in ("id", "skill_id", "difficulty", "stem", "options")}
    if session_id:
        base = canonical_options(it)
        out["options"] = [base[i] for i in session_order(session_id, it["id"], len(base))]
    return out


def canonical_options(it: dict) -> list[str]:
    """Options with the key first, as authored."""
    opts = list(it["options"])
    key = opts[it["answer"]]
    return [key] + [o for i, o in enumerate(opts) if i != it["answer"]]


def items_for(skill_id: str) -> list[dict]:
    return sorted((it for it in item_bank().values() if it["skill_id"] == skill_id), key=lambda x: (x["difficulty"], x["id"]))


def diagnostic_plan(market: MarketMap, states: dict[str, SkillState], answered: set[str],
                    n_skills: int = 11, target_items: int = 24) -> list[dict]:
    """Pick skills by demand x (1 - confidence); two items each, a third for the most demanded."""
    scored = []
    for s, sd in market.skills.items():
        if sd.demand < 0.08:
            continue
        st = states.get(s)
        conf = st.confidence if st else 0.0
        # skills supported only by claims or academic exposure are tested first (paper III.A.2)
        boost = 1.35 if st is not None and (st.claimed or "paparan_akademik_tanpa_bukti_langsung" in st.flags) else 1.0
        scored.append((sd.demand * (1.0 - 0.7 * conf) * boost, s))
    chosen = [s for _, s in sorted(scored, reverse=True) if any(it["id"] not in answered for it in items_for(s))][:n_skills]
    plan: list[dict] = []
    for rank, s in enumerate(chosen):
        pool = sorted((it for it in items_for(s) if it["id"] not in answered), key=lambda it: (it["difficulty"], it["id"]))
        k = 3 if rank < max(0, target_items - 2 * len(chosen)) else 2
        # one easy + one harder item (+ a third for the top skills) gives a spread for e_assessment
        picked = pool[:1] + [it for it in pool[1:] if it["difficulty"] >= 2][: k - 1]
        if len(picked) < k:
            picked += [it for it in pool if it not in picked][: k - len(picked)]
        plan.extend(picked[:k])
    return plan


@lru_cache(maxsize=1)
def calibrated_difficulty() -> dict[str, float]:
    """Empirical Rasch difficulty per item from data/models/item_calibration.json (plan A5), only for
    items with enough real answers and only once the calibration is marked active."""
    from .config import MODELS_DIR

    f = MODELS_DIR / "item_calibration.json"
    if not f.exists():
        return {}
    doc = json.loads(f.read_text(encoding="utf-8"))
    return {k: v["b"] for k, v in doc.get("rasch", {}).items() if v.get("calibrated")} if doc.get("active") else {}


def reassessment_items(skill_id: str, p: float, answered: set[str], n: int = 3) -> list[dict]:
    """Unseen items only: an item whose answer was revealed can never count as evidence again.

    With an active calibration, items are picked by Fisher information at the student's current
    ability (Rasch); otherwise by the author's difficulty closest to the mastery band."""
    from .item_analysis import item_information, theta_from_mastery

    pool = [it for it in items_for(skill_id) if it["id"] not in answered]
    b = calibrated_difficulty()
    if pool and all(it["id"] in b for it in pool):
        theta = theta_from_mastery(p)
        pool.sort(key=lambda it: (-item_information(theta, b[it["id"]]), it["id"]))
        return pool[:n]
    target = 1 if p < 0.35 else 2 if p < 0.65 else 3
    pool.sort(key=lambda it: (abs(it["difficulty"] - target), it["id"]))
    return pool[:n]


class SubmissionError(ValueError):
    pass


def validate_submission(issued: list[str], answers: list[dict]) -> list[dict]:
    """Answers must cover only items issued in this session, each at most once."""
    issued_set = set(issued)
    seen: set[str] = set()
    clean = []
    for a in answers:
        iid = str(a.get("item_id", ""))
        if iid not in issued_set:
            raise SubmissionError(tr(f"Item {iid!r} was not part of this check.", f"Soal {iid!r} bukan bagian dari check ini."))
        if iid in seen:
            raise SubmissionError(tr(f"Item {iid!r} was answered twice.", f"Soal {iid!r} dijawab dua kali."))
        seen.add(iid)
        choice = a.get("choice")
        if choice is not None and not (isinstance(choice, int) and 0 <= choice < 4):
            raise SubmissionError(tr("Each answer must be one of the four options.", "Setiap jawaban harus salah satu dari empat pilihan."))
        clean.append({"item_id": iid, "choice": choice})
    return clean


def grade(answers: list[dict], session_id: str | None = None) -> list[dict]:
    """Grade answers whose `choice` indexes the options as shown in this session (see `session_order`).

    Returns the displayed index of the key (`answer`) and the canonical index chosen (`choice_canon`, 0 = key), which
    the item analysis uses to count how often each distractor attracts students."""
    bank = item_bank()
    out = []
    for a in answers:
        it = bank.get(a["item_id"])
        if not it:
            continue
        order = session_order(session_id, it["id"]) if session_id else None
        if order is None:
            shown_key = it["answer"]
        else:
            # canonical index 0 is the key; position of canonical 0 in the displayed order
            shown_key = order.index(0)
        choice = a.get("choice")
        correct = choice is not None and int(choice) == shown_key
        canon = None
        if choice is not None:
            canon = order[int(choice)] if order else (0 if correct else None)
        out.append({"item_id": it["id"], "skill_id": it["skill_id"], "correct": correct, "choice": choice,
                    "choice_canon": canon, "answer": shown_key, "explanation": it["explanation"]})
    return out
