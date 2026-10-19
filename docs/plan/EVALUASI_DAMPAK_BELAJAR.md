# Protokol evaluasi dampak belajar (siap dijalankan, belum dijalankan)

Versi 20 Okt 2026. Status: **rencana**. Belum ada data; tidak boleh dikutip sebagai hasil.

## Pertanyaan

Apakah siklus belajar PathSync (latihan + umpan balik + cek ulang + keputusan adaptif) meningkatkan penguasaan
kompetensi yang terverifikasi dibanding belajar dari daftar materi saja?

## Desain

- Peserta: mahasiswa yang menyiapkan magang atau posisi entry-level (target awal 20–40 orang), satu keluarga role (BA).
- Pengacakan ke dua kelompok: **siklus** (rute + latihan + cek ulang) dan **pembanding** (rute dengan materi yang sama,
  tanpa latihan dan keputusan adaptif). Kelompok pembanding mendapat akses penuh setelah studi.
- Skill: dua skill inti BA (Elisitasi Kebutuhan, Dokumentasi Kebutuhan).

## Instrumen

- **Pra-tes dan pasca-tes paralel**: bank soal per skill dibagi menjadi bentuk A dan B dengan tingkat kesulitan seimbang
  (5–8 soal per skill tersedia; soal yang dipakai di tes tidak dipakai untuk latihan atau cek ulang selama studi).
- **Tugas praktik**: satu kasus singkat (menulis 3 requirement yang dapat diuji dari catatan wawancara), dinilai dua
  penilai dengan rubrik 4 kriteria (jelas, lengkap, konsisten, dapat diverifikasi), buta terhadap kelompok.
- **Transfer**: satu kasus dari domain berbeda.
- **Retensi**: tes singkat bentuk C setelah jeda (minimal 7 hari).

## Analisis (dikunci sebelum data dikumpulkan)

- Hasil utama: selisih kenaikan skor (pasca − pra) antarkelompok, dengan selang kepercayaan 95% (bootstrap).
- Hasil pendukung: skor tugas praktik (rata-rata dua penilai), kesepakatan antarpenilai (weighted kappa), transfer,
  retensi, dan waktu belajar.
- Semua hasil dilaporkan, termasuk hasil nol atau negatif. Keterbatasan (sampel kecil, durasi pendek) ditulis terbuka.

## Yang dibutuhkan untuk menjalankan

Peserta, dua penilai (idealnya praktisi BA), dan ±1 minggu. Kode untuk pengacakan dan analisis dapat disiapkan dari
data `practice_attempts` dan `assessment_responses` yang sudah tercatat.
