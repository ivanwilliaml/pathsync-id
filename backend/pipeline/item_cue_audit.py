"""Audit the item bank for surface cues and store per-item guessing probabilities (data/models/item_cue_audit.json).

Run after any change to the item files:  python -m pipeline.item_cue_audit
"""
from __future__ import annotations

import json
from datetime import date

from pathsync import assessment
from pathsync.config import MODELS_DIR
from pathsync.item_audit import audit, item_cue_probabilities


def main() -> None:
    assessment.LANG = "en"
    assessment.item_bank.cache_clear()
    items = list(assessment.item_bank().values())
    report = audit(items)
    p = item_cue_probabilities(items)
    out = {"generated": date.today().isoformat(), "n_items": len(items), "language": "en", **report, "p_cue": p,
           "note": "p_cue = out-of-fold probability that a model seeing only option surface features picks the key. "
                   "It becomes the item's guessing probability (clamped to 0.25-0.60) in scoring."}
    (MODELS_DIR / "item_cue_audit.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: out[k] for k in ("n_items", "single_cues", "classifier")}, indent=1))


if __name__ == "__main__":
    main()
