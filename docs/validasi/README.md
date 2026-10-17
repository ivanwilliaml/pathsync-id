# Paket Validasi Manusia (V1-V4)

Empat pekerjaan yang hanya bisa dilakukan manusia, dan menentukan nilai Metodologi. Semua lembar kerja sudah dibuat di [lembar/](lembar/), siap dibagikan. Tidak perlu menjalankan aplikasi untuk V1, V2, dan V4.

| Kode | Pekerjaan | Siapa | Berapa orang | Waktu per orang | Berkas yang dibagikan |
|---|---|---|---|---|---|
| **V1** | Anotasi skill di 130 lowongan | Mahasiswa atau alumni yang paham lowongan kerja (IT, bisnis, akuntansi). **Bukan** orang yang menulis alias atau kode ekstraksi | 2 (wajib), +1 penengah | 3-4 jam, boleh dicicil | `lembar/V1_anotasi_lowongan_anotator1.xlsx`, `..._anotator2.xlsx` |
| **V2** | Validasi prasyarat dan relevansi skill Business Analyst | Dosen sistem informasi atau praktisi BA (minimal 2 tahun) | 1 minimal, 3 ideal | 60-90 menit | `lembar/V2_pakar_BA.xlsx` (satu salinan per pakar) |
| **V3** | Pilot pengguna | Mahasiswa tingkat akhir (target BA: Sistem Informasi, Manajemen, Informatika) | 10-20 | 30-40 menit | aplikasi + [V3_PILOT.md](V3_PILOT.md) |
| **V4** | Label 300 frasa normalisasi | Sama seperti V1, boleh orang yang sama | 2 | sekitar 1 jam | `lembar/V4_normalisasi_pelabel1.xlsx`, `..._pelabel2.xlsx` |

**Urutan yang disarankan:** bagikan V1, V2, dan V4 hari ini (bisa dikerjakan di rumah). V3 butuh aplikasi yang bisa dibuka peserta, jadi jadwalkan setelah ada server (lihat V3_PILOT.md bagian 2).

**Tenggat dari PLAN.md:** V1 dan V4 kembali paling lambat **19 Okt**, V2 **19 Okt**, V3 selesai **21 Okt**.

**Aturan yang sama untuk semua:** kerjakan sendiri, jangan melihat jawaban orang lain, jangan membuka halaman Job Market atau hasil sistem selama mengerjakan, dan kirim berkas kembali tanpa mengubah kolom `id`.

---

## V1. Anotasi skill lowongan

**Apa yang dinilai:** apakah ekstraktor menemukan skill yang benar dari teks lowongan. Hasilnya menjadi presisi, recall, dan kappa yang dilaporkan di paper (target presisi > 0,80 dan kappa ≥ 0,70).

**Isi lembar** (sheet "Lowongan"): 130 lowongan. 100 dari set terkunci untuk 14 role awal (50 dev, 50 uji), ditambah 30 untuk 6 role bisnis (`gold_split_bisnis.json`). Kolom: nomor, id, peran, judul, teks lowongan lengkap, **skill** (diisi), catatan. Sheet "Daftar skill" berisi 138 id skill dengan nama dan contoh kata.

**Cara mengisi:**
1. Baca seluruh teks lowongan.
2. Di kolom kuning **skill**, tulis id skill dari "Daftar skill", dipisah koma. Contoh: `sql, excel, requirements_elicitation`.
3. Lowongan tanpa skill dari daftar: tulis `none`.
4. Ragu: pilih yang paling spesifik, tulis alasannya di catatan.

**Aturan hitung** (lengkap di [PANDUAN_ANOTASI.md](../ops/PANDUAN_ANOTASI.md), termasuk tabel skill yang tumpang tindih):
- Dihitung: syarat atau tugas eksplisit, daftar alternatif ("Python, R, atau sejenis"), nilai tambah ("diutamakan"), alat kerja yang disebut.
- Tidak dihitung: bidang gelar, nama perusahaan atau produknya, domain bisnis tanpa kemampuan, **soft skill** (komunikasi, kerja tim, kepemimpinan), benefit.

**Setelah kembali** (tim):
```bash
cd backend
python -m pipeline.gold import-sheet anotator1 <berkas-anotator1.xlsx>
python -m pipeline.gold import-sheet anotator2 <berkas-anotator2.xlsx>
python -m pipeline.gold status
python -m pipeline.gold consensus          # sengketa -> data/models/gold_agreement.json
# penengah memutuskan sengketa di data/seed/gold_adjudication.json, lalu consensus sekali lagi
python -m pipeline.eval_extractor --gold gold_consensus.json --split test
python -m pipeline.report
```

---

## V2. Validasi pakar Business Analyst

**Apa yang dinilai:** (1) apakah urutan prasyarat di graf benar, yang menjadi dasar klaim "titik hambat", dan (2) apakah skill yang paling banyak diminta lowongan memang penting untuk lulusan baru BA, yang menjadi precision@k menurut penilai industri (Bab III.D).

**Isi lembar:**
- **Prasyarat:** setiap baris "skill A sebaiknya dikuasai sebelum skill B", dengan alasan yang ditulis tim. Pakar memilih **Setuju / Tidak setuju / Ragu** (dropdown) dan boleh memberi komentar.
- **Usulan prasyarat:** pasangan yang menurut pakar penting tetapi belum ada.
- **Relevansi skill:** 20 skill BA yang paling sering diminta lowongan. Pakar memilih **Wajib / Penting / Pelengkap / Tidak relevan** untuk lulusan baru.

**Pesan untuk pakar (siap kirim):**

> Selamat siang Bapak/Ibu [nama]. Kami tim PathSync (ICC 2026), sistem yang menyusun rute belajar mahasiswa dari lowongan kerja nyata. Kami memohon bantuan Bapak/Ibu sebagai pakar Business Analyst untuk memeriksa dua hal: urutan prasyarat antar-skill dan relevansi skill untuk lulusan baru. Waktunya sekitar 60-90 menit melalui satu berkas Excel, tanpa perlu membuka aplikasi. Nama dan instansi Bapak/Ibu akan kami cantumkan sebagai validator di karya ilmiah bila berkenan. Bila bersedia, berkasnya kami kirim hari ini, dan kami mohon kembali paling lambat 19 Oktober. Terima kasih banyak.

**Setelah kembali** (tim):
```bash
cd backend
python -m pipeline.expert_sheet import <berkas.xlsx> --name "<nama pakar>" --affiliation "<instansi>" --kind dosen
# atau --kind praktisi
python -m pipeline.report
```
Aturan validasi sisi: 2 dari 3 pakar setuju. Bila hanya ada satu pakar, laporkan sebagai "divalidasi 1 pakar" dan jangan menulis "tervalidasi pakar" tanpa jumlahnya. Precision@20 relevansi skill dicatat per pakar di `data/models/expert_skill_relevance.json`.

---

## V3. Pilot pengguna

Lihat [V3_PILOT.md](V3_PILOT.md): pesan rekrutmen, persetujuan, lima tugas, lembar pengamat, kuesioner, perbandingan dengan saran karier umum, dan cara menjalankan aplikasi untuk peserta.

---

## V4. Label normalisasi frasa

**Apa yang dinilai:** apakah sistem memetakan frasa bebas di lowongan ("menjalankan campaign iklan berbayar") ke skill yang benar. Ini menentukan ambang pemetaan otomatis (target presisi ≥ 0,95) dan memperbaiki temuan bahwa sekitar 54% pemetaan otomatis salah (pre-label AI, belum manusia).

**Isi lembar** (sheet "Frasa"): 300 frasa dengan kalimat asal, urutan diacak, tebakan sistem tidak ditampilkan. Kolom kuning **label** berupa dropdown: 138 id skill dan `none`.

**Cara mengisi:**
1. Baca frasa dan kalimat asalnya.
2. Pilih id skill yang dimaksud, atau `none` bila bukan skill, soft skill, atau skill yang tidak ada di daftar.
3. Dua skill sama-sama cocok: pilih yang paling spesifik, tulis yang lain di catatan.

**Setelah kembali** (tim):
```bash
cd backend
python -m pipeline.normalisation import <pelabel1.xlsx> <pelabel2.xlsx>
python -m pipeline.normalisation eval      # kurva presisi-cakupan dan ambang terpilih
python -m pipeline.report
```

---

## Ringkasan: apa yang berubah di paper setelah ini selesai

| Klaim | Sebelum | Sesudah |
|---|---|---|
| Presisi ekstraksi | 0,828, satu anotator (AI), batas bawah selang 0,7486 | angka paruh uji gold konsensus dua manusia + kappa |
| Ambang normalisasi | 0,85 / 0,70 tanpa dasar | dipilih dari kurva presisi-cakupan label manusia |
| Graf prasyarat | 0 sisi divalidasi pakar | jumlah sisi disetujui, ditolak, dan pakar yang menilai |
| Relevansi skill teratas | tidak ada | precision@20 menurut pakar BA |
| Dampak ke mahasiswa | tidak ada data | aktivasi, waktu ke prioritas pertama, SUS, perbandingan dengan saran umum |
