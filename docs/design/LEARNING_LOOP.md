# Siklus belajar (learning loop)

Versi 20 Okt 2026. Kode: `backend/pathsync/learning_loop.py`, API `backend/api/routers/learning.py`, halaman
`frontend/src/app/learn/practice/[skill]`, komponen `frontend/src/components/learning-loop.tsx`.

## Masalah yang dijawab

Sebelumnya rute berhenti di daftar materi: mahasiswa tahu *apa* yang harus dipelajari, tetapi tidak ada yang membantu
menguasainya atau memeriksa apakah ia sudah paham. Siklus belajar menutup celah itu (learning gap dan evidence gap).

## Empat tahap per langkah rute

| Tahap | Isi | Mengubah penguasaan? |
|---|---|---|
| Pelajari | Materi gratis yang sudah ada di rute | Tidak (tanda "selesai" hanya catatan) |
| Latihan | Soal dasar, terapan, dan kasus berbeda; dinilai di server; umpan balik untuk setiap opsi (miskonsepsi di baliknya) dan satu "inti" | Tidak. Latihan untuk belajar, bukan bukti |
| Buktikan | Cek ulang dengan soal yang belum pernah dilihat (`/assessment/{skill}`), target level ditampilkan sejak awal | Ya, lewat Bayesian knowledge tracing; hanya bukti langsung yang menggerakkan `p_proven` |
| Terapkan / langkah berikutnya | Keputusan deterministik dengan alasannya | — |

## Aturan keputusan (`decide`)

Urutan pemeriksaan:

1. Sudah terbukti (`p_proven` ≥ target): kasus berbeda belum lulus → **transfer**; sudah lulus → **mastered**.
   Skill yang sudah terbukti tidak pernah dikirim kembali ke dasar.
2. Prasyarat belum kuat (p < 0,6) → **prerequisite** (nama prasyarat ditampilkan).
3. Latihan dasar belum lulus → **practice_basic** (belum dicoba) atau **review_basic** (sudah dicoba, belum lulus).
4. Latihan terapan belum lulus → **practice_applied**.
5. Cek ulang terakhir gagal setelah latihan terakhir → **retry** (latihan lagi, lalu cek lagi); selain itu → **prove**.

Lulus tier: minimal 2/3 tugas benar pada percobaan terakhir; kasus berbeda: semua benar. Nilai dari transkrip saja
tidak pernah dianggap terbukti.

## Cakupan konten

- 74 skill punya latihan: 5 skill teratas setiap role (20 role, skill yang tumpang tindih memakai latihan yang sama)
  ditambah UML untuk BA. Total 385 tugas, bahasa Indonesia.
- Skill inti BA: 3 dasar, 3 terapan, 2 kasus berbeda. Skill lain: 2/2/1.
- Penetration testing sengaja tanpa latihan; skill di luar cakupan memakai alur Pelajari → Buktikan.
- **Asal konten:** draf dibantu AI, ditinjau satu anggota tim, **belum ditinjau pakar**. Label ini tampil di halaman
  latihan. Tes `tests/test_learning_loop.py` memeriksa kelengkapan (satu kunci per soal, umpan balik setiap opsi,
  opsi unik, sebaran posisi kunci).

## Data dan privasi

Jawaban latihan disimpan di tabel `practice_attempts` (migrasi 0008), ikut ekspor data dan penghapusan profil.

## Simulasi (bukan bukti tentang manusia)

`python -m pipeline.simulate_loop` → `backend/data/models/loop_simulation.json`. Mahasiswa sintetis memeriksa bahwa mesin
berperilaku sesuai rancangan:

- Satu cek ulang 3 soal menyatakan "terbukti" untuk yang menguasai sekitar 73%, untuk yang hanya menebak sekitar 1,6%
  (sekitar 4,3% bila soal punya petunjuk bentuk opsi).
- Yang sudah menguasai atau belajar lewat latihan selalu menyelesaikan siklus (median 6–9 langkah); hampir tidak ada
  yang dinyatakan menguasai tanpa benar-benar menguasai.
- Kelemahan yang dicatat: yang terus mengulang tanpa belajar bisa "terbukti" karena kebetulan sekitar 4,3%; dibatasi
  oleh jumlah soal cek ulang per skill (5–8).

Ini menguji mesin, bukan dampak belajar. Dampak belajar memerlukan studi dengan mahasiswa nyata
(`docs/plan/EVALUASI_DAMPAK_BELAJAR.md`).
