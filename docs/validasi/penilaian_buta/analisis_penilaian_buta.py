"""Analisis penilaian buta rencana belajar setelah dua penilai selesai (audit EVAL-01, hipotesis H2).

    python analisis_penilaian_buta.py lembar_penilai_A.csv lembar_penilai_B.csv

Aturan yang ditetapkan sebelum skor dibuka:
- Skor rencana = rata-rata enam dimensi (1-3) dari satu penilai; skor akhir = rata-rata dua penilai.
- Rencana yang ditandai tidak dapat dinilai oleh salah satu penilai dikeluarkan beserta pasangannya.
- Unit analisis = responden: selisih sesudah - sebelum per responden, uji Wilcoxon bertanda dua sisi,
  rank-biserial sebagai ukuran efek, IK 95% selisih median dengan bootstrap per responden.
- Kesepakatan penilai: korelasi Spearman dan kappa berbobot kuadrat pada skor rata-rata yang dibulatkan.
- H2 didukung bila selisih positif dan p < 0,05. Bila tidak, ditulis apa adanya.
"""
import csv
import json
import random
import statistics
import sys
from pathlib import Path

from scipy.stats import spearmanr, wilcoxon

HERE = Path(__file__).resolve().parent
DIMENSIONS = ["relevansi", "kecocokan_bukti", "urutan", "spesifik", "waktu", "kriteria_selesai"]


def read(path: str) -> dict[str, float | None]:
    out = {}
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if r["tidak_dapat_dinilai"].strip():
            out[r["kode"]] = None
            continue
        out[r["kode"]] = statistics.mean(float(r[d]) for d in DIMENSIONS)
    return out


def kappa_quadratic(a: list[int], b: list[int], k: int = 3) -> float:
    n = len(a)
    obs = [[0.0] * k for _ in range(k)]
    for x, y in zip(a, b):
        obs[x - 1][y - 1] += 1 / n
    pa = [sum(row) for row in obs]
    pb = [sum(obs[i][j] for i in range(k)) for j in range(k)]
    w = [[(i - j) ** 2 / (k - 1) ** 2 for j in range(k)] for i in range(k)]
    num = sum(w[i][j] * obs[i][j] for i in range(k) for j in range(k))
    den = sum(w[i][j] * pa[i] * pb[j] for i in range(k) for j in range(k))
    return 1 - num / den if den else float("nan")


def main(a_path: str, b_path: str) -> None:
    a, b = read(a_path), read(b_path)
    key = {r["kode"]: r for r in csv.DictReader(open(HERE / "kunci_kondisi.csv", encoding="utf-8"))}
    both = [c for c in key if a.get(c) is not None and b.get(c) is not None]
    agree = {"n": len(both), "spearman": round(float(spearmanr([a[c] for c in both], [b[c] for c in both]).statistic), 3),
             "kappa_kuadrat": round(kappa_quadratic([round(a[c]) for c in both], [round(b[c]) for c in both]), 3)}
    per: dict[str, dict[str, float]] = {}
    for c in both:
        per.setdefault(key[c]["id"], {})[key[c]["versi"]] = (a[c] + b[c]) / 2
    pairs = [(v["sebelum"], v["sesudah"]) for v in per.values() if "sebelum" in v and "sesudah" in v]
    diffs = [s - p for p, s in pairs]
    nz = [d for d in diffs if d != 0]
    test = wilcoxon(nz) if len(nz) >= 5 else None
    rb = (sum(d > 0 for d in nz) - sum(d < 0 for d in nz)) / len(nz) if nz else 0.0
    rng = random.Random(0)
    boots = sorted(statistics.median([rng.choice(diffs) for _ in diffs]) for _ in range(5000)) if diffs else []
    out = {"kesepakatan_penilai": agree, "n_responden_berpasangan": len(pairs),
           "rerata_sebelum": round(statistics.mean(p for p, _ in pairs), 3) if pairs else None,
           "rerata_sesudah": round(statistics.mean(s for _, s in pairs), 3) if pairs else None,
           "median_selisih": round(statistics.median(diffs), 3) if diffs else None,
           "ik95_median_selisih": [round(boots[124], 3), round(boots[4874], 3)] if boots else None,
           "wilcoxon_p": round(float(test.pvalue), 4) if test else None, "rank_biserial": round(rb, 3),
           "dikeluarkan": len(key) - len(both)}
    (HERE / "hasil_penilaian_buta.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:3])
