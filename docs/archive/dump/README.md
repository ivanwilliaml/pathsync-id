# dump/

File yang tidak dipakai oleh aplikasi maupun pipeline, disimpan untuk arsip. Tidak ada kode di luar folder ini yang mengimpor atau membacanya.

| File | Asal | Kenapa di sini |
|---|---|---|
| `backend/scrapers/kemnaker_dataset.py` | `backend/scrapers/` | Pengunduh Dataset Pasar Kerja Kemnaker 2022–2024. Hasilnya tidak dipakai peta permintaan maupun evaluasi. |
| `backend/data/raw/kemnaker/*.csv` | `backend/data/raw/kemnaker/` | Tabel agregat lowongan per jabatan, lapangan usaha, dan pendidikan (2022–2024). Konteks untuk paper, bukan input sistem. |

Untuk memakainya lagi, pindahkan kembali ke lokasi asalnya (`python -m scrapers.kemnaker_dataset` dijalankan dari `backend/`).
