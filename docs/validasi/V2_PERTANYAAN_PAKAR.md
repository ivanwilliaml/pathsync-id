# Pertanyaan untuk Pakar Business Analyst (Validasi V2)

## Konteks singkat (untuk dibaca pakar)

PathSync adalah aplikasi yang membantu mahasiswa Indonesia menyusun rute belajar menuju pekerjaan pertama. Sistem membaca lowongan kerja nyata, memeriksa bukti kemampuan mahasiswa (nilai, proyek, tes singkat), lalu menyarankan urutan skill yang sebaiknya dipelajari. Untuk peran **Business Analyst (BA)**, peta kebutuhan disusun dari **57 lowongan BA** di Indonesia (snapshot 2026-10-12-lexicon).

Ada dua hal yang dibuat tim dan perlu dinilai oleh orang yang paham pekerjaan BA:

1. **Urutan prasyarat.** Sistem menganggap skill A sebaiknya dikuasai sebelum skill B. Urutan ini menentukan rute belajar mahasiswa. Kalau urutannya salah, mahasiswa diarahkan belajar dalam urutan yang keliru.
2. **Relevansi skill.** Daftar skill yang paling sering muncul di lowongan belum tentu yang paling penting bagi lulusan baru. Penilaian Anda dipakai untuk menguji apakah peta lowongan sudah sesuai pandangan praktisi.

Jawaban Anda dipakai di karya ilmiah tim (ICC 2026) sebagai validasi pakar. Nama dan instansi hanya dicantumkan bila Anda setuju (bagian D).

**Waktu:** sekitar 60-90 menit. **Cara menjawab:** isi kolom jawaban di dokumen ini (atau di berkas Excel `V2_pakar_BA.xlsx`, isinya sama). Kerjakan sendiri tanpa melihat jawaban orang lain.

**Siapa yang cocok:** dosen sistem informasi yang mengajar analisis sistem/kebutuhan, atau praktisi BA dengan pengalaman minimal 2 tahun. Bukan anggota tim PathSync.
## Bagian A. Urutan prasyarat (31 pernyataan)

Setiap baris berbunyi: **"Skill A sebaiknya dikuasai sebelum skill B."** Pilih:
- **Setuju**: mahasiswa akan kesulitan mempelajari B tanpa A.
- **Tidak setuju**: urutan itu tidak perlu, atau justru terbalik.
- **Ragu**: tidak yakin atau tergantung konteks.

Kolom "alasan tim" hanya penjelasan dari kami, boleh diabaikan. Komentar singkat sangat membantu, terutama bila Anda tidak setuju.

| No | Skill A (dikuasai dulu) | Skill B (sesudahnya) | Alasan tim | Jawaban (Setuju / Tidak setuju / Ragu) | Komentar |
|---|---|---|---|---|---|
| A1 | Microsoft Excel & Spreadsheet | Persiapan & Kualitas Data | Pembersihan data tingkat awal umumnya dilakukan di spreadsheet. |  |  |
| A2 | SQL & Kueri Basis Data | Persiapan & Kualitas Data | Data perlu diambil dan difilter dengan kueri sebelum dapat dibersihkan dalam skala besar. |  |  |
| A3 | Microsoft Excel & Spreadsheet | Analisis Data | Analisis data awal di lingkungan kerja BA hampir selalu memakai spreadsheet. |  |  |
| A4 | SQL & Kueri Basis Data | Analisis Data | Analisis membutuhkan kemampuan menarik dan menggabungkan data dari basis data. |  |  |
| A5 | Statistika | Analisis Data | ESCO: 'apply statistical analysis techniques' memuat 'statistics' sebagai keterampilan pendukung. |  |  |
| A6 | Persiapan & Kualitas Data | Analisis Data | ESCO: kualitas data ('implement data quality processes') mendahului penafsiran data. |  |  |
| A7 | SQL & Kueri Basis Data | Visualisasi Data | Data untuk visual harus disiapkan dengan kueri (contoh paper Gambar 6). |  |  |
| A8 | Microsoft Excel & Spreadsheet | Visualisasi Data | Grafik dasar pertama kali dipelajari di spreadsheet. |  |  |
| A9 | Visualisasi Data | Pelaporan & Dashboard BI | ESCO: 'deliver visual presentation of data' bertumpu pada 'visual presentation techniques'. |  |  |
| A10 | Analisis Data | Pelaporan & Dashboard BI | ESCO: 'report analysis results' memiliki konsep induk 'perform data analysis'. |  |  |
| A11 | Metrik & KPI Bisnis | Pelaporan & Dashboard BI | Dashboard yang berguna dimulai dari pemilihan metrik yang tepat. |  |  |
| A12 | SQL & Kueri Basis Data | Pemodelan Data & Basis Data | Pengalaman menulis kueri membuat konsep relasi dan skema bermakna. |  |  |
| A13 | Analisis Data | Python/R untuk Analisis | Python dipakai untuk memperbesar skala analisis yang alurnya sudah dipahami. |  |  |
| A14 | Visualisasi Data | Power BI | Prinsip visualisasi mendahului penguasaan alat BI. |  |  |
| A15 | Microsoft Excel & Spreadsheet | Power BI | Power Query dan model data Power BI berangkat dari logika spreadsheet. |  |  |
| A16 | Visualisasi Data | Tableau | Prinsip visualisasi mendahului penguasaan alat BI. |  |  |
| A17 | Visualisasi Data | Looker/Metabase & BI Lain | Prinsip visualisasi mendahului penguasaan alat BI. |  |  |
| A18 | SQL & Kueri Basis Data | Looker/Metabase & BI Lain | Looker Studio/Metabase umumnya dibangun di atas kueri SQL. |  |  |
| A19 | Elisitasi Kebutuhan | Dokumentasi Kebutuhan (BRD/FSD/User Story) | ESCO: 'analyse business requirements' memuat 'business requirements techniques'. |  |  |
| A20 | Pemodelan Proses Bisnis (BPMN/Flowchart) | Pemodelan Sistem (UML/Use Case) | Activity diagram dan use case berangkat dari pemahaman alur proses. |  |  |
| A21 | Elisitasi Kebutuhan | Pemodelan Sistem (UML/Use Case) | ESCO: 'translate requirement concepts into visual design' menerjemahkan kebutuhan yang sudah digali. |  |  |
| A22 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | Pengujian Sistem & UAT | Test case dan UAT diturunkan dari kebutuhan dan acceptance criteria. |  |  |
| A23 | Siklus Pengembangan Sistem (SDLC) | Pengujian Sistem & UAT | Pengujian adalah tahap dalam siklus pengembangan. |  |  |
| A24 | Pemodelan Proses Bisnis (BPMN/Flowchart) | Alat Diagram (Visio/Lucidchart/draw.io) | Notasi proses dipelajari sebelum alat penggambarnya. |  |  |
| A25 | Elisitasi Kebutuhan | Wireframe & Prototipe (Figma) | ESCO: 'translate requirement concepts into visual design'. |  |  |
| A26 | Pemodelan Proses Bisnis (BPMN/Flowchart) | Sistem ERP & CRM | Modul ERP mengotomasi proses bisnis yang harus dipahami lebih dahulu. |  |  |
| A27 | Siklus Pengembangan Sistem (SDLC) | API & Integrasi Sistem | Kebutuhan integrasi dirumuskan dalam konteks siklus pengembangan sistem. |  |  |
| A28 | Pemodelan Data & Basis Data | API & Integrasi Sistem | ESCO: 'integrate ICT data' bertumpu pada pemahaman struktur data. |  |  |
| A29 | Programming fundamentals & OOP | REST API design & development | Building APIs needs working code in some language. |  |  |
| A30 | Python programming | Python/R untuk Analisis | pandas and NumPy are Python libraries. |  |  |
| A31 | Test design & test cases | Pengujian Sistem & UAT | UAT scripts are built from test design techniques. |  |  |

**A-tambahan.** Adakah prasyarat penting yang belum ada di daftar? Tulis pasangan "skill A sebelum skill B" beserta alasannya (maksimal 5).

| No | Skill A | Skill B | Alasan |
|---|---|---|---|
| A+1 |  |  |  |
| A+2 |  |  |  |
| A+3 |  |  |  |

## Bagian B. Relevansi skill untuk lulusan baru BA (20 skill)

Kolom "diminta di lowongan" adalah porsi lowongan BA yang menyebut skill itu. Untuk **lulusan baru** (0-1 tahun pengalaman) yang melamar sebagai BA, seberapa penting skill ini?
- **Wajib**: tanpa skill ini sulit diterima.
- **Penting**: sangat membantu, biasanya ditanyakan.
- **Pelengkap**: nilai tambah, bisa dipelajari setelah bekerja.
- **Tidak relevan**: bukan bagian pekerjaan BA lulusan baru.

| No | Skill | Diminta di lowongan | Jawaban (Wajib / Penting / Pelengkap / Tidak relevan) | Komentar |
|---|---|---|---|---|
| B1 | Elisitasi Kebutuhan | 59% |  |  |
| B2 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 48% |  |  |
| B3 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 38% |  |  |
| B4 | Pengujian Sistem & UAT | 35% |  |  |
| B5 | Siklus Pengembangan Sistem (SDLC) | 31% |  |  |
| B6 | SQL & Kueri Basis Data | 29% |  |  |
| B7 | API & Integrasi Sistem | 24% |  |  |
| B8 | Microsoft Excel & Spreadsheet | 21% |  |  |
| B9 | Sistem ERP & CRM | 20% |  |  |
| B10 | Alat Diagram (Visio/Lucidchart/draw.io) | 16% |  |  |
| B11 | Pemodelan Data & Basis Data | 14% |  |  |
| B12 | Jira/Confluence & Alat Kolaborasi | 12% |  |  |
| B13 | Pemodelan Sistem (UML/Use Case) | 11% |  |  |
| B14 | REST API design & development | 9% |  |  |
| B15 | Analisis Data | 8% |  |  |
| B16 | Metrik & KPI Bisnis | 7% |  |  |
| B17 | Persiapan & Kualitas Data | 5% |  |  |
| B18 | Pelaporan & Dashboard BI | 5% |  |  |
| B19 | Wireframe & Prototipe (Figma) | 5% |  |  |
| B20 | Power BI | 5% |  |  |

## Bagian C. Pertanyaan terbuka

Jawab singkat, satu sampai tiga kalimat per pertanyaan.

| No | Pertanyaan | Jawaban |
|---|---|---|
| C1 | Dari 20 skill di Bagian B, tiga skill mana yang **paling** menentukan lulusan baru diterima sebagai BA di Indonesia? |  |
| C2 | Skill apa yang **sering diminta lowongan tetapi menurut Anda dilebih-lebihkan** untuk posisi BA junior? |  |
| C3 | Skill hard apa yang **penting untuk BA tetapi tidak ada** di daftar? (PathSync sengaja hanya mengukur hard skill; soft skill dicatat terpisah sebagai pengalaman.) |  |
| C4 | Untuk mahasiswa yang baru mulai dari nol, **tiga skill pertama** apa yang sebaiknya dipelajari, dan dalam urutan apa? |  |
| C5 | Apakah ada perbedaan kebutuhan BA antara **sektor** (perbankan, e-commerce/teknologi, konsultan, pemerintahan) yang perlu diperhatikan sistem? |  |
| C6 | Bukti apa yang paling meyakinkan Anda bahwa seorang lulusan baru **benar-benar bisa** melakukan elisitasi dan dokumentasi kebutuhan (misalnya contoh BRD, user story, studi kasus, proyek)? |  |
| C7 | Bila Anda melihat rute belajar yang disarankan PathSync untuk seorang mahasiswa (contoh di bawah), apakah urutannya masuk akal? Apa yang akan Anda ubah? |  |

**Contoh rute untuk C7** (mahasiswa Sistem Informasi semester 6, sudah punya nilai kuliah, belum ada proyek):
1. Elisitasi Kebutuhan
2. Dokumentasi Kebutuhan (BRD/FSD/User Story)
3. SQL & Kueri Basis Data

## Bagian E. Pertanyaan lanjutan (opsional, ±5 menit)

| No | Pertanyaan | Jawaban |
|---|---|---|
| E1 | Untuk pernyataan Bagian A yang Anda setujui, mana yang **wajib** (B tidak bisa dimulai tanpa A) dan mana yang hanya **membantu**? Tulis nomornya. Wajib: … / Membantu: … |  |
| E2 | Apakah prasyarat berikut perlu ditambahkan? (Setuju / Tidak / Ragu) — (a) analisis pemangku kepentingan → elisitasi; (b) acceptance criteria → UAT; (c) kebutuhan fungsional & nonfungsional → dokumentasi kebutuhan |  |
| E3 | Apakah skill berikut layak jadi skill tersendiri untuk BA junior? (Wajib / Penting / Pelengkap / Tidak) — root-cause & gap analysis; acceptance criteria; requirements traceability |  |
| E4 | Apakah rute belajar sebaiknya dibedakan per jenis BA (proses/bisnis, sistem/teknis, data)? Bila ya, skill mana yang berbeda kedalamannya? |  |

## Bagian D. Identitas dan persetujuan

| Pertanyaan | Jawaban |
|---|---|
| Nama |  |
| Instansi / perusahaan |  |
| Peran saat ini (dosen / BA / lainnya) |  |
| Pengalaman di bidang analisis bisnis atau sistem (tahun) |  |
| Apakah Anda **bukan** anggota tim PathSync dan tidak terlibat menyusun sistem ini? (ya/tidak) |  |
| Bolehkah nama dan instansi Anda dicantumkan sebagai validator di karya ilmiah? (ya / tidak / hanya instansi) |  |
| Tanggal pengisian |  |

Terima kasih atas waktunya.

---

## Untuk tim (tidak perlu dibaca pakar)

- **Cara mengirim:** bagikan bagian Konteks sampai D (bisa diekspor ke PDF atau Google Docs), atau kirim `V2_pakar_BA.xlsx` yang isinya sama untuk Bagian A dan B.
- **Memasukkan hasil:** salin jawaban A dan B ke `V2_pakar_BA.xlsx` (satu salinan per pakar), lalu:
  `python -m pipeline.expert_sheet import <berkas.xlsx> --name "<nama>" --affiliation "<instansi>" --kind dosen` (atau `--kind praktisi`).
- **Aturan:** sebuah prasyarat dianggap tervalidasi bila **2 dari 3 pakar** setuju. Dengan satu pakar, tulis "divalidasi satu pakar". Tinjauan internal tim (jenis `tim`) tidak pernah dihitung sebagai pakar.
- **Bagian C** tidak diimpor otomatis; rangkum di paper (kutipan singkat dengan izin pakar) dan gunakan sebagai masukan taksonomi dan rute.
- Daftar prasyarat dan 20 skill di dokumen ini dibuat dari data sistem yang sama dengan `V2_pakar_BA.xlsx` (peta pasar 2026-10-12-lexicon).
