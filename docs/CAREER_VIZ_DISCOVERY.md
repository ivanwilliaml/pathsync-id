# Discovery: visualisasi karier (lanjutan dari CAREER_VISUALIZATION_HANDOFF.md)

Status: discovery, belum ada desain final atau kode. Semua angka di bawah diukur dari repo dan database lokal per 17 Okt 2026.

## Round 1 (dari handoff)
- Perasaan yang dituju: menjelajah kemungkinan karier.
- Arah karier: semua mode (satu target, beberapa target, eksplorasi dari skill yang dimiliki, target yang berubah seiring waktu).
- Objek utama: pekerjaan (peran) beserta kompetensi yang dibutuhkan.
- Tingkat permainan: halus, UI profesional dengan sedikit interaksi yang playful.
- Yang paling penting saat memilih: seberapa sering skill diminta pemberi kerja.

## Round 2: dijawab dari kode, bukan asumsi

| Pertanyaan | Fakta di repo |
|---|---|
| Sumber kebutuhan kerja | 563 lowongan nyata (Karirhub dan situs karier perusahaan), diekstrak dengan kamus ditambah embedding untuk frasa bebas. Status esensial/opsional dari ESCO. Bobot level bisa di-override manual. |
| Ukuran kemampuan | Satu skala 0–1 per skill. Label: <0,35 Beginner, <0,6 Basic, <0,8 Proficient, ≥0,8 Advanced. Sumber: Quick Check (BKT), transkrip, sertifikat, proyek. CV dan penilaian diri tidak pernah dihitung sebagai penguasaan. |
| Relasi job dan skill | Per peran: skill dengan level dibutuhkan dan share lowongan (snapshot pasar). 137 sisi prasyarat beralasan. Klaster kompetensi. 62 dari 114 skill dipakai ≥ 2 peran. |
| Skala | 14 peran dalam 7 keluarga, 114 skill. Lowongan per peran 6–133 (BA 50, UI/UX 6). |
| Sinyal pasar | Share dan jumlah per skill (bobot kebaruan dan Wilson CI), jumlah per peran. Tren dihitung tapi `insufficient` (BA: 2 lowongan di jendela sebelumnya). Lokasi berupa teks bebas. Senioritas belum terstruktur. Ko-okurensi bisa diturunkan, belum dihitung. |
| Materi | 340 materi terpetakan ke skill (kesulitan, format, jam). Rute personal. Asesmen independen. |
| Saat skill naik | Ranking dan rute dihitung ulang, Path History mencatat alasannya, readiness peran target berubah. Readiness peran lain dan rekomendasi karier baru belum ada. |

## Keputusan Round 2
1. **Mode eksplorasi: konstelasi karier penuh.** Catatan: dengan 14 node, grid juga cukup, tapi konstelasi dipilih untuk nilai demo dan arah produk. Data pendukungnya:
   - Overlap skill wajib antar peran (Jaccard): 15 dari 91 pasangan ≥ 0,25. Contoh: Data Engineer–Data Scientist 0,83, Backend–Fullstack 0,57, BA–Data Analyst 0,39.
   - 7 keluarga peran bisa menjadi klaster.
   - Yang belum ada: endpoint readiness mahasiswa untuk semua peran.
2. **Metrik utama di kartu skill:** urutan prioritas beserta alasannya. Share lowongan tampil sebagai bukti, bukan sebagai pengurut.
3. **Skill yang belum terukur:** dibedakan secara visual, tidak dihitung nol. Readiness menyertakan jumlah skill terukur dan ukuran sampel lowongan.

## Batasan kejujuran data (wajib di desain apa pun)
- Peran dengan lowongan < 20 (UI/UX 6, Data Engineer 13, Frontend 14, Data Scientist 16, DevOps 17) ditandai Beta dan menampilkan n.
- Belum ada tren, jadi tidak ada animasi atau label "skill sedang naik" sampai `trend_status` = ok.
- Readiness bukan peluang diterima kerja. Labelnya "seberapa banyak yang diminta pemberi kerja yang sudah bisa kamu tunjukkan".

## Keputusan Round 3 dan 4
4. **Kedekatan ke peran:** kecerahan node kontinu sesuai readiness. Tidak ada momen "terbuka", karena menguasai satu kursus tidak sama dengan siap kerja.
5. **Umpan balik saat skill naik:** ketiganya.
   - Konstelasi bergerak: peran yang memakai skill itu lebih terang, dengan animasi singkat dari skill ke peran, dan bunglon Sync berubah warna.
   - Ringkasan teks, misalnya "SQL naik ke Proficient: BA +4%, Data Analyst +6%". Selalu tampil, termasuk dalam reduced motion.
   - Catatan di Path History, diperluas ke peran lain.
6. **Letak:** di halaman Skill Map, sebagai tab pertama "Career Map", di samping "My Skills" dan "How Skills Connect". Dashboard tetap fokus ke satu target.

## Usulan arsitektur (draf, menunggu persetujuan)

**Skill Map menjadi peta tiga tingkat:**

| Tingkat | Tab | Isi | Status |
|---|---|---|---|
| Makro | **Career Map** (baru) | Konstelasi 14 peran. Klaster = 7 keluarga. Garis = overlap skill wajib ≥ 0,25, tebal sesuai overlap. Ukuran node = jumlah lowongan, dengan cincin Beta jika n < 20. Kecerahan = readiness mahasiswa. Peran target diberi cincin. | Baru |
| Meso | Panel samping saat peran diklik | Readiness per klaster kompetensi (radar kecil atau bar per klaster, maksimal 6–7 sumbu), skill yang belum terukur bergaris putus-putus. Teks "n lowongan". Tombol "Jadikan target" dan "Bandingkan dengan target". | Baru |
| Mikro | **How Skills Connect** | Graf prasyarat skill untuk peran itu. | Sudah ada |
| Personal | **My Skills** | Level per skill dan buktinya. | Sudah ada |

**Dashboard:** kartu prioritas tetap diurutkan menurut ranking, dengan share lowongan sebagai bukti. Ditambah baris "Kamu juga dekat ke: Data Analyst 41%, …" yang menautkan ke Career Map.

**Tidak dimasukkan:**
- *Heatmap.* Untuk 14 peran, konstelasi ditambah panel perbandingan sudah cukup. Heatmap dipertimbangkan lagi kalau peran > 30.
- *Skill tree ala RPG.* Bertentangan dengan keputusan 4 (tidak ada unlock palsu).

## Kebutuhan data dan backend
- `GET /api/students/{sid}/careers`: untuk 14 peran, readiness (rumus coverage yang sama dengan peran target), jumlah skill terukur dari total, n lowongan, dan Beta. Tanpa model baru, hanya `coverage` per peran dari bukti yang sama.
- `GET /api/careers/graph`: node (peran, keluarga, n) dan edge (Jaccard skill wajib ≥ 0,25), dihitung dari snapshot aktif. Di-cache, karena berubah hanya saat snapshot bulanan.
- Saat skill naik: diff readiness per peran sebelum dan sesudah, untuk ringkasan teks dan animasi.

## Interaksi dan aksesibilitas
- SVG kustom tanpa library baru. Layout deterministik per klaster, supaya posisi node stabil dan tidak "melompat" tiap kali dibuka.
- Setiap node berupa tombol dengan label "Business Analyst, readiness 59%, 50 lowongan". Ada daftar alternatif (tabel) untuk pembaca layar dan layar sempit (< 640 px).
- Animasi hanya `transform` dan `opacity`. Mengikuti `prefers-reduced-motion`: tanpa animasi, hanya ringkasan teks.

## Rencana bertahap
1. **MVP untuk final:** dua endpoint di atas, tab Career Map dengan konstelasi, panel samping dengan bar per klaster, baris "juga dekat ke" di dashboard, dan ringkasan teks setelah Quick Check.
2. **Berikutnya:** animasi perubahan di konstelasi, radar per peran, perbandingan dua peran, dan Path History lintas peran.
3. **Nanti:** tren (saat data cukup), filter lokasi dan senioritas (butuh data terstruktur), dan heatmap (saat peran > 30).

## Status MVP tahap 1 (17 Okt 2026)

Semua butir tahap 1 sudah dibangun dan diuji:

- **Backend.**
  - `pathsync/careers.py` berisi `career_graph` dan `careers_for`.
  - Endpoint `GET /api/careers/graph` dan `GET /api/students/{sid}/careers`.
  - Tes di `tests/test_careers.py`: readiness peran target sama dengan dashboard, edge Data Engineer–Data Scientist ada, dan endpoint butuh token. Seluruh suite: 82 lulus.
- **Career Map** (`components/career-map.tsx`), tab pertama di Skill Map:
  - Kanvas tetap 1640×900 di dalam bingkai yang bisa di-scroll, terbuka di peran target.
  - Posisi keluarga ditata manual, label di bawah node. Diukur di browser: tidak ada label atau node yang bertumpuk.
  - Panel detail per klaster (yang belum terukur bergaris putus-putus), celah terbesar, tombol "Make This My Target" dan "See the Postings" (`/market?role=`).
  - Daftar semua karier sebagai alternatif aksesibel.
- **Dashboard:** baris "Your Skills Also Bring You Close To", 3 peran terdekat yang sudah terukur.
- **Quick Check:** kartu "What This Check Moved" berisi perubahan readiness per karier. Sudah diuji end-to-end dengan jawaban acak; readiness BA turun 59% → 39%, sesuai bukti barunya.
- **Tab:** padding lebih lega untuk semua `Tabs`.

Belum dibuat (tahap 2): animasi perubahan di konstelasi, radar, perbandingan dua peran, Path History lintas peran.
