# Roadmap

## Status
Pembangunan selesai: backend 88 route, 36 tes, CI, Docker, frontend 15 halaman, alat validasi (anotasi + kappa, panel pakar, studi 4 lengan, review proyek, laporan taksonomi). Sisa = validasi manusia.

## 4 minggu paralel (menggantikan 10 minggu paper)
| Minggu | Data & AI | Pengguna | Kampus |
|---|---|---|---|
| 1 | 150 anotasi emas (2 anotator, kappa) → pilih ekstraktor | rekrut peserta, pra-registrasi H1 | 1 dosen pilot + kode kelas |
| 2 | Re-run baseline LLM generik (Qwen3-8B, Kaggle) | studi 4 lengan berjalan | Course Companion dipakai di 1 mata kuliah |
| 3 | Panel pakar nyata (≥3) → latih ulang LTR | refleksi mingguan & pulse | laporan kohort (k≥5) |
| 4 | Kalibrasi bobot bukti dari pasangan nyata | analisis + laporan | umpan balik dosen |

## Startup
- **Model:** B2B2C — kampus/prodi berlangganan (dasbor dosen, laporan kesenjangan kurikulum vs pasar), mahasiswa gratis.
- **Ekspansi:** peran DA (menunggu C1 ≥ 95%), lalu peran lain dengan mekanisme governance yang sama.
- **Teknis berikutnya:** rate limiter Redis untuk multi-worker, snapshot pasar bulanan terjadwal, PostgreSQL di produksi (embedding tetap di memori dengan cache, tanpa pgvector).

## Future Works

### Ekspansi role bisnis (disepakati 12 Okt 2026)
Cakupan dibatasi pada bidang **Ekonomi, Manajemen, Akuntansi, dan IT**. Hukum dan Pendidikan sengaja tidak dicakup. Tujuannya menyelaraskan produk dengan argumen Bab 1 (jurusan penyumbang pengangguran sarjana terbesar). Saat ini 14 role: 11 teknis plus Business Analyst, Accountant, Digital Marketing.

| Bidang | Role baru | Contoh hard skill yang diukur |
|---|---|---|
| Ekonomi / Manajemen | Financial Analyst | pemodelan keuangan di Excel, forecasting dan budgeting, valuasi, analisis rasio |
| Akuntansi | Tax Specialist | PPh/PPN, e-Faktur dan e-Bupot, rekonsiliasi fiskal, SPT |
| Akuntansi / Ekonomi | Internal Auditor & Risk | prosedur audit, sampling, kontrol internal, COSO, manajemen risiko |
| Manajemen | HR Specialist | HRIS, payroll dan BPJS, hukum ketenagakerjaan, rekrutmen dan ATS, people analytics |
| Manajemen | Supply Chain & Operations Analyst | perencanaan permintaan, inventory, ERP (SAP/Odoo), procurement |
| Manajemen | Product / Project Coordinator | roadmap, Jira/Notion, analitik produk, estimasi dan WBS |

Target: 20 role. Langkah: (1) tambah role di katalog dan batas skill, scrape Karirhub dan Kalibrr; (2) tambah sekitar 50-60 skill hard bisnis ke taksonomi, bangun ulang graf, materi, kursus; (3) tulis sekitar 5 soal per skill, soal pajak/audit/payroll perlu ditinjau ahli bidangnya; (4) ukur ulang kualitas soal, ekstraksi, dan peta pasar, role dengan lowongan di bawah 30 ditandai Beta; (5) perbarui teks landing, How It Works, dan dokumen.

### Validasi manusia (ditunda)
- Panel penilai industri nyata (minimal 3) untuk precision@k rekomendasi dan pelatihan ulang ranker (saat ini ranker dilatih dari data ahli simulasi dan tidak melampaui formula biasa).
- Uji pengguna 10-20 mahasiswa untuk jalur belajar, dibandingkan dengan saran karier umum.
- Dua anotator manusia untuk gold set ekstraksi (saat ini 24 lowongan, satu anotator) dan baseline LLM generik.

### Teknis
- Soal berbahasa Indonesia (soal baru saat ini hanya berbahasa Inggris).
- Uji deploy produksi (PostgreSQL, Redis rate limit, refresh pasar terjadwal).

## Status 12 Okt 2026 (setelah audit PM)
- **Taksonomi:** 114 hard skill di 14 klaster (v3) dengan 14 role. Soft skill dipertahankan sebagai lapisan terpisah berbasis pengalaman (9 skill), tanpa soal, tidak masuk ranking atau jalur belajar.
- **Ekstraksi (Bab III.D, target precision > 0,80):** diukur di tiga set gold. Dev (24 posting, adjudikasi setelah melihat keluaran): P 0,844 / R 0,918. Held-out (26 posting, dipakai menyetel alias): P 0,855 / R 0,917. **Blind (26 posting baru, dianotasi sebelum ekstraktor dijalankan, tidak dipakai menyetel): P 0,828 / R 0,889 / F1 0,857.** Ketiganya satu anotator (Claude); anotator manusia kedua masih menjadi pekerjaan lanjutan. Ekstraktor yang diukur adalah lexicon + gerbang embedding, bukan LLM.
- **Konteks BPS:** kartu konteks nasional di halaman Job Market (`/api/context/bps`); angka dari yang dikutip di Bab I, tampilan saja, tidak masuk ranking.
- **Aset gold:** `backend/data/seed/gold_pilot.json` (dev), `gold_heldout.json`, `gold_blind.json`; jalankan `python -m pipeline.eval_extractor`.
