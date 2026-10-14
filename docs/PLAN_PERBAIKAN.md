# Rencana Perbaikan PathSync

Dibuat 14 Okt 2026, dari kode di `main` (commit 62bcbb4). Semua klaim "sudah" di bawah dicek ke kode atau ke berkas hasil ukur. Klaim "belum" adalah celah yang terbukti dari kode, bukan dugaan.

Tentang "100% tepat": tidak ada sistem AI yang bisa dijamin 100% benar. Yang bisa dijamin adalah bahwa tiap klaim punya **angka ukur, set uji, dan perintah verifikasi**, dan tidak ada klaim yang lebih besar dari buktinya. Tiap tugas di bawah punya "Selesai kalau" yang bisa dijalankan ulang.

## 1. Status jujur hari ini

| Area | Sudah (terbukti) | Belum (terbukti dari kode/ukur) |
|---|---|---|
| Ekstraksi skill | Presisi 0,828 / recall 0,889 / F1 0,857 di 26 posting buta (`gold_blind.json`), tes menjaga ≥ 0,80 | Satu anotator (Claude). Ekstraktor yang diukur adalah lexicon + embedding, bukan LLM seperti di Bab II-III. Gold hanya 76 posting dari 1.093 |
| Normalisasi | Gerbang embedding 0,85 / 0,70 + penjaga `lexical_support` | Kemurnian klaster dan kesepakatan dengan manusia (dijanjikan Bab III.D) belum diukur |
| Asesmen | Opsi diacak per sesi, anti-replay, batas waktu minimum, koreksi tebakan per soal. Akurasi classifier pola jawaban 0,37 (acak 0,25) | Pola jawaban masih bisa ditebak di atas acak. Kesulitan soal diisi penulis, belum dikalibrasi dari jawaban nyata. Pemilihan soal berdasarkan kesulitan, belum adaptif sungguhan. Soal baru hanya Inggris |
| Ranker | Formula bobot + LTR berjalan, dapat dijelaskan | NDCG@5 0,955 vs formula 0,959 (tidak lebih baik), dilatih dari ahli simulasi. Panel ahli nyata 0. Baseline LLM tidak pernah dijalankan (`evaluation_report.json`: "tidak dijalankan") |
| Peta pasar | 14 role, 1.093 baris posting (termasuk duplikat) dari 460 perusahaan | UI/UX 7, frontend 18, data engineer 18, data scientist 19 posting. ESCO hanya untuk BA dan DA |
| Database | Alembic 0001-0004, SQLite WAL, 38 indeks, load test 200 siswa tanpa error | **pgvector tidak dipakai di kode** (tidak ada query vektor; embedding memakai cache SQLite lokal). Tidak pernah dijalankan di PostgreSQL. Tidak ada retensi atau penghapusan data lama |
| Backend | Sesi staf HttpOnly + CSRF, audit log, rate limit, token terhash, 68 tes | CI hanya SQLite, tanpa PostgreSQL dan Redis. Deploy produksi belum pernah diuji |

## 2. Prioritas

P0 = harus beres sebelum klaim di proposal dipakai. P1 = sebelum pengguna nyata. P2 = setelah itu.

### A. AI (utama)

**A1 (P0). Anotasi manusia kedua dan kappa**
- Masalah: semua gold dianotasi satu orang, jadi presisi 0,828 belum bisa disebut valid untuk pembaca luar.
- Kerjakan: dua anotator manusia melabeli ulang 100 posting (tambah 50 baru di role dengan data tipis). Hitung Cohen kappa per skill. Pakai alat anotasi di Admin yang sudah ada.
- Selesai kalau: kappa ≥ 0,7 dan presisi/recall dihitung ulang terhadap label konsensus, ≥ 0,80 di set yang tidak dipakai menyetel alias.
- Verifikasi: `python -m pipeline.eval_extractor` dengan berkas gold konsensus; tes `test_extractor_meets_precision_target_on_blind_gold` diarahkan ke berkas itu.

**A2 (P0). Jalankan ekstraktor LLM dan bandingkan dengan lexicon**
- Masalah: Bab II dan III berargumen memilih LLM, tapi yang berjalan dan diukur lexicon. `extractor_comparison.json` memakai 88 posting dan taksonomi lama, jadi kedaluwarsa. Tidak ada kunci API di lingkungan ini, jadi LLM belum bisa diukur.
- Kerjakan: jalankan LLM (Claude API atau Qwen di Kaggle) pada set gold yang sama, dengan gerbang kutipan harus ada verbatim di posting. Laporkan P/R/F1 lexicon vs LLM vs gabungan.
- Selesai kalau: ada tabel tiga ekstraktor di set buta yang sama, dan pilihan ekstraktor produksi diputuskan dari angka itu. Kalau LLM tidak lebih baik, ubah teks Bab II.
- Risiko: biaya API dan variasi keluaran. Simpan semua keluaran mentah untuk replikasi.

**A3 (P0). Evaluasi normalisasi embedding**
- Masalah: Bab III.D menjanjikan kemurnian klaster dan kesepakatan dengan manusia, belum ada.
- Kerjakan: ambil 200 frasa bebas dari posting, label identitas skill oleh manusia, ukur akurasi pemetaan di ambang 0,85 / 0,70 dan kurva presisi-cakupan.
- Selesai kalau: ada angka akurasi per ambang dan ambang dipilih dari kurva, bukan tebakan.

**A4 (P0). Validasi ranker dengan ahli nyata**
- Masalah: ranker dilatih dari ahli simulasi, tanpa kenaikan terhadap formula. (Penilai sengaja ditunda atas permintaan tim.)
- Kerjakan nanti: minimal 3 penilai industri via Panel Pakar, ukur precision@5 dan NDCG@5 terhadap formula dan baseline LLM, latih ulang hanya kalau menang di data lipat-silang.
- Selesai kalau: model aktif punya NDCG@5 lebih tinggi dari formula dengan selang kepercayaan, atau formula dipakai dan teks "learning-to-rank" diturunkan.
- Sementara: label di UI dan model card tetap "Beta, ahli simulasi".

**A5 (P1). Kalibrasi asesmen dari jawaban nyata**
- Masalah: kesulitan soal ditulis penulis, bukan diukur. Pemilihan soal tidak adaptif sungguhan.
- Kerjakan: kumpulkan jawaban (target 30 jawaban per soal), pakai endpoint item-analysis untuk daya beda dan kesulitan empiris, buang atau tulis ulang soal dengan daya beda < 0,15, lalu kalibrasi 2PL atau Rasch sederhana dan ganti pemilihan soal menjadi berbasis informasi.
- Selesai kalau: laporan item-analysis menunjukkan korelasi kesulitan penulis vs empiris, dan soal buruk sudah diganti. Reliabilitas (alpha) per skill dilaporkan.
- Catatan: butuh pengguna nyata, jadi urutannya setelah uji pilot.

**A6 (P1). Turunkan pola jawaban lebih jauh**
- Masalah: classifier pola jawaban 0,37, sedangkan batas yang saya inginkan mendekati 0,30 (TODO di `test_item_bank.py`).
- Kerjakan: tulis ulang soal dengan `p_cue` tertinggi (daftar di `item_cue_audit.json`), jalankan `pipeline.item_cue_audit` sampai ambang tercapai.
- Selesai kalau: akurasi classifier ≤ 0,33 dan tes diperketat dari 0,42 ke 0,35.

**A7 (P1). Bahasa Indonesia untuk soal**
- Masalah: 440 soal baru hanya Inggris, sedangkan mode ID menampilkan Inggris.
- Kerjakan: terjemahkan lewat pipeline yang menjaga panjang opsi seimbang (pola jawaban tidak boleh naik), lalu jalankan ulang audit pola jawaban.
- Selesai kalau: 570 soal punya versi ID dan audit pola jawaban untuk ID juga ≤ 0,35.

**A8 (P1). Cakupan role dan kualitas data**
- Kerjakan: scrape tambahan untuk role di bawah 30 posting sampai ≥ 50, perluas gold set di sana, dan petakan ESCO untuk role selain BA dan DA, atau tampilkan jujur bahwa level kebutuhan hanya dari frekuensi posting.
- Selesai kalau: tidak ada role "Beta" karena data, atau badge Beta tetap dan jelas alasannya.

**A9 (P2). Ekspansi role bisnis**
- Sudah dicatat di `docs/ROADMAP.md` (6 role baru di Ekonomi, Manajemen, Akuntansi). Dikerjakan setelah A1-A3 supaya ekstraktor tervalidasi dulu.

### B. Database

**B1 (P0). Uji penuh di PostgreSQL**
- Masalah: migrasi dan seluruh tes hanya dijalankan di SQLite. Perilaku tipe JSON, urutan, dan transaksi bisa berbeda, dan compose memakai PostgreSQL.
- Kerjakan: tambahkan service PostgreSQL ke `.github/workflows/ci.yml`, jalankan `alembic upgrade head` dari nol dan seluruh `pytest` di sana. Perbaiki beda dialek yang muncul.
- Selesai kalau: CI hijau untuk dua DB, dan `alembic upgrade head` dari DB kosong lalu `alembic check` tidak melaporkan perbedaan model-migrasi.

**B2 (P0). Putuskan nasib pgvector**
- Masalah: Bab III.B menyebut PostgreSQL dengan ekstensi pencarian vektor. Di kode tidak ada query vektor; embedding memakai cache SQLite dan perbandingan di memori.
- Pilihan: (a) pakai pgvector sungguhan untuk pencarian tetangga terdekat skill di taksonomi (114 skill, sebenarnya cukup di memori), atau (b) ubah teks proposal menjadi "embedding di memori dengan cache" dan hapus ekstensi dari compose.
- Rekomendasi: (b). Dengan 114 skill, pgvector tidak memberi manfaat nyata, jadi lebih jujur mengubah teks. Putuskan sebelum Bab III difinalkan.
- Selesai kalau: kode dan teks proposal menyatakan hal yang sama.

**B3 (P1). Cadangan, pemulihan, dan retensi**
- Masalah: ada skrip `pg_dump`, tapi pemulihan belum pernah diuji, dan tidak ada penghapusan data lama (log audit, event, token kedaluwarsa, sesi asesmen).
- Kerjakan: latihan pemulihan dari cadangan ke DB kosong, lalu tugas terjadwal untuk menghapus event produk lama, sesi asesmen yang kedaluwarsa, dan log audit di atas batas retensi yang ditulis di halaman privasi.
- Selesai kalau: skrip restore terdokumentasi dan teruji, dan ada tes untuk fungsi retensi.

**B4 (P1). Indeks dan kueri berat**
- Kerjakan: jalankan `EXPLAIN` di PostgreSQL untuk kueri dashboard, metrik admin, dan pembuatan konteks pasar dengan data 10x lipat, tambah indeks yang kurang.
- Selesai kalau: `deploy/loadtest.py` dijalankan di PostgreSQL dengan 200 siswa dan p95 di bawah 1 detik tanpa galat.

**B5 (P2). Snapshot pasar versi dan jejak**
- Kerjakan: simpan versi taksonomi dan hash gold set pada tiap snapshot supaya hasil lama bisa direproduksi setelah alias berubah.

### C. Backend

**C1 (P0). Uji deploy sungguhan**
- Kerjakan: `docker compose up` di satu mesin bersih (atau VPS kecil), jalankan migrasi, build pasar, loadtest, cek HTTPS Caddy dan cookie staf, dan baca log `PATHSYNC_TRUSTED_PROXIES`.
- Selesai kalau: ada catatan deploy yang berhasil dua kali dari nol dan daftar masalah yang ditemukan.

**C2 (P1). Redis rate limit dan multi-worker**
- Masalah: rate limit Redis opsional dan belum diuji dengan banyak worker.
- Kerjakan: tes dengan 2 worker uvicorn dan Redis, pastikan batas dipakai bersama dan fallback saat Redis mati tidak membuka celah.

**C3 (P1). Keamanan: tinjauan terpisah**
- Kerjakan: jalankan `security-review`, cek unggahan (ukuran, tipe, parsing PDF), batas ukuran body, dan header keamanan di Caddy. Tambah `pip-audit` dan `npm audit` di CI.
- Selesai kalau: tidak ada temuan tinggi yang terbuka, dan CI menolak kerentanan tinggi.

**C4 (P1). Observabilitas**
- Kerjakan: log terstruktur dengan request id (sudah ada id di klien), metrik latensi per rute, peringatan galat via Sentry yang sudah ada, dan health check yang memeriksa DB.

**C5 (P2). Cakupan tes**
- Kerjakan: ukur cakupan (`pytest --cov`), tambah tes untuk jalur galat engine, soft skill, BPS, dan retensi. Target 80% pada `pathsync/` dan `api/`.

### D. Bukti dan evaluasi (lintas area)

**D1 (P0). Uji pengguna kecil**
- Kerjakan: 10-20 mahasiswa memakai alur penuh, bandingkan jalur belajar dengan saran karier umum (rancangan Bab III.D), catat kejelasan, relevansi, dan waktu sampai modul pertama.
- Selesai kalau: ada laporan dengan angka dan kutipan, dan temuan masuk daftar perbaikan.

**D2 (P1). Satu sumber kebenaran untuk metrik**
- Kerjakan: satu perintah (`python -m pipeline.report`) yang menjalankan semua evaluasi (ekstraksi, soal, ranker) dan menulis satu berkas yang dikutip oleh model card dan dokumen.
- Selesai kalau: tidak ada angka di dokumen yang tidak muncul di berkas itu.

**D3 (P1). Sinkron proposal dan produk**
- Perbarui Bab I-III: domain (teknis dan bisnis), hard skill saja dan soft skill berbasis pengalaman, ekstraktor yang benar-benar dipakai, status pgvector, dan hasil ukur terbaru.

## 3. Urutan kerja yang disarankan

| Minggu | Fokus | Tugas |
|---|---|---|
| 1 | Bukti AI | A1 (mulai anotasi), A2, A3, B1, B2 |
| 2 | Fondasi | A1 selesai, C1, B3, D3 |
| 3 | Pengguna | D1, A5 (kumpul jawaban), C2, C3 |
| 4 | Perbaikan | A6, A7, A8, B4, C4, D2 |
| Setelah itu | | A4 (panel ahli), A9, C5, B5 |

## 4. Definisi selesai untuk rilis beta

1. Presisi dan recall ekstraksi ≥ 0,80 pada gold konsensus dua manusia, dengan kappa dilaporkan.
2. Perbandingan lexicon vs LLM vs gabungan tersedia, dan keputusan ekstraktor ditulis.
3. CI hijau di SQLite dan PostgreSQL, migrasi dari nol bersih.
4. Deploy dari nol berhasil dua kali, loadtest tanpa galat.
5. Teks proposal, model card, dan dokumen hanya memuat angka yang ada di satu berkas laporan.
6. Label "Beta" tetap tampil untuk komponen yang belum divalidasi (ranker, role berdata tipis) sampai A4 dan A8 selesai.

## 5. Perintah verifikasi saat ini

```bash
cd backend
python -m pytest -q                       # 68 tes
ruff check .
python -m pipeline.eval_extractor         # dev, held-out, blind
python -m pipeline.item_cue_audit         # pola jawaban bank soal
cd ../frontend && npx tsc --noEmit && npx next build
cd .. && python deploy/loadtest.py        # dari akar repo, butuh server berjalan
```
