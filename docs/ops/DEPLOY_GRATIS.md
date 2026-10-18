# Deploy gratis full-stack (Vercel + Render + Neon)

Biaya Rp0, tanpa kartu kredit (dicek 18 Okt 2026).

| Bagian | Layanan | Paket gratis | Catatan |
|---|---|---|---|
| Frontend (Next.js) | Vercel Hobby | `nama.vercel.app` | `/api/*` di-rewrite ke backend |
| Backend (FastAPI) | Render Free, Docker | 512 MB RAM, 0,1 CPU | Tidur setelah 15 menit tanpa akses; bangun ±1 menit, indeks siap ±5 menit |
| Database | Neon Free | 0,5 GB Postgres | Project `pathsync`, Singapura; sudah berisi peta pasar dan validasi |

Hugging Face Spaces tidak dipakai: per Oktober 2026 Space Docker di CPU gratis mensyaratkan langganan PRO (API menolak
dengan 402).

## Kenapa backend muat di 512 MB

Versi biasa (`backend/Dockerfile`) memakai PyTorch untuk model embedding dan butuh ±1 GB. Versi Render
(`deploy/render/Dockerfile`) memakai model yang sama lewat onnxruntime (`PATHSYNC_EMBED_BACKEND=onnx`):

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
2. **Render**: login di render.com pakai GitHub → New → **Blueprint** → pilih repo `ivanwilliaml/pathsync-icc2026`
   (izinkan akses Render ke repo privat ini) → Render membaca `render.yaml`. Isi:
   - `PATHSYNC_DATABASE_URL` = connection string Neon
   - `PATHSYNC_PROXY_SECRET` = string acak panjang (`python -c "import secrets;print(secrets.token_urlsafe(32))"`)
   Build pertama ±10 menit. Cek `https://pathsync-api.onrender.com/api/health`.
3. **Vercel**: Add New Project → repo yang sama → Root Directory `frontend` → Environment Variables:
   `PATHSYNC_API` = URL Render, `PATHSYNC_PROXY_SECRET` = sama dengan di Render. Deploy.
4. Bila URL Vercel bukan `pathsync-icc2026.vercel.app`, ubah `PATHSYNC_CORS_ORIGINS` di Render.

## Kenapa ada PATHSYNC_PROXY_SECRET
Semua request browser masuk lewat Vercel, jadi di mata backend semua pengunjung ber-IP Vercel dan rate limit terbagi.
`frontend/src/proxy.ts` meneruskan IP pengunjung di header `x-pathsync-client-ip` bersama secret; backend
(`pathsync/security.py`, `_from_trusted_frontend`) hanya percaya header itu bila secret cocok.

## Sebelum demo ke juri
- Buka `…onrender.com/api/health/ready` 5–10 menit sebelumnya sampai menjawab 200.
- Rebuild data: jalankan pipeline di laptop dengan `PATHSYNC_DATABASE_URL` Neon (bukan di Render; 0,1 CPU terlalu lambat).
