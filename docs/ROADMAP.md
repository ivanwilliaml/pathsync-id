# Roadmap

## Status
Pembangunan selesai: backend 88 route, 36 tes, CI, Docker, frontend 15 halaman, alat validasi (anotasi + kappa, panel pakar, studi 4 lengan, review proyek, laporan taksonomi). Sisa = validasi manusia.

## 4 minggu paralel (menggantikan 10 minggu paper)
| Minggu | Data & AI | Pengguna | Kampus |
|---|---|---|---|
| 1 | 150 anotasi emas (2 anotator, kappa) → pilih ekstraktor | rekrut peserta, pra-registrasi H1 | 1 dosen pilot + kode kelas |
| 2 | Re-run baseline LLM generik (Qwen3-8B, Kaggle) | studi 4 lengan berjalan | Course Companion dipakai di 1 mata kuliah |
| 3 | Panel pakar nyata (≥3) → latih ulang LTR | refleksi mingguan & pulse | laporan kohort (k≥5) |
| 4 | Kalibrasi bobot bukti dari pasangan nyata | analisis + laporan | umpan balik dosen |

## Startup
- **Model:** B2B2C — kampus/prodi berlangganan (dasbor dosen, laporan kesenjangan kurikulum vs pasar), mahasiswa gratis.
- **Ekspansi:** peran DA (menunggu C1 ≥ 95%), lalu peran lain dengan mekanisme governance yang sama.
- **Teknis berikutnya:** rate limiter Redis untuk multi-worker, snapshot pasar bulanan terjadwal, PostgreSQL + pgvector di produksi.
