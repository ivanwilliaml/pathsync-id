"""Measure the skill extractor against the pilot gold set (data/seed/gold_pilot.json).

Reports skill-level precision, recall and F1 per posting (micro-averaged), per role and overall, and lists the most common
false positives and misses so aliases can be fixed. Run: python -m pipeline.eval_extractor [--json]
"""
from __future__ import annotations

import glob
import json
import sys
from collections import Counter

from pathsync.config import MODELS_DIR, RAW_DIR, SEED_DIR
from pathsync.extraction import extract_skills


def load_postings() -> dict[str, dict]:
    rows = {}
    for f in sorted(glob.glob(str(RAW_DIR / "*.jsonl"))):
        for line in open(f, encoding="utf-8"):
            r = json.loads(line)
            rows[f"{r['source']}:{r['source_id']}"] = r
    return rows


def evaluate(prefer: str = "lexicon") -> dict:
    gold = json.loads((SEED_DIR / "gold_pilot.json").read_text(encoding="utf-8"))["postings"]
    rows = load_postings()
    tp = fp = fn = 0
    fps, fns = Counter(), Counter()
    per_role: dict[str, list[int]] = {}
    for key, g in gold.items():
        res = extract_skills(rows[key]["description_text"], prefer=prefer)
        pred = {sid for sid in res.skills}
        want = set(g["skills"])
        a, b, c = len(pred & want), len(pred - want), len(want - pred)
        tp, fp, fn = tp + a, fp + b, fn + c
        for s in pred - want:
            fps[s] += 1
        for s in want - pred:
            fns[s] += 1
        r = per_role.setdefault(g["role"], [0, 0, 0])
        r[0] += a
        r[1] += b
        r[2] += c
    def prf(a, b, c):
        p = a / (a + b) if a + b else 0.0
        r = a / (a + c) if a + c else 0.0
        return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(2 * p * r / (p + r), 3) if p + r else 0.0}
    return {"n_postings": len(gold), "overall": prf(tp, fp, fn), "per_role": {k: prf(*v) for k, v in sorted(per_role.items())},
            "top_false_positives": fps.most_common(12), "top_misses": fns.most_common(12), "extractor": prefer}


def main() -> None:
    out = evaluate()
    (MODELS_DIR / "extractor_gold_eval.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    sys.exit(main())
