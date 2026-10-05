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


def public_item(it: dict) -> dict:
    return {k: it[k] for k in ("id", "skill_id", "difficulty", "stem", "options")}


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
    chosen = [s for _, s in sorted(scored, reverse=True)[:n_skills]]
    plan: list[dict] = []
    for rank, s in enumerate(chosen):
        pool = [it for it in items_for(s) if it["id"] not in answered]
        k = 3 if rank < max(0, target_items - 2 * len(chosen)) else 2
        # one easy + one medium (+ one hard for the top skills) gives a spread for e_assessment
        by_diff = sorted(pool, key=lambda it: it["difficulty"])
        picked = by_diff[:1] + [it for it in by_diff if it["difficulty"] >= 2][: k - 1]
        plan.extend(picked[:k])
    return plan


def reassessment_items(skill_id: str, p: float, answered: set[str], n: int = 3) -> list[dict]:
    pool = [it for it in items_for(skill_id) if it["id"] not in answered] or items_for(skill_id)
    target = 1 if p < 0.35 else 2 if p < 0.65 else 3
    pool.sort(key=lambda it: (abs(it["difficulty"] - target), it["id"]))
    return pool[:n]


def grade(answers: list[dict]) -> list[dict]:
    bank = item_bank()
    out = []
    for a in answers:
        it = bank.get(a["item_id"])
        if not it:
            continue
        choice = a.get("choice")
        correct = choice is not None and int(choice) == it["answer"]
        out.append({"item_id": it["id"], "skill_id": it["skill_id"], "correct": correct, "choice": choice,
                    "answer": it["answer"], "explanation": it["explanation"]})
    return out
