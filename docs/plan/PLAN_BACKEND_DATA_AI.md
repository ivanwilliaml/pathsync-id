# Rencana Backend dan Data/AI

Bagian dari [PLAN.md](../../PLAN.md). Dasar temuan: [audit 16 Okt](../audit/AUDIT_2026-10-16.md) (kode AI-n, INV-n, PM-n merujuk ke sana). Rencana frontend: [PLAN_FRONTEND_UIUX.md](PLAN_FRONTEND_UIUX.md).

Kolom "Pemilik" adalah usulan peran, bukan penunjukan. "Kapan" mengacu ke jadwal di PLAN.md bagian 5. Perintah yang ditulis di sini sudah saya cek ada di kode; yang bertanda *(baru)* belum ada.

---

## 0. Prinsip kerja Data/AI

Prinsip ini berlaku untuk semua tugas di bawah dan bisa dibantah hanya dengan alasan tertulis.

1. **Satu sumber angka.** `python -m pipeline.report` menulis `backend/data/models/metrics.json`. Tidak ada angka kinerja di dokumen yang tidak muncul di sana.
2. **Set tuning dan set uji terpisah.** Alias, ambang, dan prompt hanya disetel di set dev. Angka yang dilaporkan hanya dari set uji yang belum dilihat. `metrics.json` menandai `tuned_on`.
3. **Aturan keputusan ditulis sebelum eksperimen**, lalu diterapkan apa adanya.
4. **Selang kepercayaan selalu dicantumkan.** Presisi dan recall dengan Wilson 95%, F1 dengan bootstrap.
5. **Klaim mengikuti bukti.** Kalau datanya belum ada, komponen diberi label "Beta" atau "prior", bukan dibela.
6. **Setiap perubahan taksonomi, alias, atau soal** menjalankan `pipeline.eval_extractor`, `pipeline.item_cue_audit`, dan `pytest`. Hasil yang turun tanpa alasan tertulis ditolak.

---

## A. Data dan AI

### Ringkasan prioritas

| ID | Tugas | Syarat MVP | Prioritas | Perkiraan | Pemilik | Kapan |
|---|---|---|---|---|---|---|
| AI-01 | Gold konsensus dua anotator dan kappa | M1 | P0 | 6 jam anotator ×2 + 2 jam kode | Tim + Data/AI | 17-19 Okt |
| AI-02 | LLM vs lexicon di set uji yang sama | S1 | P0 | 4 jam + antre GPU | Data/AI | 16-19 Okt |
| AI-03 | Taksonomi BA lolos 3 dari 3, Agile di luar cakupan | M1 | P0 | 3 jam | Data/AI | 17-18 Okt |
| AI-04 | Normalisasi: label 300 frasa, perketat penjaga, ukur | S2 | P0 | 2 jam ×2 pelabel + 4 jam kode | Tim + Data/AI | 18-21 Okt |
| AI-05 | Semantik "terbukti" vs "dari nilai" di mesin | M2 | P0 | 4 jam | Data/AI + Backend | 19 Okt |
| AI-06 | Ranker: pakai formula, LTR sebagai eksperimen | D3 | P0 | 2 jam | Data/AI | 17 Okt |
| AI-07 | Validasi graf BA oleh pakar | M6 | P0 | 1-2 jam pakar + 1 jam kode | Tim | 19 Okt |
| AI-08 | Data: BA ≥ 100 posting, role tipis ≥ 50, sumber lebih beragam | S3 | P1 | 4 jam + waktu scrape | Data/AI | 18-20 Okt |
| AI-09 | Tren pasar: hitung dari tanggal posting, tampilkan "belum tersedia" bila tidak cukup | S5 | P1 | 4 jam | Data/AI + Backend | 20 Okt |
| AI-10 | Kalibrasi asesmen dari pilot | — | P1 | 3 jam setelah data | Data/AI | 24-26 Okt |
| AI-11 | Soal berbahasa Indonesia (440 soal baru) | M3 | P0 untuk alur BA, P1 sisanya | 2 hari untuk BA, 4 hari semuanya | Data/AI | 17-21 Okt |
| AI-12 | Ukur ulang kualitas soal skill BA (pola jawaban, penilaian vs alat) | — | P1 | 3 jam | Data/AI | 21 Okt |
| AI-13 | ESCO untuk role selain BA dan DA | — | P2 | 1 hari | Data/AI | setelah final |
| AI-14 | Ekspansi 6 role bisnis | — | P2 | ±15 hari | Data/AI | setelah final |

### AI-01. Gold konsensus dan kappa (M1)

**Masalah.** Semua gold dianotasi satu orang (AI-1 di audit). Batas bawah selang presisi 0,7486 masih di bawah 0,80.

**Langkah.**
1. Dua anotator manusia mengikuti [PANDUAN_ANOTASI.md](../ops/PANDUAN_ANOTASI.md). Mereka melabeli 100 posting terkunci (`data/seed/gold_split.json`: 50 dev, 50 uji) di Admin > Annotation, atau lewat lembar luring: `python -m pipeline.gold sheet <nama>` dan `python -m pipeline.gold import-sheet <nama> <berkas>`.
2. `python -m pipeline.gold status` untuk memantau kemajuan. Setelah keduanya selesai: `python -m pipeline.gold consensus`. Sengketa masuk `data/models/gold_agreement.json`, dan penilai ketiga memutuskan di `data/seed/gold_adjudication.json`.
3. Setel alias hanya terhadap paruh dev. Bekukan. Ukur sekali di paruh uji: `python -m pipeline.eval_extractor --gold gold_consensus.json --split test`.
4. `python -m pipeline.report`.

**Selesai kalau.** Kappa ≥ 0,70. Presisi dan recall paruh uji ≥ 0,80 dengan selang tercatat. `metrics.json` memuat `annotators: 2`. Tes `test_extractor_meets_precision_target_on_blind_gold` diarahkan ke set konsensus.

**Jika gagal.** Kappa rendah menandakan skill yang tumpang tindih. Perjelas panduan dan gabungkan skill. Jika presisi di bawah 0,80, laporkan angka sebenarnya dan ubah klaim menjadi "indikatif"; jangan menyetel alias di set uji.

### AI-02. LLM vs lexicon (S1, menjawab AI-2)

**Langkah.**
1. Aturan keputusan (sudah ditulis di PLAN.md D4): pilih ekstraktor dengan F1 tertinggi di set uji dengan syarat presisi ≥ 0,80. Seri, pilih lexicon.
2. `python -m pipeline.llm_jobs export-postings --gold-plus 300` menulis `backend/offline_llm/jobs/postings.json` (418 posting).
3. Jalankan di Kaggle: `kaggle auth login`, `python backend/offline_llm/build_kernel.py postings --user <akun>`, push kernel, unduh keluaran.
4. `python -m pipeline.llm_jobs import-postings <berkas>` lalu `python -m pipeline.llm_jobs compare`.
5. Bandingkan di set uji: `python -m pipeline.eval_extractor --gold gold_consensus.json --split test --extractor lexicon|llm|union|intersection`.
6. Catat ongkos dan waktu per posting. Jika ada kunci API Anthropic, jalankan sekali sebagai batas atas dan catat model dan tanggalnya.

**Selesai kalau.** Ada tabel empat baris dengan selang kepercayaan, dan pilihan ekstraktor ditulis di model card.

**Catatan.** Jika lexicon menang atau seri, Bab II diubah: lexicon dipilih karena determinisme, biaya, dan kontrol; LLM dipakai sebagai pembanding dan untuk membaca CV.

### AI-03. Taksonomi BA lolos kriteria final

**Masalah.** BA tidak lolos: C1 0,90 (target 0,95) dan C2 0,14 (batas 0,10) karena kandidat seperti "Agile" muncul di 14% posting.

**Langkah.**
1. Tambahkan konsep "dikenal, di luar cakupan" ke `pathsync/governance.py`: alias soft skill (`data/seed/soft_skills.json`) dan istilah metodologi umum tidak dihitung sebagai kandidat skill baru. Catat versi di changelog governance.
2. Lihat apa yang membuat C1 90%: `python -m pipeline.report` lalu `GET /api/taxonomy/report?role=business_analyst`. Untuk setiap frasa frekuen yang tidak tertutup, putuskan: tambah alias, tambah skill, atau masukkan ke "di luar cakupan".
3. Bangun ulang pasar: `python -m pipeline.build_market --extractor lexicon`.

**Selesai kalau.** Laporan governance BA menunjukkan C1 ≥ 0,95, C2 ≤ 0,10, dan C3 lolos. Versi taksonomi naik (`2026.10-v4`) dengan changelog. Aturan untuk 13 role lain tidak berubah, dan mereka tetap berlabel Beta.

**Jangan** mengembalikan `agile_scrum` dan `project_management` ke taksonomi hard skill (keputusan D2).

### AI-04. Normalisasi embedding (S2, menjawab AI-3)

**Langkah.**
1. Dua pelabel mengerjakan 300 frasa terkunci: `python -m pipeline.normalisation sheet <nama>`, isi CSV tanpa melihat prediksi sistem, lalu `python -m pipeline.normalisation import <csv>...`.
2. `python -m pipeline.normalisation eval` menulis `data/models/normalisation_eval.json` dengan kurva presisi-cakupan dan ambang terpilih. Aturan: pita otomatis dimulai dari ambang terendah dengan presisi ≥ 0,95.
3. Perketat `lexical_support` di `pathsync/extraction/base.py`: kata generik (daftar kecil, misalnya *data, media, bisnis, security, bidang, proses*) tidak dihitung sebagai dukungan. Satu kata saja sebagai dukungan tidak cukup untuk frasa satu kata.
4. Ukur dampak ke peta permintaan: bagian pasangan (posting, skill) yang berasal dari pemetaan otomatis harus turun, dan presisi di label manusia naik.

**Selesai kalau.** Presisi pita otomatis ≥ 0,95 di label manusia. Tes regresi gagal jika turun. Dampaknya ke peta BA dicatat.

### AI-05. "Terbukti" vs "dari nilai" (M2, menjawab AI-7)

**Masalah.** Nilai kuliah saja menghasilkan "Strength" dan readiness 60%.

**Langkah (mesin).**
1. Di `pathsync/evidence.py`, hitung untuk setiap skill dua nilai: `p` (seperti sekarang) dan `p_proven` (hanya asesmen, proyek, sertifikat terverifikasi). Tambahkan `evidence_kinds` per skill di keluaran `competencies`.
2. Hitung `coverage_proven` selain `coverage`. Jangan mengubah ranking: ranking tetap memakai `p`.
3. Tambah tes: profil dengan transkrip saja memiliki `coverage_proven = 0` dan tidak ada skill "strong" dalam definisi terbukti.
4. Frontend membaca dua angka ini (lihat FE-02).

**Selesai kalau.** API dashboard mengembalikan `coverage_proven`, `evidence_kinds`, dan tes lulus. `test_paper_fidelity.py` tetap lulus (persamaan (2) dan (6) tidak berubah).

### AI-06. Ranker jujur (menjawab AI-4)

**Langkah.**
1. Pastikan model aktif default adalah **Formula (5)**, bukan LTR (`ranker_models.active`). LTR tetap tersimpan sebagai eksperimen.
2. Model card dan How It Works menyebut: "Prioritas dihitung dengan formula yang bisa dijelaskan. Model terlatih belum lebih baik dari formula pada pakar simulasi, dan menunggu pakar nyata."
3. Aturan peralihan (sudah di `expert_study`): LTR menggantikan formula hanya jika NDCG@5 leave-one-expert-out lebih tinggi ≥ 0,02 dengan selang bootstrap tidak mencakup nol.

**Selesai kalau.** Model aktif = Formula (5), teks sesuai, tes `test_paper_fidelity.py` lulus.

### AI-07. Validasi graf BA (M6, menjawab AI-6)

**Langkah.** Satu atau lebih pakar BA (dosen atau praktisi) memvalidasi sekitar 50 sisi graf BA lewat halaman Experts (±1 jam). Aturan validasi 2 dari 3 sudah ada. Jika hanya satu pakar tersedia, tandai sisi sebagai "divalidasi 1 pakar" dan jangan memakai kata "tervalidasi pakar" tanpa jumlah.

**Selesai kalau.** `metrics.json` memuat jumlah sisi per status (draft, divalidasi, ditolak) dan jumlah pakar.

### AI-08. Data (S3, menjawab AI-11 dan INV-4)

**Langkah.**
1. Scrape ulang: `python -m scrapers.karirhub`, `python -m scrapers.kalibrr`, dan ATS. Target BA ≥ 100, role lain ≥ 50.
2. Tambahkan sumber ATS publik (lebih aman secara hukum) agar Karirhub tidak melebihi 50% baris.
3. `python -m pipeline.build_market --extractor lexicon --ref <tanggal>` lalu `python -m pipeline.report`.

**Selesai kalau.** BA ≥ 100 posting, tidak ada sumber di atas 50% untuk BA, dan role di bawah 30 tetap berlabel Beta.

### AI-09. Tren pasar (S5, menjawab AI-8)

**Langkah.**
1. Tren 6 vs 6 bulan dihitung dari tanggal terbit posting (`published_at`), bukan dari jumlah snapshot. Periksa mengapa status BA `insufficient` dan sebaran tanggalnya.
2. Jika tidak cukup, API mengembalikan `trend: null` dengan alasan, dan frontend menampilkan "Tren belum tersedia: perlu minimal N posting per periode" (FE-08). Jangan menampilkan 0.
3. Jadwalkan snapshot bulanan (workflow `monthly-scrape.yml` sudah ada). Perbaiki: berkas mentah jangan di-commit ke git (lihat BE-07).

**Selesai kalau.** Role dengan data cukup menampilkan tren, sisanya menampilkan "belum tersedia", dan klaim "pasar dinamis" di dokumen sesuai.

### AI-10. Kalibrasi asesmen dari pilot

**Langkah.** Setelah pilot ≥ 10 mahasiswa: `python -m pipeline.calibrate_items` (item analysis, KR-20, Rasch, estimasi ulang BKT) dan `python -m pipeline.calibrate_weights` (butuh ≥ 30 pasangan). Kalibrasi aktif hanya jika setidaknya setengah bank punya jawaban cukup.

**Selesai kalau.** `item_calibration.json` ada, kalibrasi diberi status aktif atau tidak aktif dengan alasan, dan konstanta BKT di dokumen disebut "prior" atau "terkalibrasi" sesuai statusnya.

### AI-11. Soal berbahasa Indonesia (M3)

**Masalah.** 440 soal baru (`data/seed/items/x_*.json`) berbahasa Inggris di dua sisi. Soal lama: Indonesia di `items/` dengan overlay Inggris di `items_en/`.

**Langkah.** Urutan: soal skill BA dulu (alur utama), lalu role lain. Terjemahkan stem, opsi, dan penjelasan, pertahankan urutan opsi (opsi benar pertama di sumber), jalankan `python -m pipeline.item_authoring.balance_lengths` lalu `python -m pipeline.item_cue_audit`. Pindahkan: `items/x_*.json` jadi Indonesia, `items_en/x_*.json` overlay Inggris.

**Selesai kalau.** Soal skill BA punya dua bahasa, akurasi pola jawaban versi Indonesia di bawah `random_p95`, dan tes memastikan jumlah opsi sama di dua bahasa.

### AI-12. Kualitas soal skill BA

Beberapa soal BA berbentuk "respons terbaik" (AI-10 di audit). Tinjau 20 soal skill `requirements_*`, `business_process_modeling`, dan `sdlc`. Pertahankan soal yang menguji metode atau notasi yang bisa diajarkan (apa itu BRD, perbedaan use case dan user story), tulis ulang yang bergantung pada budaya kerja. Jalankan ulang audit pola jawaban.

---

## B. Backend

### Ringkasan prioritas

| ID | Tugas | Syarat MVP | Prioritas | Perkiraan | Pemilik | Kapan |
|---|---|---|---|---|---|---|
| BE-01 | Verifikasi CI GitHub hijau di dua database dan gerbang tes | M4 | P0 | 2 jam | Backend | 16 Okt |
| BE-02 | Deploy publik dan cadangan terjadwal | M4 | P0 | 1 hari | Backend | 18-20 Okt |
| BE-03 | Tinjauan hukum sumber data dan halaman asal data | M7 | P0 | 4 jam | Backend + Tim | 17 Okt |
| BE-04 | API readiness "terbukti" (bersama AI-05) | M2 | P0 | lihat AI-05 | Backend | 19 Okt |
| BE-05 | Latensi: transkrip p95 < 1 detik, request pertama setelah restart < 5 detik | — | P1 | 1 hari | Backend | 20-22 Okt |
| BE-06 | Uji otomatis alur utama di browser | M4 | P0 | 4 jam | Backend + Frontend | 21 Okt |
| BE-07 | Jalur data: workflow bulanan tanpa commit berkas mentah | — | P1 | 3 jam | Backend | 22 Okt |
| BE-08 | Metrik produk: target dan survei akhir | M6 | P1 | 4 jam | Backend | 19 Okt |
| BE-09 | Keamanan: tinjauan akhir dan tes penetrasi ringan | — | P1 | 4 jam | Backend | 22 Okt |
| BE-10 | Kontrak API: dokumentasi dan versi | — | P2 | 3 jam | Backend | setelah final |
| BE-11 | Pemantauan dan peringatan produksi | — | P2 | 4 jam | Backend | setelah final |
| BE-12 | **Bahasa per permintaan dan katalog pesan** (dasar M3) | M3 | **P0** | 1,5 hari | Backend | 17-18 Okt |

### BE-12. Bahasa per permintaan dan katalog pesan (dasar M3)

**Masalah (terverifikasi di kode).** Bahasa adalah variabel lingkungan proses, `PATHSYNC_LANG` (`pathsync/config.py`), dibaca saat impor di `taxonomy.py` dan `assessment.py` dan di-cache. Satu proses hanya bisa satu bahasa. Selain itu kalimat penjelasan rute ditulis tetap dalam bahasa Inggris di `pathsync/pathing.py` (contoh: "Asked for in N of M job postings", "Not ready yet: ... must reach 0.6 first"), begitu juga `FLAG_TEXT` di `engine.py`, label level, dan alasan riwayat. Jadi UI Indonesia tidak bisa dibuat hanya di frontend.

**Langkah.**
1. Tentukan bahasa per permintaan: header `Accept-Language` atau parameter `lang` (`id` atau `en`), dengan nilai awal dari profil mahasiswa (`preferences.language`, sudah ada).
2. Ganti pembacaan `LANG` global di `taxonomy.py` dan `assessment.py` dengan fungsi yang menerima bahasa. Cache dikunci per bahasa (`lru_cache` per `(lang)`).
3. Buat katalog pesan `pathsync/messages.py`: kunci pesan dengan templat untuk `id` dan `en` (penjelasan di `pathing.py`, `FLAG_TEXT`, label level, alasan riwayat, pesan galat yang tampil ke pengguna). Tidak ada kalimat ke pengguna yang ditulis langsung di logika.
4. Router meneruskan bahasa ke `recommend()` dan `explain()`. Konteks pasar (`load_context`) tidak bergantung pada bahasa, jadi cache konteks tidak berlipat ganda.
5. Tes: untuk profil yang sama, `GET /students/{id}/dashboard` dengan `id` dan `en` mengembalikan struktur dan angka identik, hanya teksnya yang berbeda. Tes memastikan tidak ada kunci pesan yang kosong di salah satu bahasa.

**Selesai kalau.** Dua bahasa dilayani oleh satu proses, tes paritas lulus, dan `PATHSYNC_LANG` hanya menjadi nilai awal untuk permintaan tanpa header.

### BE-01. CI GitHub hijau

Saya hanya menjalankan perintah secara lokal; status di GitHub belum saya lihat. **Langkah:** buka tab Actions di GitHub, pastikan job backend (SQLite), backend (PostgreSQL), dan frontend hijau. Perbaiki yang merah. Tambahkan perlindungan cabang `main` (PR + CI hijau, tanpa push langsung setelah beku 22 Okt).

**Selesai kalau.** Tiga job hijau pada commit terbaru `main`, dan aturan cabang aktif.

### BE-02. Deploy publik (M4)

**Langkah.**
1. Satu VPS kecil (2 vCPU, 4 GB) dengan Docker. Ikuti [RUNBOOK.md](../ops/RUNBOOK.md) (4 bug deploy sudah tercatat di sana). Gunakan image `postgres:16`.
2. Domain atau subdomain dan HTTPS lewat Caddy. Kunci admin kuat di `.env` (produksi menolak yang lemah).
3. `PATHSYNC_WARMUP=sync`, `/api/health/ready` dipantau.
4. Cadangan harian (`deploy/backup.sh`) dan satu latihan pemulihan di mesin lain.
5. Profil demo aktif dan job retensi harian berjalan.
6. Uji beban: `python deploy/loadtest.py https://<domain> 200 40`.

**Selesai kalau.** URL publik berfungsi dari jaringan lain, loadtest 0 galat dan p95 per langkah < 1,5 detik, dan satu pemulihan berhasil.

### BE-03. Sumber data dan hukum (M7, menjawab INV-3)

**Langkah.**
1. Baca syarat layanan Karirhub (Kemnaker) dan Kalibrr. Catat apakah penggunaan ulang untuk riset non-komersial diizinkan dan apakah ada ketentuan atribusi.
2. Tulis `docs/ops/DATA_SOURCES.md`: setiap sumber, endpoint yang dipakai, laju permintaan, bidang yang disimpan, dasar penggunaan, dan kontak.
3. Simpan hanya yang dibutuhkan (judul, perusahaan, tanggal, teks deskripsi, URL). Hapus data pribadi (nama rekruter atau kontak) jika ada.
4. Halaman About menyatakan asal data dan atribusi. Siapkan jalur penghapusan atas permintaan penyedia.
5. Utamakan sumber ATS publik untuk pertumbuhan data (AI-08).

**Selesai kalau.** `DATA_SOURCES.md` ada, halaman About mencantumkan sumber, dan ada keputusan tertulis untuk setiap sumber: lanjut, lanjut dengan atribusi, atau hentikan.

### BE-06. Uji otomatis alur utama

**Langkah.** Tambahkan Playwright di `frontend/` dan satu job CI. Skenario: landing → profil demo → dashboard menampilkan prioritas pertama → buka Skill Map → buka Quick Check dan jawab satu soal. Jalankan di bahasa Indonesia dan Inggris.

**Selesai kalau.** Skenario hijau di CI, dan perubahan UI yang merusak demo menggagalkan CI.

### BE-05. Latensi

Dari laporan Derik: transkrip p95 1,19 detik, sekitar 28 query per request. Dari Jonathan: request pertama setelah restart di Docker masih lambat (cache embedding kosong atau route dibangun malas).

**Langkah.** Volume untuk `data/processed/embedding_cache.sqlite`, panggil semua route sekali saat warmup, kurangi query per request di jalur transkrip dengan memuat relasi sekaligus. Ukur ulang di Linux.

**Selesai kalau.** Transkrip p95 < 1 detik di Linux, request pertama setelah restart < 5 detik.

### BE-07. Jalur data bulanan

`monthly-scrape.yml` meng-commit berkas mentah ke git setiap bulan. **Langkah:** simpan berkas mentah sebagai artefak atau di penyimpanan objek, bukan di riwayat git. Tambahkan pemeriksaan ukuran. Catat versi snapshot ke dalam provenance.

### BE-08. Metrik produk

**Langkah.** Tambah target di Admin > Launch Metrics (bagian 4 PLAN.md). Tambah survei tiga pertanyaan di akhir Quick Check pertama (kejelasan rute, kemauan memulai, kesulitan). Simpan sebagai `product_events` dengan persetujuan riset terpisah yang sudah ada.

### BE-09. Keamanan

Tinjauan akhir sebelum beku: `pip-audit` dan `npm audit` (sudah di CI), pemeriksaan unggahan, rotasi token, header Caddy, dan uji bahwa cookie staf tidak berisi token asli (diperbaiki oleh Jonathan, perlu satu tes regresi). Hasil dicatat di RUNBOOK.

---

## C. Pengujian dan gerbang

| Tes | Isi | Gerbang |
|---|---|---|
| `pytest` (114 tes) | domain, API, migrasi, retensi, observabilitas, soft skill, BPS | harus hijau |
| `test_extractor_meets_precision_target_on_blind_gold` | presisi dan recall ≥ 0,80 di set uji | diarahkan ke gold konsensus (AI-01) |
| `test_item_bank.py` | akurasi pola jawaban ≤ batas | turun ke 0,30 untuk bank saat ini (0,328) |
| `test_paper_fidelity.py` | persamaan paper dan Tabel 4 | harus tetap hijau saat AI-05 |
| Playwright (BE-06) | alur demo di dua bahasa | CI |
| `deploy/loadtest.py` | 200 siswa, 40 konkuren | 0 galat |

Beku kode 22 Okt: semua gerbang hijau, atau rollback.

---

## D. Setelah final

- AI-13, AI-14 (ESCO untuk role lain, 6 role bisnis).
- BE-10, BE-11 (kontrak API, peringatan produksi).
- Validasi ranker dengan panel pakar sungguhan dan baseline LLM generik.
- Soal Indonesia untuk semua role dan reliabilitas per skill (tambah soal hingga 8 pada skill terbesar).
- Kemitraan pilot dengan satu prodi (menjawab INV-1 dan INV-2).
