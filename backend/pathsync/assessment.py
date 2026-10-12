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

from .config import LANG, SEED_DIR
from .demand import MarketMap
from .evidence import SkillState


@lru_cache(maxsize=1)
def item_bank() -> dict[str, dict]:
    """Load all items; the correct option is written first in the seed and shuffled deterministically here."""
    bank = {}
    for f in sorted((SEED_DIR / "items").glob("*.json")):
        overlay = {}
        tr = SEED_DIR / "items_en" / f.name
        if LANG == "en" and tr.exists():
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


def reassessment_items(skill_id: str, p: float, answered: set[str], n: int = 3) -> list[dict]:
    """Unseen items only: an item whose answer was revealed can never count as evidence again."""
    pool = [it for it in items_for(skill_id) if it["id"] not in answered]
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
            raise SubmissionError(f"Item {iid!r} was not part of this check.")
        if iid in seen:
            raise SubmissionError(f"Item {iid!r} was answered twice.")
        seen.add(iid)
        choice = a.get("choice")
        if choice is not None and not (isinstance(choice, int) and 0 <= choice < 4):
            raise SubmissionError("Each answer must be one of the four options.")
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
