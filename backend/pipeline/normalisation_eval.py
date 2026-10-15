"""Plan A3: evaluate the embedding normalisation thresholds (SIM_AUTO 0.85 / SIM_REVIEW 0.70) against human labels.

Step 1, sample phrases for labelling (stratified by similarity band, 100 per band by default):
    python -m pipeline.normalisation_eval export [--per-band 100] [--seed 13]
  -> data/seed/normalisation_to_label.json. Two people fill `label_a` / `label_b` independently with a taxonomy skill id
     or "none" (not a skill, or not in the taxonomy). They see the phrase and its posting quote, never the model's guess.

Step 2, score once both columns are filled:
    python -m pipeline.normalisation_eval score data/seed/normalisation_to_label.json
  -> agreement (Cohen's kappa), then on the phrases both agree on: precision and coverage of automatic mapping at
     every threshold 0.60-0.95, cluster purity, and the lowest threshold whose precision is >= 0.95 (plan rule).
     Writes data/models/normalisation_eval.json.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

from sqlalchemy import select

from pathsync.config import MODELS_DIR, SEED_DIR, SIM_AUTO, SIM_REVIEW
from pathsync.db import PostingMention, get_session, init_db
from pathsync.extraction import skill_index
from pathsync.extraction.base import MIN_LEXICAL_SUPPORT, lexical_support

BANDS = (("low", 0.0, SIM_REVIEW), ("review", SIM_REVIEW, SIM_AUTO), ("auto", SIM_AUTO, 1.0001))
THRESHOLDS = [round(0.60 + 0.05 * i, 2) for i in range(8)]   # 0.60 ... 0.95
TARGET_PRECISION = 0.95
OUT_LABEL = SEED_DIR / "normalisation_to_label.json"


def decision(phrase: str, sim: float, form: str) -> str:
    """The production decision (extraction.base.apply_gates): auto needs the similarity AND textual overlap."""
    if sim >= SIM_AUTO and lexical_support(phrase, form) >= MIN_LEXICAL_SUPPORT:
        return "auto"
    return "review" if sim >= SIM_REVIEW else "low"


def export(per_band: int, seed: int) -> Path:
    """Free-text phrases only (method 'pattern'): exact lexicon hits have similarity 1.0 and need no threshold."""
    init_db()
    with get_session() as s:
        rows = s.execute(select(PostingMention.surface, PostingMention.quote).where(PostingMention.method == "pattern")).all()
    seen: dict[str, str] = {}
    for surface, quote in rows:
        seen.setdefault(surface.strip(), quote)
    phrases = sorted(seen)
    nearest = skill_index().nearest(phrases)
    rng = random.Random(seed)
    out = []
    decided = [(ph, sid, sim, decision(ph, sim, form)) for ph, (sid, sim, form) in zip(phrases, nearest, strict=True)]
    for name, _lo, _hi in BANDS:
        pool = [d for d in decided if d[3] == name]
        for ph, sid, sim, _d in rng.sample(pool, min(per_band, len(pool))):
            # the model's guess is stored for scoring but kept apart from what the labeller fills in
            out.append({"phrase": ph, "quote": seen[ph][:300], "band": name, "label_a": "", "label_b": "",
                        "lexical_ok": _d != "review" or sim < SIM_AUTO,
                        "_model": {"skill_id": sid, "similarity": round(sim, 4)}})
    rng.shuffle(out)
    OUT_LABEL.write_text(json.dumps({"instructions": "Fill label_a and label_b independently with a taxonomy skill id "
                                     "from data/seed/taxonomy.json, or 'none'. Do not look at _model.",
                                     "items": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    return OUT_LABEL


def cohen_kappa(a: list[str], b: list[str]) -> float:
    n = len(a)
    if not n:
        return 0.0
    po = sum(x == y for x, y in zip(a, b, strict=True)) / n
    ca, cb = Counter(a), Counter(b)
    pe = sum(ca[k] * cb.get(k, 0) for k in ca) / (n * n)
    return (po - pe) / (1 - pe) if pe < 1 else 1.0


def score(path: Path) -> dict:
    items = json.loads(path.read_text(encoding="utf-8"))["items"]
    done = [i for i in items if i["label_a"] and i["label_b"]]
    kappa = cohen_kappa([i["label_a"] for i in done], [i["label_b"] for i in done])
    agreed = [i for i in done if i["label_a"] == i["label_b"]]
    curve = []
    for t in THRESHOLDS:
        mapped = [i for i in agreed if i["_model"]["similarity"] >= t and i.get("lexical_ok", True)]
        correct = sum(i["_model"]["skill_id"] == i["label_a"] for i in mapped)
        real_skills = [i for i in agreed if i["label_a"] != "none"]
        curve.append({"threshold": t, "mapped": len(mapped),
                      "precision": round(correct / len(mapped), 3) if mapped else None,
                      "coverage": round(correct / len(real_skills), 3) if real_skills else None})
    ok = [c for c in curve if c["precision"] is not None and c["precision"] >= TARGET_PRECISION]
    groups: dict[str, list[str]] = defaultdict(list)
    for i in agreed:
        if i["_model"]["similarity"] >= SIM_REVIEW:
            groups[i["_model"]["skill_id"]].append(i["label_a"])
    purity_num = sum(Counter(v).most_common(1)[0][1] for v in groups.values())
    purity_den = sum(len(v) for v in groups.values())
    nonskill = [i for i in agreed if i["label_a"] == "none"]
    out = {"n_items": len(items), "n_labelled": len(done), "kappa": round(kappa, 3), "n_agreed": len(agreed),
           "curve": curve, "cluster_purity": round(purity_num / purity_den, 3) if purity_den else None,
           "nonskill_rejected_at_current_auto": (round(sum(i["_model"]["similarity"] < SIM_AUTO for i in nonskill)
                                                        / len(nonskill), 3) if nonskill else None),
           "current": {"sim_auto": SIM_AUTO, "sim_review": SIM_REVIEW},
           "recommended_sim_auto": min(c["threshold"] for c in ok) if ok else None,
           "rule": f"lowest threshold with precision >= {TARGET_PRECISION} on phrases both labellers agree on"}
    (MODELS_DIR / "normalisation_eval.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export")
    e.add_argument("--per-band", type=int, default=100)
    e.add_argument("--seed", type=int, default=13)
    sc = sub.add_parser("score")
    sc.add_argument("file", type=Path)
    args = ap.parse_args()
    if args.cmd == "export":
        print("wrote", export(args.per_band, args.seed))
    else:
        print(json.dumps(score(args.file), indent=1))


if __name__ == "__main__":
    sys.exit(main())
