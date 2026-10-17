# PathSync: Rencana Produk (master)

Versi 16 Okt 2026. Dasar: [audit empat sudut pandang](docs/audit/AUDIT_2026-10-16.md) (AI engineer, investor, pengguna, product manager). Rencana rinci per bidang:

- [Backend dan Data/AI](docs/plan/PLAN_BACKEND_DATA_AI.md)
- [Frontend dan UI/UX](docs/plan/PLAN_FRONTEND_UIUX.md)

Tenggat: **23 Okt** karya ilmiah lengkap dan demo, **27 Okt** TM luring, **28 Okt** final. Hari ini 16 Okt, jadi tersisa 7 hari sampai tenggat pertama.

---

## 1. Produk dalam satu paragraf

PathSync membaca lowongan kerja nyata Indonesia, memeriksa apa yang sudah bisa dibuktikan mahasiswa (nilai, sertifikat, proyek, Quick Check), lalu menyusun rute belajar berurutan untuk hard skill, lengkap dengan alasan dan materi gratis. Sistem AI-nya sengaja sempit: AI membaca teks lowongan, **formula yang bisa dijelaskan** yang menentukan prioritas, dan setiap angka kembali ke bukti.

**Posisi yang saya rekomendasikan untuk final:**

> *PathSync adalah mesin rute belajar berbasis bukti untuk mahasiswa Indonesia. Role pertama yang divalidasi penuh: **Business Analyst**. Mesin yang sama sudah berjalan untuk 13 role lain sebagai Beta, dan bertambah seiring data lowongan tersedia.*

Alasannya dari audit: hanya BA yang punya data cukup (57 posting), gold, dan taksonomi yang mendekati kriteria final. Investor dan juri menghargai satu wedge yang terbukti lebih daripada empat belas klaim yang tipis. Kita tidak membuang 13 role itu, kita **menamainya dengan jujur**.

---

## 2. Definisi MVP final

### Harus ada pada 23 Okt (tanpa ini, final tidak layak dipertahankan)

| ID | Syarat | Ukuran lulus | Bidang |
|---|---|---|---|
| M1 | **BA tervalidasi** | Gold konsensus 2 anotator manusia dengan kappa ≥ 0,70. Presisi dan recall ekstraksi ≥ 0,80 di set uji, dengan selang dicantumkan. Kriteria taksonomi final BA lolos 3 dari 3 | Data/AI |
| M2 | **Angka kesiapan yang jujur** | Tidak ada skill tampil sebagai "kuat" atau tercakup dalam readiness hanya dari nilai kuliah. UI membedakan "dari nilai" dan "dibuktikan" | Backend + Frontend |
| M3 | **Alur utama dalam bahasa Indonesia** | Landing, pendaftaran, bukti, Quick Check, dashboard, Skill Map tersedia dalam bahasa Indonesia dengan tombol bahasa. Bahasa dipilih per permintaan di backend (bukan variabel lingkungan global) | Backend + Frontend + Data/AI |
| M4 | **URL publik yang tahan gagal** | Deploy publik berjalan dengan HTTPS dan cadangan, ada video demo cadangan, dan ada uji otomatis alur demo di browser | Backend + Frontend |
| M5 | **Proposal sama dengan produk** | Bab I-III memuat hanya angka dan komponen yang ada di `metrics.json` dan kode | Tim |
| M6 | **Bukti manusia minimum** | Minimal 1 pakar BA memvalidasi sisi graf BA, dan pilot 10 mahasiswa menyelesaikan alur dengan data tercatat | Tim |
| M7 | **Catatan hukum sumber data** | Ada halaman yang menyatakan asal data, atribusi, dan kebijakan penghapusan, dan tinjauan syarat layanan Karirhub dan Kalibrr tertulis | Backend |

### Sebaiknya ada (menaikkan nilai, tidak menggagalkan)

| ID | Syarat | Bidang |
|---|---|---|
| S1 | Tabel tiga ekstraktor (lexicon, LLM, gabungan) di set uji yang sama | Data/AI |
| S2 | Normalisasi diperketat dan diukur dengan label manusia (presisi pita otomatis ≥ 0,95) | Data/AI |
| S3 | Dua role tambahan naik dari Beta karena data (≥ 50 posting) | Data/AI |
| S4 | Ringkasan Skill Map sekali lihat (grafik) dan indikator progres Quick Check | Frontend |
| S5 | Peta tren pasar menampilkan "belum tersedia" dengan jelas, bukan angka kosong | Backend + Frontend |

### Tidak dikerjakan sebelum final (keputusan sengaja)

- Ekspansi 6 role bisnis baru (tetap di future works).
- Melatih ulang ranker dengan data nyata, kecuali pakar datang. Sampai itu, **namakan formula sebagai formula** dan pakai label Beta.
- Model bisnis berbayar, pembayaran, dan akun kampus.
- Penerjemahan seluruh halaman staf (Admin, Advisor, Experts).

---

## 3. Keputusan yang dibutuhkan (default saya kalau tidak dijawab)

| # | Keputusan | Rekomendasi (default) | Alasan |
|---|---|---|---|
| D1 | Posisi produk | **BA-first**, 13 role lain Beta | Satu wedge terbukti (audit PM-1, INV-5) |
| D2 | Agile/Scrum dan Project Management | **Tetap soft skill berbasis pengalaman.** Daftarkan sebagai "dikenal, di luar cakupan" di governance supaya tidak muncul sebagai kandidat skill baru | Konsisten dengan keputusan hard-skill-only. `PLAN.md` lama menyarankan mengembalikannya ke taksonomi hard |
| D3 | Ranker | **Pakai formula (5)** sebagai model aktif sampai ada pakar nyata. LTR disebut "eksperimen" | LTR seri dengan formula (0,9747 vs 0,9749) dan validasinya sirkular |
| D4 | Ekstraktor produksi | Ditentukan oleh S1 dengan aturan tertulis: F1 tertinggi di set uji, asal presisi ≥ 0,80. Seri, pilih lexicon | Hindari memilih setelah melihat hasil |
| D5 | Readiness | Tampilkan **dua angka**: "Terbukti" (asesmen, proyek, sertifikat) dan "Dari nilai". Hanya yang pertama untuk "Strengths" | Audit AI-7 dan USR-2 |
| D6 | Bahasa | Indonesia sebagai bahasa utama, Inggris pilihan | Sasaran proposal |
| D7 | Sumber data | Prioritaskan sumber ATS publik dan perluasan sumber, jangan menambah ketergantungan ke satu portal | Audit INV-3 dan INV-4 |

---

## 4. Metrik keberhasilan

Metrik sudah dikumpulkan oleh aplikasi (Admin > Launch Metrics). Yang belum ada adalah targetnya.

**North star:** mahasiswa teraktivasi = menyelesaikan minimal satu Quick Check dan membuka rute.

| Metrik | Target pilot (10-20 mahasiswa) | Sumber |
|---|---|---|
| Daftar → Quick Check selesai | ≥ 60% | `product_events` |
| Waktu median sampai prioritas pertama terbuka | ≤ 5 menit | `product_events` |
| "Rute ini jelas dan bisa saya jalankan" (skala 1-5) | rata-rata ≥ 4,0 | survei 3 pertanyaan di akhir |
| Siap memulai modul pertama dalam 7 hari | ≥ 50% | pulse mingguan |
| Soal bermasalah (daya beda < 0,15 atau opsi mati) | dilaporkan per soal, tanpa target | `item-analysis` |
| Kesalahan server di pilot | 0 | log |

Kegagalan pada target ini bukan kegagalan lomba: itu temuan yang dicatat dan masuk ke Bab 5.

---

## 5. Jadwal 16-28 Okt

Pekerjaan manusia (anotasi, pakar, pilot) berjalan paralel dengan kode karena itu jalur kritis.

| Hari | Backend | Data/AI | Frontend | Tim (manusia) |
|---|---|---|---|---|
| **Jum 16** | Verifikasi CI GitHub, kunci keputusan D1-D7 | Ekspor ulang A2 dan jalankan di Kaggle | Mulai infrastruktur i18n | Rekrut 2 anotator dan 1 pakar BA, jadwalkan pilot |
| **Sab 17** | Bahasa per permintaan dan katalog pesan (BE-12), tinjauan syarat layanan sumber data (M7) | A2 selesai, taksonomi BA: daftarkan skill di luar cakupan | Landing dan pendaftaran ID | Anotasi 100 posting (sesi 1) |
| **Min 18** | BE-12 selesai, deploy publik VPS (M4) | Normalisasi: perketat penjaga kata generik | Dashboard dan Quick Check ID | Anotasi sesi 2, label frasa |
| **Sen 19** | Semantik readiness "terbukti" vs "dari nilai" (API) | Gold konsensus dan kappa | Label readiness baru di dashboard dan Skill Map | Pakar BA memvalidasi sisi graf |
| **Sel 20** | Uji beban di URL publik | Evaluasi ulang di set uji, tabel tiga ekstraktor | Skill Map dan ringkasan visual | Pilot 10 mahasiswa mulai |
| **Rab 21** | Uji otomatis demo (Playwright) di CI | Normalisasi dievaluasi dengan label manusia | Quick Check progres dan hasil | Pilot berjalan |
| **Kam 22** | Beku kode, perbaikan bug | `pipeline.report` final | Beku UI, perbaikan bug | Analisis pilot, tulis D3 |
| **Jum 23** | Video demo cadangan | Angka final ke `metrics.json` | Verifikasi mobile dan aksesibilitas | **Kirim karya ilmiah dan demo** |
| **24-26** | Perbaikan dari umpan balik | Kalibrasi awal asesmen dari jawaban pilot | Perbaikan dari umpan balik | Latihan presentasi |
| **Sel 27** | Cadangan dan pemantauan | | | **TM luring** |
| **Rab 28** | | | | **Final** |

---

## 6. Gerbang go/no-go

| Tanggal | Gerbang | Jika tidak lulus |
|---|---|---|
| 19 Okt | Kappa ≥ 0,70 dan gold konsensus tersedia | Perjelas panduan, label ulang. Jika tetap gagal, turunkan klaim presisi ke "indikatif, satu anotator" |
| 20 Okt | Deploy publik hidup dan loadtest 200 siswa tanpa galat | Fokus demo lokal dengan video, tunda URL publik |
| 21 Okt | Presisi pita otomatis normalisasi ≥ 0,95 di label manusia | Naikkan ambang otomatis, tampilkan lebih banyak frasa ke antrean tinjauan, dan laporkan angka apa adanya |
| 22 Okt | Beku kode: 0 tes gagal, `tsc` dan `next build` bersih, demo lolos uji otomatis | Rollback ke commit terakhir yang hijau |

---

## 7. Risiko

| Risiko | Kemungkinan | Dampak | Mitigasi |
|---|---|---|---|
| Anotator atau pakar tidak tersedia | Sedang | Tinggi (Metodologi) | Mulai rekrut hari ini, targetkan 1 pakar dan 2 anotator, siapkan klaim yang dilabeli "indikatif" |
| Pilot kurang dari 10 mahasiswa | Sedang | Sedang | Mulai dengan teman sekelas, catat alur penuh dan tampilkan sebagai uji kebergunaan, bukan studi efektivitas |
| Kappa < 0,70 | Rendah-sedang | Sedang | Panduan anotasi sudah ada, perjelas skill yang tumpang tindih |
| LLM luring kalah dari lexicon | Sedang | Rendah | Itu hasil sah, ubah teks bukan hasil |
| Surat teguran dari penyedia data | Rendah | Tinggi | Tinjauan syarat layanan, atribusi, sumber ATS tambahan, simpan hanya bidang yang dibutuhkan |
| Server demo mati saat presentasi | Sedang | Tinggi | Video cadangan, profil demo lokal, uji otomatis sebelum beku |
| Penerjemahan memecah UI | Sedang | Sedang | Uji otomatis alur demo di bahasa Indonesia dan Inggris |
| Cabang paralel menumbuhkan perbedaan | Sedang | Sedang | Satu cabang kerja per orang, gabungkan ke `main` lewat PR dengan CI hijau |

---

## 8. Cara kerja tim

- **Satu sumber angka:** `python -m pipeline.report` menulis `backend/data/models/metrics.json`. Dokumen hanya mengutip berkas itu.
- **Satu `main`, PR dengan CI hijau.** Tidak ada push langsung ke `main` setelah 22 Okt (beku).
- **Sebelum klaim apa pun di proposal:** cocokkan dengan `metrics.json`. Kalau tidak ada angkanya, klaim dilabeli "rencana".
- **Perbedaan pendapat soal produk** dicatat di tabel keputusan bagian 3, bukan di percakapan.

---

## 9. Peta repositori

```
PLAN.md                  rencana master (file ini)
README.md                ikhtisar dan cara menjalankan
docker-compose.yml       produksi: Caddy, frontend, backend, PostgreSQL, Redis, backup
backend/                 FastAPI, mesin keputusan, pipeline data dan AI, tes
  pathsync/              logika domain (diagnosis, ranking, jalur, ekstraksi)
  api/                   router HTTP
  pipeline/              pekerjaan batch: build_market, eval, report, retensi, normalisasi
    seed_build/          pembangun data seed satu kali (taksonomi, graf, materi, kursus)
    item_authoring/      alat penulisan dan penyeimbangan soal (arsip kerja, jarang dijalankan)
  scrapers/              Karirhub, Kalibrr, ATS publik, ESCO
  offline_llm/           jalur LLM luring (Kaggle)
  data/seed/             taksonomi, soal, gold, materi, konteks BPS
  data/models/           hasil ukur (metrics.json dan lainnya)
frontend/                Next.js 16
deploy/                  Caddy, backup, loadtest, explain_queries
docs/
  audit/                 audit dan tanggapan (termasuk audit 16 Okt)
  plan/                  rencana per bidang, roadmap
  ops/                   runbook, protokol studi, panduan anotasi
  design/                desain mesin keputusan
  archive/               dokumen lama dan berkas tak terpakai
```
