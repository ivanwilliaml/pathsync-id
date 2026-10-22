"""Analisis uji lapangan PathSync dari CSV respons Google Form (buat_form_uji_lapangan.gs).

Unduh Sheet respons lewat File > Download > CSV, lalu:
    python analisis_uji_lapangan.py respons.csv
Hasil: ringkasan Markdown di layar (siap ditempel ke Tabel 16) dan hasil_uji_lapangan.json di folder yang sama dengan CSV.

Aturan yang ditetapkan sebelum data dibuka:
- Responden yang tidak setuju [P0] atau gagal cek perhatian ([P21] baris G bukan 4) dikeluarkan.
- Hipotesis Bab I didukung bila proporsi "Sering" + "Selalu" di [P6] minimal sepertiga.
- [P13] vs [P18] dibandingkan per baris dengan uji Wilcoxon bertanda (berpasangan, dua sisi).
- [P21] baris B (ketepatan diagnosis) hanya dihitung untuk responden yang memakai data sendiri atau campuran.
"""
import csv
import json
import math
import random
import sys
from pathlib import Path

ROWS = "ABCDEF"


def col(header: list[str], code: str, row: str | None = None) -> int | None:
    for i, h in enumerate(header):
        if h.startswith(f"[{code}]") and (row is None or f"[{row}." in h):
            return i
    return None


def num(x: str) -> float | None:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (math.nan, math.nan)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (c - h, c + h)


def wilcoxon(before: list[float], after: list[float]) -> dict:
    """Signed-rank test, two-sided, normal approximation with tie correction (n is about 100)."""
    diffs = [a - b for a, b in zip(after, before) if a != b]
    n = len(diffs)
    if n == 0:
        return {"n_nonzero": 0, "p": 1.0, "rank_biserial": 0.0}
    order = sorted(range(n), key=lambda i: abs(diffs[i]))
    ranks = [0.0] * n
    i, ties = 0, 0.0
    while i < n:
        j = i
        while j + 1 < n and abs(diffs[order[j + 1]]) == abs(diffs[order[i]]):
            j += 1
        r = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = r
        t = j - i + 1
        ties += t ** 3 - t
        i = j + 1
    w_plus = sum(r for r, d in zip(ranks, diffs) if d > 0)
    w_minus = sum(r for r, d in zip(ranks, diffs) if d < 0)
    mean = n * (n + 1) / 4
    sd = math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - ties / 48)
    z = (min(w_plus, w_minus) - mean) / sd if sd else 0.0
    p = math.erfc(abs(z) / math.sqrt(2))
    try:  # exact or better-corrected value when SciPy is available
        from scipy.stats import wilcoxon as sp_wilcoxon

        p = float(sp_wilcoxon(after, before, zero_method="wilcox").pvalue)
    except Exception:
        pass
    return {"n_nonzero": n, "W_plus": w_plus, "W_minus": w_minus, "p": p,
            "rank_biserial": (w_plus - w_minus) / (w_plus + w_minus)}


def sus_score(vals: list[float]) -> float:
    return 2.5 * sum((v - 1) if i % 2 == 0 else (5 - v) for i, v in enumerate(vals))


def main(path: str) -> None:
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header, data = rows[0], rows[1:]
    c_ok, c_att = col(header, "P0"), col(header, "P21", "G")
    kept = [r for r in data if r[c_ok].startswith("Ya") and (c_att is None or r[c_att] == "4")]
    out: dict = {"n_total": len(data), "n_kept": len(kept),
                 "n_excluded_attention_or_consent": len(data) - len(kept)}
    n = len(kept)

    c6 = col(header, "P6")
    k = sum(r[c6] in ("Sering", "Selalu") for r in kept)
    lo, hi = wilson(k, n)
    out["hypothesis_confused_often"] = {"k": k, "n": n, "share": k / n if n else None, "ci95": [lo, hi],
                                        "supported": (k / n >= 1 / 3) if n else None}

    out["before_vs_after"] = {}
    for row in ROWS:
        b, a = col(header, "P13", row), col(header, "P18", row)
        pairs = [(num(r[b]), num(r[a])) for r in kept]
        pairs = [(x, y) for x, y in pairs if x is not None and y is not None]
        bs, as_ = [x for x, _ in pairs], [y for _, y in pairs]
        res = wilcoxon(bs, as_)
        out["before_vs_after"][row] = {"n": len(pairs), "mean_before": sum(bs) / len(bs), "mean_after": sum(as_) / len(as_),
                                       "improved": sum(y > x for x, y in pairs), "same": sum(y == x for x, y in pairs),
                                       "worse": sum(y < x for x, y in pairs), **res}

    c11 = col(header, "P16")
    out["trust"] = {}
    for row in "ABCDEF":
        c = col(header, "P21", row)
        group = [r for r in kept if row != "B" or r[c11] != "Profil demo"]
        v = [num(r[c]) for r in group if num(r[c]) is not None]
        out["trust"][row] = {"n": len(v), "mean": sum(v) / len(v) if v else None,
                             "agree_4_5": sum(x >= 4 for x in v) / len(v) if v else None}

    out["features"] = {}
    for i, h in enumerate(header):
        if h.startswith("[P22]"):
            name = h[h.rfind("[") + 1:-1]
            tried = [r[i] for r in kept if r[i] and r[i] != "Tidak mencoba"]
            useful = sum(x in ("Berguna", "Sangat berguna") for x in tried)
            out["features"][name] = {"tried": len(tried), "useful_share": useful / len(tried) if tried else None}
    c16 = col(header, "P23")
    out["most_helpful"] = {}
    for r in kept:
        out["most_helpful"][r[c16]] = out["most_helpful"].get(r[c16], 0) + 1

    sus_cols = [i for i, h in enumerate(header) if h.startswith("[P25]")]
    scores = []
    for r in kept:
        v = [num(r[i]) for i in sus_cols]
        if len(v) == 10 and all(x is not None for x in v):
            scores.append(sus_score(v))
    if scores:
        m = sum(scores) / len(scores)
        sd = math.sqrt(sum((s - m) ** 2 for s in scores) / max(1, len(scores) - 1))
        out["sus"] = {"n": len(scores), "mean": m, "sd": sd,
                      "ci95": [m - 1.96 * sd / math.sqrt(len(scores)), m + 1.96 * sd / math.sqrt(len(scores))]}

    c19 = col(header, "P29")
    nps = [num(r[c19]) for r in kept if num(r[c19]) is not None]
    if nps:
        out["nps"] = 100 * (sum(x >= 9 for x in nps) - sum(x <= 6 for x in nps)) / len(nps)
    c20 = col(header, "P30")
    out["use_again"] = {v: sum(r[c20] == v for r in kept) / n for v in ("Ya", "Mungkin", "Tidak")} if n else {}
    c18 = col(header, "P28")
    plans: dict = {}
    for r in kept:
        for p in [x.strip() for x in r[c18].split(",") if x.strip()]:
            plans[p] = plans.get(p, 0) + 1
    out["plans"] = plans

    c1 = col(header, "P1")
    out["by_status"] = {}
    for r in kept:
        out["by_status"][r[c1]] = out["by_status"].get(r[c1], 0) + 1


    # urgensi dan nilai: P11 (setuju 4-5), P12 penting, P26 sangat kecewa, P24 masalah terbantu, P20 rencana
    out["problem_agree"] = {}
    for row in "ABCDE":
        c = col(header, "P11", row)
        v = [num(r[c]) for r in kept if num(r[c]) is not None]
        out["problem_agree"][row] = sum(x >= 4 for x in v) / len(v) if v else None
    c12 = col(header, "P12")
    v12 = [num(r[c12]) for r in kept if num(r[c12]) is not None]
    out["importance_mean"] = sum(v12) / len(v12) if v12 else None
    c26 = col(header, "P26")
    out["very_disappointed"] = sum(r[c26] == "Sangat kecewa" for r in kept) / n if n else None
    c24 = col(header, "P24")
    helped: dict = {}
    for r in kept:
        for x in [s.strip() for s in r[c24].split(",") if s.strip()]:
            helped[x] = helped.get(x, 0) + 1
    out["problems_helped"] = helped
    c20p = col(header, "P20")
    out["plan_better"] = sum(r[c20p] in ("Jauh lebih baik", "Sedikit lebih baik") for r in kept) / n if n else None
    c14, c19p = col(header, "P14"), col(header, "P19")
    with open(Path(path).with_name("rencana_untuk_penilaian_buta.csv"), "w", encoding="utf-8", newline="") as fo:
        w = csv.writer(fo)
        w.writerow(["id", "versi", "rencana"])
        rows_out = [(i, "sebelum", r[c14]) for i, r in enumerate(kept)] + [(i, "sesudah", r[c19p]) for i, r in enumerate(kept)]
        random.Random(3).shuffle(rows_out)   # urutan diacak agar penilai tidak tahu versi; kunci versi ada di kolom kedua
        w.writerows(rows_out)

    Path(path).with_name("hasil_uji_lapangan.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")

    f2 = lambda x: "-" if x is None else f"{x:.2f}".replace(".", ",")
    pct = lambda x: "-" if x is None else f"{100 * x:.0f}%"
    h = out["hypothesis_confused_often"]
    print(f"Responden lengkap: {n} dari {len(data)}")
    print(f"Sering/selalu bingung memilih skill: {pct(h['share'])} [{pct(h['ci95'][0])} sampai {pct(h['ci95'][1])}]"
          f", hipotesis {'didukung' if h['supported'] else 'tidak didukung'}")
    labels = {"A": "tahu skill pertama", "B": "tahu kenapa penting", "C": "tahu urutan", "D": "sesuai kemampuan",
              "E": "bisa dijalankan minggu ini", "F": "tahu kapan sudah cukup"}
    for row, v in out["before_vs_after"].items():
        print(f"{row} {labels[row]}: {f2(v['mean_before'])} -> {f2(v['mean_after'])}, "
              f"naik {v['improved']}, sama {v['same']}, turun {v['worse']}, p = {v['p']:.4f}, r = {f2(v['rank_biserial'])}")
    for row, v in out["trust"].items():
        print(f"P21 {row}: rata-rata {f2(v['mean'])}, setuju {pct(v['agree_4_5'])} (n = {v['n']})")
    for name, v in out["features"].items():
        print(f"Fitur {name}: berguna {pct(v['useful_share'])} dari {v['tried']} yang mencoba")
    if "sus" in out:
        s = out["sus"]
        print(f"SUS: {f2(s['mean'])} [{f2(s['ci95'][0])} sampai {f2(s['ci95'][1])}], n = {s['n']}")
    if "nps" in out:
        print(f"NPS: {out['nps']:.0f}")
    print(f"Sangat kecewa bila PathSync hilang: {pct(out['very_disappointed'])}")
    print("Akan memakai lagi: " + ", ".join(f"{k} {pct(v)}" for k, v in out["use_again"].items()))


if __name__ == "__main__":
    main(sys.argv[1])
