"""Evidence-weight calibration and sensitivity (see pathsync.calibration for the rationale).

1. Sensitivity on a synthetic cohort, ranked by the live model on the live BA market map.
2. In-product calibration: pairs of (indirect evidence that existed before a re-assessment, accuracy on
   that later re-assessment). With >= 30 pairs the weights are re-estimated (Dirichlet-MAP); they become
   active only if they lower the held-out error versus the documented prior.

Run: python -m pipeline.calibrate_weights
"""
from __future__ import annotations

import json
import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from pathsync.calibration import (
    MIN_SAMPLES,
    collect_samples,
    fit_weights,
    implied_error_ratios,
    predict,
    sensitivity_report,
    write_weights,
)
from pathsync.config import EVIDENCE_WEIGHTS, MODELS_DIR
from pathsync.db import AssessmentResponse, Student, get_session
from pathsync.engine import load_context
from pathsync.ranker import build_candidates

REPORT = MODELS_DIR / "evidence_weights_report.json"


def _rank_fn(ctx):
    demand = {k: ctx.market.D(k) for k in ctx.skills}
    trend = {k: ctx.market.T(k) for k in ctx.skills}
    ids = [k for k in ctx.skills if demand[k] > 0]

    def rank(p: dict) -> list[str]:
        cands = build_candidates(ctx.graph, p, ctx.req, demand, trend, {k: 0.5 for k in ctx.skills}, ids)
        return [c.skill_id for c, _ in ctx.model.rank(cands)]
    return rank, ids


def _pairs(s: Session) -> list[dict]:
    rows = []
    for st in s.scalars(select(Student)).all():
        ev = [e for e in st.evidence if e.kind in ("academic", "certificate", "project") and e.review_status != "rejected"]
        resp = s.scalars(select(AssessmentResponse).where(AssessmentResponse.student_id == st.id)
                         .order_by(AssessmentResponse.created_at)).all()
        diag = {}
        for r in resp:
            if r.phase == "diagnostic":
                diag.setdefault(r.skill_id, []).append(r.correct)
        for skill in {r.skill_id for r in resp if r.phase == "reassessment"}:
            later = [r for r in resp if r.phase == "reassessment" and r.skill_id == skill]
            t0 = later[0].created_at
            comps = {}
            for e in ev:
                if e.created_at <= t0 and skill in e.scores:
                    comps[e.kind] = max(comps.get(e.kind, 0.0), e.scores[skill])
            if skill in diag:
                from pathsync.evidence import smoothed_accuracy
                comps["assessment"] = smoothed_accuracy(sum(diag[skill]), len(diag[skill]))
            rows.append({"components": comps, "later_correct": sum(r.correct for r in later), "later_total": len(later)})
    return rows


def run(s: Session) -> dict:
    ctx = load_context(s, "business_analyst")
    rank, ids = _rank_fn(ctx)
    sens = sensitivity_report(rank, ids)
    samples = collect_samples(_pairs(s))
    out = {"prior": EVIDENCE_WEIGHTS, "implied_error_ratio_vs_assessment": implied_error_ratios(),
           "n_calibration_pairs": len(samples), "min_pairs": MIN_SAMPLES, "sensitivity": sens}
    if len(samples) >= MIN_SAMPLES:
        rng = random.Random(0)
        rng.shuffle(samples)
        cut = int(len(samples) * 0.7)
        fit = fit_weights(samples[:cut])
        test = samples[cut:]
        err = lambda w: sum((predict(c, w) - y) ** 2 for c, y in test) / max(1, len(test))
        better = err(fit["weights"]) < err(EVIDENCE_WEIGHTS)
        full = fit_weights(samples)
        write_weights(full, "active" if better else "candidate",
                      f"held-out MSE fit={err(fit['weights']):.4f} vs prior={err(EVIDENCE_WEIGHTS):.4f}")
        out["calibration"] = {**full, "held_out_better_than_prior": better}
    else:
        out["calibration"] = {"status": "waiting for data",
                              "message": f"{len(samples)} of {MIN_SAMPLES} pairs collected; the documented prior stays active."}
    REPORT.write_text(json.dumps(out, indent=1), encoding="utf-8")
    return out


def main():
    with get_session() as s:
        out = run(s)
    print(json.dumps({k: v for k, v in out.items() if k != "sensitivity"}, indent=1))
    for name, r in out["sensitivity"]["results"].items():
        print(f"  {name:62s} top3={r['top3_overlap']:.3f} tau={r['kendall_tau']:.3f} mae={r['mastery_mae']:.3f}")


if __name__ == "__main__":
    main()
