# Deploy gratis full-stack (Vercel + Railway + Neon)

Biaya Rp0, tanpa kartu kredit (dicek 18 Okt 2026). Render dicoba lebih dulu tetapi meminta kartu, jadi backend live di
Railway; langkah Render di bawah tetap berlaku sebagai cadangan.

## Yang sedang live (18 Okt 2026)

| Bagian | Layanan | Alamat / pengaturan |
|---|---|---|
| Frontend | Vercel Hobby, project `pathsync-icc2026` (akun Ivan) | **https://pathsync-id.vercel.app**. Deploy dari CLI, bukan dari git: `cd frontend && vercel link` (project `pathsync-icc2026`) lalu `vercel deploy --prod`. Env: `PATHSYNC_API` = URL Railway, `PATHSYNC_PROXY_SECRET`. Deployment Protection: hanya preview |
| Backend | Railway trial ($5 ≈ 30 hari), service `pathsync-icc2026` | https://pathsync-icc2026-production.up.railway.app. Auto-deploy dari branch **`main`**, Root Directory `/backend`, `RAILWAY_DOCKERFILE_PATH=Dockerfile.railway`, healthcheck `/api/health`, port 8080. Env: `PATHSYNC_DATABASE_URL`, `PATHSYNC_PROXY_SECRET`, `PATHSYNC_ADMIN_TOKEN`, `PATHSYNC_CORS_ORIGINS=https://pathsync-id.vercel.app`, `PATHSYNC_REF_DATE=2026-10-18`, `PATHSYNC_WARMUP=1` |
| Database | Neon Free | Project `pathsync` (Singapura) |

Rahasia tidak ada di repo; minta ke Ivan. Push ke `main` = backend ter-deploy ulang otomatis; frontend perlu
`vercel deploy --prod` manual.

| Bagian | Layanan | Paket gratis | Catatan |
|---|---|---|---|
| Frontend (Next.js) | Vercel Hobby | `nama.vercel.app` | `/api/*` di-rewrite ke backend |
| Backend (FastAPI) | Railway trial (atau Render Free), Docker | 512 MB RAM | Profil demo ±10 dtk, dashboard 2–4 dtk |
| Database | Neon Free | 0,5 GB Postgres | Project `pathsync`, Singapura; sudah berisi peta pasar dan validasi |

Hugging Face Spaces tidak dipakai: per Oktober 2026 Space Docker di CPU gratis mensyaratkan langganan PRO (API menolak
dengan 402).

## Kenapa backend muat di 512 MB

Versi biasa (`backend/Dockerfile`) memakai PyTorch untuk model embedding dan butuh ±1 GB. Versi Render
(`backend/Dockerfile.railway`) memakai model yang sama lewat onnxruntime (`PATHSYNC_EMBED_BACKEND=onnx`):

| Perubahan | Hemat | Dampak, diukur |
|---|---|---|
| Tokenizer SentencePiece, bukan `tokenizer.json` | ±285 MB | ID token identik pada 2.655 frasa taksonomi, mata kuliah dan lowongan (tes `test_onnx_tokenizer.py`) |
| Tabel embedding token: int8, hanya 115 ribu token aksara Latin dari 250 ribu; lapisan transformer tetap float32 (`backend/scripts/quantize_onnx.py`) | model 470 → 130 MB | Pada 300 frasa sampel normalisasi: skill terdekat sama 282/300, pita keputusan (≥0,85 / 0,70–0,85 / <0,70) sama 288/300, selisih similarity rata-rata 0,003. 17 dari 18 yang berbeda adalah hampir seri (selisih skor skill ke-1 dan ke-2 ≤ 0,011). Model int8 penuh dari repo model hanya 245/300, jadi tidak dipakai |
| Indeks deteksi "lowongan ditempel sebagai proyek": n-gram karakter 4 float32, bukan 3–5 | 84 → 20 MB | Keputusan di ambang 0,55 sama: 80 salinan sebagian lowongan semua ≥ 0,77, 5 teks proyek sendiri ≤ 0,28 |

Uji di kontainer `--memory 512m --cpus 0.1` dengan database Neon (branch sementara): siap ±5 menit, memori stabil
±470 MB, 30 mahasiswa simulasi (5 bersamaan): dashboard p50 0,6 dtk, unggah transkrip p50 1,3 dtk / p95 7 dtk, 0 galat
selain batas daftar per IP (disengaja). Sisa ruang ±40 MB: jangan tambah worker.

Peta pasar di Neon dibangun dari laptop dengan PyTorch (`pipeline.build_market`), jadi angka evaluasi tidak berubah.

## Langkah (sekali saja)

1. **Neon** sudah dibuat (project `pathsync`). Connection string: dashboard Neon → Connect.
2. **Railway**: New Project → Deploy from GitHub repo `ivanwilliaml/pathsync-id` → Root Directory `/backend`
   (`backend/railway.json` memilih `Dockerfile.railway`). Isi variabel:
   - `PATHSYNC_DATABASE_URL` = connection string Neon
   - `PATHSYNC_PROXY_SECRET` = string acak panjang (`python -c "import secrets;print(secrets.token_urlsafe(32))"`)
   - `GEMINI_API_KEY` = kunci dari aistudio.google.com (untuk membaca CV dan rubrik proyek)
   Cek `<url-railway>/api/health`.
3. **Vercel**: Add New Project → repo yang sama → Root Directory `frontend` → Environment Variables:
   `PATHSYNC_API` = URL Railway, `PATHSYNC_PROXY_SECRET` = sama dengan di Railway. Deploy.
4. Bila URL Vercel bukan `pathsync-id.vercel.app`, ubah `PATHSYNC_CORS_ORIGINS` di backend.

## Kenapa ada PATHSYNC_PROXY_SECRET
Semua request browser masuk lewat Vercel, jadi di mata backend semua pengunjung ber-IP Vercel dan rate limit terbagi.
`frontend/src/proxy.ts` meneruskan IP pengunjung di header `x-pathsync-client-ip` bersama secret; backend
(`pathsync/security.py`, `_from_trusted_frontend`) hanya percaya header itu bila secret cocok.

## Sebelum demo ke juri
- Buka `https://pathsync-id.vercel.app` dan klik profil demo sekali, 1–2 menit sebelum presentasi.
- Rebuild data: jalankan pipeline di laptop dengan `PATHSYNC_DATABASE_URL` Neon (bukan di server; CPU terlalu kecil).
