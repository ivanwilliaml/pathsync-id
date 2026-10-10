# Audit PathSync — Frontend, Backend, AI, Database

Tanggal: 11 Oktober 2026 · Basis: commit `9fc099e` (main) · Hasil perbaikan: branch `platform-v1`

Semua temuan **kritis** dan **tinggi** dibuktikan dengan uji langsung, bukan hanya dibaca dari kode. Setiap temuan yang diperbaiki punya tes regresi di `backend/tests/`.

## Ringkasan

| Tingkat | Jumlah | Diperbaiki | Catatan |
|---|---|---|---|
| Kritis | 4 | 4 | integritas bukti & keamanan, semua dengan tes regresi |
| Tinggi | 9 | 9 | |
| Sedang | 12 | 11 | 1 tersisa: kalibrasi ekstraktor butuh anotasi emas (manusia) |
| Rendah | 7 | 6 | |

Dampak terukur:
- Dasbor median **19,4 → 10,6 ms**, dan GET tidak lagi menulis ke DB.
- Upload 6 MB yang dulu memblokir server 22 detik sekarang ditolak (413) dalam milidetik.
- Kerentanan npm produksi **7 → 0**.
- Tes **23 → 36** (+ CI otomatis).

## Kritis

| ID | Area | Temuan & bukti | Perbaikan |
|---|---|---|---|
| K1 | AI / BE | **Replay asesmen.** Kunci jawaban dikirim balik setelah submit, dan butir yang sama boleh dijawab ulang tanpa batas. Satu butir SQL di-replay 6× menaikkan penguasaan **0,11 → 0,999**. Ini meruntuhkan klaim inti "diagnosis berbasis bukti". | Sesi asesmen (`AssessmentSession`): server hanya menerima butir yang memang diterbitkan, tiap butir sekali, sesi sekali pakai dan kedaluwarsa 2 jam. Butir yang sudah dijawab tidak pernah diterbitkan lagi; kalau bank habis, sistem mengarahkan ke bukti proyek. Tes: `test_assessment_sessions_block_replay`. |
| K2 | AI | **Iklan lowongan diterima sebagai "proyek".** Teks lowongan yang di-paste dikreditkan **19 skill**, termasuk "mahir". Daftar kata kunci juga lolos. Bobot proyek 0,3 di pers. (2). | `artifact_checks`: (1) kemiripan TF-IDF terhadap korpus lowongan; (2) deteksi bahasa persyaratan (baris "Mampu/Minimal/Experience in", judul "Kualifikasi") — menangkap **63/94 lowongan yang belum pernah dilihat** dengan **0 false positive** pada contoh proyek asli; (3) kepadatan istilah skill (keyword list). Salinan lowongan ditolak (422); yang mencurigakan masuk antrean review dan dihitung setengah bobot. Rubrik heuristik (tanpa LLM) dibatasi maksimal "mandiri". Tes: `test_project_evidence_and_integrity`. |
| K3 | BE | **Tanpa autentikasi/otorisasi.** Siapa pun yang tahu ID bisa membaca dan mengubah data mahasiswa, mengaktifkan model, memicu scraping, atau memilih atas nama pakar lain (`expert_id` diambil dari body request). | Token bearer per mahasiswa (hanya hash SHA-256 yang disimpan). Token staf berperan: admin, pakar, dosen. ID pakar diambil dari token, bukan dari body. CORS dibatasi asal yang dikonfigurasi. Tes: `test_student_routes_require_their_own_token`, `test_staff_routes_require_admin`. |
| K4 | BE | **DoS lewat upload.** Endpoint upload `async def` menjalankan parsing PDF dan embedding di event loop; teks 6 MB diterima dan **memblokir semua request selama 22 detik**. | Batas 5 MB per file dan 200 ribu karakter teks, whitelist ekstensi, endpoint CPU-berat dijalankan sync (threadpool), rate limit per IP. Tes: `test_upload_limits`. |

## Tinggi

| ID | Area | Temuan | Perbaikan |
|---|---|---|---|
| T1 | DB | Tidak ada migrasi (`create_all` saja): kolom baru tidak akan pernah sampai ke DB yang sudah ada (SQLite tim maupun PostgreSQL produksi). | Alembic: `0001_baseline` (di-autogenerate dari skema lama) + `0002_platform`. DB lama otomatis di-stamp lalu di-upgrade (diuji: data tetap utuh). CI menguji migrasi pada DB kosong. |
| T2 | BE | `GET /dashboard` menulis riwayat (efek samping di GET). Pemicu "pasar berubah" hanya tercatat kalau mahasiswa membuka halaman. | Dasbor read-only. Perubahan pasar dipropagasikan ke semua mahasiswa terdampak saat snapshot berubah (pipeline, simulasi, reset). Tes: `test_dashboard_is_read_only`, `test_market_simulation_propagates_to_students`. |
| T3 | BE | `load_context` memanggil `ensure_seed` (iterasi semua sisi + commit) di **setiap** request; graf, pasar, dan kutipan dibangun ulang tiap request; `recommend` dihitung dua kali saat submit. | Cache konteks per (peran, snapshot aktif, model aktif, epoch). Epoch naik saat snapshot/model/graf berubah. `ensure_seed` hanya saat startup. |
| T4 | AI | Akurasi diagnostik Laplace: 0/2 benar → 0,25, **lebih tinggi** dari prior tanpa bukti (0,10). | Koreksi tebakan klasik: e = (acc − 0,25)/(1 − 0,25). Sekarang 0/2 → 0. Tes: `test_guess_corrected_accuracy_is_not_above_prior_when_all_wrong`. |
| T5 | AI | Bobot 0,2/0,25/0,3/0,5 tanpa dasar (juga dikritik juri). | `pathsync/calibration.py`: dasar inverse-variance (rasio galat eksplisit), kalibrasi empiris otomatis dari pasangan bukti-lalu-asesmen (Dirichlet-MAP, aktif hanya bila lebih akurat pada data uji), dan analisis sensitivitas. Ditemukan sekaligus bug pembagian nol saat bobot hasil fit = 0 (sudah diperbaiki, ada tesnya). |
| T6 | AI | Flag "perlu review manusia 20%" ada, tapi tidak ada alur review; rating tetap dihitung penuh. | Antrean review proyek di Admin: setujui/koreksi level/tolak. Status `pending` = setengah bobot, `rejected` = tidak dihitung. |
| T7 | FE | CLI `shadcn` ada di dependency runtime → **7 kerentanan high** ikut ke produksi. | Dipindah ke devDependencies → `npm audit --omit=dev`: **0**. CI memeriksanya. |
| T8 | Ops | Dockerfile frontend tidak menyalin `public/` → semua gambar 404 di container. Kedua container berjalan sebagai root, tanpa healthcheck. Password DB tertulis di compose. | `public/` disalin, user non-root, healthcheck, secrets wajib dari `.env` (`.env.example` disediakan). |
| T9 | Ops | Tidak ada CI untuk tes, lint, atau build. | `.github/workflows/ci.yml`: ruff + pytest (dengan pembangunan DB demo) + uji migrasi; tsc + audit + build frontend. |

## Sedang

| ID | Area | Temuan | Status |
|---|---|---|---|
| S1 | BE | Endpoint anotasi N+1 query, `annotation_next` memuat semua lowongan; gold dari beberapa anotator di-union (bias recall). | Diperbaiki: satu query, gold = mayoritas anotator, plus **Cohen's kappa** antar-anotator. |
| S2 | BE | `expert_study` menumpuk model "LTR v1" baru setiap dijalankan. | Diperbaiki: model simulasi lama diganti. |
| S3 | BE | Pesan error campur bahasa Indonesia dan Inggris. | Diperbaiki: semua Inggris (sesuai UI). |
| S4 | BE | `api/main.py` 864 baris, satu file. | Dipecah menjadi 7 router per domain. |
| S5 | AI | `diagnostic_plan` bisa memilih butir yang sama dua kali kalau butir mudah habis. | Diperbaiki (dedupe). |
| S6 | AI | Riwayat tidak menyimpan p, sehingga alasan perubahan tidak bisa menyebut bukti ("penguasaan naik 0,35 → 0,72"). | Diperbaiki. |
| S7 | DB | Tidak ada mekanisme hak subjek data (UU PDP No. 27/2022). | Ekspor JSON + hapus total, versi persetujuan tersimpan. Tes: `test_data_export_and_erasure`. |
| S8 | FE | Identitas mahasiswa = ID di localStorage tanpa rahasia. | Kunci akses (ID + token); otomatis keluar kalau token tidak valid. |
| S9 | FE | `/assessment` menganggap daftar kosong sebagai "selesai"; tidak menangani kehabisan butir per skill. | Menangani 409 dengan arahan ke bukti proyek. |
| S10 | BE | `load_skills()` membangun ulang 42 objek di setiap pemanggilan (puluhan kali per request). | Di-cache. |
| S11 | Dep | `requirements.txt` tidak di-pin (`>=`). | Di-pin + `requirements-dev.txt`. |
| S12 | AI | **Ekstraktor leksikon menggelembungkan soft skill generik** ("good communication skills" di 70% lowongan BA). Akibatnya mahasiswa tanpa bukti mendapat "Komunikasi" sebagai prioritas #1. LLM (Qwen3) justru melewatkan soft skill eksplisit (Jaccard 0,34). | **Terbuka**: butuh 150 anotasi emas untuk memilih ekstraktor dan mengkalibrasi ambang (alat & kappa sudah ada di Admin). |

## Rendah

R1 typo/konsistensi label (diperbaiki) · R2 header keamanan HTTP (`nosniff`, `DENY`, `no-referrer`; ditambahkan) · R3 request ID + log request lambat (ditambahkan) · R4 handler 500 generik tanpa bocoran stack trace (ditambahkan) · R5 timer rencana studi menolak submit di detik yang sama (diperbaiki) · R6 kode lint (ruff bersih) · R7 *tersisa*: rate limiter masih in-process; di belakang beberapa worker perlu Redis.

## Batasan yang tetap jujur

1. Volume data: 45 lowongan BA dalam jendela 12 bulan (dari 2 snapshot). Tren 6-vs-6 bulan baru terisi setelah snapshot bulanan menumpuk.
2. Bobot model peringkat masih dari pakar tersimulasi. Panel pakar nyata belum ada.
3. Baseline "LLM generik" (Qwen3-8B) perlu dijalankan ulang di Kaggle karena skenario berubah mengikuti pasar terbaru. Fingerprint skenario mencegah hasil lama dipakai untuk skenario baru.
4. Detektor salinan lowongan menangkap 63/94 lowongan yang tidak ada di korpus. Sisanya tetap dibatasi rubrik "mandiri" dan bisa masuk sampel review 20%.
