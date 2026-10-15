"""One source of truth for every reported number (plan D2): writes data/models/metrics.json.

    python -m pipeline.report              # collect from the latest evaluation files + the database
    python -m pipeline.report --refresh    # re-run the extractor evaluation and the item-cue audit first

The model card (GET /api/model-card) and the documents quote this file only. Every block carries the date and the
hashes of the inputs it was computed from, so a number that changes can be traced to the data that changed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, select

from pathsync.config import BKT_GUESS, BKT_SLIP, BKT_TRANSIT, MODELS_DIR, ROLES, SEED_DIR, SIM_AUTO, SIM_REVIEW
from pathsync.db import Annotation, Expert, GraphEdge, Posting, RankerModel, active_snapshot, get_session, init_db

OUT = MODELS_DIR / "metrics.json"


def _sha(path: Path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12] if path.exists() else None


def _load(name: str) -> dict:
    p = MODELS_DIR / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def _extraction() -> dict:
    ev = _load("extractor_gold_eval.json")
    sets = {k: {"n_postings": v["n_postings"], **{m: v["overall"][m] for m in
                ("precision", "precision_ci95", "recall", "recall_ci95", "f1") if m in v["overall"]},
                "f1_ci95": v["overall"].get("f1_ci95"), "gold_sha": v.get("gold_sha"),
                "tuned_on": k == "dev"}
            for k, v in ev.items() if k != "provenance"}
    blind = sets.get("blind", {})
    lo = (blind.get("precision_ci95") or [None])[0]
    return {"extractor": (ev.get("provenance") or {}).get("extractor", "lexicon"), "sets": sets,
            "annotators": 1, "target_precision": 0.80,
            "target_met": {"point_estimate": blind.get("precision", 0) >= 0.80,
                           "lower_ci_bound": lo is not None and lo >= 0.80},
            "note": "dev was used to tune aliases and must not be quoted as performance; blind is the reportable set"}


def _items() -> dict:
    a = _load("item_cue_audit.json")
    c = a.get("classifier", {})
    return {"generated": a.get("generated"), "n_items": a.get("n_items"), "language": a.get("language"),
            "answer_pattern_accuracy": c.get("accuracy"), "chance": c.get("chance"), "random_p95": c.get("null_p95"),
            "note": "accuracy of a model that sees only option surface features; at or below random_p95 means no usable cue"}


def _ranker(s) -> dict:
    rep = _load("evaluation_report.json")
    active = s.scalars(select(RankerModel).where(RankerModel.active.is_(True))).first()
    conds = {}
    for name, c in (rep.get("conditions") or {}).items():
        methods = ((c.get("cv") or {}).get("methods") or {})
        conds[name] = {m: (v.get("ndcg5") or {}) for m, v in methods.items()}
    real = s.scalar(select(func.count(Expert.id)).where(Expert.kind != "simulasi")) or 0
    return {"generated": rep.get("generated_at"), "role": rep.get("role"), "n_scenarios": rep.get("n_scenarios"),
            "experts": "real" if real >= 3 else "simulated", "real_experts": real,
            "active_model": active.name if active else "Formula (5)",
            "active_weights": active.weights if active else None,
            "ndcg5_by_expert_condition": conds, "llm_baseline": rep.get("llm_baseline"),
            "note": "simulated experts rank with a known rule; this tests feasibility of the method, not agreement with people"}


def _market(s) -> dict:
    roles = {}
    for r in ROLES:
        snap = active_snapshot(s, r)
        n = s.scalar(select(func.count(Posting.id)).where(Posting.role == r, Posting.duplicate_of.is_(None),
                                                         Posting.in_window.is_(True))) or 0
        roles[r] = {"postings_in_window": n, "snapshot": snap.version if snap else None,
                    "reference_date": snap.reference_date.isoformat() if snap else None}
    return {"roles": roles, "total_postings_in_window": sum(v["postings_in_window"] for v in roles.values())}


def _validation(s) -> dict:
    edges = dict(s.execute(select(GraphEdge.status, func.count()).group_by(GraphEdge.status)).all())
    annotators = s.scalar(select(func.count(func.distinct(Annotation.annotator)))) or 0
    return {"graph_edges": edges, "annotators_in_app": annotators,
            "annotated_postings_in_app": s.scalar(select(func.count(func.distinct(Annotation.posting_id)))) or 0}


def build() -> dict:
    init_db()
    with get_session() as s:
        return {
            "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
            "inputs": {"taxonomy_sha": _sha(SEED_DIR / "taxonomy.json"), "graph_sha": _sha(SEED_DIR / "graph.json")},
            "constants": {"sim_auto": SIM_AUTO, "sim_review": SIM_REVIEW,
                          "bkt": {"slip": BKT_SLIP, "guess": BKT_GUESS, "transit": BKT_TRANSIT}},
            "extraction": _extraction(), "assessment_items": _items(), "ranker": _ranker(s),
            "market": _market(s), "validation": _validation(s),
        }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="re-run the extractor evaluation and item-cue audit first")
    args = ap.parse_args()
    if args.refresh:
        for mod in ("pipeline.eval_extractor", "pipeline.item_cue_audit"):
            subprocess.run([sys.executable, "-m", mod], check=True)
    out = build()
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    e = out["extraction"]["sets"].get("blind", {})
    print(f"wrote {OUT.name}: blind P={e.get('precision')} {e.get('precision_ci95')}  "
          f"ranker={out['ranker']['active_model']} ({out['ranker']['experts']} experts)  "
          f"postings={out['market']['total_postings_in_window']}")


if __name__ == "__main__":
    main()
