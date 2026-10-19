"""Simulated students through the learning loop (pathsync.learning_loop). SIMULATION, not evidence about real learners:
it checks that the engine behaves as designed, not that people learn.

    python -m pipeline.simulate_loop          # writes data/models/loop_simulation.json

A. What "proven" means. One re-check is 3 unseen items. A student who knows the skill answers right with 1 - slip,
   one who does not with the guessing probability. Exact binomial enumeration gives, for each starting proven level and
   target, how often the check calls the skill proven (true-positive rate for knowers, false-positive rate for guessers).
B. The loop terminates. Synthetic students with a hidden knows/does-not-know state go through practice tiers, checks and
   the transfer case following decide(); learning happens with a fixed chance per practice round. We count steps,
   students who never finish within the cap, and students called mastered while not knowing.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from itertools import product

from pathsync.config import BKT_GUESS, BKT_SLIP, MODELS_DIR, PRIOR_NO_EVIDENCE
from pathsync.evidence import bkt_update
from pathsync.learning_loop import LoopState, TierState, decide

OUT = MODELS_DIR / "loop_simulation.json"
CHECK_ITEMS = 3
TARGETS = {"mandiri": 0.725, "mahir": 0.85}
STARTS = {"no direct evidence": PRIOR_NO_EVIDENCE, "some direct evidence (0.40)": 0.40}
GUESSES = {"chance (0.25)": BKT_GUESS, "items with surface cues (0.35)": 0.35}


def proven_rates() -> list[dict]:
    rows = []
    for (sname, start), (gname, guess), (tname, target) in product(STARTS.items(), GUESSES.items(), TARGETS.items()):
        tp = fp = 0.0
        for answers in product((True, False), repeat=CHECK_ITEMS):
            p = start
            for a in answers:
                p = bkt_update(p, a, guess=guess)
            k = sum(answers)
            p_know = (1 - BKT_SLIP) ** k * BKT_SLIP ** (CHECK_ITEMS - k)
            p_guess = guess ** k * (1 - guess) ** (CHECK_ITEMS - k)
            if p >= target:
                tp += p_know
                fp += p_guess
        rows.append({"start": sname, "guess": gname, "target": tname,
                     "knower_called_proven": round(tp, 3), "guesser_called_proven": round(fp, 3)})
    return rows


def run_student(rng: random.Random, knows: bool, learn_rate: float, cap: int = 40) -> dict:
    tiers = {"basic": TierState(2, 0, 0), "applied": TierState(2, 0, 0), "transfer": TierState(1, 0, 0)}
    st = LoopState(supported=True, target=TARGETS["mandiri"], p=0.3, p_proven=None, tiers=tiers)
    clock = datetime(2026, 10, 20)
    for step in range(1, cap + 1):
        code = decide(st)
        clock += timedelta(minutes=10)
        if code == "mastered":
            return {"steps": step, "finished": True, "mastered_without_knowing": not knows}
        if code in ("practice_basic", "review_basic", "practice_applied", "retry", "transfer"):
            tier = {"practice_basic": "basic", "review_basic": "basic", "practice_applied": "applied",
                    "retry": "applied", "transfer": "transfer"}[code]
            t = tiers[tier]
            right = sum(rng.random() < ((1 - BKT_SLIP) if knows else BKT_GUESS) for _ in range(t.total))
            tiers[tier] = TierState(t.total, t.total, right)
            st.last_practice_at = clock
            if not knows and rng.random() < learn_rate:       # practice with feedback can teach
                knows = True
        elif code == "prove":
            p = st.p_proven if st.p_proven is not None else PRIOR_NO_EVIDENCE
            right = 0
            for _ in range(CHECK_ITEMS):
                a = rng.random() < ((1 - BKT_SLIP) if knows else BKT_GUESS)
                right += a
                p = bkt_update(p, a)
            st.p_proven, st.last_prove_at = p, clock
            st.last_prove_correct, st.last_prove_total = right, CHECK_ITEMS
    return {"steps": cap, "finished": False, "mastered_without_knowing": False}


def loop_runs(n: int = 2000, seed: int = 0) -> list[dict]:
    rng = random.Random(seed)
    out = []
    for start_knows, rate in ((True, 0.0), (False, 0.3), (False, 0.0)):
        runs = [run_student(rng, start_knows, rate) for _ in range(n)]
        steps = sorted(r["steps"] for r in runs if r["finished"])
        out.append({"profile": ("knows already" if start_knows else f"learns with practice (rate {rate})" if rate else "never learns"),
                    "n": n, "finished": round(sum(r["finished"] for r in runs) / n, 3),
                    "median_steps": steps[len(steps) // 2] if steps else None,
                    "mastered_without_knowing": round(sum(r["mastered_without_knowing"] for r in runs) / n, 3)})
    return out


def main() -> None:
    out = {"generated_at": datetime.now().replace(microsecond=0).isoformat(),
           "label": "simulation: synthetic students, verifies engine behaviour, not evidence about real learners",
           "check_items": CHECK_ITEMS, "proven_rates": proven_rates(), "loop": loop_runs()}
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    for r in out["proven_rates"]:
        print(r)
    for r in out["loop"]:
        print(r)


if __name__ == "__main__":
    main()
