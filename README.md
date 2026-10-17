# PathSync: Navigator Belajar Adaptif (ICC 2026, Tim cupuu)

Purwarupa kerja dari metodologi paper semifinal *PathSync: Navigator Belajar Adaptif Berbasis Kecerdasan Buatan*. PathSync membaca lowongan kerja nyata Indonesia, memeriksa apa yang sudah bisa dibuktikan mahasiswa, lalu menyusun rute belajar berurutan untuk **hard skill**, lengkap dengan alasan dan materi gratis.

**Cakupan sekarang:** 20 role (Business Analyst sebagai role yang divalidasi penuh, 19 role lain berlabel Beta), 138 hard skill di 20 klaster, 161 prasyarat, 690 soal Cek Cepat, dan 9 soft skill berbasis pengalaman (tanpa kuis, tidak masuk ranking).

**Mulai dari sini:**
- Rencana produk dan prioritas: **[PLAN.md](PLAN.md)**
- Audit terbaru (AI engineer, investor, pengguna, product manager): [docs/audit/AUDIT_2026-10-16.md](docs/audit/AUDIT_2026-10-16.md)
- Rencana backend dan data/AI: [docs/plan/PLAN_BACKEND_DATA_AI.md](docs/plan/PLAN_BACKEND_DATA_AI.md)
- Rencana frontend dan UI/UX: [docs/plan/PLAN_FRONTEND_UIUX.md](docs/plan/PLAN_FRONTEND_UIUX.md)
- Semua dokumen: [docs/README.md](docs/README.md)

Semua angka kinerja ada di satu berkas, `backend/data/models/metrics.json`, yang dihasilkan oleh `python -m pipeline.report`.

## Struktur

```
PLAN.md                  rencana master
docker-compose.yml       produksi: Caddy, frontend, backend, PostgreSQL, Redis, backup, refresh pasar bulanan
backend/
  pathsync/              inti: taksonomi dan graf, ekstraksi (leksikon dan LLM) dengan verifikasi kutipan dan
                         normalisasi embedding, peta permintaan, model bukti dan BKT, ranking, jalur, penjelasan,
                         siklus adaptif, soft skill, retensi data, observabilitas
  api/                   router FastAPI (publik, siswa, asesmen, platform, admin, pakar, dosen, classroom)
  pipeline/              pekerjaan batch yang dijalankan rutin:
                         build_market, expert_study, eval_extractor, report, item_cue_audit, gold, normalisation,
                         calibrate_items, calibrate_weights, llm_jobs, retention, scheduled_refresh, sqlite_to_postgres
    seed_build/          pembangun data seed (taksonomi, graf, materi, kursus, soft skill), dijalankan saat seed berubah
    item_authoring/      alat penulisan dan penyeimbangan soal (arsip kerja, jarang dijalankan)
  scrapers/              Karirhub, Kalibrr, ATS publik, ESCO
  offline_llm/           jalur LLM luring di GPU Kaggle (pembanding ekstraksi dan peringkat)
  data/seed/             taksonomi, graf, soal (Indonesia dengan overlay Inggris), gold, materi, kursus, konteks BPS
  data/models/           hasil ukur dan model terdaftar
  tests/                 tes domain, API, migrasi, retensi, metrik, observabilitas
frontend/                Next.js 16, React 19, Tailwind 4, shadcn/ui
deploy/                  Caddyfile, backup.sh, loadtest.py, explain_queries.py
.github/workflows/       CI (backend SQLite dan PostgreSQL, frontend) dan scraping bulanan
docs/
  audit/                 audit dan tanggapan
  plan/                  rencana per bidang dan roadmap
  ops/                   runbook deploy, protokol studi, panduan anotasi
  design/                desain mesin keputusan
  archive/               dokumen lama dan berkas yang tidak dipakai sistem
```

## Menjalankan backend

```bash
cd backend
pip install -r requirements.txt
python -m pipeline.build_market --extractor lexicon   # membangun DB dan peta permintaan dari data/raw
python -m pipeline.expert_study                        # skenario, simulasi pakar, latih dan daftarkan model
python -m pytest -q                                    # tes (memakai salinan DB sementara)
uvicorn api.main:app --port 8000                       # dokumentasi interaktif: http://localhost:8000/docs
python -m pipeline.report                              # menulis data/models/metrics.json
```

Perbarui data lowongan: `python -m scrapers.karirhub`, `python -m scrapers.kalibrr`, `python -m scrapers.ats`, lalu `python -m pipeline.build_market`. Alembic berjalan otomatis saat server mulai.

Token admin diambil dari `PATHSYNC_ADMIN_TOKEN`. Jika tidak diset, token dibuat ke `backend/data/admin_token.txt`. Produksi menolak token yang lemah.

## Menjalankan frontend

```bash
cd frontend
npm install
npm run build && npm start     # http://localhost:3000, /api/* diteruskan ke backend (ubah lewat PATHSYNC_API)
```

Untuk pengembangan lokal pakai `npm run dev`. Jika repo berada di path yang mengandung spasi atau titik, server pengembangan bisa mengembalikan 404; gunakan build produksi atau pindahkan repo.

## Ekstraksi LLM (opsional)

Dengan Claude: set `ANTHROPIC_API_KEY` (atau `PATHSYNC_EXTRACTOR=llm`), lalu `python -m pipeline.build_market --extractor llm`.

Tanpa kunci API, jalankan model open-weight di GPU Kaggle dengan prompt, taksonomi, dan skema yang sama; hasilnya melewati gerbang verifikasi kutipan dan normalisasi embedding yang sama:

```bash
cd backend
python -m pipeline.llm_jobs export-postings --gold-plus 300         # -> offline_llm/jobs/postings.json
python offline_llm/build_kernel.py postings --user <akun-kaggle>
kaggle kernels push -p offline_llm/build/postings                    # Qwen3-8B, GPU T4 x2, tanpa internet
kaggle kernels output <akun-kaggle>/pathsync-llm-postings -p offline_llm/results
python -m pipeline.llm_jobs import-postings offline_llm/results/llm_results_postings.json
python -m pipeline.llm_jobs compare                                  # kesepakatan leksikon vs LLM
```

Tanpa keduanya, sistem memakai ekstraktor leksikon offline dengan kontrak keluaran dan gerbang verifikasi yang sama (ini yang aktif sekarang).

## Deploy

`cp .env.example .env` (isi rahasia), lalu `docker compose up -d --build`. Caddy (HTTPS), Next.js, FastAPI, PostgreSQL, Redis, cadangan harian, dan refresh pasar bulanan. Langkah rinci, latihan pemulihan, dan bug deploy yang sudah ditemukan: [docs/ops/RUNBOOK.md](docs/ops/RUNBOOK.md). Uji beban: `python deploy/loadtest.py http://127.0.0.1:8000 200 40`.

Login staf memakai cookie sesi HttpOnly (`POST /api/staff/session`); skrip boleh memakai `Authorization: Bearer`.
