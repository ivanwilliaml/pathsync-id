# Protokol Uji Pengguna

Kode: `backend/pathsync/study.py`, Admin → User Studies.

## Lengan
| Lengan | Isi | Mewakili |
|---|---|---|
| A posting_list | daftar skill dari lowongan | kontrol paper |
| B generic_plan | urut permintaan, tanpa diagnosis & graf | "tanya chatbot" |
| C pathsync_static | PathSync tanpa siklus adaptif | ablation adaptif |
| D pathsync_full | PathSync penuh | intervensi |

Flag fitur per lengan (`evidence, graph, adaptive, explanations, path`) mengubah produk sungguhan.

## Hipotesis & ukuran
- **H1** kejelasan arah (pulse 1–5) — konfirmatori D vs A.
- **H2** kualitas rencana, dinilai buta oleh pakar (kode samaran).
- **H3** menit menyusun rencana.
- **H4** arah perubahan peringkat setelah bukti baru.

## Pengacakan
Minimisasi terstratifikasi per prodi (8 peserta → 2-2-2-2, diuji).

## Analisis
Kruskal–Wallis, lalu Mann–Whitney berpasangan + koreksi Holm, efek rank-biserial. Otomatis di `GET /api/admin/studies/{id}/results`.

## Power
n = 20/lengan, d = 0,9 → power 0,79 untuk satu perbandingan. Empat lengan dengan Holm butuh ±30/lengan, maka bertingkat:
1. **Konfirmatori (pra-registrasi):** D vs A pada H1.
2. **Eksploratif:** B dan C.
3. **Opsional:** within-subject untuk H1 (tiap peserta melihat A lalu D, urutan diacak) bila rekrutmen < 80.
