"""Siapkan lembar penilaian buta rencana belajar (audit EVAL-01, hipotesis H2).

    python siapkan_lembar.py

Masukan: ../uji_lapangan/rencana_untuk_penilaian_buta.csv (id responden, versi sebelum/sesudah, teks rencana) dan
../uji_lapangan/respons_anonim.csv (role yang diincar, kolom [P5]; id = indeks baris mulai 0, semua 47 baris lolos saringan).
Keluaran di folder ini:
  lembar_penilai_A.csv, lembar_penilai_B.csv  urutan acak berbeda, tanpa versi; kolom skor kosong untuk diisi
  kunci_kondisi.csv                            kode -> id dan versi; JANGAN dibuka penilai sebelum selesai
Teks rencana tidak diubah. Rencana yang menyebut nama fitur PathSync dapat membocorkan kondisinya; itu dicatat
sebagai keterbatasan, bukan disunting.
"""
import csv
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "uji_lapangan"
DIMENSIONS = ["relevansi", "kecocokan_bukti", "urutan", "spesifik", "waktu", "kriteria_selesai"]


def main() -> None:
    plans = list(csv.DictReader(open(SRC / "rencana_untuk_penilaian_buta.csv", encoding="utf-8")))
    resp = list(csv.reader(open(SRC / "respons_anonim.csv", encoding="utf-8")))
    header, rows = resp[0], resp[1:]
    role_col = next(i for i, h in enumerate(header) if h.startswith("[P5]"))
    role = {str(i): r[role_col] for i, r in enumerate(rows)}   # id = 0-based index of the kept rows (all 47 kept)

    rng = random.Random(20261023)
    codes = rng.sample(range(100, 1000), len(plans))
    items = [{"kode": f"R{c}", "id": p["id"], "versi": p["versi"], "role": role.get(p["id"], ""), "rencana": p["rencana"]}
             for c, p in zip(codes, plans)]
    with open(HERE / "kunci_kondisi.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, ["kode", "id", "versi"])
        w.writeheader()
        w.writerows({k: x[k] for k in ("kode", "id", "versi")} for x in sorted(items, key=lambda x: x["kode"]))
    for rater, seed in (("A", 1), ("B", 2)):
        order = items[:]
        random.Random(seed).shuffle(order)
        with open(HERE / f"lembar_penilai_{rater}.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["kode", "role_yang_diincar", "rencana", *DIMENSIONS, "tidak_dapat_dinilai", "catatan"])
            for x in order:
                w.writerow([x["kode"], x["role"], x["rencana"], *[""] * len(DIMENSIONS), "", ""])
    print(f"{len(items)} rencana, {len({x['id'] for x in items})} responden")


if __name__ == "__main__":
    main()
