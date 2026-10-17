"""Measure the skill extractor against a gold set.

Reports skill-level precision, recall and F1 (micro-averaged over postings) with 95% intervals:
Wilson for precision and recall, a posting-level bootstrap for F1 (pairs from one posting are not
independent). Per role and per taxonomy cluster, with the most common false positives and misses
so aliases can be fixed, and the taxonomy and gold hashes so a number can be traced to its data.

    python -m pipeline.eval_extractor [--json]
        the three earlier single-annotator sets, plus the human consensus dev/test halves once
        data/seed/gold_consensus.json exists; writes data/models/extractor_gold_eval.json
    python -m pipeline.eval_extractor --gold gold_consensus.json --split test --extractor llm
        one set; --split picks the dev or test half of the locked split (plan A1)

Extractors: lexicon (offline), llm (cache only: results imported by pipeline.llm_jobs, never an
API call), union and intersection of the two (plan A2 step 6).
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import random
import sys
from collections import Counter

from pathsync.config import MODELS_DIR, PROCESSED_DIR, RAW_DIR, SEED_DIR
from pathsync.extraction import cache_tag, extract_skills
from pathsync.gold import CONSENSUS_FILE, load_split_all, prf, wilson  # noqa: F401  (wilson re-exported for callers)
from pathsync.taxonomy import load_skills

EXTRACTORS = ("lexicon", "llm", "union", "intersection")
BOOTSTRAP = 1000


def _f1(tp: int, fp: int, fn: int) -> float:
    return 2 * tp / (2 * tp + fp + fn) if tp else 0.0


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
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:12]
EXTRACTION_CACHE = PROCESSED_DIR / "extraction_cache.json"


def load_postings() -> dict[str, dict]:
    rows = {}
    for f in sorted(glob.glob(str(RAW_DIR / "*.jsonl"))):
        for line in open(f, encoding="utf-8"):
            if line.strip():
                r = json.loads(line)
                rows[f"{r['source']}:{r['source_id']}"] = r
    return rows


class _LLMCache:
    """Skill ids the offline LLM run produced (after the same gates), keyed by posting fingerprint."""

    def __init__(self):
        cache = json.loads(EXTRACTION_CACHE.read_text(encoding="utf-8")) if EXTRACTION_CACHE.exists() else {}
        tag = f"|{cache_tag('llm')}"
        self.by_fp = {k[: -len(tag)]: {m["skill_id"] for m in v["mentions"] if m.get("status") == "auto" and m.get("skill_id")}
                      for k, v in cache.items() if k.endswith(tag)}

    def get(self, row: dict) -> set[str] | None:
        return self.by_fp.get(row["fingerprint"])


def _predict(row: dict, cap: int | None, extractor: str, llm: _LLMCache | None) -> set[str] | None:
    lex = set(extract_skills(row["description_text"][:cap], prefer="lexicon").skills) if extractor != "llm" else set()
    if extractor == "lexicon":
        return lex
    got = llm.get(row) if llm else None
    if got is None:
        return None
    return got if extractor == "llm" else (lex | got if extractor == "union" else lex & got)


def evaluate(prefer: str = "lexicon", goldfile: str = "gold_pilot.json", split: str | None = None) -> dict:
    """prefer: one of EXTRACTORS. split: "dev" or "test" restricts the gold set to that half."""
    doc = json.loads((SEED_DIR / goldfile).read_text(encoding="utf-8"))
    gold, cap = doc["postings"], doc.get("max_chars")
    if split:
        locked = load_split_all()
        if not locked:
            raise SystemExit("no gold_split.json; run python -m pipeline.gold split")
        keep = set(locked[split])
        gold = {k: v for k, v in gold.items() if k in keep}
    rows = load_postings()
    cluster = {sid: sk.cluster for sid, sk in load_skills().items()}
    # Skills added to the taxonomy after a gold set was labelled (plan A9, "added_in") cannot be judged by that set: a
    # correct mention of them would count as a false positive. They are scored only once the gold labels at least one.
    taxonomy = json.loads((SEED_DIR / "taxonomy.json").read_text(encoding="utf-8"))
    labelled = {s for g in gold.values() for s in g["skills"]}
    out_of_scope = {sk["id"] for sk in taxonomy["skills"] if sk.get("added_in")} - labelled
    llm = _LLMCache() if prefer != "lexicon" else None
    tp = fp = fn = 0
    fps, fns = Counter(), Counter()
    per_role: dict[str, list[int]] = {}
    per_cluster: dict[str, list[int]] = {}
    per_posting: list[tuple[int, int, int]] = []
    skipped = []
    for key, g in gold.items():
        pred = _predict(rows[key], cap, prefer, llm)
        if pred is None:
            skipped.append(key)
            continue
        pred = pred - out_of_scope
        want = set(g["skills"])
        a, b, c = len(pred & want), len(pred - want), len(want - pred)
        tp, fp, fn = tp + a, fp + b, fn + c
        per_posting.append((a, b, c))
        for s in pred - want:
            fps[s] += 1
        for s in want - pred:
            fns[s] += 1
        r = per_role.setdefault(g["role"], [0, 0, 0])
        r[0], r[1], r[2] = r[0] + a, r[1] + b, r[2] + c
        for s in pred | want:
            cl = per_cluster.setdefault(cluster.get(s, "?"), [0, 0, 0])
            cl[0 if (s in pred and s in want) else 1 if s in pred else 2] += 1
    return {"gold": goldfile, "gold_file": goldfile, "gold_sha": file_hash(SEED_DIR / goldfile), "split": split,
            "extractor": prefer, "skills_outside_gold_scope": len(out_of_scope), "n_postings": len(gold) - len(skipped), "skipped_no_llm_result": skipped,
            "overall": {**prf(tp, fp, fn), "f1_ci95": bootstrap_f1(per_posting)},
            "per_role": {k: prf(*v) for k, v in sorted(per_role.items())},
            "per_cluster": {k: prf(*v) for k, v in sorted(per_cluster.items())},
            "top_false_positives": fps.most_common(12), "top_misses": fns.most_common(12)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gold")
    ap.add_argument("--split", choices=("dev", "test"))
    ap.add_argument("--extractor", choices=EXTRACTORS, default="lexicon")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if a.gold:
        r = evaluate(a.extractor, a.gold, a.split)
        print(json.dumps(r if a.json else {"n": r["n_postings"], **r["overall"]}, indent=None if not a.json else 1))
        return
    out = {"dev": evaluate(), "heldout": evaluate(goldfile="gold_heldout.json"), "blind": evaluate(goldfile="gold_blind.json")}
    if CONSENSUS_FILE.exists():
        for half in ("dev", "test"):
            out[f"consensus_{half}"] = evaluate(goldfile=CONSENSUS_FILE.name, split=half)
    out["provenance"] = {"taxonomy_sha": file_hash(SEED_DIR / "taxonomy.json"), "extractor": "lexicon"}
    (MODELS_DIR / "extractor_gold_eval.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(json.dumps({k: {"n": v["n_postings"], **{m: v["overall"][m] for m in ("precision", "recall", "f1",
                                                                                 "precision_ci95", "recall_ci95", "f1_ci95")}}
                      for k, v in out.items() if k != "provenance"}, indent=1))
    last = out.get("consensus_test", out["blind"])
    print("FP:", last["top_false_positives"])
    print("misses:", last["top_misses"])


if __name__ == "__main__":
    sys.exit(main())
