# Revisi PathSync dari Audit Dosen Pembimbing (23 Oktober 2026)

Dokumen ini mencatat keputusan atas setiap rekomendasi di `recommendation.md`, perubahan yang dikerjakan, dan
perbandingan sebelum/sesudah. Kode di branch `revisi/audit-dosen` (dari `main` setelah PR #6 dari Derick),
commit `cd6e206` dan `e1da346`. Belum di-merge ke `main` dan belum di-deploy.

## 1. Yang disetujui dan dikerjakan

| ID | Keputusan | Yang dikerjakan |
|---|---|---|
| DATA-01 (P0) | Setuju, bug terbukti | Setiap sebutan skill diberi status: wajib, nilai tambah, salah satu pilihan, dikecualikan, tidak pasti, atau sekadar disebut. Yang dikecualikan tidak masuk permintaan, skor kesiapan, dan langkah pertama. 18 kasus uji, termasuk 14 kasus dari tabel audit. |
| COMP-01 (P0) | Setuju, bug terbukti | Transkrip nilai A dengan pemetaan 1,0 dulu menghasilkan p = 1, dan jawaban salah tidak bisa menurunkannya. Sekarang bukti tidak langsung saja dibatasi 0,60, dan p dijaga di 0,01–0,99 sebelum BKT. |
| COMP-04 (P0) | Setuju | Sertifikat kursus tidak lagi dihitung "terbukti". Sertifikat berbasis ujian (TOEIC dan sejenisnya) tetap dihitung terbukti. |
| COMP-02 (P0) | Sebagian | Makna p ditulis di Bab III ("peluang memenuhi kriteria Quick Check, bukan tingkat kemahiran kerja"). Label di aplikasi tidak dirombak. |
| CLAIM-01/02 (P0) | Setuju, terbukti di situs | Situs dulu menulis "dilatih dengan expert rankings" padahal Formula (5) yang aktif. Sekarang ditulis Formula (5) aktif dan belum ada model terlatih. Jumlah pakar dipisah: 3 pakar graf, 1 pakar keputusan. Tabel NDCG diberi label "simulasi, bukan penilaian manusia". Hasil V5 ditampilkan dengan pembanding. |
| CLAIM-03 | Setuju, temuan baru | Di produksi, kunci LLM tidak aktif. Artinya CV dan proyek dinilai dengan leksikon dan heuristik rubrik, bukan LLM seperti tertulis di proposal. Proposal dan tabel AI sudah dikoreksi. |
| TRACE-01 (P0) | Setuju | Situs menampilkan 1.363 (semua lowongan tersimpan), proposal menulis 1.323 (yang masuk jendela 12 bulan). Situs sekarang memakai 1.323, sama dengan proposal, dan proposal menjelaskan keduanya. Berkas validasi V5, uji ketahanan, simulasi, dan uji pengguna yang selama ini belum di-commit sekarang masuk repo. |
| SCOPE-01 / ROLE | Setuju | Jumlah peran di registry = **20, termasuk BA** (bukan BA + 20). Framing lintas peran ditambahkan di abstrak, Bab I, dan Bab III. Keterbatasan validasi per peran ditulis. Halaman Tentang dulu menulis 14 peran, sekarang 20. |
| GRAPH-01 | Setuju | Gambar 7, Gambar 8, Tabel 5, dan contoh penjelasan memakai graf final. Elisitasi menjadi titik hambat, menggantikan SQL yang ditolak pakar. Angka Tabel 5 dihitung ulang dengan formula (5). |
| RANK-01/06 | Setuju | Bab II dan III menyebut Formula (5) sebagai versi aktif. Tabel fitur menandai K dan B berbobot 0. Klaim kontrafaktual disesuaikan dengan yang benar-benar dihitung. |
| EVAL-01 | Setuju sebagian | H2 berstatus "belum diuji" di Bab IV dan V. Paket penilaian buta disiapkan di `docs/validasi/penilaian_buta/`: rubrik, dua lembar acak, kunci, dan skrip analisis. Penilaiannya **harus dilakukan dua orang**, bukan AI. |
| EVAL-02/03 | Setuju | Selisih NDCG dengan pembanding terdekat: 0,021, IK 95% [0,001; 0,048] dari bootstrap per profil. Unit 32 penilaian dijelaskan (4 skill × 8 profil). Spearman dihitung ulang dengan mesin baru: tetap 0,84. |
| EVAL-04/05 | Setuju | 70% ditulis sebagai proporsi sampel. Subkelompok dilaporkan: 29 data sendiri, 18 demo, 32 mahasiswa aktif. Urutan pengisian dijelaskan (cara biasa dinilai sebelum mencoba). 94% "rencana lebih baik" ditegaskan sebagai penilaian diri, bukan H2. |
| EVAL-09 | Setuju | 11 lowongan yang lolos sebagai proyek dianalisis: 7 sempat diberi tingkat mandiri, 0 mahir, sehingga label diturunkan dari "Kuat" ke "Cukup". Kontrol 4–5/6 karena sampel acak. Negasi: 97 → 38 dari 100 masih wajib. |
| FRAME-01/02/03 | Setuju, perubahan kecil | Pengangguran ditulis sebagai konteks, bukan hasil yang diukur. Perbandingan survei 2022 dengan angka pengangguran 2026 dihapus. Klaim chatbot dan kurikulum diperhalus. |
| DATA-03/04 | Setuju | Snapshot 18 Okt disebut. "38 dari 65" ditulis berlaku untuk korpus ini. Bab III jujur bahwa bagian uji juga menjadi dasar pemilihan ekstraktor. |
| CLAIM-04 | Setuju | Jadwal memisahkan uji pengguna 22 Okt dan revisi 23–28 Okt. Deklarasi AI dilengkapi: kode, pra-anotasi, dan draf soal. |
| OPS-02 | Setuju sebagian | Kalimat ditambahkan: biaya belum mencakup waktu tim untuk tinjauan. Honor dan insentif tetap tidak ada, sesuai keputusan Anda. |
| COMP-06/07 | Setuju | Bobot ditulis sebagai asumsi rancangan. Kalimat "BKT disesuaikan dengan data uji coba" dihapus karena tidak benar; parameter BKT memang belum dikalibrasi. |

## 2. Yang tidak disetujui atau tidak dikerjakan

| ID | Alasan |
|---|---|
| EVAL-04 (overlap dengan "20 peserta awal"), EVAL-06 (SUS 71,1 → 81,9) | Anda sudah memutuskan uji pengguna lama tidak dibahas sama sekali. Proposal hanya memakai 47 responden. |
| DATA-06 (pertahankan hasil negatif *embedding* 0,433 di proposal) | Sesuai keputusan Anda, konten pemetaan otomatis tetap dihapus. Di kode, pemetaan otomatis memang mati (`EMBEDDING_AUTO=0`) dan Cek Lowongan tidak memakai *embedding*, jadi tidak ada klaim yang salah. |
| EVAL-01 (dinilai sekarang) | Penilaian buta perlu dua penilai manusia. Kalau AI yang menilai, hasilnya sama saja dengan menyajikan data AI sebagai validasi manusia. Paketnya sudah siap; tinggal diisi. |
| DATA-05 (dua anotator independen), EVAL-02 (pakar tambahan), EVAL-07 (pembanding chatbot), EVAL-11 / LONG-01 (studi longitudinal) | Butuh orang dan waktu yang tidak tersedia sebelum 28 Okt. Ditulis sebagai keterbatasan dan rencana. |
| ROLE-01 (kontrak `RoleDefinition` baru), COMP-05 (provenance bukti), LEARN-01 (tugas autentik per peran), RESOURCE-01 (metadata materi lengkap) | Refactor besar beberapa hari sebelum final berisiko merusak demo. Audit sendiri menyebut ini tidak wajib bila tidak menghambat. |
| RANK-02 (berhenti memprioritaskan gap kecil) | Perlu kebijakan yang diuji di profil lain; menambah ambang hanya agar satu skenario pakar cocok justru dilarang audit. Tetap di Rencana Pengembangan. |
| UX-03 (label "demo" di aplikasi) | Derick baru saja menghapus label demo dengan sengaja (PR #6). Itu keputusan UX tim, jadi saya tidak membalikkannya. Proposal tetap menyebut 18 responden memakai profil demo. Silakan diskusikan dengan Derick. |
| Turnitin [ISI] | Harus diisi dari hasil cek sungguhan; tidak boleh dikarang. |
| Skor rubrik estimasi (45/60) | Bukan instruksi kerja. |

## 3. MVP: sebelum dan sesudah

| Hal | Sebelum | Sesudah |
|---|---|---|
| Contoh audit di Cek Lowongan ("SQL tidak diperlukan. Python tidak dibutuhkan.", profil Rani) | Skill wajib: Elisitasi, Dokumentasi, **SQL, Python**; kesiapan 50,2%; langkah pertama **Python** | Skill wajib: Elisitasi, Dokumentasi; SQL dan Python tampil dicoret sebagai "Tidak diminta"; kesiapan 63,8%; langkah pertama Elisitasi |
| "Python atau Java" / "SQL nilai tambah" | Semua dihitung wajib | Hanya satu pilihan yang dihitung (yang paling dekat dengan kemampuan mahasiswa). Nilai tambah ditampilkan, tapi tidak masuk skor. |
| Transkrip A saja (pemetaan 1,0) | p0 = 1,00; jawaban salah → tetap 1,00 | p0 = 0,60; jawaban salah menurunkan p |
| Sertifikat kursus | Dihitung "terbukti" | Bukti tidak langsung; hanya sertifikat ujian yang dihitung terbukti |
| Cakupan Rani (semua bukti / bukti langsung) | 60,9% / 52,3% | 60,6% / 40,5% (jalur tetap Elisitasi → SDLC → API, 22,2 jam) |
| Halaman Metode, kartu model | "Beta: divalidasi 3 pakar nyata; dilatih dengan expert rankings" | "3 pakar menilai graf BA; 1 pakar menilai urutan pada 16 skenario. Belum ada model terlatih yang aktif." + hasil uji manusia NDCG 0,972 / 0,951 / 0,726 |
| Tahap "Ranking model" | "bobot dipelajari dari ranking pakar" | "Formula (5) aktif; LTR ada di kode, belum dilatih" |
| Tabel NDCG di Metode & beranda | "kesesuaian dengan peringkat pakar" | "uji ranking dengan pakar simulasi, bukan penilaian manusia" |
| Halaman Tentang | "mendukung 14 peran" | "mendukung 20 peran", dengan keterangan kedalaman validasi per peran |
| Jumlah lowongan di situs | 1.363 | 1.323 (dalam jendela peta pasar; 1.363 tersimpan) |

Dampak ke angka penelitian, diukur ulang:
- **Ekstraksi:** F1 tetap 0,806.
- **Peta permintaan:** 2 dari 19.961 sebutan dikecualikan, keduanya benar. Peringkat permintaan per peran tidak berubah.
- **Spearman diagnosis:** 0,843 → 0,840 (3 dari 32 nilai p berubah).
- **NDCG dan simulasi:** tidak berubah.
- **Uji negasi sintetis:** 97 → 38 dari 100 masih wajib. Dua pola masih gagal, yaitu "Tanpa X pun tidak masalah" dan "Not required: X". Aturan sengaja tidak disetel pada set uji ini.
- **Tes:** 231 lulus. Satu tes `test_expert_panel_flow` gagal, dan tes itu sudah gagal di `main` sebelum perubahan ini.

## 4. Proposal: sebelum dan sesudah

PDF: `PathSync_Final_ICC2026.pdf`, 17 halaman (sebelumnya 15). Gambar dan tabel yang diganti:
- **Gambar 7:** graf final dengan Elisitasi sebagai titik hambat.
- **Gambar 8:** ilustrasi dashboard dengan contoh Elisitasi.
- **Tabel 5:** dihitung ulang dengan graf final.
- **Tabel 13:** ditambah baris H2 "Belum", dan NDCG diberi konteks satu pakar.
- **Tabel 17:** angka uji ketahanan terbaru.

Daftar lengkap kalimat sebelum dan sesudah:

### Abstrak (`meta.tex`)

1. **Sebelum:** navigator belajar adaptif berbasis AI dengan tiga mekanisme utama:
   **Sesudah:** navigator belajar adaptif berbasis AI yang dirancang lintas peran, dengan tiga mekanisme utama:

2. **Sebelum:** MVP sudah berjalan daring untuk 20 peran dan 138 keterampilan dari 1.323 lowongan.
   **Sesudah:** MVP sudah berjalan daring untuk 20 peran dan 138 keterampilan dari 1.323 lowongan (*snapshot* 18 Oktober 2026), dengan validasi mendalam dimulai dari peran *Business Analyst*.

3. **Sebelum:** penilaian kemampuan PathSync berkorelasi 0,84 dengan penilaian pakar BA, dan urutan belajarnya mencapai NDCG@5 0,972 terhadap urutan pakar.
   **Sesudah:** penilaian kemampuan PathSync berkorelasi 0,84 dengan penilaian satu pakar BA, dan urutan belajarnya mencapai NDCG@5 0,972 terhadap urutan pakar tersebut, sedikit di atas pembanding terdekat (0,951).

4. **Sebelum:** kejelasan arah naik dari 2,3--2,7
   **Sesudah:** kejelasan arah yang dirasakan naik dari 2,3--2,7

5. **Sebelum:** Pengujian juga menemukan kelemahan, antara lain kalimat negasi pada lowongan yang masih terbaca sebagai persyaratan. Dampak jangka panjang terhadap penguasaan keterampilan belum diukur dan menjadi tahap berikutnya.
   **Sesudah:** Pengujian juga menemukan kelemahan. Kalimat negasi pada lowongan semula terbaca sebagai persyaratan; setelah diperbaiki, 38 dari 100 kalimat uji masih terbaca demikian. Kualitas rencana belajar yang dinilai buta dan dampak jangka panjang terhadap penguasaan keterampilan belum diukur.


### Bab I-III (`isi.tex`)

1. **Sebelum:** Kebutuhan keterampilan di dunia kerja kini berubah lebih cepat daripada kurikulum diperbarui.
   **Sesudah:** Kebutuhan keterampilan di dunia kerja kini berubah cepat, dan mahasiswa perlu menerjemahkan sendiri apa yang dipelajari di kampus menjadi keterampilan yang diminta lowongan.

2. **Sebelum:** sehingga keputusan mereka tentang apa yang perlu dipelajari menjadi kurang tepat [5].
   **Sesudah:** sehingga keputusan mereka tentang apa yang perlu dipelajari menjadi kurang tepat [5]. Pengangguran juga dipengaruhi jumlah lowongan, lokasi, dan pengalaman kerja, sehingga angka ini dipakai sebagai konteks, bukan sebagai hasil yang diukur penelitian ini.

3. **Sebelum:** yang sering menuntut keterampilan teknis di samping pemahaman bisnis. Kelompok inilah yang menjadi sasaran awal PathSync.
   **Sesudah:** yang sering menuntut keterampilan teknis di samping pemahaman bisnis. PathSync dirancang untuk berbagai peran kerja; *Business Analyst* dipilih sebagai peran awal yang divalidasi paling mendalam karena lowongannya banyak tersedia dan relevan bagi kelompok ini.

4. **Sebelum:** hanya sekitar 3 persen peserta yang menyelesaikan kursusnya [7].
   **Sesudah:** hanya sekitar 3 persen peserta yang menyelesaikan kursusnya [7], sehingga akses ke materi belum tentu disertai arah belajar yang jelas.

5. **Sebelum:** merasa keterampilannya sudah sesuai kebutuhan industri [8], padahal lebih dari satu juta lulusan perguruan tinggi belum bekerja. Jarak antara persepsi dan kenyataan ini menunjukkan bahwa mahasiswa sering tidak memiliki gambaran yang jelas tentang keterampilan yang sebenarnya dituntut.
   **Sesudah:** merasa keterampilannya sudah sesuai kebutuhan industri [8]. Survei tahun 2022 itu tidak membandingkan penilaian diri dengan hasil tugas, sehingga tidak membuktikan bahwa mahasiswa salah menilai dirinya. Namun, temuan ini menunjukkan bahwa penilaian diri tidak cukup dijadikan satu-satunya dasar untuk memilih apa yang dipelajari.

6. **Sebelum:** Jawaban *chatbot* umum disusun dari teks umum di internet, bukan dari lowongan Indonesia terkini, dan tidak dapat memeriksa apakah mahasiswa benar-benar menguasai suatu keterampilan.
   **Sesudah:** *Chatbot* umum dapat memberi saran yang berguna, tetapi tanpa data lowongan dan bukti kemampuan yang dimasukkan secara terstruktur, sarannya sulit diperiksa dan tidak menunjukkan apakah mahasiswa benar-benar menguasai suatu keterampilan.

7. **Sebelum:** merancang dan menguji prototipe navigator belajar adaptif yang membantu
   **Sesudah:** merancang dan menguji prototipe navigator belajar adaptif lintas peran yang membantu

8. **Sebelum:** lalu diprioritaskan ulang terhadap peta permintaan keterampilan Indonesia yang juga terus diperbarui.
   **Sesudah:** lalu diprioritaskan ulang terhadap peta permintaan keterampilan Indonesia yang juga terus diperbarui. Tanda Ya pada baris PathSync menunjukkan bahwa mekanismenya berjalan, bukan bahwa setiap peran sudah divalidasi setara; kedalaman validasi per peran dilaporkan pada Bab IV.

9. **Sebelum:** karena sarannya tidak didasarkan pada data lowongan terkini maupun bukti yang diperiksa.
   **Sesudah:** karena sarannya tidak secara terstruktur didasarkan pada data lowongan maupun bukti yang diperiksa.

10. **Sebelum:** Permintaan tidak hanya dihitung dari frekuensi kemunculan keterampilan pada lowongan, tetapi juga dari arah perubahannya dalam enam bulan terakhir, sehingga mahasiswa melihat keterampilan yang sedang naik maupun yang mulai ditinggalkan. Setiap angka permintaan juga dapat ditelusuri ke kutipan lowongan aslinya.
   **Sesudah:** Permintaan dihitung dari frekuensi kemunculan keterampilan pada lowongan, hanya dari kalimat yang benar-benar memintanya, dan setiap angka dapat ditelusuri ke kutipan lowongan aslinya. Rumus arah perubahan dalam enam bulan terakhir sudah disiapkan, tetapi baru ditampilkan bila data pada kedua periode cukup.

11. **Sebelum:** Bobotnya tidak ditetapkan sekali secara manual, tetapi dikalibrasi dari peringkat rujukan pakar dengan formula perkalian sederhana sebagai titik awal.
   **Sesudah:** Versi yang aktif memakai formula perkalian sederhana yang setiap faktornya dapat diperiksa, sedangkan model yang bobotnya dipelajari dari peringkat pakar sudah disiapkan dan baru dipakai bila data pakar cukup.

12. **Sebelum:** Sistem juga membandingkan urutan belajar alternatif dan menjelaskan mengapa satu urutan lebih efektif daripada yang lain.
   **Sesudah:** Sistem juga menghitung berapa langkah yang akan tertahan bila urutan alternatif dipakai.

13. **Sebelum:** Dengan cara ini, mesin yang sama kini berjalan untuk 20 peran dengan total 138 keterampilan, dan pekerjaan utama untuk setiap peran baru adalah validasi graf oleh pakar.
   **Sesudah:** Dengan cara ini, mesin yang sama kini berjalan untuk 20 peran dengan total 138 keterampilan tanpa logika khusus per peran. Menambah satu peran berarti menyusun aturan sebutan jabatan, memeriksa hasil ekstraksi, memvalidasi graf bersama pakar, serta menyediakan soal dan materi, sehingga kedalaman validasi berbeda antarperan dan dilaporkan terpisah pada Bab IV.

14. **Sebelum:** sehingga sistem tidak dapat mengarang keterampilan yang tidak disebut. Dua ekstraktor diuji
   **Sesudah:** sehingga sistem tidak dapat mengarang keterampilan yang tidak disebut. Setiap sebutan juga diberi status kebutuhan berdasarkan klausanya, yaitu wajib, nilai tambah, salah satu dari beberapa pilihan, atau tidak diperlukan, misalnya pada kalimat "SQL tidak diperlukan". Sebutan yang dinyatakan tidak diperlukan tidak dihitung sebagai permintaan. Dua ekstraktor diuji

15. **Sebelum:** lalu yang dipakai adalah yang memiliki *F1-score* tertinggi pada data uji yang tidak pernah dipakai untuk penyetelan.
   **Sesudah:** lalu yang dipakai adalah yang memiliki *F1-score* tertinggi pada bagian uji yang tidak pernah dipakai untuk penyetelan. Karena bagian uji ini juga menjadi dasar pemilihan, leksikon diuji lagi pada set lowongan buta yang terpisah (Bab IV).

16. **Sebelum:** dinyatakan sebagai peluang penguasaan p_{s} beserta tingkat keyakinannya.
   **Sesudah:** dinyatakan sebagai peluang penguasaan p_{s}, yaitu peluang mahasiswa sudah memenuhi kriteria Quick Check keterampilan tersebut, beserta tingkat keyakinannya. Nilai p_{s} bukan tingkat kemahiran kerja, sehingga label tingkat di aplikasi dibaca sebagai perkiraan.

17. **Sebelum:** Penilaian dilakukan oleh LLM yang wajib menyertakan kutipan dari artefak, dengan pemeriksaan ulang oleh manusia pada 20 persen sampel acak. Asesmen singkat (Quick Check) mengukur penguasaan secara langsung dan diberi bobot tertinggi.
   **Sesudah:** Penilaian dirancang dilakukan oleh LLM yang wajib menyertakan kutipan dari artefak. Pada versi yang di-*deploy*, kunci API LLM belum diaktifkan, sehingga rubrik dinilai dengan aturan berbasis kata kunci yang juga wajib berkutipan, dan 20 persen penilaian diambil acak untuk ditinjau manusia. Asesmen singkat (Quick Check) mengukur penguasaan secara langsung dan diberi bobot tertinggi. Sertifikat kursus hanya menunjukkan penyelesaian, sehingga hanya sertifikat berbasis ujian yang dihitung sebagai bukti langsung.

18. **Sebelum:** Urutan ini mengikuti seberapa langsung setiap bukti mengamati keterampilan tersebut.
   **Sesudah:** Urutan ini adalah asumsi rancangan berdasarkan seberapa langsung setiap bukti mengamati keterampilan tersebut.

19. **Sebelum:** ditandai berkeyakinan rendah di *dashboard*.
   **Sesudah:** ditandai berkeyakinan rendah di *dashboard*. Bila hanya ada bukti tidak langsung, yaitu nilai atau sertifikat kursus, p_s^{(0)} dibatasi paling tinggi 0,60 agar paparan tidak terbaca sebagai penguasaan penuh. Batas ini adalah kebijakan awal, bukan hasil kalibrasi.

20. **Sebelum:** Nilai awal ini diambil dari rentang yang lazim pada literatur lalu disesuaikan dengan data uji coba. Dengan cara ini, penguasaan naik bertahap dan tidak melonjak hanya karena satu jawaban benar.
   **Sesudah:** Nilai awal ini diambil dari rentang yang lazim pada literatur dan belum dikalibrasi. Sebelum setiap pembaruan, p dijaga di antara 0,01 dan 0,99 agar jawaban salah selalu menurunkan estimasi. Dengan cara ini, penguasaan naik bertahap dan tidak melonjak hanya karena satu jawaban benar. Perubahan p menunjukkan bertambahnya informasi tentang mahasiswa, belum tentu peningkatan kemampuan.

21. **Sebelum:** Gambar [fig:graph] memberi contoh dari rancangan awal. SQL bukan keterampilan dengan kesenjangan terbesar, tetapi menjadi *bottleneck* karena analisis data dan visualisasi data bergantung padanya. Bab IV menunjukkan bahwa validasi pakar kemudian mengubah contoh ini.
   **Sesudah:** Gambar [fig:graph] memberi contoh dari graf final yang disetujui pakar. Elisitasi Kebutuhan bukan keterampilan dengan kesenjangan terbesar, tetapi menjadi *bottleneck* karena dokumentasi kebutuhan, pemodelan UML, dan *wireframing* bergantung padanya. Contoh pada rancangan awal, yaitu SQL sebagai prasyarat analisis data, ditolak pakar (Bab IV).

22. **Sebelum:** Caption: Contoh *prerequisite graph* peran *Business Analyst* pada rancangan awal. Persentase menunjukkan peluang penguasaan mahasiswa, dan garis biru tua menandai keterampilan yang tertahan oleh SQL}
   **Sesudah:** Caption: Contoh *prerequisite graph* peran *Business Analyst* dari sisi yang disetujui pakar. Persentase menunjukkan peluang penguasaan mahasiswa fiktif, dan garis biru tua menandai keterampilan yang tertahan oleh Elisitasi Kebutuhan}

23. **Sebelum:** Model peringkat disusun dengan pendekatan *pairwise learning to rank* [22].
   **Sesudah:** Model peringkat dirancang dengan pendekatan *pairwise learning to rank* [22], sedangkan versi yang aktif saat ini adalah kasus khususnya, yaitu formula (pers. prio).

24. **Sebelum:** Caption: Fitur Model Peringkat Berbasis *Bottleneck*}
   **Sesudah:** Caption: Fitur Model Peringkat Berbasis *Bottleneck* (K_{s} dan B_{s} Berbobot Nol pada Formula Aktif)}

25. **Sebelum:** lalu ketiga urutan digabung berdasarkan rata-rata peringkat.
   **Sesudah:** lalu ketiga urutan digabung berdasarkan rata-rata peringkat. Pada pelaksanaannya, peringkat rujukan diperoleh dari satu pakar pada 16 skenario, yaitu 8 skenario dasar beserta turunan kompetensinya, sehingga Kendall W belum dapat dihitung.

26. **Sebelum:** Untuk SQL pada Gambar [fig:graph], penjelasannya adalah SQL tidak memiliki prasyarat yang belum dikuasai, penguasaannya baru 0,35 dari kebutuhan 0,80, permintaannya tinggi, dan analisis data serta visualisasi data tertahan olehnya.
   **Sesudah:** Untuk Elisitasi Kebutuhan pada Gambar [fig:graph], penjelasannya adalah keterampilan ini tidak memiliki prasyarat yang belum dikuasai, penguasaannya baru 0,35 dari kebutuhan 0,85, keterampilan ini diminta 38 dari 65 lowongan *Business Analyst*, dan tiga keterampilan lain tertahan olehnya.

27. **Sebelum:** dan urutan yang direkomendasikan adalah yang meminimalkan jumlah tersebut.
   **Sesudah:** dan menunjukkan apakah urutan yang direkomendasikan memiliki langkah tertahan paling sedikit.

28. **Sebelum:** Tabel [tab:cycle] mengilustrasikan siklus adaptif pada satu mahasiswa fiktif dari rancangan awal. Angka pada tabel merupakan ilustrasi mekanisme, bukan hasil pengukuran, dan skornya dihitung dengan (pers. prio). Pada siklus pertama, analisis data memiliki kesenjangan terbesar, tetapi belum siap dipelajari karena prasyaratnya belum dikuasai, sehingga SQL menempati peringkat pertama berkat nilai bukanya yang tinggi. Setelah mahasiswa mempelajari SQL dan mengikuti asesmen ulang, penguasaan SQL naik dari 0,35 menjadi 0,72, sehingga analisis data kini siap dipelajari dan berpindah ke peringkat pertama.
   **Sesudah:** Tabel [tab:cycle] mengilustrasikan siklus adaptif pada satu mahasiswa fiktif dengan graf final dan permintaan *Business Analyst* pada *snapshot* 18 Oktober 2026. Nilai p_{s} adalah rekaan untuk ilustrasi, sedangkan skornya dihitung dengan (pers. prio). Pada siklus pertama, Dokumentasi Kebutuhan memiliki kesenjangan terbesar, tetapi belum siap dipelajari karena Elisitasi Kebutuhan belum dikuasai, sehingga Elisitasi menempati peringkat pertama berkat nilai bukanya yang tinggi. Setelah mahasiswa mempelajari Elisitasi dan mengikuti asesmen ulang, penguasaannya naik dari 0,35 menjadi 0,72, sehingga Dokumentasi Kebutuhan kini siap dipelajari dan berpindah ke peringkat pertama.

29. **Sebelum:** SQL & 0,80 & 0,35 & 0,95 (1) & 0,72 & 0,17 (3) | Analisis data & 0,85 & 0,30 & 0,25 (2) & 0,30 & 0,49 (1) | Statistik & 0,75 & 0,60 & 0,15 (3) & 0,60 & 0,15 (4) | Visualisasi data & 0,80 & 0,45 & 0,14 (4) & 0,45 & 0,28 (2) | Analisis kebutuhan & 0,75 & 0,55 & 0,13 (5) & 0,55 & 0,13 (5) | Excel & 0,75 & 0,80 & 0,00 (6) & 0,80 & 0,00 (6) |
   **Sesudah:** Elisitasi kebutuhan & 0,85 & 0,35 & 0,47 (1) & 0,72 & 0,12 (2) | Dokumentasi kebutuhan & 0,83 & 0,30 & 0,17 (2) & 0,30 & 0,34 (1) | Pengujian UAT & 0,68 & 0,40 & 0,05 (3) & 0,40 & 0,05 (3) | SDLC & 0,74 & 0,65 & 0,04 (4) & 0,65 & 0,04 (5) | Pemodelan UML & 0,75 & 0,40 & 0,02 (5) & 0,40 & 0,05 (4) | *Wireframing* & 0,73 & 0,45 & 0,01 (6) & 0,45 & 0,01 (6) |

30. **Sebelum:** LLM hanya dipakai di lapisan AI untuk membaca teks dan menilai rubrik proyek.
   **Sesudah:** LLM hanya dipakai di lapisan AI untuk membaca teks dan menilai rubrik proyek, bila kunci API diaktifkan.

31. **Sebelum:** AI dipakai pada lima komponen yang masing-masing divalidasi, yaitu ekstraksi keterampilan (*F1-score* terhadap anotasi), normalisasi dengan *embedding* (presisi terhadap label manusia), penilaian rubrik proyek (pemeriksaan ulang oleh manusia),
   **Sesudah:** AI dan model statistik dipakai pada lima komponen yang masing-masing memiliki cara pemeriksaan, yaitu ekstraksi keterampilan (*F1-score* terhadap anotasi), usulan padanan dengan *embedding* (ditinjau tim sebelum dipakai), penilaian rubrik proyek (tinjauan manusia pada sampel acak),

32. **Sebelum:** LLM dipakai sebagai ekstraktor pembanding (Qwen3-8B) dan untuk penilaian rubrik proyek.
   **Sesudah:** LLM Qwen3-8B dipakai secara luring sebagai ekstraktor pembanding. Jalur LLM untuk membaca CV dan menilai rubrik proyek (Claude API) tersedia di kode, tetapi belum diaktifkan pada versi yang di-*deploy*, sehingga keduanya saat ini memakai ekstraktor leksikon dan aturan rubrik berkutipan.

33. **Sebelum:** tersisa 1.323 lowongan untuk 20 peran, termasuk 65 lowongan *Business Analyst*.
   **Sesudah:** tersisa 1.323 lowongan untuk 20 peran pada *snapshot* 18 Oktober 2026, termasuk 65 lowongan *Business Analyst*. Basis data menyimpan 1.363 lowongan unik, dan 40 sisanya berada di luar jendela 12 bulan.

34. **Sebelum:** 22--28 Okt & Uji pengguna produk final dan karya ilmiah final & 47 respons uji pengguna |
   **Sesudah:** 22 Okt & Uji pengguna produk final, data ditutup 23 Okt & 47 respons uji pengguna | 23--28 Okt & Revisi hasil audit internal dan karya ilmiah final & Perbaikan negasi dan model bukti, uji ulang |

35. **Sebelum:** Pakar dan responden uji pengguna berpartisipasi secara sukarela tanpa honor atau insentif.
   **Sesudah:** Pakar dan responden uji pengguna berpartisipasi secara sukarela tanpa honor atau insentif. Biaya ini belum mencakup waktu tim untuk meninjau soal, frasa baru, dan proyek yang masuk antrean tinjauan.

36. **Sebelum:** dengan memvalidasi penuh satu peran lebih dahulu dan menandai peran lain sebagai Beta.
   **Sesudah:** dengan memvalidasi penuh satu peran lebih dahulu dan menampilkan status validasi setiap peran.


### Bab IV-V (`bab45.tex`)

1. **Sebelum:** Sebagian besar modul berjalan penuh. Dua modul berjalan sebagian karena hasil pengujian membuat tim membatasinya dengan sengaja.
   **Sesudah:** Sebagian besar modul berjalan penuh. Dua modul berjalan sebagian, yaitu model peringkat terlatih yang menunggu data pakar dan penilaian CV serta proyek dengan LLM yang belum diaktifkan.

2. **Sebelum:** BKT; status "dari nilai" dan "terbukti" dipisah & Berjalan |
   **Sesudah:** BKT; bukti tidak langsung dibatasi 0,60; sertifikat kursus tidak dihitung terbukti & Berjalan | Pembacaan CV dan proyek & Leksikon dan aturan rubrik berkutipan; jalur LLM tersedia, belum diaktifkan & Sebagian |

3. **Sebelum:** Cek Lowongan & Sorotan keterampilan, persentase kesiapan, kesenjangan, dan langkah pertama untuk teks lowongan apa pun & Berjalan |
   **Sesudah:** Cek Lowongan & Keterampilan berstatus wajib, nilai tambah, salah satu pilihan, atau tidak diperlukan; kesiapan dan langkah pertama hanya dari yang wajib & Berjalan |

4. **Sebelum:** PathSync menghitung cakupan 62,8 persen bila semua bukti dihitung dan 54,7 persen bila hanya bukti langsung, sehingga mahasiswa tahu bagian mana dari kesiapannya yang baru berasal dari nilai kuliah.
   **Sesudah:** PathSync menghitung cakupan 60,6 persen bila semua bukti dihitung dan 40,5 persen bila hanya bukti langsung, sehingga mahasiswa tahu bagian mana dari kesiapannya yang baru berasal dari nilai kuliah atau sertifikat kursus.

5. **Sebelum:** karena keterampilan ini diminta 38 dari 65 lowongan *Business Analyst* (58 persen)
   **Sesudah:** karena keterampilan ini diminta 38 dari 65 lowongan *Business Analyst* pada *snapshot* yang sama (58 persen)

6. **Sebelum:** 1. Ekstraksi leksikon dan verifikasi kutipan & Teks lowongan menjadi keterampilan, kutipan, dan tingkat &
   **Sesudah:** 1. Ekstraksi leksikon dan verifikasi kutipan & Teks lowongan menjadi keterampilan, kutipan, tingkat, dan status kebutuhan &

7. **Sebelum:** 3. LLM & CV dan proyek menjadi rubrik per keterampilan & Wajib berkutipan; 20% diperiksa manusia |
   **Sesudah:** 3. Pembaca CV dan rubrik proyek & CV dan proyek menjadi keterampilan dan tingkat & Wajib berkutipan; LLM belum diaktifkan; 20% ditinjau |

8. **Sebelum:** Semua angka diambil dari satu berkas metrik yang dijaga uji otomatis agar angka pada karya ilmiah sama dengan angka pada produk.
   **Sesudah:** Angka diambil dari berkas hasil di repositori, yaitu berkas metrik yang dijaga uji otomatis serta berkas validasi pakar, uji ketahanan, simulasi, dan uji pengguna, pada versi kode 23 Oktober 2026.

9. **Sebelum:** ρ = 0,84 terhadap pakar BA (32 penilaian) & Tercapai |
   **Sesudah:** ρ = 0,84 terhadap satu pakar BA (32 penilaian dari 8 profil) & Tercapai |

10. **Sebelum:** Peringkat vs pakar, NDCG@5 & 0,972 (kesenjangan terbesar 0,726) & Tercapai |
   **Sesudah:** Peringkat vs pakar, NDCG@5 & 0,972; pembanding terdekat 0,951; 1 pakar, 16 skenario & Tercapai, awal |

11. **Sebelum:** SUS ≥ 70 & 81,9 [78,1--85,7] & Tercapai |
   **Sesudah:** SUS ≥ 70 & 81,9 [78,1--85,7] & Tercapai | Kualitas rencana dinilai buta (H2) & Rencana terkumpul, belum dinilai & Belum |

12. **Sebelum:** dengan *recall* lebih rendah pada peran bisnis (0,68) karena keterampilannya lebih sering ditulis secara tersirat.
   **Sesudah:** dengan *recall* lebih rendah pada peran bisnis (0,68) karena keterampilannya lebih sering ditulis secara tersirat. Setelah status kebutuhan ditambahkan, *F1* pada bagian uji tidak berubah (0,806) dan hanya 2 dari 19.961 sebutan pada korpus yang tergolong tidak diperlukan, sehingga peta permintaan tidak berubah. Dampak perbaikan ini terutama terasa pada Cek Lowongan, yang menerima teks apa pun dari pengguna.

13. **Sebelum:** Untuk 32 penilaian kemampuan dari bukti yang sama, korelasi Spearman antara penilaian pakar dan peluang penguasaan PathSync adalah 0,84, di atas target 0,5.
   **Sesudah:** Untuk 32 penilaian kemampuan, yaitu 4 keterampilan pada 8 profil contoh, korelasi Spearman antara penilaian pakar dan peluang penguasaan PathSync adalah 0,84, di atas target 0,5. Angka ini dihitung ulang dengan mesin yang sudah diperbaiki dan tetap 0,84. Korelasi peringkat ini menunjukkan urutan yang sejalan, bukan bahwa besar peluangnya sudah terkalibrasi.

14. **Sebelum:** lebih tinggi dari urutan kesenjangan terbesar (0,726) dan kesenjangan dikali permintaan (0,951).
   **Sesudah:** lebih tinggi dari urutan kesenjangan terbesar (0,726) dan kesenjangan dikali permintaan (0,951). Selisih dengan pembanding terdekat kecil, yaitu 0,021 dengan IK 95% 0,001--0,048 dari *bootstrap* per profil, karena dua skenario dari profil yang sama tidak independen. Karena itu, hasil ini dibaca sebagai kesesuaian awal dengan satu penilai, bukan bukti umum.

15. **Sebelum:** Uji ini juga menemukan kelemahan. Kalimat negasi seperti "SQL tidak diperlukan" masih terbaca sebagai persyaratan pada 97 persen kasus, dan empat dari enam laporan proyek kontrol dikirim ke tinjauan manusia sehingga bobotnya sementara setengah.
   **Sesudah:** Dari 11 lowongan yang lolos, tujuh sempat diberi tingkat paling tinggi mandiri dan tidak ada yang diberi mahir, sehingga bukti palsu masih dapat menaikkan estimasi sampai tinjauan dilakukan. Laporan proyek kontrol yang masuk tinjauan manusia berjumlah empat atau lima dari enam, bergantung pada sampel acak 20 persen, sehingga bobotnya sementara setengah. Uji ini juga menemukan kelemahan pada kalimat negasi. Pada versi awal, kalimat seperti "SQL tidak diperlukan" terbaca sebagai persyaratan pada 97 dari 100 kasus, dan contoh lowongan pada audit internal menjadikan Python langkah pertama padahal lowongan menyatakan Python tidak dibutuhkan. Setelah status kebutuhan ditambahkan, contoh tersebut tidak lagi menghitung SQL dan Python, langkah pertamanya menjadi Elisitasi Kebutuhan, dan kalimat uji yang masih terbaca wajib turun menjadi 38 dari 100. Sisa kegagalan berasal dari dua pola yang belum dikenali, yaitu "Tanpa X pun tidak masalah" dan "Not required: X". Aturan tidak disetel pada kalimat uji ini agar angkanya tetap jujur.

16. **Sebelum:** Lowongan baru diunggah sebagai proyek & 89/100 ditolak & Kuat |
   **Sesudah:** Lowongan baru diunggah sebagai proyek & 89/100 ditolak; 7 lolos sampai mandiri & Cukup |

17. **Sebelum:** Laporan proyek asli (kontrol) & 0/6 ditolak, 4/6 ditinjau & Perlu perbaikan |
   **Sesudah:** Laporan proyek asli (kontrol) & 0/6 ditolak, 4--5/6 ditinjau & Perlu perbaikan |

18. **Sebelum:** Kalimat negasi di Cek Lowongan & 97/100 tetap terbaca & Kelemahan |
   **Sesudah:** Kalimat negasi di Cek Lowongan & 38/100 masih wajib (semula 97/100) & Perlu perbaikan |

19. **Sebelum:** tidak ada galat, dengan waktu respons persentil ke-95 di bawah 1,4 detik. Kode dijaga 192 uji otomatis,
   **Sesudah:** tidak ada galat, dengan waktu respons persentil ke-95 di bawah 1,4 detik pada alur daftar, unggah transkrip, dan *dashboard* tanpa pemanggilan LLM. Kode dijaga lebih dari 200 uji otomatis,

20. **Sebelum:** sehingga hipotesis pada Bab I bahwa minimal sepertiga mahasiswa mengalaminya didukung.
   **Sesudah:** sehingga hipotesis pada Bab I bahwa minimal sepertiga mahasiswa mengalaminya didukung. Angka ini adalah proporsi dalam sampel ini, bukan prevalensi seluruh mahasiswa Indonesia; di antara 32 mahasiswa aktif, proporsinya 72 persen.

21. **Sebelum:** dengan penilaian setelah memakai PathSync pada enam pernyataan yang sama.
   **Sesudah:** dengan penilaian setelah memakai PathSync pada enam pernyataan yang sama. Penilaian cara biasa diisi sebelum responden mencoba PathSync.

22. **Sebelum:** yaitu dua hal yang dijawab oleh Quick Check dan prioritas *bottleneck*.
   **Sesudah:** yaitu dua hal yang dijawab oleh Quick Check dan prioritas *bottleneck*. Kenaikan juga terlihat pada 29 responden yang memakai datanya sendiri (2,0--2,5 menjadi 4,3--4,6) dan pada 18 pengguna profil demo (2,4--3,3 menjadi 4,1--4,3), dengan p ≤ 0,002 pada setiap pernyataan.

23. **Sebelum:** Rencana belajar sebelum dan sesudah sudah terkumpul, tetapi penilaian buta oleh penilai independen belum dilakukan.
   **Sesudah:** Rencana belajar sebelum dan sesudah sudah terkumpul, tetapi penilaian buta oleh dua penilai independen belum dilakukan, sehingga H2 berstatus belum diuji meskipun rubrik dan lembar acaknya sudah disiapkan. Pernyataan 94 persen responden bahwa rencananya lebih baik adalah penilaian diri dan tidak dipakai untuk menguji H2.

24. **Sebelum:** dan ekstraktor mencapai *F1* 0,806.
   **Sesudah:** dan ekstraktor mencapai *F1* 0,806 serta membedakan keterampilan yang wajib, nilai tambah, dan tidak diperlukan. Angka seperti 38 dari 65 lowongan berlaku untuk korpus pada *snapshot* ini, bukan seluruh pasar kerja Indonesia.

25. **Sebelum:** Penilaian keputusan ini baru berasal dari satu pakar, sehingga kesepakatan antarpakar belum dapat dihitung.
   **Sesudah:** Penilaian keputusan ini baru berasal dari satu pakar dan selisih dengan pembanding terdekat masih kecil, sehingga kesepakatan antarpakar belum dapat dihitung dan hasilnya belum dapat digeneralisasi.

26. **Sebelum:** *RQ3: kejelasan arah dibanding panduan umum.* Hasil mendukung.
   **Sesudah:** *RQ3: kejelasan arah dibanding panduan umum.* Hasil mendukung untuk kejelasan arah yang dirasakan.

27. **Sebelum:** Kualitas rencana belajar menurut penilai buta dan perubahan jalur setelah beberapa minggu belajar masih menunggu studi lanjutan.
   **Sesudah:** Kualitas rencana belajar menurut penilai buta (H2) belum diuji, dan perubahan jalur setelah beberapa minggu belajar masih menunggu studi lanjutan.

28. **Sebelum:** karena tren pasar tidak ditampilkan sebelum datanya cukup dan satu contoh utama pada rancangan diganti karena pakar tidak setuju.
   **Sesudah:** karena tren pasar tidak ditampilkan sebelum datanya cukup, satu contoh utama pada rancangan diganti karena pakar tidak setuju, dan kalimat negasi yang menyesatkan langkah pertama diperbaiki lalu diuji ulang.

29. **Sebelum:** 94% responden setuju sesuai lowongan & Ya; peran selain BA berstatus Beta |
   **Sesudah:** 94% responden setuju sesuai lowongan & Ya; validasi per peran berbeda |

30. **Sebelum:** Kedua, hanya graf *Business Analyst* yang sudah dinilai pakar, sehingga peran lain diberi label Beta.
   **Sesudah:** Kedua, kedalaman validasi berbeda antarperan. Untuk BA, graf dinilai tiga pakar, sedangkan 12 soal dan keputusan sistem dinilai satu pakar. Untuk 19 peran lain, ekstraksi baru diuji pada set buta gabungan, sedangkan graf dan soalnya belum ditinjau pakar, dan enam peran dengan kurang dari 30 lowongan diberi label Beta.

31. **Sebelum:** Keempat, parameter BKT dan bobot bukti masih memakai nilai awal.
   **Sesudah:** Keempat, parameter BKT, bobot bukti, dan batas 0,60 untuk bukti tidak langsung masih merupakan nilai awal.

32. **Sebelum:** Ketujuh, ekstraksi belum memahami kalimat negasi, tren pasar
   **Sesudah:** Ketujuh, pemahaman kalimat negasi masih berbasis aturan dan gagal pada 38 dari 100 kalimat uji, lowongan junior dan senior belum dipisahkan sehingga target untuk lulusan baru dapat terlalu tinggi, tren pasar

33. **Sebelum:** dengan penilaian kemampuan dan urutan belajar yang sejalan dengan pakar BA (ρ = 0,84; NDCG@5 0,972).
   **Sesudah:** dengan penilaian kemampuan dan urutan belajar yang sejalan dengan satu pakar BA (ρ = 0,84; NDCG@5 0,972, sedikit di atas pembanding terdekat 0,951).

34. **Sebelum:** dengan skor kebergunaan 81,9. Dampaknya terhadap penguasaan keterampilan dalam jangka panjang belum diukur.
   **Sesudah:** dengan skor kebergunaan 81,9. Kualitas rencana yang dinilai buta dan dampak jangka panjang terhadap penguasaan keterampilan belum diukur.

35. **Sebelum:** Dalam waktu dekat, tim akan menurunkan prioritas
   **Sesudah:** Dalam waktu dekat, tim akan menyelesaikan penilaian buta rencana belajar oleh dua penilai dengan rubrik yang sudah disiapkan, menurunkan prioritas

36. **Sebelum:** memperbaiki pemahaman kalimat negasi pada ekstraksi,
   **Sesudah:** memperluas pemahaman kalimat negasi pada pola yang masih gagal, memisahkan target lowongan junior dan senior,

37. **Sebelum:** Hal ini penting karena 80 persen mahasiswa merasa keterampilannya sudah sesuai kebutuhan industri [8], sementara lebih dari satu juta lulusan belum bekerja [3].
   **Sesudah:** Hal ini penting karena penilaian diri saja tidak cukup untuk menentukan apa yang perlu dipelajari.

38. **Sebelum:** PathSync sudah dekat dengan kondisi siap diluncurkan untuk pengguna umum.
   **Sesudah:** PathSync siap diuji pada kelompok pengguna yang lebih luas, dengan status validasi setiap peran ditampilkan.


### Lampiran (`paper.tex`)

1. **Sebelum:** Claude (Anthropic) digunakan untuk pemeriksaan tata bahasa, penyuntingan bahasa, dan bantuan penelusuran awal pustaka. Seluruh referensi hasil saran AI telah diverifikasi kembali keasliannya oleh tim.
   **Sesudah:** Claude (Anthropic) digunakan untuk pemeriksaan tata bahasa, penyuntingan bahasa, bantuan penelusuran awal pustaka, bantuan penulisan kode, pra-anotasi data uji ekstraksi (lalu diperiksa satu anggota tim), dan penyusunan draf soal latihan (lalu diperiksa otomatis, 12 soal ditinjau pakar). Seluruh referensi hasil saran AI telah diverifikasi kembali keasliannya oleh tim. Hasil AI tidak dipakai sebagai pengganti penilaian pakar atau responden.
