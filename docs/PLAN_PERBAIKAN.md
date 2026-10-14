# Rencana Perbaikan PathSync (versi rinci)

Dibuat 14 Okt 2026 dari kode di `main`. Setiap klaim "sudah" dicek ke kode atau ke berkas hasil ukur. Setiap klaim "belum" adalah celah yang terbukti dari kode. Perkiraan usaha adalah perkiraan kasar dalam hari-orang, bukan janji.

**Tentang "100% tepat".** Tidak ada sistem AI yang bisa dijamin 100% benar. Yang bisa dijamin: tiap klaim punya angka ukur, set uji yang tidak dipakai menyetel, selang kepercayaan, dan perintah yang bisa dijalankan ulang oleh orang lain. Tiap tugas di bawah punya bagian "Selesai kalau" yang bisa dicek mesin atau manusia.

---

## 0. Aturan kerja (berlaku untuk semua tugas)

1. **Pisahkan set tuning dan set uji.** Alias, ambang, dan prompt hanya boleh disetel di set dev. Angka yang dilaporkan hanya dari set uji yang belum pernah dilihat. Set yang sudah dipakai menyetel diberi label "dev" dan tidak boleh dikutip sebagai kinerja.
2. **Tulis aturan keputusan sebelum menjalankan eksperimen.** Contoh: "pilih ekstraktor dengan F1 tertinggi di set uji, asal presisi ≥ 0,80". Jangan memilih setelah melihat hasil.
3. **Laporkan selang kepercayaan.** Presisi dan recall dilaporkan dengan selang Wilson 95%, bukan angka tunggal. Dengan 26 posting selangnya lebar, dan ini harus kelihatan.
4. **Satu sumber angka.** Semua metrik ditulis ke satu berkas oleh satu perintah (tugas D2). Dokumen dan model card hanya mengutip berkas itu.
5. **Setiap perubahan taksonomi atau alias menjalankan ulang** `pipeline.eval_extractor`, `pipeline.item_cue_audit`, dan `pytest`. Perubahan yang menurunkan angka tanpa alasan tertulis ditolak.
6. **Label Beta tetap tampil** untuk komponen yang belum divalidasi, sampai kriteria di bagian 4 terpenuhi.

---

## 1. Status hari ini (terverifikasi)

| Area | Sudah | Belum |
|---|---|---|
| Ekstraksi skill | Presisi 0,828, recall 0,889, F1 0,857 di 26 posting buta (`gold_blind.json`). Tes menjaga ≥ 0,80. Penjaga `lexical_support`, gerbang kutipan verbatim, gerbang embedding 0,85 / 0,70 | Gold hanya 76 posting, satu anotator (Claude). Ekstraktor yang diukur adalah lexicon + embedding. Hasil LLM luring (`kaggle/results/*.json`) berasal dari 88 posting dan taksonomi lama, jadi kedaluwarsa. Tidak ada selang kepercayaan |
| Normalisasi | Embedding multibahasa, cache lokal, tiga status (auto / review / new) | Ambang 0,85 dan 0,70 dipilih tanpa kurva. Kemurnian klaster dan kesepakatan manusia (dijanjikan Bab III.D) belum diukur |
| Asesmen | Opsi diacak per sesi, anti-replay, batas waktu minimum, `choice_canon` disimpan, endpoint item-analysis, koreksi tebakan per soal. Akurasi classifier pola jawaban 0,37 (acak 0,25, p95 tebakan acak 0,295) | Kesulitan soal ditulis penulis. Konstanta BKT tetap (`BKT_SLIP` 0,10, `BKT_GUESS` 0,25, `BKT_TRANSIT` 0,10 di `config.py`). Pemilihan soal berdasarkan urutan kesulitan. Lima soal per skill membatasi reliabilitas. 440 soal baru (`items/x_*.json`) berbahasa Inggris di dua sisi |
| Ranker | Formula 5 dan LTR berjalan, setiap bobot bisa dijelaskan | NDCG@5 0,975 (CV) vs formula 0,975 (model 0,9747, formula 0,9749). Dilatih dari ahli simulasi, skenario berbasis BA. Panel ahli nyata 0. Baseline LLM: `evaluation_report.json` menulis "tidak dijalankan" |
| Peta pasar | 14 role, 1.093 baris posting (termasuk duplikat) dari 460 perusahaan | Role dengan data tipis: UI/UX 7, frontend 18, data engineer 18, data scientist 19. ESCO hanya untuk BA dan DA |
| Database | Alembic 0001-0004, SQLite WAL, 38 indeks, load test 200 siswa tanpa galat, skrip `pg_dump` harian | pgvector tidak dipakai di kode (tidak ada query vektor). Tidak pernah dijalankan di PostgreSQL. Pemulihan cadangan belum pernah dilatih. Tidak ada retensi data lama |
| Backend | Sesi staf HttpOnly + CSRF, audit log, rate limit (Redis opsional), token terhash, `npm audit` di CI, 68 tes | CI hanya SQLite, tanpa PostgreSQL dan Redis. Tidak ada `pip-audit`. Deploy produksi belum diuji |
| Alat yang sudah ada dan belum dipakai penuh | Alat anotasi dengan kappa (`/api/admin/annotation/*`), Panel Pakar, studi 4 lengan (`pathsync/study.py`), kalibrasi bobot bukti (`pipeline.calibrate_weights`, butuh ≥ 30 pasangan), jalur LLM luring (`pipeline.llm_jobs` + `kaggle/pathsync_llm.py`) | Belum ada data manusia di dalamnya |

---

## 2. Peta ketergantungan dan urutan

```
A1 anotasi manusia ──► A2 LLM vs lexicon ──► keputusan ekstraktor ──► A9 ekspansi role bisnis
        │                       │
        └──► A3 normalisasi ────┘
B1 CI PostgreSQL ──► B3 cadangan/retensi ──► C1 deploy ──► D1 uji pengguna ──► A5 kalibrasi asesmen ──► A4 panel ahli
B2 putusan pgvector (independen, murah, kerjakan paling awal)
```

| Minggu | Tugas | Keluaran |
|---|---|---|
| 1 | B2, B1, A1 (panduan + mulai anotasi), A2 (ekspor + jalankan di Kaggle), D2 (kerangka laporan) | Putusan pgvector, CI dua DB, 100 posting terbagi dua anotator, keluaran LLM mentah |
| 2 | A1 selesai, A2 evaluasi, A3, C1, B3, D3 | Gold konsensus + kappa, tabel tiga ekstraktor, kurva ambang, deploy sukses dua kali |
| 3 | D1 (pilot), A5 (kumpul jawaban), C2, C3 | Data jawaban nyata, uji Redis multi-worker, audit keamanan |
| 4 | A6, A7, A8, B4, C4, A5 (analisis) | Soal diperbaiki dan diterjemahkan, role tipis diisi, indeks dan metrik |
| Setelah | A4, A9, C5, B5 | Panel ahli, role bisnis, cakupan tes, versi snapshot |

---

## 3. Tugas rinci

### A. AI (utama)

#### A1. Anotasi manusia kedua, kappa, dan gold konsensus (P0, ±6 hari-orang)

**Masalah.** Semua gold dianotasi satu orang (saya). Presisi 0,828 tidak bisa dipakai pembaca luar sebagai bukti, dan konvensi anotasi memengaruhi hasil (contoh: "REST API integration" bisa dihitung sebagai `rest_api_design`, `api_integration`, atau keduanya; "Python" bisa jatuh ke tiga skill).

**Langkah.**
1. Tulis panduan anotasi satu halaman: yang dihitung (syarat atau tugas yang eksplisit, termasuk daftar "X, Y, atau sejenis"), yang tidak dihitung (bidang gelar, nama tim, nama perusahaan, domain bisnis), aturan untuk skill yang tumpang tindih (REST vs integrasi API, Python generik vs analitik vs backend, SIEM vs incident response), dan aturan nilai tambah ("diutamakan" dihitung).
2. Ambil 100 posting dari baris yang belum dipakai untuk menyetel apa pun: sampel acak berstrata menurut 14 role (minimal 5 per role, 10 untuk role besar). Bagi dua: 50 dev, 50 uji. Kunci pembagian dengan menyimpan daftar id di `data/seed/gold_split.json`.
3. Dua anotator manusia melabeli secara independen di Admin > Annotation (`GET /api/admin/annotation/next?annotator=...`, `POST /api/admin/annotation`). Anotator tidak melihat keluaran ekstraktor.
4. Hitung Cohen kappa per pasangan (posting, skill) lewat `GET /api/admin/annotation/eval`, dan per skill untuk 20 skill terbanyak.
5. Perselisihan diselesaikan oleh penilai ketiga atau diskusi, hasilnya ditulis ke `data/seed/gold_consensus.json` (format sama dengan `gold_blind.json`, dengan `max_chars` dihapus karena anotator membaca seluruh teks).
6. Ubah `pipeline/eval_extractor.py` agar: (a) menerima berkas gold dan pembagian, (b) mencetak selang Wilson 95% untuk presisi dan recall, (c) mencetak P/R per role dan per klaster.
7. Setel alias hanya di paruh dev. Bekukan, lalu ukur sekali di paruh uji.

**Selesai kalau.**
- Kappa antar-anotator ≥ 0,70 (kalau lebih rendah, panduan diperbaiki dan sebagian posting dilabeli ulang).
- Presisi dan recall di paruh uji ≥ 0,80, dengan batas bawah selang tercantum di laporan.
- `gold_consensus.json`, `gold_split.json`, dan panduan anotasi ada di repo, dan tes `test_extractor_meets_precision_target_on_blind_gold` diarahkan ke paruh uji konsensus.

**Risiko.** Kappa rendah pada skill yang tumpang tindih. Mitigasi: gabungkan atau perjelas skill itu di taksonomi (hasil kappa per skill menjadi masukan taksonomi v4).

#### A2. Jalankan LLM dan bandingkan dengan lexicon (P0, ±5 hari-orang)

**Masalah.** Bab II-III memilih LLM, sedangkan yang berjalan dan diukur adalah lexicon. Keluaran LLM yang ada (`kaggle/results/llm_results_postings.json`) memakai taksonomi lama dan 88 posting, sehingga `extractor_comparison.json` (Jaccard 0,34) tidak berlaku untuk taksonomi v3. Jalur luring sudah ada (`pipeline/llm_jobs.py`), jadi tidak butuh kunci API.

**Langkah.**
1. Tulis aturan keputusan di dokumen ini sebelum eksperimen: pilih ekstraktor dengan F1 tertinggi di paruh uji dengan syarat presisi ≥ 0,80. Jika selisih F1 < 0,02, pilih yang lebih murah dan lebih deterministik (lexicon).
2. Ubah `export-postings` agar hanya mengekspor posting di `gold_consensus.json` ditambah 300 posting acak (untuk uji kestabilan), dengan taksonomi v3 dan prompt yang sama dengan jalur Claude.
3. Jalankan `kaggle/pathsync_llm.py` di notebook GPU (Qwen3-8B, T4 x2). Simpan keluaran mentah dan versi model, suhu, dan seed.
4. `python -m pipeline.llm_jobs import-postings <file>`. Keluaran melewati gerbang yang sama (kutipan harus verbatim, normalisasi embedding).
5. Tambah mode "hanya cache" di `eval_extractor` (`--extractor llm`) supaya evaluasi tidak memanggil API.
6. Laporkan di paruh uji: lexicon, LLM, gabungan (gabungan = selisih/irisan, keduanya dicoba). Sertakan ongkos dan waktu per posting.
7. Jika ada kunci API, jalankan sekali dengan Claude sebagai batas atas, dan catat model dan tanggalnya.
8. Perbarui Bab II.A sesuai hasil. Jika lexicon menang atau seri, teks "LLM dipilih karena…" diganti dengan alasan yang benar (kontrol, biaya, dan determinisme), dan LLM disebut sebagai pembaca CV dan pembanding.

**Selesai kalau.** Ada tabel tiga ekstraktor dengan selang kepercayaan di set uji yang sama, aturan keputusan diterapkan apa adanya, dan `extractor_comparison.json` dibuat ulang dari taksonomi v3.

**Risiko.** Model 8B bisa kalah dari lexicon. Itu hasil sah, yang berubah adalah teks proposal, bukan hasilnya.

#### A3. Evaluasi normalisasi embedding (P0, ±3 hari-orang)

**Masalah.** `SIM_AUTO = 0.85` dan `SIM_REVIEW = 0.70` tidak punya dasar empiris. Bab III.D menjanjikan kemurnian klaster dan kesepakatan manusia.

**Langkah.**
1. Dari `posting_mentions` dengan status `review` dan `new` (dan sampel `auto` dari jalur pola), ambil 300 frasa: 100 per pita kemiripan (<0,70, 0,70-0,85, ≥0,85).
2. Dua orang melabeli: skill taksonomi yang benar atau "bukan skill / tidak ada di taksonomi".
3. Hitung: presisi pemetaan otomatis di tiap ambang, cakupan, dan akurasi penolakan frasa non-skill. Gambar kurva presisi-cakupan untuk ambang 0,60-0,95 dengan langkah 0,05.
4. Hitung kemurnian klaster seperti di Bab III.D: kelompokkan frasa menurut skill yang dituju, kemurnian = proporsi frasa yang label manusianya sama dengan mayoritas kelompok.
5. Pilih ambang dari kurva (aturan: presisi pita otomatis ≥ 0,95). Simpan frasa berlabel di `data/seed/normalisation_gold.json` dan tambah tes yang menjaga angka.

**Selesai kalau.** Ada kurva dan angka kemurnian di laporan, ambang yang dipakai dikutip dari kurva, dan tes regresi gagal jika presisi pita otomatis turun di bawah 0,95.

#### A4. Validasi ranker dengan ahli nyata (P0 untuk klaim, tetapi ditunda atas permintaan tim)

**Masalah.** Ranker dilatih dari ahli simulasi. Skenario dan bobot berasal dari domain BA lalu dipakai untuk 14 role.

**Langkah (saat dikerjakan).**
1. Rekrut minimal 3 penilai per keluarga role (praktisi atau dosen). Minta mereka mengurutkan 30 skenario per role lewat halaman Experts (`pipeline.expert_study` membuat skenario).
2. Aturan keputusan tertulis: model LTR dipakai hanya jika NDCG@5 leave-one-expert-out melampaui formula 5 sebesar ≥ 0,02 dengan selang bootstrap yang tidak mencakup nol. Jika tidak, formula 5 dipakai dan istilah "learning-to-rank" diturunkan di Bab III dan model card.
3. Jalankan baseline LLM generik di skenario yang sama (jalur `export-scenarios`, `import-scenarios`) supaya perbandingannya ada.
4. Latih per keluarga role, bukan satu model BA untuk semua, kecuali uji menunjukkan bobotnya tidak berbeda.

**Persiapan yang bisa dikerjakan sekarang.** Perluas generator skenario (`pathsync/scenarios.py`) agar menghasilkan skenario realistis untuk klaster baru (saat ini klaster tak dikenal memakai nilai dasar 0,35), dan jalankan `pipeline.expert_study` per role.

**Selesai kalau.** Ada laporan NDCG@5 dan precision@5 terhadap ahli nyata untuk setiap keluarga role, model aktif ditentukan oleh aturan di atas, dan teks Bab III sesuai.

#### A5. Kalibrasi asesmen dari jawaban nyata (P1, ±8 hari-orang, butuh pengguna)

**Masalah.** Kesulitan soal diisi penulis. BKT memakai konstanta tetap. Pemilihan soal berdasarkan urutan kesulitan. Lima soal per skill membatasi reliabilitas.

**Langkah.**
1. Pastikan data terkumpul: `assessment_responses` menyimpan `choice_canon`, waktu, dan sesi. Kumpulkan dari pilot (D1): target 30 jawaban per soal.
2. Per soal hitung: proporsi benar, korelasi titik-biserial terhadap skor skill tanpa soal itu, dan distribusi pilihan (distraktor yang dipilih < 5% dianggap tidak berfungsi). Endpoint `GET /api/admin/item-analysis` sudah ada, tambahkan korelasi titik-biserial dan tabel distraktor.
3. Aturan buang atau tulis ulang: proporsi benar di luar 0,20-0,90, atau korelasi < 0,15, atau distraktor mati.
4. Reliabilitas per skill: KR-20 dan koreksi Spearman-Brown. Bila 5 soal per skill menghasilkan KR-20 < 0,6, tambah soal hingga 8 pada 30 skill terbesar, dan beri keterangan jujur "hasil indikatif" pada skill lain.
5. Ganti kesulitan penulis dengan estimasi empiris (model Rasch sederhana atau regresi logistik), lalu ubah `next_items` agar memilih soal dengan informasi terbesar di sekitar perkiraan kemampuan.
6. Estimasi ulang `slip`, `guess`, dan `transit` BKT dari data (dengan prior sekarang sebagai nilai awal) dan laporkan perubahan galat prediksi pada jawaban berikutnya.
7. Jalankan `pipeline.calibrate_weights` setelah ada ≥ 30 pasangan (bukti tidak langsung sebelum re-asesmen vs akurasi re-asesmen), dan aktifkan bobot baru hanya jika galat held-out turun.

**Selesai kalau.** Ada laporan: korelasi kesulitan penulis vs empiris, daftar soal yang diganti, KR-20 per skill, dan perbandingan galat prediksi BKT sebelum dan sesudah.

#### A6. Turunkan pola jawaban yang tersisa (P1, ±3 hari-orang)

**Masalah.** Classifier pola jawaban 0,37 untuk seluruh bank, 0,25 acak, p95 acak 0,295.

**Langkah.**
1. Ambil 60 soal dengan `p_cue` tertinggi dari `data/models/item_cue_audit.json`.
2. Tulis ulang opsi (bukan batang soal) lewat `data/seed/_rewrite/*.json` dan `pipeline.apply_item_rewrite`, lalu `pipeline.balance_lengths` untuk menyeimbangkan panjang.
3. Jalankan `python -m pipeline.item_cue_audit` sampai akurasi turun.

**Selesai kalau.** Akurasi classifier ≤ 0,33 dan batas di `tests/test_item_bank.py` diperketat dari 0,42 ke 0,35.

#### A7. Soal berbahasa Indonesia (P1, ±4 hari-orang)

**Masalah.** `items/x_*.json` (440 soal) berbahasa Inggris dan `items_en/x_*.json` sama saja. Soal lama berbahasa Indonesia di `items/` dengan terjemahan Inggris di `items_en/`. Ini tidak konsisten dengan pilihan bahasa (`PATHSYNC_LANG`).

**Langkah.**
1. Terjemahkan stem, opsi, dan penjelasan 440 soal ke bahasa Indonesia dengan istilah teknis tetap (jangan menerjemahkan nama alat). Pertahankan urutan opsi (opsi benar tetap di posisi pertama pada berkas sumber).
2. Pindahkan: `items/x_*.json` menjadi Indonesia dan `items_en/x_*.json` menjadi overlay Inggris, sesuai pola di `item_bank()`.
3. Jalankan `balance_lengths` dan `item_cue_audit` untuk versi Indonesia (panjang kata berubah, jadi pola panjang bisa kembali).
4. Tambah tes: jumlah opsi sama di dua bahasa, id sama, dan pola jawaban Indonesia ≤ 0,35.

**Selesai kalau.** 570 soal punya dua bahasa, audit pola jawaban Indonesia ≤ 0,35, dan tes lulus untuk `PATHSYNC_LANG=en` dan `id`.

#### A8. Data role yang tipis dan ESCO (P1, ±5 hari-orang)

**Langkah.**
1. Jalankan scraper Karirhub, Kalibrr, dan ATS tambahan untuk role di bawah 50 posting (`python -m scrapers.karirhub`, dst.), lalu `pipeline.build_market`.
2. Perluas gold di role itu (bagian dari A1, minimal 5 posting per role).
3. Untuk role selain BA dan DA, petakan ESCO (`data/raw/esco_occupations.json`) atau tulis di halaman bahwa level yang dibutuhkan dihitung dari frekuensi posting.

**Selesai kalau.** Tidak ada role Beta karena data, atau badge tetap dengan alasan yang tertulis.

#### A9. Ekspansi role bisnis (P2, ±15 hari-orang)

Rencana sudah tertulis di `docs/ROADMAP.md` (6 role di Ekonomi, Manajemen, Akuntansi). Dikerjakan setelah A1-A3, supaya ekstraktor sudah tervalidasi dan alias bisnis (pajak, audit, payroll) diuji di gold bisnis. Soal pajak, audit, dan payroll perlu ditinjau ahli bidangnya.

---

### B. Database

#### B1. Uji penuh di PostgreSQL (P0, ±3 hari-orang)

**Masalah.** Migrasi dan seluruh tes hanya dijalankan di SQLite (`ci.yml` tidak punya service PostgreSQL), padahal `docker-compose.yml` memakai `pgvector/pgvector:pg16`. Tipe JSON, urutan hasil tanpa `ORDER BY`, dan perilaku transaksi bisa berbeda.

**Langkah.**
1. Tambahkan job di `.github/workflows/ci.yml` dengan `services: postgres` dan variabel `PATHSYNC_DATABASE_URL=postgresql+psycopg://...`.
2. Jalankan `alembic upgrade head` dari database kosong, lalu `alembic check` untuk memastikan model dan migrasi tidak berbeda.
3. Jalankan seluruh `pytest` di PostgreSQL. Perbaiki perbedaan yang muncul (kueri tanpa urutan, perbandingan tanggal, tipe boolean).
4. Jika ada pengguna di SQLite, tulis dan uji skrip pemindahan data SQLite ke PostgreSQL (belum ada skripnya).

**Selesai kalau.** CI hijau di dua database, `alembic check` bersih, dan satu langkah CI membuktikan `upgrade head` dari nol.

#### B2. Putusan pgvector (P0, ±0,5 hari-orang)

**Masalah.** Bab III.B menyebut PostgreSQL dengan ekstensi pencarian vektor. Di kode tidak ada query vektor: embedding dihitung di memori dan di-cache di `embedding_cache.sqlite`. Image `pgvector` di compose tidak memberi manfaat apa pun.

**Pilihan.**
- (a) Pakai pgvector untuk pencarian tetangga terdekat atas 114 skill dan alias. Biayanya: kolom vektor, indeks, migrasi, dan kode baru yang tidak mengubah hasil.
- (b) Ubah teks: "embedding multibahasa di memori dengan cache persisten, PostgreSQL untuk data relasional". Ganti image compose ke `postgres:16`.

**Rekomendasi: (b).** Untuk 114 skill, pencarian eksak di memori lebih cepat dan lebih sederhana, dan klaim pgvector akan memicu pertanyaan juri yang tidak bisa dijawab dengan kode.

**Selesai kalau.** Kode, compose, dan Bab III.B menyatakan hal yang sama.

#### B3. Cadangan, pemulihan, dan retensi (P1, ±3 hari-orang)

**Masalah.** `deploy/backup.sh` menulis dump harian dan mendokumentasikan perintah pemulihan, tetapi belum pernah dilatih. Tidak ada penghapusan data lama.

**Langkah.**
1. Latihan pemulihan: ambil dump, pulihkan ke database kosong, jalankan `alembic check` dan sejumlah kueri kontrol, ukur waktunya (RTO) dan umur data (RPO = 24 jam). Tulis di `docs/RUNBOOK.md`.
2. Fungsi retensi di `pathsync/` dan tugas terjadwal: hapus `product_events` lebih tua dari N hari, `assessment_sessions` kedaluwarsa, `api_tokens` kedaluwarsa, dan `audit_log` melewati masa retensi. Nilai N ditulis di halaman Privacy dan dipakai fungsinya (satu konstanta).
3. Tes: buat data lama, jalankan retensi, pastikan hanya data lewat batas yang terhapus dan data siswa aktif utuh.

**Selesai kalau.** Pemulihan berhasil dari dump nyata dengan RTO tercatat, dan tes retensi lulus.

#### B4. Indeks dan kueri berat (P1, ±2 hari-orang)

**Langkah.** Di PostgreSQL dengan data 10x lipat (buat dengan `deploy/loadtest.py` dan pembangkit posting sintetis), jalankan `EXPLAIN (ANALYZE, BUFFERS)` untuk dashboard siswa, metrik admin, pembuatan konteks pasar (`skill_quotes`, `role_demand`), dan item-analysis. Tambahkan indeks yang kurang lewat migrasi 0005.

**Selesai kalau.** `python deploy/loadtest.py http://127.0.0.1:8000 200 40` di PostgreSQL: p95 setiap langkah < 1 detik, nol galat.

#### B5. Versi snapshot dan keterlacakan (P2, ±1 hari-orang)

**Langkah.** Simpan versi taksonomi, hash alias, hash gold, dan ekstraktor pada setiap `market_snapshots` (kolom JSON `provenance`). Dengan itu angka lama bisa direproduksi setelah alias berubah.

---

### C. Backend

#### C1. Uji deploy dari nol (P0, ±2 hari-orang)

**Langkah.**
1. Mesin bersih (VPS kecil atau VM), `docker compose up -d` dengan `.env` dari `.env.example` (kunci admin kuat, `PATHSYNC_ENV=production`).
2. Jalankan migrasi dan `pipeline.build_market`. Cek bahwa produksi menolak kunci admin yang lemah.
3. Cek: HTTPS Caddy, cookie staf `HttpOnly` dan `SameSite=Strict`, `PATHSYNC_TRUSTED_PROXIES`, X-Forwarded-For diteruskan dengan benar (tes `test_client_ip.py` sudah ada untuk logikanya).
4. Jalankan `deploy/loadtest.py` ke domain, dan ulangi dari mesin kosong untuk memastikan bisa diulang.

**Selesai kalau.** Ada catatan deploy yang berhasil dua kali berturut-turut dari nol dan daftar temuan yang sudah diperbaiki.

#### C2. Rate limit Redis dan multi-worker (P1, ±2 hari-orang)

**Langkah.** Jalankan 2-4 worker uvicorn dengan Redis. Uji: batas dipakai bersama antarworker, dan perilaku saat Redis mati (fallback tidak boleh membuka batas tanpa catatan: tulis log peringatan dan metrik).

**Selesai kalau.** Tes integrasi (service Redis di CI) membuktikan batas bersama dan fallback yang tercatat.

#### C3. Keamanan (P1, ±3 hari-orang)

**Sudah:** `npm audit --audit-level=high` di CI.

**Langkah.**
1. Tambah `pip-audit` di CI untuk `requirements.txt`.
2. Tinjau unggahan (transkrip, CV, proyek): batas ukuran, tipe berkas, parsing PDF di dalam batas waktu dan memori.
3. Header keamanan di Caddy (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`) dan batas ukuran body.
4. Jalankan tinjauan keamanan terpisah atas seluruh diff, dan uji alur token siswa (rotasi, kedaluwarsa) serta sesi staf.

**Selesai kalau.** Tidak ada temuan tinggi yang terbuka dan CI menolak kerentanan tinggi di Python dan Node.

#### C4. Observabilitas (P1, ±2 hari-orang)

**Langkah.** Log JSON dengan request id (id sudah dikirim ke klien), metrik latensi per rute dan jumlah galat, Sentry yang sudah ada diaktifkan di deploy, dan `/health` yang memeriksa koneksi database dan umur snapshot pasar.

**Selesai kalau.** Satu panel (atau satu perintah) menunjukkan p95 per rute, tingkat galat, dan umur snapshot, dan ada peringatan jika snapshot lebih tua dari 45 hari.

#### C5. Cakupan tes (P2, ±3 hari-orang)

**Langkah.** `pytest --cov=pathsync --cov=api`, lalu tambah tes untuk jalur galat engine, soft skill (sudah ada satu tes), retensi, BPS, dan jalur gagal ekstraktor. Tetapkan ambang di CI.

**Selesai kalau.** Cakupan ≥ 80% untuk `pathsync/` dan `api/`, dan ambang dijaga CI.

---

### D. Bukti dan evaluasi (lintas area)

#### D1. Uji pengguna pilot (P0, ±8 hari-orang)

**Langkah.**
1. Rekrut 10-20 mahasiswa (persetujuan riset terpisah sudah ada di aplikasi). Pakai alur penuh: daftar, unggah transkrip, tes cepat, Skill Map, rute.
2. Bandingkan jalur belajar dengan saran karier umum (rancangan Bab III.D): peserta menilai relevansi, kejelasan, dan kemudahan penerapan (skala 1-5), dan dicatat waktu sampai modul pertama dan kemauan melanjutkan.
3. Gunakan `pathsync/study.py` (studi 4 lengan) bila jumlahnya cukup, jika tidak laporkan deskriptif saja.
4. Catat kendala bahasa (soal berbahasa Inggris), kebingungan Skill Map, dan galat.

**Selesai kalau.** Ada laporan dengan angka dan kutipan, plus daftar perbaikan yang masuk ke backlog dengan pemilik.

#### D2. Satu sumber kebenaran metrik (P1, ±2 hari-orang)

**Langkah.** Buat `python -m pipeline.report` yang menjalankan semua evaluasi (ekstraksi, normalisasi, pola jawaban, ranker, kinerja) dan menulis `data/models/metrics.json` dengan tanggal, hash taksonomi, dan hash gold. Model card dan dokumen hanya membaca berkas itu. Tambah tes yang gagal jika `PLAN_PERBAIKAN.md` atau README memuat angka metrik yang tidak ada di berkas.

**Selesai kalau.** Satu perintah menghasilkan semua angka, dan tidak ada angka di dokumen yang tidak terlacak.

#### D3. Sinkronkan proposal dan produk (P1, ±2 hari-orang)

**Langkah.** Perbarui Bab I-III: domain (teknis dan bisnis), hard skill saja dengan soft skill berbasis pengalaman, ekstraktor yang benar-benar dipakai dan hasil A2, status pgvector (B2), kappa dan presisi dari A1, dan status ranker (A4). Hapus kalimat yang melebihi bukti.

**Selesai kalau.** Setiap angka dan nama komponen di Bab I-III cocok dengan `metrics.json` dan kode.

---

## 4. Definisi selesai untuk rilis beta

1. Presisi dan recall ekstraksi ≥ 0,80 di paruh uji gold konsensus dua manusia, kappa ≥ 0,70, dan selang kepercayaan dilaporkan.
2. Perbandingan lexicon vs LLM vs gabungan tersedia, dan keputusan ekstraktor mengikuti aturan yang ditulis sebelumnya.
3. Ambang normalisasi dipilih dari kurva presisi-cakupan, dan presisi pita otomatis ≥ 0,95.
4. CI hijau di SQLite dan PostgreSQL, `alembic check` bersih, migrasi dari nol terbukti.
5. Deploy dari nol berhasil dua kali, loadtest 200 siswa tanpa galat dan p95 < 1 detik, pemulihan cadangan teruji.
6. Pilot 10-20 mahasiswa selesai dan laporannya terbit.
7. Seluruh angka di dokumen berasal dari `metrics.json`, dan teks proposal sesuai kode.
8. Label Beta tetap tampil untuk ranker (sampai A4) dan role berdata tipis (sampai A8).

## 5. Daftar risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kappa < 0,70 | Gold tidak bisa dipercaya | Perjelas panduan, gabungkan skill yang tumpang tindih, label ulang |
| LLM luring kalah dari lexicon | Teks Bab II harus diubah | Aturan keputusan tertulis sebelumnya, hasil tetap sah |
| Mahasiswa pilot sedikit | Kalibrasi asesmen tidak stabil | Tandai skill "indikatif", kumpulkan lebih lama, tampilkan selang |
| Perbedaan dialek PostgreSQL muncul banyak | Jadwal B1 molor | Mulai B1 di minggu 1, sebelum fitur lain |
| Ahli nyata sulit direkrut | A4 tertunda | Tetap labeli ranker "Beta, ahli simulasi" dan jangan klaim validasi |
| Data posting berubah karena scraper | Hasil tidak bisa direproduksi | B5 mencatat versi, dan gold menyimpan id posting serta hash teks |

## 6. Perintah verifikasi saat ini

```bash
cd backend
python -m pytest -q                       # 68 tes
ruff check .
python -m pipeline.eval_extractor         # dev, held-out, blind
python -m pipeline.item_cue_audit         # pola jawaban bank soal
python -m pipeline.llm_jobs compare       # perbandingan lexicon vs LLM (perlu hasil impor)
cd ../frontend && npx tsc --noEmit && npx next build
cd .. && python deploy/loadtest.py http://127.0.0.1:8000 200 40   # butuh server berjalan
```
