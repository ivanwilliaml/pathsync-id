"""Human gold set for extraction (plan A1): locked dev/test split, Wilson intervals,
inter-annotator agreement per skill and the consensus file.

Files in data/seed:
  gold_split.json         100 posting ids, stratified by role, split 50 dev / 50 test (locked)
  gold_adjudication.json  third-rater decisions for disputed (posting, skill) pairs
  gold_consensus.json     consensus labels, same format as gold_blind.json (no max_chars)
"""
from __future__ import annotations

import json
import math
import random
from collections import defaultdict
from itertools import combinations

from .config import SEED_DIR

SPLIT_FILE = SEED_DIR / "gold_split.json"
ADJUDICATION_FILE = SEED_DIR / "gold_adjudication.json"
CONSENSUS_FILE = SEED_DIR / "gold_consensus.json"
EARLIER_GOLD = ("gold_pilot.json", "gold_heldout.json", "gold_blind.json")

# plan A1 step 2: at least 5 postings per role, 10 for the large roles (BA is the paper's focus)
LARGE_ROLES = ("business_analyst", "data_analyst", "backend_developer", "fullstack_developer",
               "digital_marketing", "accountant")
PER_ROLE_SMALL, PER_ROLE_LARGE = 5, 10
SPLIT_SEED = 20261014


def wilson(k: int, n: int, z: float = 1.96) -> list[float]:
    """95% Wilson score interval for a proportion k/n."""
    if n == 0:
        return [0.0, 0.0]
    p = k / n
    den = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [round(max(0.0, centre - half), 4), round(min(1.0, centre + half), 4)]


def prf(tp: int, fp: int, fn: int) -> dict:
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(2 * p * r / (p + r), 3) if p + r else 0.0,
            "precision_ci95": wilson(tp, tp + fp), "recall_ci95": wilson(tp, tp + fn), "tp": tp, "fp": fp, "fn": fn}


def earlier_gold_ids() -> set[str]:
    out: set[str] = set()
    for name in EARLIER_GOLD:
        f = SEED_DIR / name
        if f.exists():
            out |= set(json.loads(f.read_text(encoding="utf-8"))["postings"])
    return out


def make_split(candidates: dict[str, str], seed: int = SPLIT_SEED) -> dict:
    """candidates: {posting_id: role} for canonical postings. Postings already in an earlier gold set
    (used to tune aliases) are excluded. Each role's sample is split in half, so dev and test have the
    same role mix; odd-sized roles alternate the extra posting between dev and test so the halves
    end up the same size."""
    used = earlier_gold_ids()
    by_role: dict[str, list[str]] = defaultdict(list)
    for pid, role in sorted(candidates.items()):
        if pid not in used:
            by_role[role].append(pid)
    rng = random.Random(seed)
    dev, test, per_role, extra_to_dev = [], [], {}, True
    for role in sorted(by_role):
        want = PER_ROLE_LARGE if role in LARGE_ROLES else PER_ROLE_SMALL
        pick = rng.sample(by_role[role], min(want, len(by_role[role])))
        half = len(pick) // 2
        if len(pick) % 2:
            half += extra_to_dev
            extra_to_dev = not extra_to_dev
        dev += pick[:half]
        test += pick[half:]
        per_role[role] = {"dev": half, "test": len(pick) - half}
    return {"seed": seed, "note": "Locked split for the human gold set (plan A1). Tune aliases, prompts and "
                                  "thresholds on dev only; report numbers on test only.",
            "excluded_earlier_gold": len(used), "per_role": per_role, "dev": sorted(dev), "test": sorted(test)}


def load_split() -> dict | None:
    return json.loads(SPLIT_FILE.read_text(encoding="utf-8")) if SPLIT_FILE.exists() else None


def kappa(x: list[int], y: list[int]) -> float | None:
    if not x:
        return None
    po = sum(i == j for i, j in zip(x, y, strict=True)) / len(x)
    pa, pb = sum(x) / len(x), sum(y) / len(y)
    pe = pa * pb + (1 - pa) * (1 - pb)
    return round((po - pe) / (1 - pe), 4) if pe < 1 else 1.0


def agreement(by_post: dict[str, dict[str, set]], skills: list[str], top: int = 20) -> list[dict]:
    """Cohen's kappa per annotator pair over (posting, skill) cells, plus kappa per skill for the
    `top` most labelled skills (plan A1 step 4)."""
    out = []
    names = sorted({n for anns in by_post.values() for n in anns})
    for a, b in combinations(names, 2):
        both = [anns for anns in by_post.values() if a in anns and b in anns]
        if len(both) < 3:
            continue
        x = [int(k in an[a]) for an in both for k in skills]
        y = [int(k in an[b]) for an in both for k in skills]
        freq = defaultdict(int)
        for an in both:
            for k in an[a] | an[b]:
                freq[k] += 1
        per_skill = []
        for k, n in sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))[:top]:
            per_skill.append({"skill": k, "postings_labelled": n,
                              "kappa": kappa([int(k in an[a]) for an in both], [int(k in an[b]) for an in both])})
        out.append({"annotators": [a, b], "postings": len(both), "kappa": kappa(x, y), "per_skill": per_skill})
    return out


def consensus(by_post: dict[str, dict[str, set]], roles: dict[str, str], adjudication: dict | None = None) -> tuple[dict, list]:
    """Consensus labels. A skill is in when every annotator chose it; a disputed skill follows the
    adjudication file when it has a decision, otherwise it is listed as still open.
    Returns (consensus document, open disputes)."""
    adjudication = adjudication or {}
    postings, open_disputes = {}, []
    for pid, anns in sorted(by_post.items()):
        if len(anns) < 2:
            continue
        sets = list(anns.values())
        agreed = set.intersection(*sets)
        disputed = set.union(*sets) - agreed
        decided = adjudication.get(pid, {})
        keep = set(agreed)
        for k in sorted(disputed):
            if k in decided:
                if decided[k]:
                    keep.add(k)
            else:
                open_disputes.append({"posting_id": pid, "skill": k,
                                      "chosen_by": sorted(n for n, v in anns.items() if k in v)})
        postings[pid] = {"role": roles.get(pid, ""), "skills": sorted(keep), "annotators": sorted(anns)}
    doc = {"note": "Consensus of two or more human annotators (plan A1). Agreed labels kept; disputed labels "
                   "follow gold_adjudication.json. Annotators read the full posting text.",
           "postings": postings}
    return doc, open_disputes
