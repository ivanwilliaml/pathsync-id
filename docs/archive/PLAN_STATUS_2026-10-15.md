# Rencana Lanjutan PathSync

Status per 15 Okt 2026, branch `plan-perbaikan`. Acuan tugas: [docs/PLAN_PERBAIKAN.md](docs/PLAN_PERBAIKAN.md) (kode tugas A1–D3 sama). Tenggat: karya ilmiah lengkap + demo **23 Okt**, TM luring 27 Okt, final 28 Okt (guidebook 4.3, 7.2.6).

## 1. Status tugas

| Tugas | Status | Catatan singkat |
|---|---|---|
| B1 PostgreSQL di CI | ✅ | job CI PostgreSQL, `pathsync.migrate check`, skrip `pipeline.sqlite_to_postgres` |
| B2 pgvector | ✅ | dilepas; compose pakai `postgres:16` |
| B3 cadangan, retensi | ✅ | latihan restore lulus, `pathsync.retention`, `docs/RUNBOOK.md` |
| B4 indeks dan kueri berat | 🟡 | DB bukan bottleneck (di bawah 1 ms per endpoint di data 10x). Hangat: p95 daftar 528 ms, transkrip 1.116 ms, dashboard 1.011 ms. **Sisa:** request pertama setelah restart masih lambat (transkrip p95 sekitar 27 s, 12 galat) |
| B5 provenance snapshot | ✅ | juga perbaikan kunci cache ekstraksi |
| C1 deploy dari nol | ✅ | dua kali; 4 bug deploy diperbaiki (lihat RUNBOOK) |
| C2 Redis multi-worker | ✅ | diuji 3 worker |
| C3 keamanan | ✅ | pip-audit (starlette diperbarui), unggahan dibatasi, header Caddy, cookie staf jadi sesi yang bisa dicabut |
| C4 observabilitas | ✅ | `/api/admin/runtime`, `/api/health`, log JSON |
| C5 cakupan tes | ✅ | 81% → 87%, CI menjaga ≥ 80%; 104 tes |
| D2 satu sumber angka | ✅ | `pipeline.report` → `data/models/metrics.json` |
| A1 anotasi manusia | 🟡 alat siap | 100 lowongan terkunci, panduan `docs/PANDUAN_ANOTASI.md`. **Butuh 2 anotator tim** |
| A2 LLM vs leksikon | 🟡 ekspor siap | 418 lowongan di `kaggle/jobs/postings.json`. **Butuh `kaggle auth login`** |
| A3 normalisasi | 🟡 alat siap | 300 frasa terkunci. **Butuh 2 pelabel** |
| A4 panel pakar | 🟡 persiapan siap | skenario per peran, aturan leave-one-expert-out. **Butuh pakar** |
| A5 kalibrasi asesmen | 🟡 alat siap | `pipeline.calibrate_items`. **Butuh jawaban nyata (pilot D1)** |
| A6 pola jawaban | ✅ | akurasi classifier 0,37 → 0,258 |
| A7 soal bahasa Indonesia | ⏳ | belum mulai |
| A8 peran berdata tipis + ESCO | ⏳ | belum mulai |
| A9 6 peran bisnis | ⏳ | belum mulai |
| D1 pilot pengguna | ⏳ | butuh 10–20 mahasiswa |
| D3 sinkron paper–produk | ⏳ | butuh daftar selisih (lihat bagian 4); naskahnya ditulis tim |

## 2. Urutan berikutnya (usulan)

Prioritas pada yang mengubah isi paper dan demo sebelum 23 Okt.

1. **Taksonomi BA (sekitar 1 jam).** BA sekarang **tidak** lulus kriteria final (cakupan 90%, target 95%; kandidat "Agile" di 14% lowongan, batas 10%). Kembalikan skill `agile_scrum` dan `project_management` dari riwayat git (`7aa5b81`: taksonomi, 10 soal, 3 sisi graf) ke klaster `business_analysis`, naikkan versi ke `2026.10-v4` + changelog di `pathsync/governance.py`, bangun ulang pasar, cek `governance.report` sampai 3/3. Perbarui `docs/JURY_RESPONSE.md` (masih menulis "lulus 3/3, 42 skill").
2. **A2 (sekitar 1 jam setelah login).** `kaggle auth login`, lalu `python kaggle/build_kernel.py postings --user <akun>` → push → output → `llm_jobs import-postings`. Bandingkan di set uji dengan `eval_extractor --gold gold_consensus.json --split test --extractor {lexicon,llm,union,intersection}` setelah A1 ada.
3. **Data manusia (paralel, tim).** A1 anotasi (2 orang × 2–3 jam), A3 label frasa, D1 pilot 10–20 mahasiswa (sekaligus data A5 dan kalibrasi bobot), A4 1–3 pakar BA × 2 jam. Lalu jalankan `pipeline.gold consensus`, `pipeline.normalisation eval`, `pipeline.calibrate_items`, `pipeline.calibrate_weights`, `pipeline.report`.
4. **B4 sisa (sekitar 1 jam).** Cari penyebab lambat pertama setelah restart di Docker (di laptop sudah turun dari 20 s ke 3 s dengan single-flight embedding). Dugaan: route FastAPI 0.143 dibangun malas di event loop, atau cache embedding di container kosong setiap image baru. Coba: buat volume untuk `data/processed/embedding_cache.sqlite`, panggil semua route sekali saat warmup.
5. **A8 (sekitar 1 jam).** Scrape ulang peran di bawah 50 lowongan (UI/UX 7, frontend 18, data engineer 18, data scientist 19), petakan ESCO atau tulis di halaman bahwa level dihitung dari frekuensi.
6. **D3 (tim, dibantu daftar selisih).** Lihat bagian 4.
7. **A7 (2–3 jam)** dan **A9 (3–4 jam)** setelah final atau bila waktu cukup.

## 3. Temuan penting sepanjang jalan

- `market_latest.json` lama dibangun dari leksikon versi sebelumnya (17.728 sebutan auto; kode sekarang 13.708). Penyebab: kunci cache cuma versi taksonomi. Sudah diperbaiki.
- Ranker LTR vs formula (5) seri: 0,9747 vs 0,9749 (pakar simulasi). Dengan aturan pakar nyata, LTR baru dipakai bila unggul ≥ 0,02 dengan CI tidak mencakup nol.
- Presisi ekstraksi blind 0,828, selang 95% [0,749–0,886]: batas bawah di bawah target 0,80, dan gold masih satu anotator (Claude).
- Tidak ada satu pun dari 14 peran yang lulus kriteria taksonomi final.
- Celah yang sudah ditutup: hapus profil tidak menghapus `product_events`; cookie staf berisi token staf aslinya (tidak bisa dicabut); 10 kerentanan starlette; DOCX zip bomb dan PDF tanpa batas halaman; pool koneksi habis di bawah beban.

## 4. Selisih paper semifinal vs produk (bahan D3, ditulis tim)

| Paper (Bab III) | Produk sekarang | Yang perlu ditulis |
|---|---|---|
| 1 peran BA, ±40 skill | 14 peran, 114 hard skill; BA fokus | BA tetap fokus; peran lain "perluasan (Beta)" |
| Ekstraksi LLM | leksikon aktif, LLM luring sebagai pembanding | hasil A2 dan alasan pilihan ekstraktor |
| PostgreSQL + pgvector | PostgreSQL tanpa pgvector | hapus pgvector dari III.B |
| Bobot bukti 0,2 / 0,3 / 0,5 | 0,2 / 0,25 / 0,3 / 0,5 (+ sertifikat) | dasar inverse-variance, uji sensitivitas, kalibrasi bila data ada |
| 150 anotasi, 2 anotator | 100 lowongan terkunci, menunggu anotator | angka A1 |
| 3 pakar nyata | pakar simulasi | hasil A4 atau batasan yang jujur |
| Uji pengguna 2 × 20 | studi 4 lengan siap, belum ada peserta | hasil D1 (pilot) |
| Jadwal 10 minggu | pembangunan selesai | apa yang divalidasi sebelum 23 Okt, sisanya ke Bab 5 |

## 5. Cara memeriksa

```bash
cd backend
python -m pipeline.build_market --extractor lexicon --ref 2026-10-12
python -m pipeline.expert_study
python -m pytest -q --cov=pathsync --cov=api
python -m pipeline.report
```

Deploy lokal dan uji beban: lihat `docs/RUNBOOK.md`.
