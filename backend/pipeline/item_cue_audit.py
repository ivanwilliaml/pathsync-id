"""Audit the item bank for surface cues and store per-item guessing probabilities, once per language:
data/models/item_cue_audit.json (English) and item_cue_audit_id.json (Indonesian, used when PATHSYNC_LANG=id).

Run after any change to the item files:  python -m pipeline.item_cue_audit
"""
from __future__ import annotations

import json
from datetime import date

from pathsync import assessment
from pathsync.config import MODELS_DIR
from pathsync.i18n import use_lang
from pathsync.item_audit import audit, item_cue_probabilities


def audit_language(lang: str) -> dict:
    assessment.item_bank.cache_clear()
    with use_lang(lang):
        items = list(assessment.item_bank().values())
    report = audit(items)
    p = item_cue_probabilities(items)
    out = {"generated": date.today().isoformat(), "n_items": len(items), "language": lang, **report, "p_cue": p,
           "note": "p_cue = out-of-fold probability that a model seeing only option surface features picks the key. "
                   "It becomes the item's guessing probability (clamped to 0.25-0.60) in scoring."}
    name = "item_cue_audit.json" if lang == "en" else f"item_cue_audit_{lang}.json"
    (MODELS_DIR / name).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def main() -> None:
    first = None
    for lang in ("en", "id"):
        out = audit_language(lang)
        first = first or out
        print(lang, json.dumps({k: out[k] for k in ("n_items", "classifier")}))
    assessment.item_bank.cache_clear()


if __name__ == "__main__":
    main()
