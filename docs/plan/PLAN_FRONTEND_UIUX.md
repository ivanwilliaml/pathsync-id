# Rencana Frontend dan UI/UX

Bagian dari [PLAN.md](../../PLAN.md). Dasar temuan: [audit 16 Okt](../audit/AUDIT_2026-10-16.md) (kode USR-n, AI-n, PM-n merujuk ke sana). Rencana backend dan data/AI: [PLAN_BACKEND_DATA_AI.md](PLAN_BACKEND_DATA_AI.md).

Kondisi saat ini (terverifikasi): Next.js 16.3, React 19.3, Tailwind 4, shadcn/ui, 16 halaman, sekitar 6.500 baris TSX. Tidak ada library i18n, tidak ada uji frontend (tidak ada Playwright, Vitest, atau Jest). `tsc` dan `next build` bersih. Tampilan seluler 375 px sudah rapi. Halaman About dan Privacy sudah berbahasa Indonesia, sisanya Inggris.

---

## 0. Prinsip UX

1. **Bukti di atas klaim.** Angka yang terlihat meyakinkan harus punya bukti di belakangnya, dan UI harus memperlihatkan jenis buktinya. Ini prinsip produk, bukan hiasan.
2. **Satu tindakan utama per layar.** Dashboard punya "langkah berikutnya". Skill Map punya "perbaiki dulu". Jangan menambah tombol yang bersaing.
3. **Bahasa yang dipakai mahasiswa, bukan bahasa sistem.** "Penghambat" bukan "bottleneck", "Buktikan" bukan "prove it".
4. **Jujur soal batas.** Beta, data tipis, tren belum tersedia, hasil indikatif, semuanya terlihat dan dijelaskan satu kalimat.
5. **Cepat sampai nilai.** Dari buka halaman sampai melihat prioritas pertama maksimal lima menit tanpa demo, dan satu klik dengan demo.
6. **Dapat dipakai dengan keyboard, di ponsel, dan tanpa animasi.**

---

## 1. Ringkasan prioritas

| ID | Tugas | Syarat MVP | Prioritas | Perkiraan | Kapan |
|---|---|---|---|---|---|
| FE-01 | Bahasa Indonesia untuk alur utama (infrastruktur i18n + terjemahan) | M3 | **P0** | 3 hari (bersama BE-12) | 17-21 Okt |
| FE-02 | Kesiapan yang jujur: "Terbukti" vs "Dari nilai" | M2 | **P0** | 1 hari (bersama AI-05) | 19-20 Okt |
| FE-03 | Istilah dan mikrocopy (glosarium, tooltip) | M3 | P0 | 0,5 hari | 18-19 Okt |
| FE-04 | Uji otomatis alur utama (Playwright) | M4 | P0 | 0,5 hari (bersama BE-06) | 21 Okt |
| FE-05 | Skill Map: ringkasan sekali lihat dan legenda | S4 | P1 | 1 hari | 20-21 Okt |
| FE-06 | Quick Check: progres, waktu, ringkasan hasil, survei akhir | S4 | P1 | 1 hari | 21 Okt |
| FE-07 | Keadaan data: tren belum tersedia, Beta, kesegaran data | S5 | P1 | 0,5 hari | 20 Okt |
| FE-08 | Landing: BA-first, kepercayaan, video demo | M4 | P1 | 1 hari | 19-20 Okt |
| FE-09 | Aksesibilitas dan kinerja (Lighthouse) | — | P1 | 1 hari | 22 Okt |
| FE-10 | Mode demo yang dipandu | M4 | P1 | 0,5 hari | 22 Okt |
| FE-11 | Keadaan memuat, kosong, galat | — | P2 | 1 hari | setelah final |
| FE-12 | Kebersihan sistem desain | — | P2 | 1 hari | setelah final |
| FE-13 | Halaman staf (Admin, Advisor, Experts) | — | P2 | 1 hari | setelah final |

---

## 2. Tugas rinci

### FE-01. Bahasa Indonesia (M3, menjawab USR-1)

**Masalah.** Seluruh UI, soal, dan penjelasan rute berbahasa Inggris, padahal sasarannya mahasiswa Indonesia. `<html lang="en">` tetap. Tidak ada mekanisme bahasa. Bahasa di backend juga global (lihat BE-12), jadi pekerjaan ini bergantung pada BE-12.

**Keputusan teknis (rekomendasi).** Kamus ringan buatan sendiri, bukan library besar. Alasannya: 16 halaman, dua bahasa, dan tidak ada plural yang rumit. Jika kamu lebih suka `next-intl`, hasilnya sama; yang penting kuncinya satu tempat.

**Langkah.**
1. `src/lib/i18n.ts`: tipe `Locale = "id" | "en"`, `useLocale()`, `useT()`, dan kamus `src/lib/messages/{id,en}.ts` dengan kunci bertingkat (`dashboard.nextStep.title`). Locale disimpan di `localStorage` dan `preferences.language` profil (API sudah ada), nilai awal dari `navigator.language` (Indonesia jika diawali `id`).
2. `src/lib/api.ts` mengirim header `Accept-Language` pada setiap permintaan. Cache `useApi` memasukkan locale ke kunci.
3. `<html lang>` diperbarui sesuai locale. Tombol bahasa di `app-shell.tsx` (ID | EN).
4. Terjemahkan dalam urutan alur: landing → pendaftaran dan persetujuan → wizard bukti → Quick Check → dashboard → Skill Map → Job Market → riwayat → pengaturan. Halaman About dan Privacy sudah Indonesia (buat versi Inggris pendek).
5. Format tanggal dan angka mengikuti locale (`format.ts` sudah memakai format Indonesia untuk tanggal).
6. Skrip pemeriksa: tidak ada kunci yang hilang di salah satu bahasa, dan tidak ada string literal teks Inggris di komponen alur utama (pemeriksaan sederhana dengan regex di CI).

**Glosarium (satu sumber, pakai konsisten).**

| Inggris | Indonesia | Catatan |
|---|---|---|
| Role Readiness | Kesiapan Peran | lihat FE-02 untuk dua angka |
| Your Next Step | Langkah Berikutnya | |
| Quick Check | Cek Cepat | |
| Prove It | Buktikan | |
| Fix First | Perbaiki Dulu | |
| Almost There | Hampir Sampai | |
| Your Strengths | Kekuatanmu | hanya yang terbukti |
| Not Proven Yet | Belum Terbukti | |
| Bottleneck | Penghambat | tampilkan penjelasan satu kalimat: "skill ini menahan beberapa skill lain" |
| Skill Map | Peta Skill | |
| Job Market | Pasar Kerja | |
| Path History | Riwayat Rute | |
| Soft Skills From Experience | Soft Skill dari Pengalaman | |
| Beta | Beta | tetap, dengan penjelasan |
| Evidence | Bukti | |
| Asked in X% of postings | Diminta di X% lowongan | |

**Selesai kalau.** Alur BA (landing sampai Skill Map) dapat diselesaikan penuh dalam bahasa Indonesia, tombol bahasa mengganti seluruh teks tanpa muat ulang, tidak ada kunci hilang, dan uji otomatis (FE-04) lulus di dua bahasa.

### FE-02. Kesiapan yang jujur (M2, menjawab AI-7 dan USR-2)

**Masalah (terlihat langsung).** Profil demo hanya punya transkrip, tetapi dashboard menampilkan "Role Readiness 60%", dan Skill Map menaruh dua skill di "Your Strengths" dengan label "Shown by your evidence" padahal buktinya hanya nilai kuliah. Dashboard yang sama menulis bahwa skill itu "no project or assessment evidence yet".

**Desain.**
- Dashboard menampilkan **dua** angka dalam satu cincin atau dua batang: **Terbukti** (asesmen, proyek, sertifikat terverifikasi) dan **Dari nilai** (transkrip). Judul tetap "Kesiapan Peran", dengan keterangan "Hanya yang terbukti dihitung sebagai kuat".
- Pengguna baru tanpa bukti melihat "Belum diukur", seperti yang sudah dilakukan Derik untuk kasus tanpa bukti sama sekali, tetapi diperluas untuk kasus "hanya nilai".
- Di Skill Map: "Kekuatanmu" hanya berisi skill dengan `p_proven ≥ target`. Skill yang tinggi hanya karena nilai muncul di grup baru **"Dari nilai, belum dibuktikan"** dengan tombol "Buktikan".
- Setiap kartu skill memiliki lencana jenis bukti: Cek Cepat, Proyek, Sertifikat, Nilai.

**Bergantung pada.** AI-05 (API `coverage_proven`, `evidence_kinds`).

**Langkah.**
1. `Dashboard` di `lib/api.ts`: tambah `coverage_proven`, `competencies[].evidence_kinds`, `competencies[].p_proven`.
2. `readiness-ring.tsx`: dua nilai. `my-skills.tsx`: fungsi `classify` memakai `p_proven`, tambah status `fromGrades`.
3. Tes komponen atau skenario Playwright: profil demo tidak memiliki skill di "Kekuatanmu" sebelum ada Cek Cepat.

**Selesai kalau.** Profil demo (transkrip saja) menampilkan "Terbukti 0%" atau "Belum diukur", "Dari nilai" sesuai nilai, dan tidak ada skill di "Kekuatanmu".

### FE-03. Istilah dan mikrocopy (menjawab USR-3)

**Langkah.**
1. Komponen `<Term>` dengan tooltip singkat untuk istilah teknis: "Penghambat", "Prasyarat", "Diminta di X% lowongan", "Level yang dibutuhkan".
2. Ganti "Worth Confirming" dengan kalimat yang menjelaskan tindakan: "Nilaimu bagus, tapi belum ada bukti. Buktikan."
3. Legenda singkat di Skill Map dan dashboard: garis hitam pada batang = level yang diminta, isi batang = level sekarang.
4. Semua tombol berupa kata kerja, dan setiap halaman punya satu kalimat "apa yang bisa kamu lakukan di sini".

**Selesai kalau.** Lima pengguna pilot diminta menjelaskan arti "Penghambat" dan "Buktikan" dengan kata mereka sendiri, dan minimal empat benar (diukur di protokol uji, bagian 4).

### FE-04. Uji otomatis alur utama (M4, menjawab PM-6)

**Langkah.** Tambah Playwright di `frontend/` dan satu job CI (bersama BE-06). Skenario: (1) landing memuat 14 karier, (2) klik profil demo, dashboard memuat prioritas pertama, (3) buka Skill Map dan lihat "Perbaiki Dulu", (4) buka Cek Cepat dan jawab satu soal dengan tombol "1", (5) ganti bahasa ke Inggris dan teks berubah. Jalankan di viewport desktop dan 375 px.

**Selesai kalau.** CI menjalankan skenario di dua bahasa dan dua ukuran, dan perubahan yang merusak demo menggagalkan CI.

### FE-05. Skill Map (S4, menjawab USR-4)

Sudah ada kelompok (Fix First, Almost There, Strengths, Not Proven Yet) dan soft skill terpisah. Yang kurang adalah ringkasan sekali lihat.

**Langkah.**
1. Bagian atas: batang bertumpuk jumlah skill per kelompok (Perbaiki Dulu, Hampir Sampai, Kekuatan, Dari nilai, Belum terbukti) dengan angka. Satu pandangan menjawab "mana yang oke, mana yang kurang".
2. Kartu skill ringkas secara bawaan (nama, batang, tindakan). Alasan prasyarat panjang disembunyikan di "Lihat alasan".
3. Urutkan "Perbaiki Dulu" menurut prioritas dan batasi lima teratas, sisanya lewat "Tampilkan semua".
4. Filter: Semua | Hanya yang terbukti | Sesuai klaster.

**Selesai kalau.** Pengguna pilot dapat menjawab dalam 10 detik: "skill mana yang sudah oke, mana yang paling mendesak?" (diukur di protokol uji).

### FE-06. Quick Check (S4, menjawab USR-5)

**Langkah.**
1. Bar progres dan perkiraan waktu ("Soal 3 dari 24, sekitar 6 menit lagi").
2. Layar hasil per skill setelah selesai: level sebelum dan sesudah, jumlah benar, dan apa yang berubah di rute ("Requirements Elicitation naik dari Dasar ke Mandiri; urutan rute berubah").
3. Jeda dan lanjut: jawaban tersimpan per soal sehingga menutup tab tidak menghilangkan kemajuan.
4. Survei tiga pertanyaan di akhir Cek Cepat pertama (BE-08): kejelasan rute, kemauan memulai, kesulitan.

**Selesai kalau.** Pengguna pilot menyelesaikan 24 soal tanpa bertanya "berapa lagi?", dan ringkasan hasil muncul di akhir.

### FE-07. Keadaan data (S5, menjawab AI-8 dan AI-11)

**Langkah.**
1. Tren: jika API mengembalikan `trend: null`, tampilkan "Tren belum tersedia: perlu minimal N posting per periode", bukan nol atau grafik kosong.
2. Beta: lencana "Beta" pada role berdata tipis dengan penjelasan satu kalimat: "Berdasarkan X lowongan, hasil bisa berubah saat data bertambah."
3. Kesegaran: "Data lowongan diperbarui 12 Okt 2026" di Job Market dan dashboard.

### FE-08. Landing (menjawab USR-7 dan PM-1)

**Langkah.**
1. BA-first: kartu Business Analyst paling atas dengan lencana "Divalidasi", sisanya di bawah "Role lain (Beta)". Pencarian singkat untuk 14 role.
2. Bagian kepercayaan: sumber data dengan atribusi, "tanpa email, data bisa dihapus kapan saja", dan retensi 24 bulan (sudah ditepati, Derik).
3. Tombol video demo (setelah video ada, M4).
4. Setelah pilot: satu baris angka nyata ("N mahasiswa, M Cek Cepat selesai"). Jangan menaruh angka palsu atau placeholder yang tampak seperti data.

### FE-09. Aksesibilitas dan kinerja (menjawab temuan umum)

**Langkah.** Jalankan Lighthouse pada landing, dashboard, Skill Map, dan Cek Cepat (mobile dan desktop). Target: aksesibilitas ≥ 95, kinerja ≥ 85 di mobile. Periksa: navigasi dengan keyboard, fokus terlihat, kontras AA, `prefers-reduced-motion`, ukuran target sentuh ≥ 44 px, gambar `webp` dengan `width` dan `height`. Periksa `Skeleton` agar tidak ada loncatan tata letak ("Loading careers…" di landing memicu loncatan).

### FE-10. Mode demo yang dipandu

**Langkah.** Profil demo sudah ada (Rani, Sistem Informasi). Tambahkan tur tiga langkah yang menyorot: prioritas pertama, "Lihat alasan", dan Cek Cepat. Tombol "Mulai ulang demo" yang membuat profil baru. Spanduk demo sudah menyebut hapus otomatis setelah 2 hari.

### FE-11 sampai FE-13 (setelah final)

- **FE-11:** kerangka memuat (skeleton) per halaman, keadaan kosong dengan tindakan ("belum ada riwayat, ambil Cek Cepat"), pesan galat dengan id permintaan (sudah ada) dan tombol coba lagi.
- **FE-12:** rapikan `kit.tsx`, token warna, hapus komponen mati, dokumentasikan sistem desain (`docs/audit/UI_AUDIT.md` memuat dasar).
- **FE-13:** halaman staf tetap Inggris. Perbaiki aksesibilitas dan keterbacaan, dan tambahkan penjelasan di Admin > Annotation untuk anotator baru.

---

## 3. Alur pengguna sasaran (untuk uji dan demo)

1. **Buka landing** → memahami janji dalam 5 detik, melihat bahwa BA divalidasi.
2. **Pilih Business Analyst** atau **demo** → dashboard.
3. **Unggah transkrip** (opsional) → daftar skill dari nilai muncul dengan label "dari nilai".
4. **Cek Cepat** (24 soal, sekitar 8 menit) → rute bergeser, layar hasil menjelaskan perubahan.
5. **Dashboard** → "Langkah berikutnya" dengan alasan dan materi gratis.
6. **Skill Map** → ringkasan sekali lihat, tahu mana yang oke dan mana yang paling mendesak.
7. **Soft skill** → catat pengalaman, tanpa kuis.
8. **Kembali seminggu kemudian** → pulse mingguan, rute diperbarui.

---

## 4. Protokol uji kebergunaan untuk pilot (10 mahasiswa)

Setiap peserta mengerjakan lima tugas tanpa bantuan, dengan pikir-keras (think aloud), sekitar 30 menit. Catat keberhasilan, waktu, dan kutipan.

| # | Tugas | Sukses jika | Target |
|---|---|---|---|
| T1 | "Jelaskan dengan kata-katamu apa yang dilakukan PathSync" setelah 10 detik di landing | Menyebut rute belajar dari lowongan | ≥ 8 dari 10 |
| T2 | Mulai sebagai mahasiswa BA dan sampai ke langkah pertama | Dalam ≤ 5 menit tanpa demo | ≥ 8 dari 10 |
| T3 | Selesaikan satu Cek Cepat | Selesai tanpa berhenti | ≥ 8 dari 10 |
| T4 | "Skill mana yang sudah kuat dan mana yang paling mendesak?" di Skill Map | Jawaban benar dalam ≤ 30 detik | ≥ 8 dari 10 |
| T5 | Jelaskan arti "Penghambat" dan "Buktikan" | Benar | ≥ 8 dari 10 |

Tambahkan SUS (10 pertanyaan standar, versi Indonesia) dan tiga pertanyaan survei di BE-08. Target SUS rata-rata ≥ 70. Hasil di bawah target dicatat sebagai temuan dan masuk ke Bab 5.

---

## 5. Gerbang kualitas frontend

| Gerbang | Perintah | Syarat |
|---|---|---|
| Tipe | `npx tsc --noEmit` | bersih |
| Build | `npx next build` | bersih |
| Alur utama | `npx playwright test` (FE-04) | hijau di dua bahasa dan dua ukuran |
| Kunci bahasa | skrip pemeriksa (FE-01) | tidak ada kunci hilang |
| Lighthouse | FE-09 | aksesibilitas ≥ 95, kinerja ≥ 85 (mobile) |

Beku UI 22 Okt: semua gerbang hijau, atau rollback.
