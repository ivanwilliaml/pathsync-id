# PathSync — Progres & Langkah Berikutnya

Terakhir diperbarui: 5 Oktober 2026. Acuan: paper semifinal ICC 2026 (Tim cupuu), Bagian III Metodologi.

## Ringkasan

Backend sudah berupa produk yang berjalan end-to-end di atas **data lowongan nyata**: scraping → ekstraksi skill dengan kutipan terverifikasi → peta permintaan → diagnosis kompetensi berbasis bukti → model peringkat titik hambat → jalur belajar + penjelasan + kontrafaktual → siklus adaptif dengan riwayat. Semua lewat REST API dan sudah diuji integrasi. **Yang belum: antarmuka web (Next.js).**

## Yang sudah selesai (dipetakan ke paper)

| Bagian paper | Status | Implementasi |
|---|---|---|
| III.C.1 Akuisisi data | ✅ | `scrapers/`: Karirhub Kemnaker (API publik portal pemerintah), Workable public search, Workday (BINUS dll.), Lever (GoTo, Amar Bank, ATI), SmartRecruiters (Qraved, FLOW, BukuWarung), Dataset Pasar Kerja Kemnaker 2022–2024, ESCO API v1.2 |
| Data terkumpul | ✅ | 94 lowongan berteks (ID+EN) → 17 duplikat dibuang (TF-IDF ≥ 0,90) → **43 lowongan BA + 29 DA** dalam jendela 12 bulan |
| III.A.1 Taksonomi | ✅ | 42 skill, 4 rumpun, alias ID/EN, pemetaan ESCO. v2 menambah "API & Integrasi Sistem" karena muncul sebagai kandidat skill baru dari ekstraksi (mekanisme ekspansi di paper) |
| III.A.1 Ekstraksi | ✅ | Ekstraktor LLM (Claude, structured output, terbatas taksonomi) + ekstraktor leksikon offline; **verifikasi kutipan** (kutipan wajib ada di teks asli) + **normalisasi embedding** multibahasa dengan ambang 0,85 / 0,70 → otomatis / antrean tinjauan / kandidat baru |
| III.A.1 Permintaan & tren | ✅ | Persamaan (1) bobot 0,5^(a/6), tren 6 vs 6 bulan, klip ±0,5, λ=0,5, interval Wilson, r_s ∈ [0,60; 0,85] dari status ESCO + frekuensi |
| III.A.2 Diagnosis bukti | ✅ | Transkrip (A=1, B=0,75, C=0,5 × kekuatan pemetaan; 63 mata kuliah 4 prodi + fallback embedding), sertifikat (36), rubrik proyek 4 tingkat dengan kutipan + sampel 20% untuk cek manusia, CV hanya klaim, penilaian diri tidak dihitung. Persamaan (2) bobot 0,2/0,25/0,3/0,5 + BKT persamaan (3). Keyakinan K_s, flag konfirmasi, jenis rekomendasi pelajari/buktikan |
| Asesmen | ✅ | Bank **210 butir** (42 skill × 5), diagnostik 20–30 butir dipilih adaptif, asesmen ulang per skill |
| III.A.3 Graf prasyarat | ✅ | DAG 50 sisi (sumber ESCO/tim + alasan), cek siklus, aturan validasi 2 dari 3 pakar via API |
| III.A.4 Model peringkat | ✅ | Fitur Tabel 3, skor persamaan (4), formula (5) sebagai kasus khusus, LTR berpasangan (logistic loss) diregularisasi ke bobot formula (5), λ dipilih inner-CV berkelompok |
| III.A.5 Jalur & penjelasan | ✅ | Top-3 + prasyarat belum dikuasai, urutan topologis, 4 pertanyaan (apa / mengapa berbasis data + kutipan lowongan / mengapa sekarang / berikutnya), kontribusi fitur, kontrafaktual "langkah tertahan", cakupan persamaan (6), 121 materi terbuka terverifikasi HTTP (11 berbahasa Indonesia, Dicoding) |
| III.A.6 Siklus adaptif | ✅ | 3 pemicu teruji: bukti baru, pembaruan pasar (snapshot baru / simulasi), ganti peran. Setiap perubahan jalur disimpan beserta alasannya |
| III.B Arsitektur | ✅ sebagian | Python + FastAPI + SQLAlchemy (SQLite default, siap PostgreSQL), embedding open-source multibahasa. **Next.js belum** |
| III.D Evaluasi | ✅ alat, ⏳ data nyata | Harness P/R/F1 vs anotasi, NDCG@5 / Kendall τ / top-3 vs 4 pembanding, CV berkelompok, bootstrap CI 95%, ablasi, uji adaptivitas, Kendall W |

### Uji kesetiaan ke paper
`tests/test_paper_fidelity.py` — 7/7 lulus, termasuk **reproduksi persis Tabel 4** (SQL 0,95 → 0,17; Analisis data naik ke #1 setelah asesmen ulang SQL).

### Hasil simulasi kelayakan (pakar tersimulasi, 15 skenario dasar × 3 = 45 skenario, 8 kandidat)

| Kondisi pakar | NDCG@5 model [CI95] | Formula (5) | Gap terbesar | Gap × D | Tanpa fitur graf |
|---|---|---|---|---|---|
| Titik hambat | **0,993** [0,987–0,997] | 0,987 | 0,715 | 0,755 | 0,738 |
| Gap × permintaan | **0,944** [0,906–0,974] | 0,786 | 0,883 | 0,955 | 0,956 |
| Campuran | 0,949 [0,923–0,971] | 0,956 | 0,763 | 0,810 | 0,805 |

Ablasi menunjukkan fitur graf memberi perbaikan besar saat pakar menilai berdasarkan titik hambat (0,738 → 0,993). Selisih hasil 8 vs 30 skenario dasar ≤ ~0,03. Model aktif: "LTR v1 (simulasi)" — lolos aturan *minimal setara formula (5)* dengan margin 0,01. **Ini simulasi kelayakan, bukan kinerja pada pakar nyata.**

## Keterbatasan yang perlu jujur disampaikan

1. **Volume data**: 43 lowongan BA (target paper 500–1.000). Sumber yang patuh ToS hanya memuat lowongan aktif; volume akan naik lewat scraping bulanan.
2. **Tren belum bisa dihitung** (`trend_status: insufficient`): snapshot tunggal → T_s = 1. Butuh ≥ 15 lowongan per jendela 6 bulan; terisi otomatis seiring snapshot bulanan.
3. **Ekstraksi saat ini memakai ekstraktor leksikon** (belum ada API key). Jalur LLM sudah diimplementasikan tapi belum dijalankan dan belum diukur F1-nya.
4. **Pakar & anotasi masih kosong**: bobot model dari pakar tersimulasi; graf berstatus draf (belum divalidasi); belum ada 150 anotasi emas.
5. Pemetaan mata kuliah adalah draf tim berdasarkan nama mata kuliah umum, belum dari silabus rinci.

## Langkah berikutnya (urut prioritas)

### 1. Frontend Next.js (prioritas utama, belum mulai)
- `npm install` gagal karena registry npm mengembalikan 404 untuk tarball `baseline-browser-mapping@2.11.27` (dependensi transitif Next 16). Coba lagi nanti, atau pin versi lama: `npm install baseline-browser-mapping@2.11.26 --save-dev`, atau pakai `next@16.2.x`.
- Halaman yang perlu dibuat (semua endpoint sudah ada di `api/main.py`, lihat `/docs`):
  - Onboarding + persetujuan → `POST /api/students`
  - Profil awal: transkrip (`/transcript/parse` → `/evidence/academic`), CV, sertifikat, proyek, kuesioner (`PATCH` preferensi & self-rating)
  - Asesmen diagnostik & asesmen ulang (`/assessment/*`)
  - Dasbor: cakupan, prioritas + kartu 4 pertanyaan, kontrafaktual, jalur + materi, tombol "Buktikan kemajuan" (`/dashboard`) — lihat Gambar 7 paper
  - Graf prasyarat dengan sorotan titik hambat (`/students/{id}/graph`)
  - Peta pasar + kutipan lowongan (`/market/{role}`, `/market/{role}/skill/{id}`)
  - Riwayat jalur (`/history`)
  - Panel Pakar: validasi sisi, peringkat skenario, Kendall W, latih model (`/expert/*`)
  - Admin: statistik, refresh pasar, simulasi pasar, antrean tinjauan, anotasi + F1 (`/admin/*`, `/annotation/*`)
- Proxy `/api/*` ke backend sudah diatur di `next.config.mjs`.

### 2. Data
- Jadwalkan scraping bulanan (`scrapers.karirhub`, `scrapers.ats`, lalu `pipeline.build_market`) supaya tren 6-vs-6 bulan terisi.
- Tambah slug perusahaan Indonesia di `scrapers/ats.py` (cari via web: `jobs.lever.co Jakarta`, `myworkdayjobs.com Indonesia`, dst.). Perbaiki format site Workday Traveloka (saat ini 422).
- Pertimbangkan sumber patuh ToS lain (pusat karier kampus dengan izin, kemitraan penyedia lowongan).

### 3. Validasi (bagian terberat menurut paper)
- Isi `ANTHROPIC_API_KEY`, jalankan `python -m pipeline.build_market --extractor llm`, bandingkan dengan leksikon.
- 2 anotator × 150 lowongan lewat endpoint `/annotation` → hitung F1 (target ≥ 0,75); kalibrasi ambang 0,85/0,70.
- Rekrut 3 pakar (≥1 bukan validator graf): validasi 50 sisi (`/expert/edges` → `finalize`), ranking 45 skenario (~2 jam/pakar), lalu `POST /api/expert/train`.
- Survei pendahuluan ±100 mahasiswa (aturan: < 1/3 kesulitan → tinjau ulang fokus).
- Uji pengguna terkontrol 2 × 20 mahasiswa (H1–H4, Mann-Whitney U).

### 4. Teknis
- Deploy: docker-compose PostgreSQL + pgvector, hosting gratis (backend Render/Railway, frontend Vercel).
- Pemetaan mata kuliah dari silabus rinci (butuh izin kampus); mapping KBJI/SKKNI untuk ekspansi peran.
- Tambah uji API otomatis (`fastapi.testclient`) ke `tests/`.
