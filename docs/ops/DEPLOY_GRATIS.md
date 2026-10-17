# Deploy gratis full-stack (Vercel + Hugging Face Spaces + Neon)

Biaya: Rp0. Tidak perlu kartu kredit di ketiganya (per Oktober 2026; cek ulang halaman pricing kalau ragu).

| Bagian | Layanan | Paket gratis | Catatan |
|---|---|---|---|
| Frontend (Next.js) | Vercel Hobby | `nama.vercel.app` | `/api/*` di-rewrite ke backend |
| Backend (FastAPI + embedding) | Hugging Face Spaces, Docker, CPU basic | 2 vCPU, 16 GB RAM | Tidur setelah ~48 jam tanpa akses; bangun ±1–2 menit |
| Database | Neon Free | 0,5 GB Postgres | Data tetap ada walau Space restart |

Kenapa bukan Render/Railway: RAM gratis 512 MB tidak cukup untuk model embedding (±1 GB).

Akun harus dibuat sendiri oleh tim (Claude tidak membuat akun / memasukkan password).

## 1. Neon (database)
1. Daftar di neon.tech (login GitHub), buat project `pathsync`, region Singapore.
2. Salin **connection string** (`postgresql://...neon.tech/neondb?sslmode=require`). Boleh ditempel apa adanya; backend mengubah prefiks ke driver psycopg sendiri.

## 2. Hugging Face Space (backend)
1. Daftar di huggingface.co → New Space → nama `pathsync-api`, SDK **Docker**, hardware **CPU basic (free)**, visibility Public.
2. Settings → Variables and secrets, tambahkan sebagai **Secret**:
   - `PATHSYNC_DATABASE_URL` = string dari Neon
   - `PATHSYNC_ADMIN_TOKEN` = string acak panjang (mis. `python -c "import secrets;print(secrets.token_urlsafe(32))"`)
   - `PATHSYNC_PROXY_SECRET` = string acak panjang lain (dipakai juga di Vercel)
   - Variable biasa: `PATHSYNC_CORS_ORIGINS` = `https://<nama>.vercel.app`, `PATHSYNC_REF_DATE` = `2026-10-18`
3. Buat access token (Settings → Access Tokens, tipe Write), lalu dari root repo:
   ```bash
   huggingface-cli login
   sh deploy/huggingface/push.sh <username-hf>/pathsync-api
   ```
4. Build pertama ±10 menit, lalu start pertama membangun peta pasar ke Neon (±7 menit). Cek `https://<username-hf>-pathsync-api.hf.space/api/health`.

## 3. Vercel (frontend)
1. Daftar di vercel.com (login GitHub) → Add New Project → import `ivanwilliaml/pathsync-icc2026`.
2. Root Directory: `frontend`. Framework: Next.js (otomatis).
3. Environment Variables:
   - `PATHSYNC_API` = `https://<username-hf>-pathsync-api.hf.space`
   - `PATHSYNC_PROXY_SECRET` = sama persis dengan di HF
4. Deploy. Setiap push ke branch yang dipilih akan deploy ulang otomatis.

## Kenapa ada PATHSYNC_PROXY_SECRET
Semua request browser masuk lewat Vercel, jadi di mata backend semua pengunjung punya IP Vercel dan rate limit terbagi bersama.
`frontend/src/proxy.ts` meneruskan IP pengunjung di header `x-pathsync-client-ip` bersama secret; backend
(`pathsync/security.py`, `_from_trusted_frontend`) hanya percaya header itu kalau secret cocok, jadi tidak bisa dipalsukan.

## Sebelum demo ke juri
- Buka URL backend 2–3 menit sebelumnya supaya Space bangun dari tidur.
- Untuk rebuild data: Space → Settings → Factory rebuild tidak cukup (DB di Neon). Hapus tabel lewat Neon SQL editor atau jalankan pipeline lokal dengan `PATHSYNC_DATABASE_URL` Neon.
