# Verifikasi Final PathSync (21 Okt 2026)

Audit menyeluruh dari `main` (commit `0fbc87b`) pada branch `audit/final-verification`: backend, database, frontend, keamanan, performa, lalu perbaikan dan uji ulang. Semua angka di bawah diukur pada komputer pengembang (SQLite, Windows) kecuali disebut lain.

## 1. Ringkasan

| Hal | Hasil |
|---|---|
| Tes backend | **207 lulus, 2 dilewati**, cakupan 90% (`pathsync/` + `api/`), lint bersih |
| Frontend | Pemeriksaan tipe bersih, build produksi berhasil, `npm audit` 0 kerentanan |
| Dependensi Python | `pip-audit`: tidak ada kerentanan yang diketahui |
| Kontrol akses | 120 operasi API diuji (tanpa login, akun mahasiswa lain, akun mahasiswa di rute staf): **0 kebocoran** |
| Ketahanan input | 867 isi permintaan rusak + 16 unggahan berkas buruk: **0 galat server (5xx)** |
| Perbaikan | 10 temuan diperbaiki (satu sedang, sisanya rendah), dengan tes baru untuk yang bisa diuji |
| PostgreSQL (lokal, PG 17) | Migrasi dari kosong dua kali + cocok dengan model; seluruh tes: **208 lulus**, 1 dilewati |
| Redis sungguhan | Batas laju dibagi antarproses: **2 lulus** |
| Playwright | Lokal: **4 lulus** (alur demo, halaman publik, 2 tes ponsel baru); situs online: alur demo **lulus** (31 detik) |
| Tampilan ponsel (375 px) | 14 halaman diperiksa; 2 masalah nyata ditemukan dan diperbaiki (bagian 4, #8 dan #9) |
| Belum diuji | Lihat bagian 6 |

## 2. Inventaris singkat

- **Halaman (18):** beranda, dashboard, skill, karier (+ cek lowongan), belajar (+ latihan per skill), bukti, asesmen (+ per skill), pengaturan, metode & data, tentang, privasi, admin, advisor (dosen), experts (pakar), undangan staf.
- **API:** 120 operasi di 11 kelompok: publik (pasar, karier, evaluasi, model-card), mahasiswa (akun, bukti, dashboard, karier, riwayat), asesmen, kelas, siklus belajar, sinkronisasi, platform (sesi staf, peristiwa, umpan balik), advisor, pakar, demo, admin.
- **Peran:** mahasiswa (kunci akses bearer), staf: admin, pakar, advisor (sesi cookie HttpOnly + token CSRF `x-pathsync`), akun demo staf yang hanya bisa melihat.
- **Pekerjaan latar:** pembaruan pasar (dipicu admin), scrape bulanan dan cadangan Neon (GitHub Actions), pembersihan retensi data, pemanasan model saat start.
- **Integrasi:** model embedding (SentenceTransformers atau ONNX di Railway), Claude API (opsional, tidak aktif), Redis (opsional), Sentry (opsional), Vercel + Railway + Neon.

## 3. Yang lolos

- **Autentikasi dan otorisasi:** 39 operasi bertaut akun mahasiswa menjawab 401 tanpa login dan 403 dengan kunci mahasiswa lain; 52 operasi staf menjawab 401 untuk tamu dan kunci mahasiswa; endpoint publik yang menjawab 200 tanpa login semuanya memang publik (data pasar, kesehatan, profil demo).
- **Pembatasan laju:** 10 percobaan login staf per menit (lalu 429), 20 pembuatan profil per menit, 240 permintaan publik per menit.
- **Unggahan:** batas 5 MB (413), pemeriksaan isi berkas (bukan hanya ekstensi), berkas Word rusak atau mengembang >40 MB ditolak, teks biasa diterima, nama berkas aneh (`../`, null, 400 karakter) tidak membuat server error.
- **Injeksi:** semua kueri memakai ORM atau parameter; tidak ada `eval`, `exec`, pickle, atau shell dari input pengguna (satu `subprocess` untuk pembaruan pasar memakai argumen tetap dan hanya admin).
- **Frontend:** tidak ada `dangerouslySetInnerHTML`, `eval`, atau `console.log`; semua tautan keluar memakai `rel="noreferrer"`; token staf di cookie HttpOnly (tidak terbaca JavaScript); semua permintaan lewat path relatif `/api/...`.
- **Alur di browser** (aplikasi lokal, build produksi): profil demo, dashboard, pilih karier (20 karier tampil), cek lowongan (input kosong dinonaktifkan; teks tak relevan menampilkan "belum ada skill yang dikenali"; contoh berfungsi), belajar, latihan dengan umpan balik, Quick Check (24 soal mulai dan tampil), daftar akun (validasi persetujuan data), halaman staf menampilkan form masuk, `/dashboard` tanpa profil mengarahkan ke pembuatan profil, tampilan ponsel 375 px tanpa luapan horizontal.
- **Data:** tidak ada rahasia di berkas yang dilacak (`.env`, kredensial) dan `.gitignore` menutup `.env*` dan cadangan.

## 4. Temuan dan perbaikan

| # | Tingkat | Temuan | Perbaikan | Bukti |
|---|---|---|---|---|
| 1 | Sedang (kinerja) | Pola N+1: `/api/meta` 44 query, `/api/careers/graph` 22, `/api/students/{id}/careers` 25 (satu `SELECT` snapshot per role, memuat JSON besar dua kali). Di server online tiap query adalah perjalanan jaringan ke Neon | `active_snapshot_summaries()`: satu query kecil untuk semua role, dipakai oleh `meta` dan konteks keputusan | Turun menjadi 5, 3, dan 6 query; `tests/test_query_budget.py` (4 tes) menjaga batasnya |
| 2 | Rendah (benar-salah kode) | Berkas .docx rusak dijawab 413 ("terlalu besar") padahal artinya rusak | `DocumentTooLarge` (413) dipisah dari `DocumentRejected` (422) | `tests/test_upload_hardening.py` (5 tes, termasuk zip bomb 45 MB dalam <1 MB) |
| 3 | Rendah-sedang (keamanan) | Halaman Next.js tidak mengirim header keamanan (hanya API) | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` | Diverifikasi lewat respons nyata; seluruh alur browser tetap berjalan |
| 4 | Rendah (keamanan) | Tautan yang berasal dari data (lowongan, materi, kutipan) tidak disaring skema | `safeUrl()` hanya mengizinkan http(s) di 6 komponen | tsc dan build bersih |
| 5 | Rendah | Lint di `main` gagal (3 galat ruff: 2 f-string tanpa placeholder, 1 urutan impor); langkah CI "Lint" akan gagal | Diperbaiki | `ruff check .` bersih |
| 6 | Rendah (bahasa) | Label klaster (14 klaster lama) masih Inggris di tampilan Indonesia | Label Indonesia; versi Inggris disimpan di `clusters_en` | Terlihat di halaman Karier |
| 7 | Rendah (UX) | Setiap halaman memicu galat 401 merah di konsol (pemeriksaan sesi staf untuk tamu) | `GET /api/staff/session?probe=1` menjawab 200 `{"role": null}` untuk tamu; panggilan polos tetap 401 | Tes baru di `test_launch.py`; jaringan browser menunjukkan 200 |

Temuan tambahan dari uji lanjutan (malam 21 Okt):

| # | Tingkat | Masalah | Perbaikan | Bukti |
| --- | --- | --- | --- | --- |
| 8 | Sedang (tampilan) | **Halaman depan bergeser ke samping di ponsel** (lebar halaman 440 px pada layar 375 px): kartu karier terlalu lebar karena nama karier panjang dan tombol tidak boleh turun baris | `grid-cols-1`, kartu boleh menyempit, tombol boleh membungkus teks | Tes Playwright ponsel baru lulus; tangkapan layar menunjukkan kartu muat |
| 9 | Rendah (aksesibilitas) | Tombol centang "Tandai selesai" di halaman Belajar hanya 20x20 px (batas WCAG 2.2: 24x24 px) | Tombol 24 px dengan kotak gambar tetap 20 px | Tes Playwright ponsel mengukur ulang |
| 10 | Rendah (teks) | Beranda masih menulis "karier teknis" padahal kini ada 20 karier termasuk bisnis | Diganti "karier" | Terlihat di beranda |

## 5. Performa

**Lokal (SQLite):** semua halaman publik dan dashboard menjawab di bawah 70 ms; setelah perbaikan #1, jumlah query terbesar per halaman adalah 9.

**Situs online (Railway + Neon, kode lama dari `perbaikan-be-ai`), diukur 21 Okt:**

| Endpoint | Waktu | Catatan |
| --- | --- | --- |
| `GET /api/meta` | 11,3 detik (stabil) | 44 query x ±0,26 detik: dipakai beranda untuk daftar karier |
| `GET /api/careers/graph` | 32,8 detik (panggilan pertama), 6,1 detik (berikutnya) | 22 query x ±0,28 detik; pertama kali membangun konteks 20 role |
| `GET /students/{id}/careers` | 7,1 detik | 25 query |
| `GET /students/{id}/dashboard` | 2,3 detik | |
| Membuat profil demo | 5,9 detik | |
| Alur demo Playwright (online) | 31 detik | lokal: 5 detik |

Jadi **satu pertanyaan ke database di server online memakan ±0,26 detik**. Perbaikan #1 (44 jadi 5, 22 jadi 3, 25 jadi 6 query) memperkirakan `/api/meta` ±1,3 detik, `/api/careers/graph` ±0,8 detik, dan `/careers` ±1,6 detik setelah dipasang di Railway (perkiraan dari jumlah query; belum diukur karena belum dipasang). Pembangunan konteks 20 role saat panggilan pertama (32 detik) belum ditangani dan perlu pemanasan saat server mulai.

## 6. Belum diuji

Daftar sebelumnya sudah dikurangi banyak (PostgreSQL, Redis, Playwright, situs online, dan ponsel kini diuji). Yang tersisa:

- **Model ONNX penuh** (±470 MB, tidak diunduh). Yang diuji: kesamaan hasil tokenizer SentencePiece dengan tokenizer acuan (1 tes lulus) dan seluruh alur di situs online yang memakai jalur ONNX di Railway.
- **Konsol admin setelah login** dan **asesmen 24 soal sampai selesai di layar** (tes API menutupinya).
- **Aksesibilitas penuh**: pembaca layar dan keyboard menyeluruh. Yang diuji: tampilan ponsel, nama kontrol, label formulir, atribut `alt`, bahasa halaman, satu `h1` per halaman, ukuran sentuh.
- **Peramban selain Chromium.**
- **Uji beban** tidak diulang; dan **perbaikan #1 belum terpasang di Railway**, jadi percepatannya baru perkiraan.
- **Validitas produk** (bukan bug kode): bobot bukti dan soal belum dikalibrasi dengan data pengguna; presisi ekstraksi separuh uji 0,79 (target 0,80); validasi pakar hanya untuk Business Analyst.

## 7. Risiko tersisa

1. **Token mahasiswa di `localStorage`** (desain "kunci akses"): kerentanan XSS apa pun akan membocorkannya. Mitigasi yang ada: tanpa `innerHTML`, tautan disaring, CSP bagian pembingkaian. CSP penuh dengan `script-src` bernonce belum ada.
2. **`POST /api/demo/profile` publik** membuat baris di database (dibatasi 20/menit per IP, profil dihapus setelah 2 hari). Penyalahgunaan bisa menambah ukuran data.
3. **`GET /api/postings` publik** menampilkan teks lowongan lengkap, termasuk dari Kalibrr yang syaratnya melarang menyalin tanpa izin (catatan Ivan di `docs/ops/DATA_SOURCES.md`). Perlu keputusan tim (`PATHSYNC_EXCLUDED_SOURCES`, izin tertulis, atau potong tampilan).
4. **Repo privat vs kewajiban mengirim tautan GitHub** ke panitia: juri tidak bisa membuka repo privat.
5. **Kuis tidak diawasi:** jawaban bisa dibantu pihak lain; hanya bisa ditulis sebagai keterbatasan.
6. **Kredit Railway trial** hanya ±30 hari: cukup sampai 28 Okt, lalu perlu diperpanjang bila demo daring dipakai setelahnya.
7. **Format angka:** tampilan Indonesia masih memakai titik desimal pada sebagian angka (mis. "0.47") dan bukan koma.
8. **Cakupan tes rendah** pada `embeddings.py` (69%), `extraction/llm.py` (71%), `migrate.py` (73%), `sync_agent.py` (76%).

## 8. Cara mengulang

```bash
cd backend
python -m pipeline.build_market --extractor lexicon --ref 2026-10-06 && python -m pipeline.expert_study
python -m pytest -q --cov=pathsync --cov=api
python -m ruff check .
python -m pip_audit -r requirements.txt
cd ../frontend && npm ci && npx tsc --noEmit && npm run build && npm audit --omit=dev
```

Skrip probe kontrol akses, input rusak, dan pembatasan laju yang dipakai audit ini tidak disimpan di repo; pola uji yang bisa diulang sudah dijadikan tes di `backend/tests/test_query_budget.py`, `test_upload_hardening.py`, dan `test_launch.py`.
