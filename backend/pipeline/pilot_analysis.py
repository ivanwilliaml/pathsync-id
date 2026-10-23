"""Analyse the V3 pilot sheet (usability pilot, PathSync vs generic career advice).

    python -m pipeline.pilot_analysis        # -> data/models/pilot_eval.json

Input: the observer sheet in data/seed/_validasi/V3_pilot.xlsx. Provenance as stated by
the team on 18 Oct 2026: responses collected in Google Sheets and entered into the template by the team; the raw
Sheets export is not in the repository. The analysis is descriptive with paired Wilcoxon tests; it is a usability pilot,
not an effectiveness study.
"""
from __future__ import annotations

import json
import statistics
from datetime import datetime

from scipy.stats import wilcoxon

from pathsync.config import MODELS_DIR, SEED_DIR

SHEET = SEED_DIR / "_validasi" / "V3_pilot.xlsx"
OUT = MODELS_DIR / "pilot_eval.json"
TARGETS = {"T1": 0.8, "T2": 0.8, "T3": 0.6, "T4": 0.8, "T5": 0.8, "median_T2_minutes": 5.0, "Q1_pathsync_mean": 4.0, "SUS_mean": 70.0}
PROVENANCE = ("Responses collected by the team in Google Sheets and entered into the V3 template; raw export not in the "
              "repository. Session dates as recorded in the sheet.")


def _sus(scores: list[int]) -> float:
    return sum((s - 1) if i % 2 == 0 else (5 - s) for i, s in enumerate(scores)) * 2.5


def _rate(rows, col) -> dict:
    vals = [r[col] for r in rows if r.get(col) in ("ya", "tidak")]
    k = sum(v == "ya" for v in vals)
    return {"yes": k, "n": len(vals), "share": round(k / len(vals), 3) if vals else None}


def _paired(rows, pathsync_col, generic_col) -> dict:
    pairs = [(r[generic_col], r[pathsync_col]) for r in rows
             if isinstance(r.get(pathsync_col), (int, float)) and isinstance(r.get(generic_col), (int, float))]
    y = [g for g, _ in pairs]          # generic advice
    x = [p for _, p in pairs]          # PathSync
    diffs = [p - g for g, p in pairs]
    out = {"n": len(pairs), "generic_mean": round(statistics.mean(y), 2), "pathsync_mean": round(statistics.mean(x), 2),
           "mean_diff": round(statistics.mean(diffs), 2), "pathsync_higher": sum(d > 0 for d in diffs),
           "equal": sum(d == 0 for d in diffs), "generic_higher": sum(d < 0 for d in diffs)}
    if any(diffs):
        t = wilcoxon(x, y, zero_method="wilcox", alternative="two-sided")
        nz = [d for d in diffs if d]
        # matched-pairs rank-biserial effect size
        ranks = sorted(range(len(nz)), key=lambda i: abs(nz[i]))
        rk = [0.0] * len(nz)
        for pos, i in enumerate(ranks):
            rk[i] = pos + 1
        pos_sum = sum(r for r, d in zip(rk, nz, strict=True) if d > 0)
        neg_sum = sum(r for r, d in zip(rk, nz, strict=True) if d < 0)
        out |= {"wilcoxon_W": float(t.statistic), "p": round(float(t.pvalue), 4),
                "rank_biserial": round((pos_sum - neg_sum) / (pos_sum + neg_sum), 3)}
    return out


def main() -> None:
    from openpyxl import load_workbook

    ws = load_workbook(SHEET)["Peserta"]
    rows_raw = list(ws.iter_rows(values_only=True))
    hdr = [str(h) for h in rows_raw[0]]
    rows = [dict(zip(hdr, r, strict=False)) for r in rows_raw[1:] if r and r[0]]
    sus_cols = [f"SUS{i}" for i in range(1, 11)]
    sus = [_sus([int(r[c]) for c in sus_cols]) for r in rows if all(isinstance(r.get(c), (int, float)) for c in sus_cols)]
    t2 = [float(r["T2 menit"]) for r in rows if isinstance(r.get("T2 menit"), (int, float))]
    t2_ok = [float(r["T2 menit"]) for r in rows if r.get("T2 sampai langkah pertama") == "ya" and isinstance(r.get("T2 menit"), (int, float))]
    t3 = [float(r["T3 menit"]) for r in rows if r.get("T3 Quick Check selesai") == "ya" and isinstance(r.get("T3 menit"), (int, float))]
    t4 = [float(r["T4 detik"]) for r in rows if isinstance(r.get("T4 detik"), (int, float))]
    t5 = [r for r in rows if r.get("T5a Bottleneck") in ("ya", "tidak")]
    t5_both = sum(r["T5a Bottleneck"] == "ya" and r["T5b Prove It"] == "ya" for r in t5)
    dates = sorted({r["tanggal"].date().isoformat() for r in rows if isinstance(r.get("tanggal"), datetime)})
    order = {o: sum(r.get("urutan") == o for r in rows) for o in ("Saran umum dulu", "PathSync dulu")}
    prodi: dict[str, int] = {}
    for r in rows:
        prodi[r.get("prodi") or "?"] = prodi.get(r.get("prodi") or "?", 0) + 1
    out = {
        "generated": datetime.now().isoformat(timespec="seconds"), "provenance": PROVENANCE, "n": len(rows),
        "session_dates": dates, "programmes": prodi, "order": order,
        "tasks": {"T1_understands_purpose": _rate(rows, "T1 paham tujuan"),
                  "T2_reaches_first_step": _rate(rows, "T2 sampai langkah pertama"),
                  "T3_finishes_quick_check": _rate(rows, "T3 Quick Check selesai"),
                  "T4_finds_strong_and_urgent": _rate(rows, "T4 jawab benar"),
                  "T5a_explains_bottleneck": _rate(rows, "T5a Bottleneck"),
                  "T5b_explains_prove_it": _rate(rows, "T5b Prove It"),
                  "T5_both_terms": {"yes": t5_both, "n": len(t5), "share": round(t5_both / len(t5), 3) if t5 else None}},
        "times": {"T2_minutes_median_all": statistics.median(t2) if t2 else None,
                  "T2_minutes_median_successful": statistics.median(t2_ok) if t2_ok else None,
                  "T3_minutes_median_finished": statistics.median(t3) if t3 else None,
                  "T4_seconds_median": statistics.median(t4) if t4 else None},
        "ratings_pathsync_vs_generic": {q: _paired(rows, f"{q} P", f"{q} U") for q in ("Q1", "Q2", "Q3")},
        "sus": {"n": len(sus), "mean": round(statistics.mean(sus), 1) if sus else None,
                "median": statistics.median(sus) if sus else None, "min": min(sus) if sus else None, "max": max(sus) if sus else None},
        "targets": TARGETS,
        "note": "Usability pilot with one session per student; questions answered right after use. Not evidence of learning "
                "or job outcomes. Ratings compare PathSync with a fixed generic advice page in counterbalanced order.",
    }
    tk = out["tasks"]
    out["meets"] = {"T1": tk["T1_understands_purpose"]["share"] >= TARGETS["T1"],
                    "T2": tk["T2_reaches_first_step"]["share"] >= TARGETS["T2"],
                    "T3": tk["T3_finishes_quick_check"]["share"] >= TARGETS["T3"],
                    "T4": tk["T4_finds_strong_and_urgent"]["share"] >= TARGETS["T4"],
                    "T5": tk["T5_both_terms"]["share"] >= TARGETS["T5"],
                    "median_T2_minutes": (out["times"]["T2_minutes_median_all"] or 99) <= TARGETS["median_T2_minutes"],
                    "Q1_pathsync_mean": out["ratings_pathsync_vs_generic"]["Q1"]["pathsync_mean"] >= TARGETS["Q1_pathsync_mean"],
                    "SUS_mean": (out["sus"]["mean"] or 0) >= TARGETS["SUS_mean"]}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"n": out["n"], "tasks": {k: v["share"] for k, v in tk.items()}, "times": out["times"],
                      "ratings": {q: (v["generic_mean"], v["pathsync_mean"], v.get("p")) for q, v in out["ratings_pathsync_vs_generic"].items()},
                      "sus": out["sus"], "meets": out["meets"]}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
