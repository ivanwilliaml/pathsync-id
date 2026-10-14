"""One source of truth for every reported number (plan D2).

    python -m pipeline.report            # extraction, answer patterns, governance, evidence weights
    python -m pipeline.report --ranker   # also re-runs the expert study (slow, registers a model)

Writes data/models/metrics.json with the date, the taxonomy hash and the hash of every gold
file. Documents, the model card and the paper quote this file only;
tests/test_metrics_single_source.py fails when README.md or docs/PLAN_PERBAIKAN.md carries a
three-decimal metric that is not in it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime

from pathsync.config import MODELS_DIR, ROLES, SEED_DIR

METRICS = MODELS_DIR / "metrics.json"
GOLD_FILES = ("gold_pilot.json", "gold_heldout.json", "gold_blind.json", "gold_split.json",
              "gold_consensus.json", "gold_adjudication.json", "normalisation_gold.json")


def _sha(path) -> str | None:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def _read(name: str) -> dict | None:
    p = MODELS_DIR / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def extraction() -> dict:
    from pathsync.gold import CONSENSUS_FILE
    from pipeline.eval_extractor import EXTRACTORS, evaluate

    sets = {"pilot_dev": evaluate(goldfile="gold_pilot.json"), "heldout": evaluate(goldfile="gold_heldout.json"),
            "blind": evaluate(goldfile="gold_blind.json")}
    out = {k: {"n_postings": v["n_postings"], "annotators": 1, **v["overall"]} for k, v in sets.items()}
    if CONSENSUS_FILE.exists():
        for ext in EXTRACTORS:
            r = evaluate(ext, CONSENSUS_FILE.name, "test")
            if r["n_postings"]:
                out[f"consensus_test_{ext}"] = {"n_postings": r["n_postings"], "annotators": 2, **r["overall"],
                                                "per_role": r["per_role"]}
    agree = _read("gold_agreement.json")
    if agree:
        out["inter_annotator"] = [{k: p[k] for k in ("annotators", "postings", "kappa")} for p in agree["pairs"]]
    return out


def answer_patterns() -> dict:
    from pipeline import item_cue_audit

    item_cue_audit.main()
    a = _read("item_cue_audit.json")
    return {"n_items": a["n_items"], "language": a["language"], **a["classifier"]}


def governance() -> dict:
    from pathsync import governance as g
    from pathsync.db import SessionLocal

    out = {}
    with SessionLocal() as s:
        for role in ROLES:
            r = g.report(s, role)
            out[role] = {"n_postings": r["n_postings"], "final": r["final"], "n_core": r["n_core"],
                         **{k: v["value"] for k, v in r["criteria"].items()}}
    return out


def ranker(rerun: bool) -> dict | None:
    if rerun:
        from pipeline import expert_study

        expert_study.main()
    ev = _read("evaluation_report.json")
    if not ev:
        return None
    conds = {c: {m: round(x["ndcg5"]["mean"], 3) for m, x in v["cv"]["methods"].items()}
             for c, v in ev["conditions"].items()}
    reg = ev.get("registered_model") or {}
    return {"generated_at": ev["generated_at"], "experts": "simulated" if "simulasi" in ev.get("note", "").lower() else "real",
            "ndcg5_by_condition": conds, "active_cv_ndcg5": reg.get("cv_ndcg5"),
            "formula5_ndcg5": reg.get("formula5_ndcg5"), "llm_baseline": ev.get("llm_baseline")}


def evidence_weights() -> dict:
    from pathsync.db import get_session
    from pipeline.calibrate_weights import run

    with get_session() as s:
        r = run(s)
    return {"prior": r["prior"], "n_calibration_pairs": r["n_calibration_pairs"], "min_pairs": r["min_pairs"],
            "calibration": r["calibration"],
            "sensitivity_top3": {k: v["top3_overlap"] for k, v in r["sensitivity"]["results"].items()}}


def build(rerun_ranker: bool = False) -> dict:
    from pathsync.taxonomy import load_taxonomy

    tax = load_taxonomy()
    out = {"generated_at": datetime.now().isoformat(timespec="seconds"),
           "taxonomy": {"version": tax["version"], "sha256": _sha(SEED_DIR / "taxonomy.json")},
           "gold_sha256": {n: _sha(SEED_DIR / n) for n in GOLD_FILES if (SEED_DIR / n).exists()},
           "extraction": extraction(), "normalisation": _read("normalisation_eval.json"),
           "answer_patterns": answer_patterns(), "taxonomy_final": governance(),
           "ranker": ranker(rerun_ranker), "evidence_weights": evidence_weights(),
           "performance": _read("loadtest.json")}
    METRICS.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ranker", action="store_true", help="re-run pipeline.expert_study first")
    out = build(ap.parse_args().ranker)
    print(f"[report] {METRICS}")
    print(json.dumps({k: out[k] for k in ("taxonomy", "answer_patterns")}, indent=1))
    print(json.dumps({k: {m: v.get(m) for m in ("n_postings", "precision", "recall", "f1", "precision_ci95")}
                      for k, v in out["extraction"].items() if isinstance(v, dict)}, indent=1))


if __name__ == "__main__":
    main()
