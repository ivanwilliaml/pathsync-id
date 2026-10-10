# Jawaban atas Catatan Juri Semifinal

Skor semifinal 82,63 (rata-rata 4 juri). Nilai terendah ada di **Metodologi & Kelayakan Teknis** (78–88) dan **Tinjauan Pustaka & Positioning** (78–84). Dokumen ini memetakan setiap catatan juri ke perubahan **di produk yang berjalan**, bukan hanya di naskah: di mana melihatnya dan bukti angkanya.

| # | Catatan juri | Jawaban singkat | Lihat di produk |
|---|---|---|---|
| 1 | Kaitan ke pengalaman belajar di kelas kurang, fokusnya ke karier | Rute kini berjangkar pada mata kuliah semester berjalan, ditambah siklus rencana–refleksi mingguan dan tampilan kohort untuk dosen | `/classroom`, `/advisor` |
| 2 | Daftar keterampilan BA perlu dipastikan final | Kriteria "final" yang terukur dan dicek otomatis pada data: BA **lulus 3/3** (37 inti + 5 berdekatan) | `/how-it-works` → "Is the skill list final?", `GET /api/taxonomy/report` |
| 3 | Model LLM yang dipakai belum disebut | Model card: tiap model, perannya, dan apa yang **tidak pernah** dikerjakan LLM | `/how-it-works` → "Models we use", `GET /api/model-card` |
| 4 | Bentuk mesin keputusan kurang jelas | Spesifikasi 5 tahap + panel "How was this decided?" yang menampilkan angka asli setiap mahasiswa | Panel skill di `/dashboard`, `docs/DECISION_ENGINE.md` |
| 5 | Bobot 0,2/0,3/0,5 belum ada alasannya | Dasar inverse-variance (rasio galat eksplisit) + kalibrasi otomatis dari data + analisis sensitivitas | `/how-it-works` → "Why evidence is weighted this way" |
| 6 | Kelompok pembanding uji pengguna terlalu sederhana | 4 lengan (daftar lowongan, rencana AI generik, PathSync tanpa adaptif, PathSync penuh), pengacakan minimisasi, instrumen hasil di dalam produk | Admin → User Studies, `docs/STUDY_PROTOCOL.md` |
| 7 | Jadwal 10 minggu melewati tenggat lomba | Pembangunan sudah selesai; sisa pekerjaan adalah validasi manusia yang dipadatkan menjadi 4 minggu paralel | `docs/ROADMAP.md` |

---

## 1. Pengalaman belajar di kelas (bukan hanya karier)

**Masalah yang ditangkap juri:** paper menempatkan pengalaman belajar sebagai sasaran utama, tetapi produk semifinal hanya menghubungkan mahasiswa ke lowongan dan materi daring di luar kelas.

**Yang dibangun:**
- **Course Companion** (`/classroom`). Mahasiswa memasukkan mata kuliah semester ini. Tiap mata kuliah dipetakan ke skill (katalog yang sama dengan transkrip + embedding untuk nama di luar katalog), lalu dipotong dengan rute: "Analisis & Perancangan SI — 59% sejalan dengan rutemu; BPMN = langkah rute 2". Untuk skill yang sejalan, ada saran konkret **mengubah tugas kuliah menjadi bukti**. Tugas yang diunggah ditandai asal mata kuliahnya dan menggerakkan rute (pemicu adaptif 1). Coursework menjadi bukti, bukan aktivitas terpisah.
- **Siklus rencana → refleksi mingguan.** Siklus belajar berregulasi diri Zimmerman, yang sudah dikutip paper (II.A.1), sekarang benar-benar ada di produk:
  - **Rencana:** tujuan mingguan disarankan dari langkah rute berikutnya, dipasangkan dengan mata kuliah pendukung dan alokasi menit sesuai jam belajar mahasiswa.
  - **Refleksi:** tujuan selesai, menit aktual, keyakinan, dan hambatan.
  - **Penutup loop:** tujuan "pelajari" yang selesai memicu ajakan asesmen ulang.
- **Pulse kejelasan arah.** Satu butir H1 paper ("I know which skill to learn next and why", skala 1–5) muncul di refleksi dan dasbor. Pengalaman belajar menjadi metrik produk yang terus terukur, bukan hanya diukur sekali di uji pengguna.
- **Tampilan dosen** (`/advisor`). Dosen pembimbing/pengampu melihat kesenjangan kelas terhadap pasar (rata-rata penguasaan vs tingkat yang dibutuhkan, dibobot permintaan), mata kuliah yang paling sering dikaitkan mahasiswa ke rute, kejelasan arah rata-rata, dan tingkat penyelesaian tujuan mingguan. Privasi: agregat baru tampil setelah **k ≥ 5** mahasiswa (diuji otomatis). Mahasiswa bergabung dengan kode kelas dan bisa keluar kapan saja. Ini juga menjawab "Tahap kedua: integrasi dengan pusat karier kampus" di paper III.E.

**Dampak pada positioning:** PathSync menjadi lapisan yang menyambungkan **kelas ↔ kebutuhan industri ↔ belajar mandiri**, bukan sekadar rekomendasi karier.

## 2. Daftar keterampilan BA sudah final?

"Final" didefinisikan sebagai tiga kriteria keluar yang dicek otomatis pada data hidup (`pathsync/governance.py`):

| Kriteria | Definisi | Hasil BA |
|---|---|---|
| C1 Cakupan | ≥ 95% sebutan skill dari lowongan BA terpetakan ke taksonomi | **95,0%** dari 1.266 sebutan (45 lowongan) — lulus |
| C2 Tidak ada celah | Tidak ada klaster kandidat skill baru di ≥ 10% lowongan | Klaster terbesar **4,4%** (mis. "procurement", "troubleshooting") — lulus |
| C3 Grounding | Tiap skill berstatus esensial/opsional ESCO, atau muncul di ≥ 10% lowongan, atau ditambahkan dari bukti ekstraksi | **42/42** — lulus |

Hasilnya **37 skill inti BA** + **5 skill berdekatan** (Python/R, KPI, Power BI, Tableau, BI lain), yaitu skill yang muncul di <10% lowongan BA tetapi inti untuk Data Analyst. Taksonomi dibekukan dengan hash SHA-256 dan versi (`2026.10-v2`), dengan changelog. Penambahan "API & Integrasi Sistem" di v2 adalah contoh mekanisme ekspansi berbasis data yang dijanjikan paper. Peran Data Analyst **belum** final (cakupan 90,8%), dan laporan menyatakannya terang-terangan.

## 3. Model yang dipakai

| Komponen | Model | Peran |
|---|---|---|
| Mesin keputusan | **Bukan LLM.** Model linear learning-to-rank (pers. 4), aktif: "LTR v1" | memutuskan prioritas; setiap bobot bisa diperiksa |
| Membaca lowongan | **Claude** (Anthropic API, structured output terbatas taksonomi) saat API key tersedia; run luring **Qwen3-8B** (Apache-2.0) di Kaggle T4×2 untuk 88 lowongan | ekstraksi skill + kutipan; peta pasar aktif saat ini memakai ekstraktor leksikon sampai F1 vs anotasi emas memutuskan |
| Pemetaan frasa & mata kuliah | `paraphrase-multilingual-MiniLM-L12-v2` (open-source, ID+EN) | normalisasi ambang 0,85 / 0,70 |
| Pelacakan penguasaan | Bayesian knowledge tracing (slip 0,10; guess 0,25; learn 0,10) | memperbarui p setiap jawaban |

LLM **tidak pernah** memilih prioritas, mengestimasi penguasaan, atau menyusun urutan rute. Ini juga tampil di produk.

## 4. Bentuk mesin keputusan

Lima tahap deterministik (input sama → output sama), lengkap di `docs/DECISION_ENGINE.md`:
1. **Bukti → p0:** pers. (2), rata-rata berbobot dari bukti yang ada.
2. **Jawaban baru → p:** BKT, pers. (3).
3. **Fitur:** 7 fitur Tabel 3 (G, R, K, D, T, U, B).
4. **Skor:** pers. (4) f = Σ wᵢ log xᵢ (formula 5 = kasus khusus), lalu peringkat.
5. **Rute:** top-3 + prasyarat yang belum dikuasai, urutan topologis, dan penjelasan 4 pertanyaan.

Di dasbor, setiap prioritas punya panel **"How was this decided?"** (`GET /api/students/{id}/trace/{skill}`) yang menampilkan kelima tahap dengan angka mahasiswa itu sendiri. Tes otomatis memastikan jumlah kontribusi fitur = skor dan peringkat yang ditampilkan konsisten. Paper juga direproduksi persis: Tabel 4 (SQL 0,95 → 0,17) lulus sebagai unit test.

## 5. Alasan bobot bukti

1. **Prinsip:** untuk beberapa ukuran berderau yang independen dari kemampuan yang sama, rata-rata paling akurat membobot tiap sumber dengan 1/σ². Bobot 0,20 : 0,25 : 0,30 : 0,50 setara dengan asumsi eksplisit bahwa galat nilai kuliah **×1,58**, sertifikat **×1,41**, dan proyek **×1,29** dibanding asesmen langsung. Urutannya sejalan dengan piramida Miller (1990): *knows < knows how < shows how* dan bias penilaian diri (Kruger & Dunning).
2. **Diuji oleh produk sendiri:** setiap asesmen ulang adalah ukuran langsung yang bisa dibandingkan dengan bukti tak langsung sebelumnya. Setelah ≥ 30 pasangan, bobot diestimasi ulang (Dirichlet-MAP berpusat di nilai awal) dan **hanya dipakai kalau lebih akurat** pada data uji. Unit test menunjukkan fitting memulihkan sumber yang paling andal dari data sintetis.
3. **Sensitivitas** (kohort sintetis, model & pasar aktif):

| Bobot yang dicoba | Top-3 tetap sama | Galat penguasaan |
|---|---|---|
| Prior terdokumentasi | 100% | 0,105 |
| Acak di sekitar prior (Dirichlet 100 / 30) | 98% / 96% | 0,106 / 0,107 |
| Bobot rata | 94% | 0,112 |
| Dibalik (nilai kuliah paling berat) | **88%** | **0,125** |

Urutan bobot berdampak nyata, tetapi angka persisnya tidak rapuh.

## 6. Kelompok pembanding

Empat lengan, sehingga kontribusi tiap komponen bisa diukur (`docs/STUDY_PROTOCOL.md`):
- **A** daftar skill dari lowongan (kontrol paper)
- **B** rencana "AI generik" (urut permintaan, tanpa diagnosis bukti dan tanpa graf; mewakili "tanya chatbot")
- **C** PathSync tanpa siklus adaptif
- **D** PathSync penuh

Implementasinya:
- **Pengacakan:** minimisasi terstratifikasi per prodi (seimbang di sampel kecil; diuji: 8 peserta → 2-2-2-2).
- **Flag fitur per lengan:** produk benar-benar berubah per lengan, dan hal ini diuji.
- **Instrumen di dalam produk:** H1 pulse kejelasan, H2 rencana belajar dinilai buta oleh pakar dengan kode samaran, H3 menit menyusun rencana, H4 arah perubahan peringkat.
- **Analisis otomatis:** Kruskal–Wallis + Mann–Whitney berpasangan dengan koreksi Holm + rank-biserial.

Power analysis yang jujur: 20/lengan dengan d = 0,9 → power 0,79. Karena itu **D vs A adalah konfirmatori** (pra-registrasi), sedangkan B dan C eksploratif, ditambah opsi desain within-subject untuk H1.

## 7. Jadwal vs tenggat

Paper menjadwalkan 10 minggu karena mengasumsikan pembangunan dari nol. Sekarang **pembangunan sudah selesai dan teruji**: 36 tes backend, CI, Docker, 15 halaman, dan seluruh alat validasi (anotasi + kappa, panel pakar, studi 4 lengan, review proyek). Yang tersisa hanya pekerjaan manusia, dipadatkan menjadi **4 minggu paralel** (`docs/ROADMAP.md`).
