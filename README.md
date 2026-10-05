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
  pipeline/      build_market (pembaruan bulanan), expert_study (skenario + simulasi pakar + pelatihan), build_materials,
                 llm_jobs (ekspor/impor run LLM luring di GPU Kaggle)
  api/main.py    REST API FastAPI
  data/seed/     taksonomi 42 skill, graf 50 sisi, 121 materi terbuka, 210 butir soal, katalog mata kuliah & sertifikat
  data/raw/      hasil scraping (snapshot 2026-10-01)
  tests/         uji kesetiaan terhadap contoh paper (Tabel 4 direproduksi persis) + uji API end-to-end
frontend/        Next.js 16 + Tailwind 4: onboarding, profil & bukti, asesmen, dasbor, graf, peta pasar, riwayat, panel pakar, admin
kaggle/          kernel LLM open-weight (Qwen3) untuk ekstraksi lowongan & pembanding "LLM generik"; results/ = keluaran mentah
```

## Menjalankan backend

```bash
cd backend
pip install -r requirements.txt
python -m pipeline.build_market --extractor lexicon   # membangun DB + peta permintaan dari data/raw
python -m pipeline.expert_study                        # 45 skenario, simulasi pakar, latih & daftarkan model
python -m pytest -q tests                              # uji kesetiaan paper + uji API (pakai salinan DB sementara)
uvicorn api.main:app --port 8000                       # dokumentasi interaktif: http://localhost:8000/docs
```

Scraping ulang (pembaruan bulanan): `python -m scrapers.karirhub`, `python -m scrapers.ats`, lalu `python -m pipeline.build_market`.

## Menjalankan frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000, /api/* diteruskan ke backend (ubah lewat PATHSYNC_API)
```

Halaman: `/` onboarding + persetujuan, `/profil` transkrip/sertifikat/CV/proyek/kuesioner, `/asesmen` diagnostik dan `/asesmen/<skill>` asesmen ulang, `/dasbor` (cakupan, prioritas + kartu 4 pertanyaan + kutipan lowongan, jalur + materi, kontrafaktual, profil kompetensi), `/graf`, `/pasar`, `/riwayat`, `/pakar` (validasi sisi, peringkat skenario buta, Kendall W, latih model, laporan evaluasi), `/admin` (pembaruan & simulasi pasar, antrean tinjauan, anotasi + F1).

## Ekstraksi LLM

Dengan Claude: set `ANTHROPIC_API_KEY` (atau paksa `PATHSYNC_EXTRACTOR=llm`), lalu `python -m pipeline.build_market --extractor llm`.

Tanpa kunci API, jalankan model open-weight di GPU Kaggle dengan prompt, taksonomi, dan skema yang sama persis; hasilnya masuk lewat gerbang verifikasi kutipan + normalisasi embedding yang sama:

```bash
cd backend
python -m pipeline.llm_jobs export-postings                          # -> kaggle/jobs/postings.json
python ../kaggle/build_kernel.py postings --user <akun-kaggle>
kaggle kernels push -p ../kaggle/build/postings                     # Qwen3-8B, GPU T4 x2, tanpa internet
kaggle kernels output <akun-kaggle>/pathsync-llm-postings -p ../kaggle/results
python -m pipeline.llm_jobs import-postings ../kaggle/results/llm_results_postings.json
python -m pipeline.build_market --extractor llm                     # memakai cache, tidak memanggil API
python -m pipeline.llm_jobs compare                                  # kesepakatan leksikon vs LLM
python -m pipeline.expert_study
# pembanding "LLM generik" untuk evaluasi peringkat:
python -m pipeline.llm_jobs export-scenarios && python ../kaggle/build_kernel.py scenarios --user <akun-kaggle>
kaggle kernels push -p ../kaggle/build/scenarios   # lalu kernels output -> import-scenarios -> expert_study
```

Tanpa keduanya, sistem memakai ekstraktor leksikon offline dengan kontrak keluaran dan gerbang verifikasi yang sama.
