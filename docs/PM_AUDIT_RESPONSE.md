# Tindak Lanjut Audit Produk Pra-Launch

Menjawab [PM_AUDIT_PRELAUNCH.md](PM_AUDIT_PRELAUNCH.md) (basis `e251bd4`). Status jujur per temuan: **Selesai** (diubah dan diuji), **Sebagian** (ada yang masih harus dikerjakan manusia atau di server produksi), **Belum** (sengaja ditunda, alasannya ditulis).

Hasil uji setelah perbaikan: backend **59 tes lulus** (sebelumnya 36), `ruff` bersih, `tsc` dan `next build` lulus (21 rute), `docker compose config` valid. Uji beban lokal (SQLite, 1 worker): 200 mahasiswa × 30 paralel, **0 galat**, signup p50 131 ms, dasbor p50 102 ms.

## Blocker P0

| # | Temuan | Status | Apa yang berubah | Bukti |
|---|---|---|---|---|
| P0-1 | Opsi terpanjang = benar di 83% soal | **Selesai** | Distraktor ditulis ulang untuk ±175 dari 210 soal (ID dan EN); jawaban benar diringkas bila terlalu panjang | Opsi terpanjang benar: **83% → 16% (EN) / 17% (ID)**; opsi terpendek 10% / 23%; posisi jawaban seimbang. Tes CI `tests/test_item_bank.py` gagal bila salah satu > 30% |
| P0-2 | Rubrik heuristik memberi "mahir", teks sama bisa dikirim 6× | **Selesai** | Level heuristik maks "mandiri" (`HEURISTIC_MAX_LEVEL`); duplikat ditolak lewat MinHash (≥ 0,9 terhadap proyek sendiri maupun mahasiswa lain, 409); sampel review 20% memakai `secrets` (ganti judul tidak membantu); batas 5 proyek/hari (429); kutipan menunjuk jendela di sekitar kata kunci | `test_heuristic_rubric_never_gives_proficient_and_rejects_duplicates`, `test_project_daily_limit` |
| P0-3 | Rate limit bisa dipalsukan, di Docker semua pengguna satu IP | **Sebagian** | `client_ip()` hanya mempercayai `X-Forwarded-For` dari proxy di `PATHSYNC_TRUSTED_PROXIES`, menelusuri rantai dari kanan; kunci tambahan per mahasiswa; Redis opsional (`PATHSYNC_REDIS_URL`); Caddy di compose menimpa header klien; uvicorn `--no-proxy-headers`; signup 20/menit/IP | Dengan loopback tidak dipercaya, header palsu diabaikan dan permintaan ke-21 kena 429 (diuji langsung). `tests/test_client_ip.py`. **Belum diuji di belakang Caddy sungguhan** (tidak ada Caddy di mesin ini); di mode dev lokal loopback dipercaya sehingga header palsu masih bisa memengaruhi kunci |
| P0-4 | Kehilangan akses akun | **Selesai** (magic link email: Belum) | Layar wajib "Save Your Access Key" setelah daftar (Copy, Download .txt, Email It to Me, centang "sudah saya simpan"); 401/403 tidak lagi menghapus sesi diam-diam, melainkan dialog "Enter Your Access Key"; "Create a New Key" di Settings (kunci lama dicabut) | Diuji di browser; `test_rotate_key_invalidates_the_old_one` |
| P0-5 | Request menggantung tanpa batas | **Selesai** | Timeout 30 s (90 s untuk unggahan) dengan pesan "Still processing… your change may already be saved. Reload the page to check"; galat 5xx menampilkan kode `ref` untuk pelacakan | `lib/api.ts` |
| P0-6 | Masih dev server, token demo, SQLite | **Sebagian** | `docker-compose.yml` produksi: Caddy (HTTPS) → Next.js build produksi → FastAPI → PostgreSQL, Redis, sidecar `pg_dump` harian (simpan 14 hari), refresh pasar bulanan; token admin ≥ 32 karakter wajib (aplikasi menolak start di produksi bila lemah atau berisi "demo"); halaman login admin tidak lagi menyebut env var atau path file; Sentry opsional (`SENTRY_DSN`); log JSON per request | `docker compose config` valid; tes penolakan token lemah. **Belum dilakukan:** deploy ke VPS, build image di Docker, latihan restore backup, uptime monitor, token admin baru (harus Anda buat: `openssl rand -base64 48`) |
| P0-7 | Teks persetujuan tidak akurat | **Selesai** | Halaman `/privacy` (Indonesia) dan `/about`; teks persetujuan jujur (sampel review manusia, ringkasan dosen); **opt-in riset terpisah** (checkbox opsional, `PUT /students/{id}/research-consent`, mencabut = keluar dari studi); versi persetujuan `2026-10b` | Diuji di browser; `test_research_consent_is_separate_and_optional`. **Catatan:** alamat kontak di halaman privasi adalah placeholder (`NEXT_PUBLIC_CONTACT_EMAIL`), isi dengan alamat DPO/support sebenarnya sebelum launch |

## AI & rekomendasi

| # | Status | Perubahan |
|---|---|---|
| AI-1 Soft skill jadi prioritas #1 | **Selesai** | Lima soft skill generik (`SUPPORTING_SKILLS`) keluar dari peringkat atas dan tidak lagi jadi langkah prasyarat; tampil di "Practise Alongside". Profil baru kini mendapat Stakeholder Management → Business Process Modeling → SDLC |
| AI-2 Estimasi "Beginner to Advanced 7 jam" | **Selesai** | Kartu rute memakai "modul pertama ±N jam"; total gap tetap ada sebagai keterangan |
| AI-3 Sertifikat cukup diketik | **Selesai** | Kolom tautan kredensial; domain penerbit dikenal (Coursera, Credly, Dicoding, Google, Microsoft, dll.) dihitung penuh, tanpa tautan = klaim bobot 0,5 (`review_status: claimed`). Halaman tidak diambil/diverifikasi otomatis |
| AI-4 Pratinjau pemetaan mata kuliah sebelum simpan | **Belum** | Tabel transkrip sudah bisa diedit sebelum disimpan; pratinjau skill hasil pemetaan belum ada |
| AI-5 Bank soal 5 butir/skill | **Belum** | Butuh penulisan konten per skill (pekerjaan manusia). Catatan: kualitas distraktor kini diuji CI |
| AI-6 Badge "Beta", kolom LLM kosong | **Selesai** | Kartu model menampilkan "Beta: divalidasi dengan 0 pakar nyata; dilatih dari pakar tersimulasi"; kolom baseline LLM disembunyikan selama datanya belum ada |
| AI-7 Klaim Claude API padahal tidak aktif | **Selesai** | How it works hanya menyebut yang aktif ("Keyword and phrase matching (no LLM)"); LLM masuk daftar "planned" |
| AI-8 Enum level berbahasa Indonesia di API | **Belum** | Perlu lapisan i18n; tidak menghambat launch |
| AI-9 Antrean review tanpa SLA | **Sebagian** | Tab Admin → Launch Metrics menampilkan jumlah review menunggu dan yang melewati 72 jam. Siapa reviewernya tetap harus ditetapkan |

## UX / UI

| # | Status | Catatan |
|---|---|---|
| UX-1 Bahasa Indonesia default | **Sebagian** | Format tanggal Indonesia, halaman privasi/tentang, metadata/OG berbahasa Indonesia. **Antarmuka utama masih Inggris**: terjemahan penuh belum dikerjakan |
| UX-2 Angka 80 vs 45 | **Selesai** | "Built from 80 real postings across both roles" |
| UX-3 "no account needed" | **Selesai** | "Free, no email or password" |
| UX-4 Menu staf terlihat tamu | **Selesai** | Menu Team Workspace hanya muncul bila ada sesi staf, dan hanya untuk perannya |
| UX-5 Stepper terpotong | **Selesai** | Grid 2/3/5 kolom, label tidak dipotong |
| UX-6 Footer "research prototype" | **Selesai** | "closed beta" + Tentang, Privasi, Report a Problem |
| UX-7 CTA setelah wizard | **Belum** | |
| UX-8 Pulse terlalu dini | **Selesai** | Pulse baru tampil setelah "See Why and How" dibuka atau kunjungan ke-2 |
| UX-9 Isi otomatis mata kuliah | **Belum** | |
| UX-10 Request duplikat | **Selesai** | `/meta`, `/catalog`, `/model-card` di-cache dan di-dedup di klien (5 menit) |
| OG/favicon/robots/sitemap | **Selesai** | `opengraph-image` (kartu pratinjau WhatsApp), `icon.svg`, `robots.txt`, `sitemap.xml`, `metadataBase` |
| Tombol nonaktif tanpa alasan | **Sebagian** | Sertifikat sudah; form lain belum |

## Backend, produk, kepatuhan

| # | Status | Catatan |
|---|---|---|
| BE-2 Token staf di localStorage | **Selesai** | Login staf menukar kunci dengan cookie `HttpOnly; SameSite=Strict`; tulis lewat cookie wajib header `X-PathSync` (CSRF). Diverifikasi di browser: localStorage tidak berisi token staf |
| BE-3 Token tanpa kedaluwarsa | **Selesai** | Token staf baru kedaluwarsa 30 hari; mahasiswa bisa memutar kunci. CSP header belum |
| BE-4 Lock global embedding | **Selesai** | Lock hanya saat memuat model, maks 2 encode paralel, koneksi cache per-thread |
| BE-5 SQLite | **Sebagian** | `.db` tidak ada di git; PostgreSQL di compose. SQLite diperkuat (timeout 30 s, `synchronous=NORMAL`): uji beban 0 galat. Sebelumnya 20 dari 450 permintaan gagal "database is locked" |
| BE-6 `self_ratings` | **Selesai** | Validasi 1–5 dan kunci harus skill yang ada (422) |
| BE-7 Audit log | **Selesai** | Semua tulis admin dicatat; tab Activity & Reports |
| BE-8 Scraping bulanan | **Sebagian** | Layanan `market-refresh` di compose + hasilnya masuk audit log. Belum berjalan di server |
| §6.2 Daftar tunggu peran | **Selesai** | Form di beranda, rekap di Admin. (Perluasan ke 20 peran: lihat analisis bottleneck terpisah, belum dikerjakan) |
| §6.5–6 Metrik & analitik | **Selesai** | Event first-party (tanpa tracker pihak ketiga), funnel, North Star (re-check lulus ≤ 14 hari), D7, SLA review di Admin |
| §7 Kanal bantuan | **Selesai** | "Report a Problem" menyertakan halaman dan request ID |

## Yang harus Anda kerjakan sebelum launch

1. Buat `.env` dengan `POSTGRES_PASSWORD` dan `PATHSYNC_ADMIN_TOKEN` acak (`openssl rand -base64 48`), isi `PATHSYNC_DOMAIN`, `NEXT_PUBLIC_CONTACT_EMAIL`.
2. Deploy `docker compose up -d --build` di VPS, lalu uji dari HP: daftar, simpan kunci, Quick Check, unggah proyek. Image backend ±2,3 GB.
3. Latihan restore: `gunzip -c backups/pathsync-YYYYMMDD.sql.gz | psql ...` di database kosong.
4. Pasang uptime monitor dan (opsional) Sentry.
5. Hapus data uji auditor (lampiran A) dan bangun database produksi bersih.
6. Tetapkan siapa yang meninjau proyek (SLA 72 jam) dan siapa penerima email privasi/support.
7. Terjemahan Indonesia penuh (UX-1) dan perluasan bank soal (AI-5) adalah pekerjaan pasca-beta.
