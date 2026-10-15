"""Measure the skill extractor against the gold sets (data/seed/gold_*.json).

Reports skill-level precision, recall and F1 (micro-averaged over (posting, skill) pairs) overall, per role and per
taxonomy cluster, with 95% intervals (plan rule 0.3): Wilson for precision and recall, a posting-level bootstrap for
F1, since pairs from the same posting are not independent. Also lists the most common false positives and misses so
aliases can be fixed, and stamps the taxonomy and gold hashes so a number can be traced to the data it came from.

Run: python -m pipeline.eval_extractor [--extractor lexicon|llm] [--gold gold_blind.json ...]
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import math
import random
import sys
from collections import Counter

from pathsync.config import MODELS_DIR, RAW_DIR, SEED_DIR
from pathsync.extraction import extract_skills
from pathsync.taxonomy import load_skills

Z95 = 1.959964
BOOTSTRAP = 1000
DEFAULT_SETS = {"dev": "gold_pilot.json", "heldout": "gold_heldout.json", "blind": "gold_blind.json"}


def load_postings() -> dict[str, dict]:
    rows = {}
    for f in sorted(glob.glob(str(RAW_DIR / "*.jsonl"))):
        for line in open(f, encoding="utf-8"):
            r = json.loads(line)
            rows[f"{r['source']}:{r['source_id']}"] = r
    return rows


def wilson(k: int, n: int) -> list[float]:
    """95% Wilson score interval for k successes out of n (well behaved for small n and proportions near 1)."""
    if n == 0:
        return [0.0, 1.0]
    p = k / n
    d = 1 + Z95 ** 2 / n
    centre = (p + Z95 ** 2 / (2 * n)) / d
    half = Z95 * math.sqrt(p * (1 - p) / n + Z95 ** 2 / (4 * n * n)) / d
    return [round(max(0.0, centre - half), 3), round(min(1.0, centre + half), 3)]


def _f1(tp: int, fp: int, fn: int) -> float:
    return 2 * tp / (2 * tp + fp + fn) if tp else 0.0


def prf(tp: int, fp: int, fn: int) -> dict:
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(_f1(tp, fp, fn), 3),
            "precision_ci95": wilson(tp, tp + fp), "recall_ci95": wilson(tp, tp + fn), "support": tp + fn}


def bootstrap_f1(counts: list[tuple[int, int, int]], seed: int = 0) -> list[float]:
    """Resample postings (not pairs) with replacement; percentile interval of micro F1."""
    if not counts:
        return [0.0, 1.0]
    rng = random.Random(seed)
    vals = []
    for _ in range(BOOTSTRAP):
        tp = fp = fn = 0
        for _ in counts:
            a, b, c = counts[rng.randrange(len(counts))]
            tp, fp, fn = tp + a, fp + b, fn + c
        vals.append(_f1(tp, fp, fn))
    vals.sort()
    return [round(vals[int(0.025 * BOOTSTRAP)], 3), round(vals[int(0.975 * BOOTSTRAP) - 1], 3)]


def file_hash(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def evaluate(prefer: str = "lexicon", goldfile: str = "gold_pilot.json") -> dict:
    doc = json.loads((SEED_DIR / goldfile).read_text(encoding="utf-8"))
    gold, cap = doc["postings"], doc.get("max_chars")
    rows = load_postings()
    cluster_of = {sid: sk.cluster for sid, sk in load_skills().items()}
    tp = fp = fn = 0
    fps, fns = Counter(), Counter()
    per_role: dict[str, list[int]] = {}
    per_cluster: dict[str, list[int]] = {}
    per_posting: list[tuple[int, int, int]] = []
    for key, g in gold.items():
        res = extract_skills(rows[key]["description_text"][:cap], prefer=prefer)
        pred = set(res.skills)
        want = set(g["skills"])
        a, b, c = len(pred & want), len(pred - want), len(want - pred)
        tp, fp, fn = tp + a, fp + b, fn + c
        per_posting.append((a, b, c))
        fps.update(pred - want)
        fns.update(want - pred)
        r = per_role.setdefault(g["role"], [0, 0, 0])
        r[0], r[1], r[2] = r[0] + a, r[1] + b, r[2] + c
        for sid, slot in [(s, 0) for s in pred & want] + [(s, 1) for s in pred - want] + [(s, 2) for s in want - pred]:
            per_cluster.setdefault(cluster_of.get(sid, "unknown"), [0, 0, 0])[slot] += 1
    return {"n_postings": len(gold), "gold_file": goldfile, "gold_sha": file_hash(SEED_DIR / goldfile),
            "overall": {**prf(tp, fp, fn), "f1_ci95": bootstrap_f1(per_posting)},
            "per_role": {k: prf(*v) for k, v in sorted(per_role.items())},
            "per_cluster": {k: prf(*v) for k, v in sorted(per_cluster.items())},
            "top_false_positives": fps.most_common(12), "top_misses": fns.most_common(12), "extractor": prefer}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--extractor", default="lexicon", choices=["lexicon", "llm"],
                    help="llm reads only the extraction cache (no API calls when every posting is cached)")
    ap.add_argument("--gold", nargs="*", help="gold files in data/seed to evaluate instead of dev/heldout/blind")
    ap.add_argument("--no-write", action="store_true", help="print only; do not overwrite data/models/extractor_gold_eval.json")
    args = ap.parse_args()
    sets = {g.removesuffix(".json"): g for g in args.gold} if args.gold else DEFAULT_SETS
    out = {k: evaluate(prefer=args.extractor, goldfile=f) for k, f in sets.items()}
    out["provenance"] = {"taxonomy_sha": file_hash(SEED_DIR / "taxonomy.json"), "extractor": args.extractor}
    if not args.no_write and not args.gold and args.extractor == "lexicon":
        (MODELS_DIR / "extractor_gold_eval.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    for k, v in out.items():
        if k == "provenance":
            continue
        o = v["overall"]
        print(f"{k:8s} n={v['n_postings']:3d}  P={o['precision']:.3f} {o['precision_ci95']}  "
              f"R={o['recall']:.3f} {o['recall_ci95']}  F1={o['f1']:.3f} {o['f1_ci95']}")
    last = out[list(sets)[-1]]
    print("FP:", last["top_false_positives"])
    print("misses:", last["top_misses"])


if __name__ == "__main__":
    sys.exit(main())
