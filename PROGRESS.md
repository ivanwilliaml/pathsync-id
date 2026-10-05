# PathSync — Progres & Langkah Berikutnya

Terakhir diperbarui: 6 Oktober 2026. Acuan: paper semifinal ICC 2026 (Tim cupuu), Bagian III Metodologi.

## Ringkasan

Backend sudah berupa produk yang berjalan end-to-end di atas **data lowongan nyata**: scraping → ekstraksi skill dengan kutipan terverifikasi → peta permintaan → diagnosis kompetensi berbasis bukti → model peringkat titik hambat → jalur belajar + penjelasan + kontrafaktual → siklus adaptif dengan riwayat. Semua lewat REST API **dan antarmuka web Next.js berbahasa Inggris** (10 halaman, didesain ulang setelah audit UI/UX, lihat [docs/UI_AUDIT.md](docs/UI_AUDIT.md)), sudah diuji integrasi (23 tes), dan bisa di-deploy dengan `docker compose` (teruji di PostgreSQL). Ekstraksi LLM dan pembanding "LLM generik" sudah dijalankan dengan model open-weight (Qwen3-8B) di GPU Kaggle. **Yang tersisa terutama validasi dengan manusia** (anotasi emas, pakar, uji pengguna) dan hosting publik.

## Yang sudah selesai (dipetakan ke paper)

| Bagian paper | Status | Implementasi |
|---|---|---|
| III.C.1 Akuisisi data | ✅ | `scrapers/`: Karirhub Kemnaker (API publik portal pemerintah), Workable public search, Workday (BINUS dll.), Lever (GoTo, Amar Bank, ATI), SmartRecruiters (Qraved, FLOW, BukuWarung), Dataset Pasar Kerja Kemnaker 2022–2024, ESCO API v1.2 |
| Data terkumpul | ✅ | 94 lowongan berteks (ID+EN) → 17 duplikat dibuang (TF-IDF ≥ 0,90) → **43 lowongan BA + 29 DA** dalam jendela 12 bulan |
| III.A.1 Taksonomi | ✅ | 42 skill, 4 rumpun, alias ID/EN, pemetaan ESCO. v2 menambah "API & Integrasi Sistem" karena muncul sebagai kandidat skill baru dari ekstraksi (mekanisme ekspansi di paper) |
| III.A.1 Ekstraksi | ✅ | Ekstraktor LLM (Claude, structured output, terbatas taksonomi) + **jalur LLM luring** (Qwen3-8B di GPU Kaggle, prompt/taksonomi/skema identik, `pipeline/llm_jobs.py` + `kaggle/`) + ekstraktor leksikon offline; **verifikasi kutipan** (kutipan wajib ada di teks asli) + **normalisasi embedding** multibahasa dengan ambang 0,85 / 0,70 → otomatis / antrean tinjauan / kandidat baru |
| III.A.1 Permintaan & tren | ✅ | Persamaan (1) bobot 0,5^(a/6), tren 6 vs 6 bulan, klip ±0,5, λ=0,5, interval Wilson, r_s ∈ [0,60; 0,85] dari status ESCO + frekuensi |
| III.A.2 Diagnosis bukti | ✅ | Transkrip (A=1, B=0,75, C=0,5 × kekuatan pemetaan; 63 mata kuliah 4 prodi + fallback embedding), sertifikat (36), rubrik proyek 4 tingkat dengan kutipan + sampel 20% untuk cek manusia, CV hanya klaim, penilaian diri tidak dihitung. Persamaan (2) bobot 0,2/0,25/0,3/0,5 + BKT persamaan (3). Keyakinan K_s, flag konfirmasi, jenis rekomendasi pelajari/buktikan |
| Asesmen | ✅ | Bank **210 butir** (42 skill × 5), diagnostik 20–30 butir dipilih adaptif, asesmen ulang per skill |
| III.A.3 Graf prasyarat | ✅ | DAG 50 sisi (sumber ESCO/tim + alasan), cek siklus, aturan validasi 2 dari 3 pakar via API |
| III.A.4 Model peringkat | ✅ | Fitur Tabel 3, skor persamaan (4), formula (5) sebagai kasus khusus, LTR berpasangan (logistic loss) diregularisasi ke bobot formula (5), λ dipilih inner-CV berkelompok |
| III.A.5 Jalur & penjelasan | ✅ | Top-3 + prasyarat belum dikuasai, urutan topologis, 4 pertanyaan (apa / mengapa berbasis data + kutipan lowongan / mengapa sekarang / berikutnya), kontribusi fitur, kontrafaktual "langkah tertahan", cakupan persamaan (6), 121 materi terbuka terverifikasi HTTP (11 berbahasa Indonesia, Dicoding) |
| III.A.6 Siklus adaptif | ✅ | 3 pemicu teruji: bukti baru, pembaruan pasar (snapshot baru / simulasi), ganti peran. Setiap perubahan jalur disimpan beserta alasannya |
| III.B Arsitektur | ✅ | Python + FastAPI + SQLAlchemy (SQLite default; **PostgreSQL 16 + pgvector teruji** lewat `docker-compose.yml`), embedding open-source multibahasa, **Next.js 16 + Tailwind 4** |
| III.D Evaluasi | ✅ alat, ⏳ data nyata | Harness P/R/F1 vs anotasi, NDCG@5 / Kendall τ / top-3 vs **4 pembanding (termasuk LLM generik, kini dijalankan)**, CV berkelompok, bootstrap CI 95%, ablasi, uji adaptivitas, Kendall W, kesepakatan leksikon vs LLM |
| Antarmuka (Gbr. 7) | ✅ | `frontend/` (bahasa Inggris, shadcn/ui + Tailwind 4, design system di `docs/UI_AUDIT.md`): landing + pendaftaran, wizard bukti bertahap, cek cepat satu soal per layar (pintasan keyboard), dasbor dengan rute belajar bergradasi dan panel detail 4 pertanyaan, peta skill terfokus, pasar kerja, riwayat, panel pakar (validasi prasyarat satu per satu, peringkat dengan klik berurutan), admin (pembaruan pasar bisa dihentikan). Responsif sampai 375 px, kontras AA, `prefers-reduced-motion` |
| Bahasa | ✅ | UI dan seluruh teks backend (nama & deskripsi 42 skill, penjelasan, riwayat, peringatan, 210 soal asesmen, alasan 50 sisi graf) dalam bahasa Inggris lewat `PATHSYNC_LANG=en`; teks Indonesia asli tetap di seed untuk prompt ekstraksi (prompt Kaggle identik byte per byte) |
| Operasional | ✅ | `docker compose up` (DB kosong → bangun peta pasar & studi pakar otomatis), GitHub Actions scraping bulanan (`.github/workflows/monthly-scrape.yml`), uji API end-to-end |

### Uji kesetiaan ke paper
`tests/test_paper_fidelity.py` — 7/7 lulus, termasuk **reproduksi persis Tabel 4** (SQL 0,95 → 0,17; Analisis data naik ke #1 setelah asesmen ulang SQL).
`tests/test_api.py` — 14 uji alur API (persetujuan, bukti, klaim CV tidak menaikkan penguasaan, kunci jawaban tidak dikirim ke klien, 3 pemicu adaptif, kutipan dapat ditelusuri, panel pakar 2-dari-3 + tolak siklus, F1 anotasi) pada salinan DB sementara. `tests/test_llm_jobs.py` — hasil LLM luring melewati gerbang yang sama (kutipan halusinasi ditolak). Tombol Stop pembaruan pasar diuji dengan proses tiruan. **Total 23/23 lulus.**

### Hasil simulasi kelayakan (pakar tersimulasi, 15 skenario dasar × 3 = 45 skenario, 8 kandidat)

| Kondisi pakar | NDCG@5 model [CI95] | Formula (5) | Gap terbesar | Gap × D | LLM generik (Qwen3-8B) | Tanpa fitur graf |
|---|---|---|---|---|---|---|
| Titik hambat | **0,993** [0,987–0,997] | 0,987 | 0,715 | 0,755 | 0,636 [0,591–0,681] | 0,738 |
| Gap × permintaan | **0,944** [0,906–0,974] | 0,786 | 0,883 | 0,955 | 0,740 [0,640–0,834] | 0,956 |
| Campuran | 0,949 [0,922–0,971] | 0,956 | 0,763 | 0,810 | 0,653 [0,593–0,719] | 0,805 |

Ablasi menunjukkan fitur graf memberi perbaikan besar saat pakar menilai berdasarkan titik hambat (0,738 → 0,993). Selisih hasil 8 vs 30 skenario dasar ≤ ~0,03. Model aktif: "LTR v1 (simulasi)" — lolos aturan *minimal setara formula (5)* dengan margin 0,01. Pembanding LLM generik (Qwen3-8B, prompt tanpa bobot taksonomi dan tanpa graf, dijalankan luring di Kaggle) paling rendah di ketiga kondisi, termasuk saat pakar menilai murni kesenjangan × permintaan. **Ini simulasi kelayakan, bukan kinerja pada pakar nyata.**

### Ekstraksi LLM luring vs leksikon (88 lowongan unik, tanpa anotasi emas)

Qwen3-8B (Apache-2.0) di Kaggle T4×2, 49 menit, 88/88 JSON valid. Gerbang verifikasi menolak **14 dari 498 sebutan (2,8%)** karena kutipannya tidak ada di teks lowongan; 475 lolos otomatis, 9 ke antrean tinjauan / kandidat baru.

| Ukuran | Nilai |
|---|---|
| Skill per lowongan | leksikon 11,0 · LLM 5,0 |
| Jaccard rata-rata per lowongan | 0,34 |
| Spearman frekuensi skill | 0,61 |
| Paling sepakat | Analisis Data, Elisitasi Kebutuhan, BPMN, Dokumentasi Kebutuhan, SQL |

Cek manual: LLM **melewatkan soft skill yang tertulis eksplisit** ("Strong communication skills"; 43 lowongan hanya ditangkap leksikon), sedangkan leksikon **salah tangkap** pada "Pelaporan & Dashboard BI" ("regulatory reporting", "prepare reports"). Belum ada yang jelas unggul, jadi **peta pasar aktif tetap leksikon**; hasil LLM tersimpan di cache dan bisa diaktifkan dengan `python -m pipeline.build_market --extractor llm` setelah F1 terhadap anotasi emas memutuskan. Perbandingan lengkap: `backend/data/models/extractor_comparison.json` dan halaman Admin → Anotasi & F1. Keluaran mentah model: `kaggle/results/`.

## Keterbatasan yang perlu jujur disampaikan

1. **Volume data**: 43 lowongan BA (target paper 500–1.000). Sumber yang patuh ToS hanya memuat lowongan aktif; volume akan naik lewat scraping bulanan.
2. **Tren belum bisa dihitung** (`trend_status: insufficient`): snapshot tunggal → T_s = 1. Butuh ≥ 15 lowongan per jendela 6 bulan; terisi otomatis seiring snapshot bulanan.
3. **Peta pasar aktif masih dari ekstraktor leksikon.** Ekstraksi LLM sudah dijalankan (Qwen3-8B luring, bukan Claude) dan dibandingkan, tetapi F1 keduanya belum bisa diukur tanpa anotasi emas. Jalur Claude belum dijalankan (belum ada API key).
4. **Pakar & anotasi masih kosong**: bobot model dari pakar tersimulasi; graf berstatus draf (belum divalidasi); belum ada 150 anotasi emas.
5. Pemetaan mata kuliah adalah draf tim berdasarkan nama mata kuliah umum, belum dari silabus rinci.
6. Asesmen diagnostik memakai akurasi terhaluskan, sehingga 0 benar dari 2 butir memberi p ≈ 0,2, sedikit di atas prior tanpa bukti (0,10). Perilaku ini dari desain model bukti dan belum diubah; tinjau prior/penghalusan saat kalibrasi dengan data nyata.

## Langkah berikutnya (urut prioritas)

### 1. Validasi (bagian terberat menurut paper; semua alat sudah ada di aplikasi)
- 2 anotator × 150 lowongan di **Admin → Anotasi & F1** → F1 leksikon vs LLM (target ≥ 0,75), lalu pilih ekstraktor aktif dan kalibrasi ambang 0,85/0,70.
- Rekrut 3 pakar (≥1 bukan validator graf) di **Panel Pakar**: validasi 50 sisi → Finalisasi, peringkat 45 skenario (~2 jam/pakar), lalu Latih model.
- Survei pendahuluan ±100 mahasiswa (aturan: < 1/3 kesulitan → tinjau ulang fokus).
- Uji pengguna terkontrol 2 × 20 mahasiswa (H1–H4, Mann-Whitney U).
- Bila ada `ANTHROPIC_API_KEY`: jalankan ekstraksi Claude dan bandingkan dengan Qwen3/leksikon (hapus dulu entri `|llm|` di `data/processed/extraction_cache.json` agar tidak memakai cache Qwen).

### 2. Data
- Aktifkan workflow **Scraping bulanan** di tab Actions GitHub (tiap tanggal 1; bisa dipicu manual), lalu jalankan `pipeline.build_market` (atau Admin → Jalankan sekarang) supaya tren 6-vs-6 bulan terisi.
- Lowongan baru perlu ekstraksi LLM ulang: `pipeline.llm_jobs export-postings` → kernel Kaggle → `import-postings` (lowongan yang sudah diekstrak tidak diulang karena cache per fingerprint).
- Tambah slug perusahaan Indonesia di `scrapers/ats.py`. Traveloka sudah dikeluarkan dari daftar Workday (tidak ada tenant; semua DC mengembalikan 422).
- Pertimbangkan sumber patuh ToS lain (pusat karier kampus dengan izin, kemitraan penyedia lowongan).

### 3. Teknis
- Hosting publik: image Docker siap (`docker compose up --build`). Pilihan gratis: backend Render/Railway (image ±2,3 GB karena torch CPU; butuh ≥2 GB RAM untuk model embedding), frontend Vercel dengan `PATHSYNC_API` diarahkan ke backend saat build.
- Pemetaan mata kuliah dari silabus rinci (butuh izin kampus); mapping KBJI/SKKNI untuk ekspansi peran.
- `pipeline.expert_study` mendaftarkan model "LTR v1" baru setiap dijalankan; pertimbangkan menimpa model simulasi lama agar daftar model tidak menumpuk.
