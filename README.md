# PathSync — Navigator Belajar Adaptif (ICC 2026, Tim cupuu)

Purwarupa kerja (bukan mockup) dari metodologi paper semifinal *PathSync: Navigator Belajar Adaptif Berbasis Kecerdasan Buatan*. Peran target awal: **Business Analyst** (plus **Data Analyst** sebagai peran berdekatan untuk menguji pemicu "ganti peran").

Status lengkap dan langkah berikutnya: lihat **[PROGRESS.md](PROGRESS.md)**.

## Struktur

```
backend/
  scrapers/      Karirhub Kemnaker, ATS publik (Workable, Workday, Lever, Greenhouse, SmartRecruiters, Ashby, Recruitee), ESCO API, Dataset Pasar Kerja Kemnaker
  pathsync/      inti: taksonomi+graf, ekstraksi (LLM/leksikon) + verifikasi kutipan + normalisasi embedding,
                 peta permintaan (pers. 1), model bukti (pers. 2) + BKT (pers. 3), fitur Tabel 3 + LTR (pers. 4-5),
                 jalur + penjelasan + kontrafaktual + cakupan (pers. 6), siklus adaptif + riwayat, evaluasi
  pipeline/      build_market (pembaruan bulanan), expert_study (skenario + simulasi pakar + pelatihan), build_materials
  api/main.py    REST API FastAPI
  data/seed/     taksonomi 42 skill, graf 50 sisi, 121 materi terbuka, 210 butir soal, katalog mata kuliah & sertifikat
  data/raw/      hasil scraping (snapshot 2026-10-01)
  tests/         uji kesetiaan terhadap contoh paper (Tabel 4 direproduksi persis)
frontend/        Next.js 16 + Tailwind 4 (scaffold; halaman belum ditulis — lihat PROGRESS.md)
```

## Menjalankan backend

```bash
cd backend
pip install -r requirements.txt
python -m pipeline.build_market --extractor lexicon   # membangun DB + peta permintaan dari data/raw
python -m pipeline.expert_study                        # 45 skenario, simulasi pakar, latih & daftarkan model
python -m pytest -q tests
uvicorn api.main:app --port 8000                       # dokumentasi interaktif: http://localhost:8000/docs
```

Scraping ulang (pembaruan bulanan): `python -m scrapers.karirhub`, `python -m scrapers.ats`, lalu `python -m pipeline.build_market`.

Ekstraksi dengan LLM (Claude) aktif otomatis bila `ANTHROPIC_API_KEY` di-set, atau paksa dengan `PATHSYNC_EXTRACTOR=llm`. Tanpa kunci, sistem memakai ekstraktor leksikon offline dengan kontrak keluaran dan gerbang verifikasi yang sama.
