# Review Final PathSync (16 Okt 2026)

Review independen atas `main` (commit `e8e202c`) terhadap proposal semifinal *PathSync* dan `docs/PLAN_PERBAIKAN.md`. Perbaikan yang dikerjakan selama review ada di branch lokal `review/final-improvements` (7 commit, belum di-push). Semua angka di dokumen ini diukur di mesin lokal. Bila suatu angka berupa estimasi, keterangannya ditulis.

---

## 1. Ringkasan

1. **Produknya matang untuk ukuran lomba.** 16 halaman, sekitar 90 route API, 79 tes lulus, CI, dan Docker. Alur inti (daftar, bukti, Quick Check, rute, siklus adaptif) berjalan end-to-end di browser. Engineering-nya di atas rata-rata: token di-hash, CSRF, rate limit, audit log, migrasi Alembic, dan model card yang jujur.
2. **Kelemahan terbesar ada di bukti validasi, bukan di kode.** Bagian ini juga yang mendapat nilai terendah dari juri semifinal (Metodologi 78–88). Saat ini belum ada anotator manusia kedua, belum ada pakar nyata, dan belum ada uji pengguna. Ranker dilatih dari "pakar simulasi" yang memakai bentuk rumus yang sama dengan ranker, sehingga NDCG 0,95–0,98 sebagian besar sirkular.
3. **Ada beberapa angka yang berisiko ditanyakan juri.** Presisi ekstraksi blind 0,828 lolos target 0,80 sebagai titik, tetapi **batas bawah selang 95%-nya 0,749**. Pemetaan embedding "otomatis" untuk frasa bebas, menurut pre-label AI pada 72 sampel, hanya **sekitar 54% benar** (target plan ≥ 0,95).
4. **Cakupan produk menyimpang dari proposal.** Proposal: satu peran (Business Analyst), 500–1.000 lowongan, LLM sebagai ekstraktor, PostgreSQL + pgvector. Produk: 14 peran, BA 50 lowongan, ekstraktor aktif berbasis leksikon, dan tidak ada query pgvector. Sebagian penyimpangan ini disengaja dan masuk akal, tetapi harus dinarasikan dengan sadar di presentasi final.
5. **Leverage terbesar untuk final:** sprint validasi manusia selama 2–3 hari (anotasi 2 orang + kappa, minimal 3 pakar, pilot 10–20 mahasiswa), ditambah demo yang mulus. Demo sekali klik sudah ditambahkan malam ini.

---

## 2. Kondisi saat ini

**Yang berjalan (diverifikasi di browser, build produksi):**

- **Landing:** hero, 14 kartu karier, "How it works".
- **Pendaftaran:** tanpa email; kunci akses ditampilkan sekali; persetujuan UU PDP dan persetujuan riset terpisah.
- **Quick Check:** 24 soal, satu soal per layar, pintasan keyboard 1–4 + Enter, dan penjaga waktu minimum. Hasilnya langsung menggeser rute.
- **Dashboard:** langkah berikutnya, readiness, rute 3 langkah, prioritas dengan kutipan lowongan, tab "Why This Order" / "How We Ranked", dan panel 4 pertanyaan.
- **Halaman lain:** Skill Map, Path History, Job Market, How the AI Works (model card), Classroom, Advisor, Experts, dan Admin.

**Ukuran saat ini (lihat `backend/data/models/metrics.json`, `python -m pipeline.report`):**

| Hal | Nilai |
|---|---|
| Lowongan dalam jendela | 563 (14 peran); BA 50 |
| Taksonomi / graf | 114 skill / 137 sisi (semua berstatus *draft*, 0 tervalidasi pakar) |
| Ekstraksi, set blind (26 lowongan, 1 anotator) | P 0,828 [0,749–0,886] · R 0,889 [0,816–0,935] · F1 0,857 [0,777–0,918] |
| Ranker aktif | LTR v1 dari pakar simulasi; NDCG@5 CV 0,955 vs formula (5) 0,959 |
| Pakar nyata / anotator di aplikasi | 0 / 0 |
| Bank soal | 570 butir; akurasi classifier pola jawaban 0,37 (acak 0,25, p95 acak 0,295) |
| Tes backend | 79 lulus (SQLite) · 72 lulus di PostgreSQL 16 (sebelum 7 tes baru ditambahkan) |

---

## 3. Review software engineering

### 3.1 Yang sudah baik

- Pemisahan lapisan rapi: `pathsync/` berisi logika domain murni, `api/routers/` tipis, dan `pipeline/` untuk batch. Setiap persamaan di paper punya fungsinya sendiri dan teruji (`test_paper_fidelity.py` mereproduksi Tabel 4).
- Keamanan dipikirkan sejak awal: token siswa dan staf disimpan sebagai hash, cookie staf HttpOnly + SameSite=Strict + CSRF header, rate limit yang tidak bisa dipalsukan lewat X-Forwarded-For, upload dibatasi tipe dan ukuran, kunci jawaban tidak dikirim ke klien, dan ada anti-replay sesi asesmen.
- Kejujuran produk: label Beta, model card yang menyebut apa yang **tidak** dikerjakan LLM, dan dokumen audit yang menulis status apa adanya.

### 3.2 Masalah yang ditemukan dan **sudah diperbaiki** malam ini

| # | Temuan | Dampak | Perbaikan (commit) |
|---|---|---|---|
| 1 | Cold start: 200 siswa × 40 konkurensi tepat setelah server hidup membuat upload pertama butuh **126 detik**, lalu `QueuePool limit reached` | Demo atau peluncuran pertama bisa macet total | `once()` thread-safe untuk model dan indeks embedding, pool DB disesuaikan dengan threadpool, `PATHSYNC_WARMUP=sync` di compose, dan `/api/health/ready` (b96a80e). Hasil: maks 10 dtk, 0 galat |
| 2 | starlette 0.52.1 punya 5 advisory (pip-audit) | Kerentanan yang diketahui di produksi | fastapi 0.143.2 + starlette 1.8.0, `pip-audit` di CI (43255de) |
| 3 | Halaman Privacy menjanjikan "profil tidak aktif >24 bulan dihapus", tetapi kodenya tidak ada. Hapus profil juga tidak menghapus `product_events` | Janji UU PDP tidak ditepati | `pathsync/retention.py` dengan konstanta yang dikutip halaman Privacy, job harian, dan hapus profil yang ikut menghapus event (43255de, 917943a) |
| 4 | PDF 5 MB bisa berisi ribuan halaman; .docx bisa menjadi zip bomb; PDF rusak menghasilkan 500 | DoS ringan dan pesan galat yang buruk | Batas 40 halaman dan 40 MB setelah unzip; berkas rusak menghasilkan 422 dengan pesan yang jelas (43255de) |
| 5 | CI hanya memakai SQLite, padahal produksi PostgreSQL | Bug dialek baru muncul di produksi | Job CI PostgreSQL 16 + tes drift model-vs-migrasi; seluruh suite lulus di PG lokal (43255de) |
| 6 | `conftest.py` menyalin `pathsync.db` tanpa file `-wal`, sehingga database salinan bisa *malformed* | Tes flaky | Memakai SQLite backup API (b96a80e) |
| 7 | Dashboard pengguna baru menampilkan "Role Readiness 14%" di sebelah tulisan "everyone starts from zero" (angka prior, bukan bukti) | Bertentangan dengan prinsip "proof over claims" dan mudah ditangkap juri | Ring menampilkan "–" / "Not measured yet" sampai ada bukti (f69efa9) |
| 8 | "Skills by Area" untuk BA menampilkan 14 area, termasuk Mobile, Cybersecurity, dan Marketing (0%). UI/UX tampil 14% tanpa pernah diuji | Noise, terlihat seperti bug | Hanya area yang diminta lowongan peran itu (BA: 6 area), plus label "Not measured" (f69efa9) |
| 9 | Judul tab berbahasa Indonesia sementara UI berbahasa Inggris, dan sama di semua halaman | Kesan kurang rapi | Judul per halaman dalam bahasa Inggris; halaman staf `noindex` (f69efa9) |
| 10 | Konstanta BKT di model card di-hardcode, terpisah dari `config.py` | Angka bisa tidak sinkron | Diambil dari config; model card membaca `metrics.json` (04ebcb1) |
| 11 | `.dockerignore` backend tidak mengecualikan `.venv/` | Build context ratusan MB | Ditambahkan |

### 3.3 Masalah yang **belum** diperbaiki (perlu keputusan tim atau data manusia)

- **Normalisasi embedding terlalu longgar.** Guard `lexical_support` menganggap "berbagi satu kata" sebagai dukungan penuh, termasuk kata generik (*data, media, bisnis, security, bidang, proses*). Contoh yang lolos otomatis: "bisnis komersial" → `business_process_modeling`, "Data Science" → `data_warehousing`, "Perbankan" → `budgeting_forecasting`. Pemetaan seperti ini menyumbang 2–11% pasangan (lowongan, skill) di peta permintaan (BA 7,9%, Cybersecurity 10,7%). Aku **tidak** mengubah ambang tanpa label manusia, sesuai aturan plan 0.1. Lembar label sudah siap di `data/seed/normalisation_to_label.json` (300 frasa, 3 pita); skor dihitung dengan `python -m pipeline.normalisation_eval score <file>`. Usulan perbaikan setelah ada label: abaikan kata generik dalam pengecekan "berbagi kata", atau naikkan ambang khusus untuk frasa satu kata.
- **Latensi di bawah beban (PostgreSQL, 4 worker, Windows + Docker):** signup p95 0,51 dtk, dashboard 0,39 dtk, transcript **1,19 dtk** (target plan < 1 dtk). Sekitar 28 query per request; di Linux angkanya diperkirakan lebih rendah, tetapi belum diukur.
- **C1 deploy dari nol belum terverifikasi.** Build image torch memenuhi drive C: (lihat bagian 7).
- **Keputusan pgvector (B2) belum diambil**, lihat bagian 4.
- Dev server (`npm run dev`, Turbopack) mengembalikan 404 untuk semua route selain `/` di path Windows yang mengandung spasi dan titik ("3. Final"). Build produksi normal. Untuk dev lokal di mesin ini, pakai `npm run build && npm start`, atau pindahkan repo ke path tanpa spasi.

---

## 4. Keselarasan dengan proposal

| Klaim proposal | Status di produk | Risiko di final | Saran |
|---|---|---|---|
| Fokus satu peran: *Business Analyst* (III.A) | 14 peran; BA salah satu kartu | Juri bisa melihatnya sebagai *scope creep*, dengan data tipis (UI/UX 6 lowongan) | Presentasikan BA sebagai **peran yang divalidasi**, peran lain sebagai Beta "mesin yang sama, data menyusul". Pertimbangkan menampilkan BA paling atas di landing |
| 500–1.000 lowongan BA (Tabel 5) | 50 lowongan BA dalam jendela | Juri tahu angka di proposal | Sebutkan dengan jujur + jalankan scraper sebelum final; tampilkan tren pertumbuhan snapshot |
| Ekstraksi dengan LLM + verifikasi kutipan (III.A.1) | Peta pasar aktif memakai **leksikon**; Qwen3-8B dijalankan luring; Claude belum pernah | "Mana LLM-nya?" | Narasi: LLM dijalankan dan **dibandingkan**; leksikon dipilih karena biaya, determinisme, dan F1. Sertakan tabel tiga ekstraktor (plan A2) |
| PostgreSQL + **pgvector** (Gambar 8) | Tidak ada query vektor; embedding di memori + cache SQLite | Pertanyaan teknis yang tidak bisa dijawab dengan kode | Pilih salah satu sebelum final: (a) ubah narasi menjadi "embedding di memori, PostgreSQL relasional" (rekomendasi plan, ±0,5 hari), atau (b) pindahkan `SkillIndex.nearest` ke pgvector supaya sesuai gambar arsitektur |
| Graf prasyarat divalidasi 3 pakar (III.A.3) | 137 sisi, **semuanya draft** | Klaim inti "titik hambat" belum tervalidasi | Minimal validasi sisi-sisi BA (~50) oleh 2–3 dosen lewat halaman Experts (±1 jam per orang) |
| Peringkat rujukan dari 3 pakar, NDCG@5 vs 4 pembanding (III.D) | Pakar simulasi (rumus log-linear yang sama dengan ranker + noise) | NDCG 0,98 sirkular; pembanding LLM generik kalah "di lapangan sendiri" | Sebut terang-terangan sebagai uji kelayakan. Satu panel pakar nyata, sekecil apa pun, jauh lebih meyakinkan |
| Survei 100 mahasiswa + RCT 2×20 (III.D) | Belum ada data | Semua klaim dampak masih hipotesis | Pilot 10–20 mahasiswa dengan instrumen yang sudah ada di aplikasi (studi 4 lengan) |
| Bobot bukti 0,2/0,25/0,3/0,5, BKT, formula (5), cakupan (6), siklus adaptif, Gambar 7 | **Sesuai** dan teruji | — | Ini kekuatan utama, tunjukkan langsung di demo |
| Arsitektur Next.js + FastAPI (Gambar 8) | Sesuai | — | — |
| Sasaran: mahasiswa Indonesia (Manajemen, Akuntansi, dst.) | UI 100% bahasa Inggris | Hambatan bagi sasaran utama dan bisa memengaruhi H1 (kejelasan arah) | Pertimbangkan pilihan bahasa Indonesia, lihat bagian 5 |

---

## 5. Improvement yang paling berdampak (urut prioritas)

1. **Sprint validasi manusia (2–3 hari, tanpa kode baru).** Semua alatnya sudah ada di aplikasi.
   - 2 orang menganotasi 50 lowongan lewat Admin → Annotation. Hasilnya kappa + P/R dengan selang kepercayaan (`eval_extractor` sekarang mencetak selangnya).
   - 2 orang melabeli `normalisation_to_label.json` (300 frasa, sekitar 1 jam per orang). Hasilnya kurva ambang.
   - 2–3 dosen memvalidasi graf BA dan memeringkat 15 skenario.
   - Pilot 10–20 mahasiswa.

   Dengan ini, pertanyaan juri "mana buktinya?" berubah dari kelemahan menjadi keunggulan.
2. **Demo final yang tidak bisa gagal.** Profil demo sekali klik sudah ada (`/` → "look around first with a demo student profile"). Siapkan juga *deploy* publik (VPS kecil + `docker compose up`) dan rekam video cadangan.
3. **Pilihan bahasa Indonesia** untuk halaman mahasiswa (landing, dashboard, Quick Check). Data seed sudah menyimpan teks Indonesia (`name_id`, `items/`); yang perlu diterjemahkan terutama string UI. Dampaknya besar untuk sasaran proposal dan sangat terlihat oleh juri. Usaha sekitar 2–3 hari.
4. **Perketat normalisasi** setelah label A3 ada (lihat 3.3). Ini perbaikan kualitas data pasar yang bisa diukur.
5. **Putuskan pgvector** (bagian 4) supaya proposal dan kode menyatakan hal yang sama.
6. **Narasi "kenapa 14 peran"**: satu slide yang menunjukkan bahwa mesinnya generik dan BA divalidasi, sementara peran lain menunggu data. Ini mengubah penyimpangan cakupan menjadi bukti skalabilitas.

---

## 6. Yang dikerjakan malam ini (branch `review/final-improvements`)

| Commit | Isi |
|---|---|
| 43255de | B1 CI PostgreSQL + tes drift migrasi · B3 retensi + penghapusan profil tidak aktif · C3 pip-audit, starlette patched, batas PDF/DOCX, header Caddy (CSP, Permissions-Policy, batas body) · C4 `/api/health/ready` |
| 04ebcb1 | A1.6 selang Wilson + bootstrap F1 + rincian per klaster di `eval_extractor` · D2 `pipeline.report` → `metrics.json` |
| b96a80e | Performa cold start (126 dtk → maks 10 dtk, 0 galat) · salinan DB tes yang benar |
| f69efa9 | UX: readiness "Not measured", area relevan saja, hasil Quick Check dalam persen, grid karier, judul halaman |
| bdaf774 | B5 provenance snapshot (migrasi 0005) · A3 alat evaluasi normalisasi + lembar label |
| 917943a | Fitur profil demo + job retensi harian |

Verifikasi: 79/79 tes backend (SQLite), suite lulus di PostgreSQL 16 lokal sebelum tes demo/provenance ditambahkan, `tsc` dan `next build` bersih, `ruff` bersih, pip-audit dan npm audit tanpa temuan, Caddyfile valid (`caddy validate`). Alur landing → demo → dashboard dan Quick Check diuji di browser pada build produksi.

**Belum dilakukan:** push ke GitHub, deploy dari nol via `docker compose` (C1), dan latihan pemulihan backup.

---

## 7. Catatan operasional untuk pagi ini

- **Drive C: sempat penuh (0 GB)** karena build image Docker (torch) memperbesar `docker_data.vhdx` menjadi 14,7 GB. Build sudah dihentikan, dan sisa tes serta model embedding (0,45 GB) sudah dipindah ke `D:\hf-cache`. Saat ini C: punya sekitar 0,7 GB kosong. **Docker Engine tidak merespons.** Aku sengaja tidak me-restart Docker Desktop karena container `banguninajaapp` milikmu sedang berjalan.
- Langkah yang disarankan, setelah memastikan proyek lain aman:
  1. Restart Docker Desktop.
  2. `docker compose -p pathsync-c1 down -v`
  3. `docker rm -f ps-pg` (PostgreSQL uji)
  4. `docker builder prune -f`
  5. Bila VHDX tidak menyusut, gunakan Docker Desktop → Troubleshoot → "Clean / Purge data", atau compact VHDX.
- `.env` lokal dengan secret acak dibuat di root repo untuk uji compose. File ini di-ignore git; hapus bila tidak dipakai.
- Backend lokal membaca model dari `D:\hf-cache` (set `HF_HOME=D:/hf-cache`).
