"""Calibrate the assessment from real answers (plan A5). Run after the pilot:

    python -m pipeline.calibrate_items

Writes data/models/item_calibration.json: item analysis with flags, KR-20 per skill, Rasch
difficulty (with its rank correlation to the author's difficulty), BKT parameters re-estimated on
next-answer log loss, and whether the calibration is active. It becomes active only when at least
half the bank has MIN_ANSWERS_PER_ITEM answers; until then the author difficulty stays in use.
Evidence weights are calibrated separately by pipeline.calibrate_weights (>= 30 pairs).
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime

from scipy.stats import spearmanr
from sqlalchemy import select

from pathsync import assessment
from pathsync.config import BKT_GUESS, BKT_SLIP, BKT_TRANSIT, MODELS_DIR, PRIOR_NO_EVIDENCE
from pathsync.db import AssessmentResponse, SessionLocal, init_db
from pathsync.item_analysis import MIN_ANSWERS_PER_ITEM, fit_bkt, fit_rasch, item_stats, reliability_by_skill

OUT = MODELS_DIR / "item_calibration.json"


def build(rows: list[tuple], ordered: list[tuple]) -> dict:
    bank = assessment.item_bank()
    stats = item_stats(rows)
    counts = defaultdict(int)
    for r in rows:
        counts[r[1]] += 1
    rasch = {}
    if rows:
        b, _ = fit_rasch(rows)
        rasch = {i: {"b": v, "n": counts[i], "calibrated": counts[i] >= MIN_ANSWERS_PER_ITEM,
                     "author_difficulty": bank[i]["difficulty"] if i in bank else None} for i, v in b.items()}
    pairs = [(v["b"], v["author_difficulty"]) for v in rasch.values() if v["calibrated"] and v["author_difficulty"]]
    rho = float(spearmanr(*zip(*pairs, strict=True)).statistic) if len(pairs) >= 5 else None
    seqs: dict[tuple[str, str], list[bool]] = defaultdict(list)
    for sid, skill, ok in ordered:
        seqs[(sid, skill)].append(bool(ok))
    bkt = fit_bkt([v for _, v in sorted(seqs.items())], PRIOR_NO_EVIDENCE, (BKT_SLIP, BKT_GUESS, BKT_TRANSIT)) if seqs else None
    n_cal = sum(v["calibrated"] for v in rasch.values())
    return {"generated_at": datetime.now().isoformat(timespec="seconds"), "n_answers": len(rows),
            "n_items_in_bank": len(bank), "n_items_calibrated": n_cal, "min_answers_per_item": MIN_ANSWERS_PER_ITEM,
            "active": n_cal >= len(bank) / 2,
            "items": stats, "flagged": [s["item_id"] for s in stats if s["flags"]],
            "reliability": reliability_by_skill(rows), "rasch": rasch,
            "author_vs_empirical_spearman": None if rho is None else round(rho, 3), "bkt": bkt}


def main() -> None:
    init_db()
    with SessionLocal() as s:
        rs = s.execute(select(AssessmentResponse.student_id, AssessmentResponse.item_id, AssessmentResponse.skill_id,
                              AssessmentResponse.correct, AssessmentResponse.choice_canon, AssessmentResponse.created_at)
                       .order_by(AssessmentResponse.created_at, AssessmentResponse.id)).all()
    rows = [tuple(r[:5]) for r in rs]
    ordered = [(r[0], r[2], r[3]) for r in rs]
    out = build(rows, ordered)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    assessment.calibrated_difficulty.cache_clear()
    print(json.dumps({k: out[k] for k in ("n_answers", "n_items_calibrated", "active", "author_vs_empirical_spearman")}),
          f"| flagged {len(out['flagged'])} | bkt {out['bkt'] and out['bkt']['held_out_log_loss']}")


if __name__ == "__main__":
    main()
