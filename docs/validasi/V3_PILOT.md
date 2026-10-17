# V3. Pilot Pengguna (10-20 mahasiswa)

Tujuan: bukti pertama dari pengguna sungguhan. Yang diukur adalah **kebergunaan** (bisa dipakai, dipahami, dan memberi arah) dan **perbandingan dengan saran karier umum** seperti dijanjikan Bab III.D. Ini **bukan** uji efektivitas jangka panjang; jangan dilaporkan sebagai bukti dampak terhadap pekerjaan.

Lembar pengamat: [lembar/V3_lembar_pengamat.xlsx](lembar/V3_lembar_pengamat.xlsx). Satu baris per peserta.

---

## 1. Peserta

- **Siapa:** mahasiswa tingkat akhir (semester 5 ke atas) atau lulusan baru maksimal satu tahun, yang tertarik menjadi Business Analyst. Prodi yang cocok: Sistem Informasi, Informatika, Manajemen, Teknik Industri.
- **Berapa:** minimal 10, ideal 20. Usahakan tidak semua dari satu kelas yang sama.
- **Bukan peserta:** anggota tim, orang yang pernah melihat PathSync sebelumnya.
- **Kode peserta:** P01, P02, dst. Nama asli tidak ditulis di lembar pengamat.

**Pesan rekrutmen (siap kirim):**

> Halo! Kami tim PathSync (ICC 2026). Kami sedang menguji aplikasi yang membaca lowongan kerja nyata dan menyusun rute belajar untuk calon Business Analyst. Kami butuh 30-40 menit waktumu untuk mencoba aplikasinya dan menjawab beberapa pertanyaan. Tidak perlu persiapan, tidak perlu email atau kata sandi. Kalau kamu punya transkrip nilai (PDF atau teks), boleh dibawa, tapi tidak wajib. Hasilnya dipakai untuk karya ilmiah kami dan tidak akan menampilkan namamu. Kalau mau ikut, balas dengan jadwal yang cocok antara [tanggal] dan 21 Oktober. Terima kasih!

---

## 2. Persiapan aplikasi

Pilih salah satu, dari yang paling aman:

| Cara | Kapan dipakai | Catatan |
|---|---|---|
| **A. Laptop tim, peserta datang langsung** | Selama deploy publik belum ada | Paling aman dan paling mudah diamati. `npm run build && npm start` di frontend dan `uvicorn` di backend, buka `http://127.0.0.1:3000` |
| **B. Server publik** | Setelah BE-02 (deploy publik) selesai | Bisa daring lewat panggilan video dengan berbagi layar |
| C. Tunnel sementara dari laptop | Hanya bila A dan B tidak mungkin | Membuka laptop ke internet. Pakai token admin yang kuat, nyalakan hanya selama sesi, matikan sesudahnya |

**Sebelum sesi pertama:**
1. Database sudah dibangun dari kode terbaru (`python -m pipeline.build_market`, `python -m pipeline.expert_study`).
2. Buka landing sekali untuk memanaskan model (respons pertama setelah server hidup bisa lambat).
3. Siapkan lembar pengamat dan stopwatch.
4. Siapkan **saran karier umum** (bagian 4) dalam satu halaman, dicetak atau di tab terpisah.
5. Catat bahasa UI yang dipakai saat itu (saat ini UI berbahasa Inggris; bila FE-01 sudah selesai, pakai bahasa Indonesia).

**Setiap peserta membuat profil sendiri** dari tombol "Start Your Path" (tanpa email). Jangan pakai profil demo. Saat pendaftaran, peserta boleh mencentang persetujuan riset (opsional). Hanya data peserta yang mencentangnya yang dipakai untuk kalibrasi soal dan bobot bukti.

---

## 3. Alur sesi (30-40 menit)

Urutan kondisi diselang-seling supaya urutan tidak memengaruhi penilaian: peserta bernomor **ganjil** melihat saran umum dulu, **genap** melihat PathSync dulu. Tulis urutannya di lembar pengamat.

| Menit | Langkah | Yang dicatat |
|---|---|---|
| 0-3 | Pembukaan dan persetujuan (naskah di bawah) | persetujuan lisan ya/tidak |
| 3-8 | **Kondisi saran umum:** peserta membaca halaman saran umum, lalu mengisi 3 pertanyaan penilaian | Q1-Q3 (saran umum) |
| 8-30 | **Kondisi PathSync:** lima tugas di bawah, pikir-keras (think aloud), pengamat tidak membantu | sukses, waktu, kutipan per tugas |
| 30-35 | 3 pertanyaan penilaian untuk PathSync, lalu SUS (10 pertanyaan) | Q1-Q3 (PathSync), SUS1-SUS10 |
| 35-40 | Tiga pertanyaan terbuka | jawaban teks |

**Naskah pembukaan:**

> Terima kasih sudah datang. Kami sedang menguji aplikasinya, bukan menguji kamu, jadi tidak ada jawaban salah. Tolong ucapkan apa yang kamu pikirkan selama mencoba, termasuk kalau bingung. Saya tidak akan membantu selama tugas, tapi kamu boleh berhenti kapan saja. Kami tidak mencatat namamu; jawabanmu disimpan dengan kode [P..]. Data yang kamu masukkan ke aplikasi bisa kamu hapus sendiri dari halaman Settings. Boleh kita mulai?

### Lima tugas PathSync

| # | Instruksi ke peserta | Sukses bila | Catat |
|---|---|---|---|
| T1 | Setelah 10 detik di landing: "Ceritakan dengan katamu, aplikasi ini untuk apa?" | menyebut rute belajar atau skill dari lowongan | ya/tidak, kutipan |
| T2 | "Mulai sebagai calon Business Analyst sampai kamu melihat langkah belajar pertamamu." (boleh tempel transkrip bila membawa) | sampai ke "Your Next Step" di dashboard | ya/tidak, menit |
| T3 | "Kerjakan satu Quick Check sampai selesai." | selesai tanpa berhenti di tengah | ya/tidak, menit, jumlah soal |
| T4 | Di Skill Map: "Skill mana yang sudah kuat, dan mana yang paling mendesak?" | jawaban sesuai tampilan, dalam ≤ 30 detik | ya/tidak, detik |
| T5 | "Apa arti 'Bottleneck' dan 'Prove It' di aplikasi ini?" | penjelasan benar dengan kata sendiri | ya/tidak per istilah |

Bila peserta macet lebih dari 2 menit pada satu tugas, catat "gagal" beserta titik macetnya, lalu lanjut ke tugas berikutnya.

---

## 4. Saran karier umum (kondisi pembanding)

Tunjukkan teks ini apa adanya, tanpa diagnosis peserta. Isinya sengaja seperti saran umum dari artikel atau chatbot: skill yang paling sering diminta lowongan BA, urut dari yang paling sering, tanpa menyesuaikan dengan kondisi peserta dan tanpa prasyarat.

> **Saran untuk menjadi Business Analyst**
>
> Pelajari skill berikut, mulai dari yang paling sering diminta perusahaan:
> 1. Elisitasi kebutuhan (wawancara dan workshop dengan pengguna)
> 2. Dokumentasi kebutuhan (BRD, FSD, user story)
> 3. Pemodelan proses bisnis (BPMN, flowchart)
> 4. Pengujian sistem dan UAT
> 5. Siklus pengembangan sistem (SDLC)
> 6. SQL dan kueri basis data
> 7. Integrasi API dan sistem
> 8. Sistem ERP dan CRM
>
> Ikuti kursus daring, kerjakan proyek, dan perbanyak latihan.

Urutan di atas diambil dari peta permintaan BA saat ini (20 skill teratas di lembar V2). Bila peta pasar dibangun ulang dan urutannya berubah, perbarui teks ini sebelum sesi.

---

## 5. Kuesioner

Bisa dibuat di Google Form, atau diisi langsung di lembar pengamat.

### Penilaian kondisi (dua kali: saran umum dan PathSync), skala 1-5 (1 = sangat tidak setuju, 5 = sangat setuju)

- **Q1.** Saya tahu skill apa yang harus saya pelajari pertama kali.
- **Q2.** Rekomendasi ini sesuai dengan kondisi kemampuan saya saat ini.
- **Q3.** Saya bisa langsung menjalankan langkah pertamanya minggu ini.

### SUS (System Usability Scale), skala 1-5, hanya untuk PathSync

1. Saya rasa saya akan sering menggunakan aplikasi ini.
2. Aplikasi ini terasa rumit tanpa alasan.
3. Aplikasi ini mudah digunakan.
4. Saya rasa saya butuh bantuan orang yang paham teknis untuk bisa memakai aplikasi ini.
5. Fitur-fitur di aplikasi ini terintegrasi dengan baik.
6. Ada terlalu banyak hal yang tidak konsisten di aplikasi ini.
7. Saya rasa kebanyakan orang akan cepat belajar memakai aplikasi ini.
8. Aplikasi ini terasa merepotkan untuk dipakai.
9. Saya merasa yakin saat memakai aplikasi ini.
10. Saya perlu belajar banyak hal sebelum bisa memakai aplikasi ini.

Skor SUS: untuk butir ganjil (skor − 1), untuk butir genap (5 − skor), jumlahkan, kalikan 2,5. Rentang 0-100. Lembar pengamat menghitungnya otomatis.

### Pertanyaan terbuka

1. Bagian mana yang paling membantu?
2. Bagian mana yang membingungkan atau membuatmu ragu?
3. Apakah kamu akan memakai PathSync lagi minggu depan? Kenapa?

---

## 6. Setelah semua sesi

1. **Lembar pengamat** sudah menghitung: tingkat sukses per tugas, median waktu, rata-rata Q1-Q3 per kondisi, dan skor SUS per peserta.
2. **Bandingkan saran umum vs PathSync** untuk Q1-Q3 dengan uji Wilcoxon bertanda (berpasangan). Dengan 10-20 peserta, laporkan efek dan selang, jangan hanya nilai p. Saya bisa menjalankan analisisnya dari lembar yang sudah terisi.
3. **Data dari aplikasi:** Admin > Launch Metrics (aktivasi, waktu sampai prioritas pertama, Quick Check selesai).
4. **Kalibrasi soal** setelah cukup jawaban: `python -m pipeline.calibrate_items` (lihat PLAN_BACKEND_DATA_AI.md, AI-10).
5. **Target dari PLAN.md** (bukan syarat lulus, temuan di bawah target tetap dilaporkan):

| Ukuran | Target |
|---|---|
| T2 sukses (sampai langkah pertama) | ≥ 8 dari 10 |
| Quick Check selesai | ≥ 60% |
| Waktu median sampai langkah pertama | ≤ 5 menit |
| Q1 PathSync rata-rata | ≥ 4,0 dan lebih tinggi dari saran umum |
| SUS rata-rata | ≥ 70 |

**Cara menulis hasilnya di paper:** "uji kebergunaan dengan N mahasiswa", sebutkan prodi dan urutan kondisi yang diselang-seling, laporkan angka beserta keterbatasannya (sampel kecil, satu sesi, bukan efektivitas jangka panjang).
