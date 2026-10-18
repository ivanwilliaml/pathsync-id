<!-- Asal data: jawaban tiga pakar BA independen (1 dosen Sistem Informasi, 1 praktisi BA proses, 1 praktisi BA sistem), dikumpulkan dan dirangkum oleh anggota tim (Ivan) pada 18 Okt 2026. Identitas pakar dirahasiakan atas permintaan mereka; jawaban asli dan identitas disimpan tim, tidak di repositori. Diimpor lewat data/seed/_validasi/V2_pakar*.xlsx (pipeline.apply_validation). -->

# Jawaban Kuesioner PathSync — Tiga Perspektif BA

## Perspektif 1 — Pendidikan Sistem Informasi

### Bagian A. Urutan prasyarat

| No | Skill A → Skill B | Jawaban | Alasan |
|---|---|---|---|
| A1 | Microsoft Excel & Spreadsheet → Persiapan & Kualitas Data | Tidak setuju | Excel adalah salah satu media latihan, bukan prasyarat memahami missing value, duplikasi, atau validitas data. |
| A2 | SQL & Kueri Basis Data → Persiapan & Kualitas Data | Tidak setuju | Konsep kualitas data dapat dipelajari menggunakan berkas kecil tanpa basis data. |
| A3 | Microsoft Excel & Spreadsheet → Analisis Data | Tidak setuju | Analisis dapat diajarkan melalui tabel sederhana atau alat lain sambil belajar Excel. |
| A4 | SQL & Kueri Basis Data → Analisis Data | Tidak setuju | Data siap pakai cukup untuk memulai analisis; SQL dipelajari ketika sumbernya basis data. |
| A5 | Statistika → Analisis Data | Ragu | Setuju untuk statistika deskriptif dasar; tidak untuk seluruh statistika sebagai gerbang awal analisis. |
| A6 | Persiapan & Kualitas Data → Analisis Data | Setuju | Minimal memahami validitas dan keterbatasan data diperlukan agar interpretasi tidak menyesatkan. |
| A7 | SQL & Kueri Basis Data → Visualisasi Data | Tidak setuju | Grafik bisa dipelajari dari dataset yang sudah disiapkan. |
| A8 | Microsoft Excel & Spreadsheet → Visualisasi Data | Tidak setuju | Prinsip sumbu, skala, dan pemilihan grafik tidak mensyaratkan Excel. |
| A9 | Visualisasi Data → Pelaporan & Dashboard BI | Setuju | Prinsip keterbacaan dan pemilihan grafik membantu sebelum menyusun dashboard yang utuh. |
| A10 | Analisis Data → Pelaporan & Dashboard BI | Setuju | Laporan bermakna memerlukan kemampuan membaca pola dan menjelaskan temuan. |
| A11 | Metrik & KPI Bisnis → Pelaporan & Dashboard BI | Setuju | Tujuan pengukuran dan definisi indikator sebaiknya jelas sebelum dashboard dinilai. |
| A12 | SQL & Kueri Basis Data → Pemodelan Data & Basis Data | Tidak setuju | Entitas, relasi, serta kunci dapat diajarkan sebelum atau bersama SQL. |
| A13 | Analisis Data → Python/R untuk Analisis | Tidak setuju | Analisis dasar dan pemrograman analitis dapat dikembangkan bersamaan. |
| A14 | Visualisasi Data → Power BI | Setuju | Dasar visualisasi membantu agar pembelajaran tidak berhenti pada penggunaan tombol. |
| A15 | Microsoft Excel & Spreadsheet → Power BI | Tidak setuju | Transfer pengalaman Excel membantu, tetapi Power BI dapat dipelajari langsung. |
| A16 | Visualisasi Data → Tableau | Setuju | Konsep grafik yang tepat menjadi bekal untuk menyusun visual di Tableau. |
| A17 | Visualisasi Data → Looker/Metabase & BI Lain | Ragu | Kelompok alat terlalu luas; bedakan prinsip visual, pemodelan, dan penggunaan alat. |
| A18 | SQL & Kueri Basis Data → Looker/Metabase & BI Lain | Tidak setuju | Looker, Looker Studio, dan Metabase tidak dapat diberi satu aturan SQL yang sama. |
| A19 | Elisitasi Kebutuhan → Dokumentasi Kebutuhan (BRD/FSD/User Story) | Setuju | Mahasiswa perlu memiliki bahan kebutuhan sebelum menghasilkan dokumentasi yang bermakna. |
| A20 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Pemodelan Sistem (UML/Use Case) | Tidak setuju | Use case dapat dimulai dari tujuan aktor tanpa harus menguasai BPMN. |
| A21 | Elisitasi Kebutuhan → Pemodelan Sistem (UML/Use Case) | Setuju | Dasar kebutuhan diperlukan agar model menjawab masalah yang tepat. |
| A22 | Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pengujian Sistem & UAT | Setuju | Pengujian penerimaan perlu acuan kebutuhan dan kriteria penerimaan yang tertulis. |
| A23 | Siklus Pengembangan Sistem (SDLC) → Pengujian Sistem & UAT | Setuju | Gambaran SDLC membantu menempatkan tujuan, peran, dan waktu pengujian. |
| A24 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Alat Diagram (Visio/Lucidchart/draw.io) | Tidak setuju | Alat diagram mendukung banyak notasi; dapat dipakai sambil belajar pemodelan. |
| A25 | Elisitasi Kebutuhan → Wireframe & Prototipe (Figma) | Setuju | Kebutuhan pengguna awal diperlukan agar rancangan tidak sekadar meniru tampilan. |
| A26 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Sistem ERP & CRM | Ragu | Pemahaman proses penting, tetapi kemampuan membuat model BPMN tidak selalu harus mendahului pengenalan ERP. |
| A27 | Siklus Pengembangan Sistem (SDLC) → API & Integrasi Sistem | Tidak setuju | Konsep API dapat dipelajari mandiri sebelum mahasiswa memahami keseluruhan SDLC. |
| A28 | Pemodelan Data & Basis Data → API & Integrasi Sistem | Ragu | Setuju untuk pemahaman struktur data dasar, bukan wajib menguasai pemodelan basis data penuh. |
| A29 | Programming fundamentals & OOP → REST API design & development | Tidak setuju | Dasar pemrograman relevan untuk implementasi API, tetapi OOP bukan syarat universal. |
| A30 | Python programming → Python/R untuk Analisis | Tidak setuju | Python dasar hanya berlaku untuk cabang Python; analisis R membutuhkan dasar R. |
| A31 | Test design & test cases → Pengujian Sistem & UAT | Setuju | Mahasiswa perlu memahami skenario, data uji, serta hasil yang diharapkan untuk menyusun UAT. |

### A-tambahan. Prasyarat yang diusulkan

Kelima usulan berikut adalah bahan tinjauan baru; jika skill belum ada dalam taksonomi, tambahkan atau definisikan dulu sebelum membuat edge.

| No | Skill A | Skill B | Alasan |
|---|---|---|---|
| A+1 | Analisis pemangku kepentingan | Elisitasi kebutuhan | Menentukan sumber kebutuhan, kepentingan, dan pihak yang perlu dilibatkan. |
| A+2 | Kebutuhan fungsional dan nonfungsional | Dokumentasi kebutuhan | Membantu menuliskan perilaku sistem dan batas kualitasnya. |
| A+3 | Dasar entitas, atribut, relasi, dan kunci | SQL JOIN dan pemodelan relasional | Mengurangi kesalahan hubungan data; cukup konsep dasar, bukan penguasaan desain penuh. |
| A+4 | Business rules | Acceptance criteria | Kondisi penerimaan perlu mencakup aturan yang dapat diuji. |
| A+5 | Acceptance criteria | Penyusunan skenario UAT | Memberikan acuan keberhasilan atau kegagalan skenario. |

### Bagian B. Relevansi untuk lulusan baru BA

| No | Skill | Disebut lowongan, menurut dokumen tim | Jawaban | Alasan |
|---|---|---|---|---|
| B1 | Elisitasi Kebutuhan | 59% | Wajib | Dasar menggali dan membedakan kebutuhan harus dapat ditunjukkan melalui kasus. |
| B2 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 48% | Wajib | Kandidat perlu menulis kebutuhan yang jelas, konsisten, dan dapat diperiksa. |
| B3 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 38% | Penting | Pemodelan dasar penting; tidak semua lulusan harus menguasai BPMN secara mendalam. |
| B4 | Pengujian Sistem & UAT | 35% | Penting | Lulusan perlu memahami tujuan, skenario, serta hasil uji penerimaan. |
| B5 | Siklus Pengembangan Sistem (SDLC) | 31% | Penting | Memahami hubungan kebutuhan, pengembangan, dan pengujian membantu kesiapan proyek. |
| B6 | SQL & Kueri Basis Data | 29% | Penting | SQL dasar memperkuat pemeriksaan data, tetapi bukan syarat semua BA. |
| B7 | API & Integrasi Sistem | 24% | Pelengkap | Literasi integrasi berguna; kedalaman teknis disesuaikan jalur. |
| B8 | Microsoft Excel & Spreadsheet | 21% | Penting | Pengolahan tabel dasar mendukung latihan dan pekerjaan analitis awal. |
| B9 | Sistem ERP & CRM | 20% | Pelengkap | Pengetahuan produk bersifat domain dan dapat diperdalam setelah penempatan. |
| B10 | Alat Diagram (Visio/Lucidchart/draw.io) | 16% | Penting | Kemampuan menghasilkan diagram jelas membantu penilaian portofolio. |
| B11 | Pemodelan Data & Basis Data | 14% | Penting | Entitas, relasi, dan kunci merupakan bekal konseptual yang berguna. |
| B12 | Jira/Confluence & Alat Kolaborasi | 12% | Pelengkap | Dasar pengelolaan issue dan dokumentasi mudah dilatih pada proyek. |
| B13 | Pemodelan Sistem (UML/Use Case) | 11% | Penting | Use case dasar membantu merumuskan aktor, tujuan, serta batas sistem. |
| B14 | REST API design & development | 9% | Pelengkap | Pemahaman kontrak bisa berguna, tetapi implementasi kode tidak menjadi syarat umum. |
| B15 | Analisis Data | 8% | Penting | Kemampuan menafsirkan data membantu menguji asumsi dan masalah. |
| B16 | Metrik & KPI Bisnis | 7% | Penting | Kebutuhan sebaiknya dihubungkan dengan ukuran keberhasilan yang jelas. |
| B17 | Persiapan & Kualitas Data | 5% | Penting | Kualitas data memengaruhi keandalan analisis dan kesimpulan. |
| B18 | Pelaporan & Dashboard BI | 5% | Pelengkap | Dashboard berguna pada jalur analitik, bukan seluruh peran BA. |
| B19 | Wireframe & Prototipe (Figma) | 5% | Pelengkap | Rancangan sederhana dapat membantu validasi kebutuhan antarmuka. |
| B20 | Power BI | 5% | Pelengkap | Penguasaan produk BI tertentu mengikuti spesialisasi dan proyek. |

### Bagian C. Jawaban terbuka

**C1. Dari 20 skill di Bagian B, tiga skill mana yang **paling** menentukan lulusan baru diterima sebagai BA di Indonesia?**

Elisitasi kebutuhan (B1), dokumentasi kebutuhan (B2), dan pemodelan proses bisnis (B3). Ketiganya dapat ditunjukkan dalam satu studi kasus yang memperlihatkan hubungan antara masalah, kebutuhan, dan alur solusi.

**C2. Skill apa yang **sering diminta lowongan tetapi menurut Anda dilebih-lebihkan** untuk posisi BA junior?**

REST API design & development berpotensi berlebihan jika kandidat BA junior diwajibkan membuat backend. Tuntutan menguasai banyak produk ERP atau BI sekaligus juga perlu disesuaikan dengan posisi yang dilamar.

**C3. Skill hard apa yang **penting untuk BA tetapi tidak ada** di daftar? (PathSync sengaja hanya mengukur hard skill; soft skill dicatat terpisah sebagai pengalaman.)**

Kebutuhan fungsional/nonfungsional, business rules, acceptance criteria, dan requirements traceability. Root-cause serta gap analysis juga perlu dijadikan kemampuan yang dapat dinilai melalui kasus.

**C4. Untuk mahasiswa yang baru mulai dari nol, **tiga skill pertama** apa yang sebaiknya dipelajari, dan dalam urutan apa?**

Pemodelan proses bisnis dasar → elisitasi kebutuhan → dokumentasi kebutuhan. Asumsinya, pengenalan masalah dan stakeholder dimasukkan dalam latihan awal; diagram proses sementara diperbaiki setelah elisitasi.

**C5. Apakah ada perbedaan kebutuhan BA antara **sektor** (perbankan, e-commerce/teknologi, konsultan, pemerintahan) yang perlu diperhatikan sistem?**

Dalam skenario perbankan, latihan dapat menekankan aturan transaksi dan audit trail; e-commerce dapat menekankan alur pengguna dan metrik. Konsultan dapat menekankan pemodelan lintas domain, sedangkan pemerintahan dapat menekankan layanan publik dan akuntabilitas; ini hipotesis penyesuaian yang perlu dikonfirmasi kepada praktisi sektor.

**C6. Bukti apa yang paling meyakinkan Anda bahwa seorang lulusan baru **benar-benar bisa** melakukan elisitasi dan dokumentasi kebutuhan (misalnya contoh BRD, user story, studi kasus, proyek)?**

Portofolio kasus dengan catatan pertanyaan elisitasi, temuan, model proses, kebutuhan, dan acceptance criteria yang saling konsisten. Presentasi atau pembelaan singkat terhadap keputusan analisis membantu membedakan pemahaman dari sekadar pengisian template.

**C7. Bila Anda melihat rute belajar yang disarankan PathSync untuk seorang mahasiswa (contoh di bawah), apakah urutannya masuk akal? Apa yang akan Anda ubah?**

Rute awal masuk akal sebagai daftar topik, tetapi nilai kuliah saja belum membuktikan penguasaan dan SQL tidak harus menjadi langkah ketiga. Saya akan memakai elisitasi → dokumentasi dengan model proses sederhana → mini-proyek yang menghubungkan kebutuhan ke acceptance criteria; SQL menjadi cabang sesuai target lowongan.

### Bagian E. Pertanyaan lanjutan

**E1. Untuk pernyataan Bagian A yang Anda setujui, mana yang **wajib** (B tidak bisa dimulai tanpa A) dan mana yang hanya **membantu**? Tulis nomornya. Wajib: … / Membantu: …**

Wajib pada batas minimum tugas: A6, A19, A21, A22, A25, A31. Membantu: A9, A10, A11, A14, A16, A23. “Wajib” berarti ada pemahaman awal data/kebutuhan/desain uji sebelum menghasilkan keluaran yang layak; bukan harus menuntaskan seluruh skill A sebelum mencoba B. Konsep dan latihan B tetap dapat dikenalkan bersamaan.

**E2. Apakah prasyarat berikut perlu ditambahkan? (Setuju / Tidak / Ragu) — (a) analisis pemangku kepentingan → elisitasi; (b) acceptance criteria → UAT; (c) kebutuhan fungsional & nonfungsional → dokumentasi kebutuhan**

(a) Setuju: identifikasi stakeholder dasar membantu memilih sumber kebutuhan. (b) Setuju: acceptance criteria menjadi acuan penyusunan UAT. (c) Setuju: perlu membedakan kebutuhan fungsional dan nonfungsional untuk dokumentasi yang memadai; ketiganya dapat dikembangkan iteratif.

**E3. Apakah skill berikut layak jadi skill tersendiri untuk BA junior? (Wajib / Penting / Pelengkap / Tidak) — root-cause & gap analysis; acceptance criteria; requirements traceability**

Root-cause & gap analysis: Penting. Acceptance criteria: Wajib pada tingkat dasar. Requirements traceability: Penting, dengan latihan hubungan kebutuhan, desain, dan uji; tidak perlu alat khusus.

**E4. Apakah rute belajar sebaiknya dibedakan per jenis BA (proses/bisnis, sistem/teknis, data)? Bila ya, skill mana yang berbeda kedalamannya?**

Ya. Jalur proses memperdalam as-is/to-be dan analisis gap; jalur sistem memperdalam spesifikasi, data, API, dan UAT; jalur data memperdalam SQL, kualitas data, statistik dasar, serta BI. Elisitasi, dokumentasi, dan tujuan bisnis menjadi fondasi bersama.


## Perspektif 2 — BA bisnis/proses

### Bagian A. Urutan prasyarat

| No | Skill A → Skill B | Jawaban | Alasan |
|---|---|---|---|
| A1 | Microsoft Excel & Spreadsheet → Persiapan & Kualitas Data | Tidak setuju | Pemeriksaan kualitas data dapat dimulai dari formulir dan aturan bisnis tanpa Excel. |
| A2 | SQL & Kueri Basis Data → Persiapan & Kualitas Data | Tidak setuju | Menentukan data yang valid bergantung pada aturan bisnis, bukan kemampuan menulis kueri. |
| A3 | Microsoft Excel & Spreadsheet → Analisis Data | Tidak setuju | Memahami pertanyaan bisnis dan membandingkan data lebih mendasar daripada alat spreadsheet. |
| A4 | SQL & Kueri Basis Data → Analisis Data | Tidak setuju | BA dapat menganalisis ekspor operasional yang sudah tersedia tanpa menulis SQL. |
| A5 | Statistika → Analisis Data | Tidak setuju | Analisis deskriptif sederhana bisa dimulai sambil mempelajari statistik yang relevan. |
| A6 | Persiapan & Kualitas Data → Analisis Data | Setuju | Kesimpulan bisnis akan keliru bila definisi, kelengkapan, dan konsistensi data diabaikan. |
| A7 | SQL & Kueri Basis Data → Visualisasi Data | Tidak setuju | BA dapat memvisualisasikan data ekspor tanpa kueri. |
| A8 | Microsoft Excel & Spreadsheet → Visualisasi Data | Tidak setuju | Grafik dapat dibuat di BI atau disusun sebagai rancangan sebelum memilih alat. |
| A9 | Visualisasi Data → Pelaporan & Dashboard BI | Setuju | Tanpa pemilihan visual yang tepat, laporan mudah menimbulkan interpretasi keliru. |
| A10 | Analisis Data → Pelaporan & Dashboard BI | Setuju | Dashboard perlu menjawab pertanyaan bisnis, bukan sekadar menampilkan angka. |
| A11 | Metrik & KPI Bisnis → Pelaporan & Dashboard BI | Setuju | Pemilik proses perlu tahu keputusan apa yang didukung setiap KPI. |
| A12 | SQL & Kueri Basis Data → Pemodelan Data & Basis Data | Tidak setuju | Model konseptual bisnis dapat dibuat tanpa pengalaman menulis kueri. |
| A13 | Analisis Data → Python/R untuk Analisis | Ragu | Masuk akal untuk otomasi pekerjaan yang sudah dipahami, tetapi bukan urutan wajib bagi pemula. |
| A14 | Visualisasi Data → Power BI | Ragu | Prinsip visual dan penggunaan Power BI dapat dipelajari dalam latihan yang sama. |
| A15 | Microsoft Excel & Spreadsheet → Power BI | Tidak setuju | Jangan menunda pembelajaran BI hanya karena kandidat belum menguasai Excel. |
| A16 | Visualisasi Data → Tableau | Ragu | Latihan Tableau dapat sekaligus menjadi media belajar prinsip visualisasi. |
| A17 | Visualisasi Data → Looker/Metabase & BI Lain | Ragu | Belajar konsep dan alat dapat bersamaan; kedalaman kebutuhan bergantung tugas BA. |
| A18 | SQL & Kueri Basis Data → Looker/Metabase & BI Lain | Tidak setuju | Pengguna dashboard atau konektor spreadsheet tidak harus menulis SQL. |
| A19 | Elisitasi Kebutuhan → Dokumentasi Kebutuhan (BRD/FSD/User Story) | Setuju | Dokumen harus mencerminkan kebutuhan pemangku kepentingan, bukan hanya mengisi template. |
| A20 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Pemodelan Sistem (UML/Use Case) | Tidak setuju | Pemahaman proses membantu, tetapi penguasaan notasi proses bukan syarat semua model sistem. |
| A21 | Elisitasi Kebutuhan → Pemodelan Sistem (UML/Use Case) | Setuju | Tujuan aktor dan kebutuhan proses perlu diketahui sebelum memodelkan solusi. |
| A22 | Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pengujian Sistem & UAT | Setuju | UAT harus memeriksa pemenuhan kebutuhan, bukan sekadar keberhasilan klik. |
| A23 | Siklus Pengembangan Sistem (SDLC) → Pengujian Sistem & UAT | Ragu | BA bisa mulai dari latihan UAT berbasis skenario sebelum mempelajari seluruh siklus. |
| A24 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Alat Diagram (Visio/Lucidchart/draw.io) | Tidak setuju | Menggambar alur sederhana tidak perlu menunggu penguasaan BPMN. |
| A25 | Elisitasi Kebutuhan → Wireframe & Prototipe (Figma) | Setuju | Wireframe sebaiknya merespons tujuan, tugas, dan kendala pengguna yang telah digali. |
| A26 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Sistem ERP & CRM | Setuju | Pada jalur BA implementasi ERP/CRM, pemetaan proses dasar membantu memahami gap dan konfigurasi modul. |
| A27 | Siklus Pengembangan Sistem (SDLC) → API & Integrasi Sistem | Tidak setuju | BA dapat mempelajari pertukaran informasi antarproses melalui kasus sederhana. |
| A28 | Pemodelan Data & Basis Data → API & Integrasi Sistem | Ragu | BA proses perlu memahami informasi yang dipertukarkan, tetapi belum tentu desain basis data. |
| A29 | Programming fundamentals & OOP → REST API design & development | Tidak setuju | Rancangan kontrak API perlu dipisahkan dari penulisan kode; OOP bukan dasar semua pendekatan. |
| A30 | Python programming → Python/R untuk Analisis | Tidak setuju | Label alternatif Python/R tidak boleh dipaksa melewati Python. |
| A31 | Test design & test cases → Pengujian Sistem & UAT | Setuju | Desain uji dasar membantu menguji proses normal, pengecualian, dan aturan bisnis. |

### A-tambahan. Prasyarat yang diusulkan

Kelima usulan berikut adalah bahan tinjauan baru; jika skill belum ada dalam taksonomi, tambahkan atau definisikan dulu sebelum membuat edge.

| No | Skill A | Skill B | Alasan |
|---|---|---|---|
| A+1 | Identifikasi masalah dan tujuan bisnis | Elisitasi kebutuhan | Mencegah pengumpulan keinginan yang tidak berhubungan dengan masalah utama. |
| A+2 | Analisis pemangku kepentingan | Perencanaan elisitasi | Menentukan siapa yang mengetahui proses dan siapa yang memutuskan kebutuhan. |
| A+3 | Pemetaan proses as-is | Gap analysis dan rancangan to-be | Perubahan perlu didasarkan pada kondisi awal dan kesenjangan yang nyata. |
| A+4 | Business rules | Acceptance criteria | Kriteria harus mencerminkan kebijakan dan aturan operasional yang disepakati. |
| A+5 | Acceptance criteria | UAT | Menjelaskan hasil bisnis yang harus dibuktikan oleh pengujian. |

### Bagian B. Relevansi untuk lulusan baru BA

| No | Skill | Disebut lowongan, menurut dokumen tim | Jawaban | Alasan |
|---|---|---|---|---|
| B1 | Elisitasi Kebutuhan | 59% | Wajib | Kemampuan menerjemahkan masalah pemilik proses menjadi kebutuhan adalah inti peran. |
| B2 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 48% | Wajib | Hasil analisis harus dapat dipakai dan dikonfirmasi oleh pihak bisnis. |
| B3 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 38% | Wajib | Untuk BA proses, pemetaan as-is dan to-be merupakan bukti kemampuan utama. |
| B4 | Pengujian Sistem & UAT | 35% | Penting | BA membantu memastikan solusi mendukung proses dan kebutuhan pengguna. |
| B5 | Siklus Pengembangan Sistem (SDLC) | 31% | Penting | Penting untuk mengetahui kapan masukan bisnis dibutuhkan selama proyek. |
| B6 | SQL & Kueri Basis Data | 29% | Pelengkap | Berguna bila BA mengakses data sendiri; bukan inti semua pekerjaan proses. |
| B7 | API & Integrasi Sistem | 24% | Pelengkap | Cukup memahami pertukaran informasi dan dampak proses pada tahap awal. |
| B8 | Microsoft Excel & Spreadsheet | 21% | Penting | Bermanfaat untuk rekonsiliasi sederhana, daftar kebutuhan, dan analisis operasional. |
| B9 | Sistem ERP & CRM | 20% | Pelengkap | Penting untuk lowongan implementasi tertentu, tetapi tidak wajib pada semua BA junior. |
| B10 | Alat Diagram (Visio/Lucidchart/draw.io) | 16% | Penting | Mendukung penyampaian alur proses; merek alat tertentu tidak wajib. |
| B11 | Pemodelan Data & Basis Data | 14% | Pelengkap | Pemetaan informasi berguna, sementara desain basis data rinci bukan fokus utama. |
| B12 | Jira/Confluence & Alat Kolaborasi | 12% | Pelengkap | Proses pelacakan kerja lebih penting daripada merek alat. |
| B13 | Pemodelan Sistem (UML/Use Case) | 11% | Pelengkap | Tidak semua BA proses menggunakan UML; flowchart bisa mencukupi. |
| B14 | REST API design & development | 9% | Pelengkap | Untuk BA proses, ini nilai tambah; development bukan kompetensi inti. |
| B15 | Analisis Data | 8% | Penting | Analisis dasar diperlukan untuk mendukung rekomendasi perubahan proses. |
| B16 | Metrik & KPI Bisnis | 7% | Wajib | BA proses perlu menjelaskan manfaat perubahan melalui indikator yang tepat. |
| B17 | Persiapan & Kualitas Data | 5% | Penting | BA harus mengenali aturan validasi dan inkonsistensi data bisnis. |
| B18 | Pelaporan & Dashboard BI | 5% | Pelengkap | Kebutuhan pelaporan perlu dipahami, tetapi membangun dashboard bisa menjadi tugas tim lain. |
| B19 | Wireframe & Prototipe (Figma) | 5% | Pelengkap | Nilai tambah untuk proses berbasis aplikasi; bukan semua BA perlu Figma. |
| B20 | Power BI | 5% | Pelengkap | Dapat dipelajari setelah kebutuhan pelaporan atau organisasi diketahui. |

### Bagian C. Jawaban terbuka

**C1. Dari 20 skill di Bagian B, tiga skill mana yang **paling** menentukan lulusan baru diterima sebagai BA di Indonesia?**

Elisitasi kebutuhan (B1), pemodelan proses bisnis (B3), dan dokumentasi kebutuhan (B2). Untuk jalur proses, kandidat perlu memahami kondisi awal, menemukan masalah, dan menjelaskan perubahan secara operasional.

**C2. Skill apa yang **sering diminta lowongan tetapi menurut Anda dilebih-lebihkan** untuk posisi BA junior?**

Development REST API serta penguasaan teknis mendalam atas ERP/CRM dapat berlebihan untuk BA proses junior. Literasi sistem tetap berguna, tetapi kandidat sebaiknya dinilai atas kemampuan analisis proses dan kebutuhan.

**C3. Skill hard apa yang **penting untuk BA tetapi tidak ada** di daftar? (PathSync sengaja hanya mengukur hard skill; soft skill dicatat terpisah sebagai pengalaman.)**

Root-cause analysis, gap analysis, business rules, serta dasar analisis manfaat dan kelayakan. Acceptance criteria dan teknik prioritisasi seperti MoSCoW juga perlu terlihat sebagai kemampuan yang dapat diperiksa.

**C4. Untuk mahasiswa yang baru mulai dari nol, **tiga skill pertama** apa yang sebaiknya dipelajari, dan dalam urutan apa?**

Pemodelan proses bisnis dasar → elisitasi kebutuhan → dokumentasi kebutuhan. Latihan dimulai dari satu proses yang dikenal, disertai tujuan dan stakeholder, lalu diperbaiki setelah informasi tambahan diperoleh.

**C5. Apakah ada perbedaan kebutuhan BA antara **sektor** (perbankan, e-commerce/teknologi, konsultan, pemerintahan) yang perlu diperhatikan sistem?**

Perbankan dapat memerlukan kedalaman pada pengecualian transaksi dan kendali; e-commerce pada friksi pengguna dan hasil perubahan proses. Konsultan dapat menuntut adaptasi lintas klien, sementara pemerintahan dapat memerlukan pemetaan prosedur dan layanan; kebutuhan sebenarnya harus dikonfirmasi per organisasi.

**C6. Bukti apa yang paling meyakinkan Anda bahwa seorang lulusan baru **benar-benar bisa** melakukan elisitasi dan dokumentasi kebutuhan (misalnya contoh BRD, user story, studi kasus, proyek)?**

Studi kasus as-is/to-be yang menunjukkan sumber informasi, akar masalah, aturan bisnis, kebutuhan yang diprioritaskan, serta alasan perubahan. Kandidat perlu mampu menjelaskan mengapa usulan itu lebih baik dan bagaimana hasilnya akan diukur.

**C7. Bila Anda melihat rute belajar yang disarankan PathSync untuk seorang mahasiswa (contoh di bawah), apakah urutannya masuk akal? Apa yang akan Anda ubah?**

Saya akan menambahkan pemodelan proses sebelum atau bersama elisitasi, lalu dokumentasi dan acceptance criteria dalam proyek yang sama. Untuk jalur proses, SQL dapat menyusul setelah kandidat mampu menjelaskan masalah, kebutuhan, dan ukuran keberhasilan.

### Bagian E. Pertanyaan lanjutan

**E1. Untuk pernyataan Bagian A yang Anda setujui, mana yang **wajib** (B tidak bisa dimulai tanpa A) dan mana yang hanya **membantu**? Tulis nomornya. Wajib: … / Membantu: …**

Wajib pada batas minimum tugas: A6, A19, A21, A22, A25, A31. Membantu: A9, A10, A11, A26. Pada A26 yang membantu ialah pemetaan proses untuk memahami implementasi ERP/CRM, bukan kewajiban menguasai seluruh BPMN; UAT juga memerlukan kebutuhan dan kondisi penerimaan, bukan format BRD tertentu.

**E2. Apakah prasyarat berikut perlu ditambahkan? (Setuju / Tidak / Ragu) — (a) analisis pemangku kepentingan → elisitasi; (b) acceptance criteria → UAT; (c) kebutuhan fungsional & nonfungsional → dokumentasi kebutuhan**

(a) Setuju: stakeholder berbeda bisa memiliki kebutuhan dan kewenangan yang berbeda. (b) Setuju: UAT memerlukan hasil bisnis yang disepakati. (c) Setuju: dokumentasi harus mencakup fungsi serta kendala kualitas yang relevan.

**E3. Apakah skill berikut layak jadi skill tersendiri untuk BA junior? (Wajib / Penting / Pelengkap / Tidak) — root-cause & gap analysis; acceptance criteria; requirements traceability**

Root-cause & gap analysis: Wajib pada jalur proses. Acceptance criteria: Wajib pada tingkat dasar. Requirements traceability: Penting, khususnya untuk memeriksa bahwa perubahan yang dibuat masih menjawab kebutuhan awal.

**E4. Apakah rute belajar sebaiknya dibedakan per jenis BA (proses/bisnis, sistem/teknis, data)? Bila ya, skill mana yang berbeda kedalamannya?**

Ya. BA proses perlu lebih dalam pada proses, aturan, KPI, dan manfaat perubahan; BA sistem pada perilaku serta batas solusi; BA data pada definisi metrik, data, dan pelaporan. Jangan menjadikan seluruh cabang teknis sebagai jalur wajib BA proses.


## Perspektif 3 — BA sistem/teknis

### Bagian A. Urutan prasyarat

| No | Skill A → Skill B | Jawaban | Alasan |
|---|---|---|---|
| A1 | Microsoft Excel & Spreadsheet → Persiapan & Kualitas Data | Tidak setuju | Pembersihan dapat dipelajari lewat SQL atau Python; jangan mengunci konsep pada satu alat. |
| A2 | SQL & Kueri Basis Data → Persiapan & Kualitas Data | Tidak setuju | SQL diperlukan untuk jalur pembersihan berbasis basis data, tetapi bukan seluruh jalur persiapan data. |
| A3 | Microsoft Excel & Spreadsheet → Analisis Data | Tidak setuju | Analisis bisa menggunakan SQL, notebook, atau BI; Excel berguna tetapi bukan syarat universal. |
| A4 | SQL & Kueri Basis Data → Analisis Data | Tidak setuju | SQL sangat membantu analisis data relasional, tetapi tidak semua analisis memerlukan akses basis data. |
| A5 | Statistika → Analisis Data | Ragu | Inferensi memerlukan dasar statistik yang lebih kuat daripada eksplorasi sederhana; pecah tingkat kompetensinya. |
| A6 | Persiapan & Kualitas Data → Analisis Data | Setuju | Pemeriksaan tipe, duplikasi, dan nilai hilang menjadi dasar analisis yang dapat dipertanggungjawabkan. |
| A7 | SQL & Kueri Basis Data → Visualisasi Data | Tidak setuju | Banyak alur visualisasi memakai berkas atau konektor; SQL hanya prasyarat pada jalur tertentu. |
| A8 | Microsoft Excel & Spreadsheet → Visualisasi Data | Tidak setuju | Visualisasi bisa dipelajari melalui Python, BI, atau alat lain secara langsung. |
| A9 | Visualisasi Data → Pelaporan & Dashboard BI | Setuju | Dasar pengkodean visual diperlukan untuk merancang komponen dashboard; penguasaan lanjut dapat menyusul. |
| A10 | Analisis Data → Pelaporan & Dashboard BI | Setuju | Analisis dasar diperlukan untuk memvalidasi agregasi dan menafsirkan hasil dashboard. |
| A11 | Metrik & KPI Bisnis → Pelaporan & Dashboard BI | Setuju | Definisi rumus, periode, dan tingkat rincian KPI memengaruhi rancangan dashboard. |
| A12 | SQL & Kueri Basis Data → Pemodelan Data & Basis Data | Tidak setuju | Konsep relasi dan kunci justru membantu belajar JOIN; SQL dan pemodelan logis dapat dilatih bersama. |
| A13 | Analisis Data → Python/R untuk Analisis | Tidak setuju | Mahasiswa dapat belajar analisis langsung melalui Python atau R; tidak harus melalui alat lain dahulu. |
| A14 | Visualisasi Data → Power BI | Setuju | Sebaiknya memahami pilihan grafik dan skala sebelum merancang laporan Power BI. |
| A15 | Microsoft Excel & Spreadsheet → Power BI | Tidak setuju | Power Query dan model data tidak mensyaratkan penguasaan spreadsheet lebih dahulu. |
| A16 | Visualisasi Data → Tableau | Setuju | Prinsip visual membantu sebelum memilih encoding dan menyusun dashboard Tableau. |
| A17 | Visualisasi Data → Looker/Metabase & BI Lain | Setuju | Untuk merancang visual yang dipakai pengguna, dasar visualisasi sebaiknya dipahami terlebih dahulu. |
| A18 | SQL & Kueri Basis Data → Looker/Metabase & BI Lain | Tidak setuju | Bedakan penulis kueri, pemodel, dan pengguna antarmuka visual; SQL tidak wajib untuk semuanya. |
| A19 | Elisitasi Kebutuhan → Dokumentasi Kebutuhan (BRD/FSD/User Story) | Setuju | Informasi kebutuhan diperlukan sebelum spesifikasi; elisitasi dan dokumentasi tetap berlangsung iteratif. |
| A20 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Pemodelan Sistem (UML/Use Case) | Tidak setuju | UML memiliki beragam diagram; model data atau use case tidak selalu didahului BPMN. |
| A21 | Elisitasi Kebutuhan → Pemodelan Sistem (UML/Use Case) | Setuju | Kebutuhan awal membantu menentukan batas sistem dan skenario; model juga dapat dipakai untuk elisitasi lanjutan. |
| A22 | Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pengujian Sistem & UAT | Setuju | Kebutuhan terdokumentasi membantu menurunkan skenario dan hasil yang diharapkan; tidak harus berupa BRD lengkap. |
| A23 | Siklus Pengembangan Sistem (SDLC) → Pengujian Sistem & UAT | Setuju | Pemahaman siklus pengembangan membantu membedakan pengujian teknis, UAT, dan penanganan defect. |
| A24 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Alat Diagram (Visio/Lucidchart/draw.io) | Tidak setuju | draw.io atau Visio bisa dipakai untuk ERD dan arsitektur, sehingga BPMN bukan prasyarat universal. |
| A25 | Elisitasi Kebutuhan → Wireframe & Prototipe (Figma) | Setuju | Kebutuhan awal mengarahkan rancangan; prototipe berikutnya menjadi sarana elisitasi dan validasi tambahan. |
| A26 | Pemodelan Proses Bisnis (BPMN/Flowchart) → Sistem ERP & CRM | Ragu | Membaca alur proses membantu analisis modul; pengguna awal dapat mulai dari skenario tanpa menguasai notasi. |
| A27 | Siklus Pengembangan Sistem (SDLC) → API & Integrasi Sistem | Tidak setuju | Dasar HTTP, request-response, dan format data lebih langsung relevan daripada penguasaan SDLC. |
| A28 | Pemodelan Data & Basis Data → API & Integrasi Sistem | Setuju | Pemahaman entitas, kunci, dan struktur membantu pemetaan data pada integrasi; tidak harus desain fisik mendalam. |
| A29 | Programming fundamentals & OOP → REST API design & development | Tidak setuju | API dapat dibuat secara prosedural atau fungsional; pisahkan programming fundamentals dari OOP serta design dari development. |
| A30 | Python programming → Python/R untuk Analisis | Tidak setuju | Pisahkan dua cabang: Python dasar menuju analisis Python, R dasar menuju analisis R. |
| A31 | Test design & test cases → Pengujian Sistem & UAT | Setuju | Teknik dasar desain uji mendukung cakupan UAT; tidak harus menguasai seluruh teknik pengujian lanjutan. |

### A-tambahan. Prasyarat yang diusulkan

Kelima usulan berikut adalah bahan tinjauan baru; jika skill belum ada dalam taksonomi, tambahkan atau definisikan dulu sebelum membuat edge.

| No | Skill A | Skill B | Alasan |
|---|---|---|---|
| A+1 | Dasar HTTP dan JSON | Membaca kontrak REST API | Memahami method, status, struktur request, dan response sebelum analisis kontrak. |
| A+2 | Entitas, kunci, dan relasi dasar | SQL JOIN | Membantu memahami hubungan tabel dan risiko duplikasi hasil. |
| A+3 | Kebutuhan fungsional dan nonfungsional | Spesifikasi sistem | Memastikan perilaku, kualitas, dan batas sistem tercatat. |
| A+4 | Acceptance criteria | Desain skenario UAT | Menyediakan kondisi lulus, termasuk jalur gagal dan batas data. |
| A+5 | Identifikasi kebutuhan dengan ID unik | Requirements traceability | Keterlacakan memerlukan kebutuhan yang dapat diacu secara konsisten. |

### Bagian B. Relevansi untuk lulusan baru BA

| No | Skill | Disebut lowongan, menurut dokumen tim | Jawaban | Alasan |
|---|---|---|---|---|
| B1 | Elisitasi Kebutuhan | 59% | Wajib | Kebutuhan yang jelas diperlukan sebelum menyusun spesifikasi sistem. |
| B2 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 48% | Wajib | Spesifikasi dan acceptance criteria perlu cukup jelas untuk pengembangan dan pengujian. |
| B3 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 38% | Penting | Diagram proses membantu memahami alur dan pengecualian sebelum merancang sistem. |
| B4 | Pengujian Sistem & UAT | 35% | Penting | Penting untuk validasi solusi; tanggung jawab operasional UAT bergantung organisasi. |
| B5 | Siklus Pengembangan Sistem (SDLC) | 31% | Wajib | Untuk perspektif BA sistem, kandidat perlu memahami alur pengembangan dan perubahan kebutuhan. |
| B6 | SQL & Kueri Basis Data | 29% | Penting | SELECT, JOIN, agregasi, dan pemeriksaan data membantu investigasi sistem. |
| B7 | API & Integrasi Sistem | 24% | Penting | BA sistem perlu membaca kontrak, payload, respons, serta aturan pemetaan data. |
| B8 | Microsoft Excel & Spreadsheet | 21% | Penting | Berguna untuk pemeriksaan data dan spesifikasi; fungsi lanjutan mengikuti kebutuhan. |
| B9 | Sistem ERP & CRM | 20% | Pelengkap | Pemahaman modul spesifik mengikuti sistem yang digunakan perusahaan. |
| B10 | Alat Diagram (Visio/Lucidchart/draw.io) | 16% | Penting | Alat diagram mendukung dokumentasi teknis, tetapi kandidat cukup menguasai salah satu. |
| B11 | Pemodelan Data & Basis Data | 14% | Penting | Membaca ERD dan memahami relasi membantu analisis dampak perubahan. |
| B12 | Jira/Confluence & Alat Kolaborasi | 12% | Penting | Berguna untuk pelacakan kebutuhan, keputusan, dan defect dalam proyek sistem. |
| B13 | Pemodelan Sistem (UML/Use Case) | 11% | Penting | Use case dan diagram terpilih berguna; penguasaan seluruh UML tidak diperlukan. |
| B14 | REST API design & development | 9% | Pelengkap | Literasi desain API relevan, tetapi label gabungan menuntut development yang belum tentu tugas BA. |
| B15 | Analisis Data | 8% | Penting | Berguna untuk investigasi masalah dan validasi dampak solusi. |
| B16 | Metrik & KPI Bisnis | 7% | Penting | KPI membantu menetapkan tujuan solusi dan mengevaluasi hasilnya. |
| B17 | Persiapan & Kualitas Data | 5% | Penting | Mendukung pemeriksaan sumber data, migrasi, serta integrasi. |
| B18 | Pelaporan & Dashboard BI | 5% | Pelengkap | Berguna bila cakupan proyek melibatkan pelaporan atau BI. |
| B19 | Wireframe & Prototipe (Figma) | 5% | Penting | Wireframe dasar membantu menjelaskan alur interaksi; penguasaan Figma lanjut tidak wajib. |
| B20 | Power BI | 5% | Pelengkap | Relevan untuk jalur data/BI; bukan kompetensi universal BA sistem. |

### Bagian C. Jawaban terbuka

**C1. Dari 20 skill di Bagian B, tiga skill mana yang **paling** menentukan lulusan baru diterima sebagai BA di Indonesia?**

Dokumentasi kebutuhan (B2), elisitasi kebutuhan (B1), dan SDLC (B5). Pada jalur sistem, hubungan kebutuhan, pengembangan, dan pengujian perlu jelas; SQL serta literasi integrasi menjadi pembeda sesuai cakupan posisi.

**C2. Skill apa yang **sering diminta lowongan tetapi menurut Anda dilebih-lebihkan** untuk posisi BA junior?**

Menulis production API atau menguasai OOP mendalam berpotensi berlebihan bila tugas posisi hanya analisis. Kandidat lebih tepat diuji membaca kontrak, memetakan data, dan menuliskan aturan serta kondisi gagal.

**C3. Skill hard apa yang **penting untuk BA tetapi tidak ada** di daftar? (PathSync sengaja hanya mengukur hard skill; soft skill dicatat terpisah sebagai pengalaman.)**

Acceptance criteria, kebutuhan nonfungsional, requirements traceability, dan business rules. Literasi HTTP/JSON serta teknik pemetaan request-response juga layak dipisahkan dari development API.

**C4. Untuk mahasiswa yang baru mulai dari nol, **tiga skill pertama** apa yang sebaiknya dipelajari, dan dalam urutan apa?**

SDLC dasar → elisitasi kebutuhan → dokumentasi kebutuhan. Pengenalan stakeholder dan masalah bisnis tetap menjadi bagian pembuka; SQL dan model data dasar dapat menjadi latihan paralel setelah kebutuhan data mulai jelas.

**C5. Apakah ada perbedaan kebutuhan BA antara **sektor** (perbankan, e-commerce/teknologi, konsultan, pemerintahan) yang perlu diperhatikan sistem?**

Perbankan dapat menekankan integritas transaksi, rekonsiliasi, dan keterlacakan; e-commerce dapat menekankan integrasi layanan dan alur pesanan. Konsultan bergantung arsitektur klien dan pemerintahan dapat melibatkan interoperabilitas; ini skenario penyesuaian, bukan hasil survei sektor.

**C6. Bukti apa yang paling meyakinkan Anda bahwa seorang lulusan baru **benar-benar bisa** melakukan elisitasi dan dokumentasi kebutuhan (misalnya contoh BRD, user story, studi kasus, proyek)?**

Spesifikasi singkat yang menghubungkan kebutuhan ke use case, aturan validasi, acceptance criteria, dan skenario UAT. Jika kasus memakai API, tambahkan pemetaan field dan penanganan respons gagal tanpa mewajibkan implementasi backend.

**C7. Bila Anda melihat rute belajar yang disarankan PathSync untuk seorang mahasiswa (contoh di bawah), apakah urutannya masuk akal? Apa yang akan Anda ubah?**

Elisitasi → dokumentasi → SQL masuk akal untuk jalur sistem yang memakai data, tetapi perlu diagnosis kemampuan awal. Tambahkan pengantar SDLC dan model data sesuai kesenjangan; gunakan satu mini-proyek kebutuhan hingga skenario UAT agar kompetensi dapat dibuktikan.

### Bagian E. Pertanyaan lanjutan

**E1. Untuk pernyataan Bagian A yang Anda setujui, mana yang **wajib** (B tidak bisa dimulai tanpa A) dan mana yang hanya **membantu**? Tulis nomornya. Wajib: … / Membantu: …**

Wajib pada batas minimum tugas: A6, A19, A21, A22, A25, A31. Membantu: A9, A10, A11, A14, A16, A17, A23, A28. Pada A28, dasar entitas dan struktur diperlukan untuk pemetaan data, sedangkan penguasaan seluruh pemodelan basis data tidak wajib; karena label aslinya luas, hubungan tersebut diklasifikasikan membantu.

**E2. Apakah prasyarat berikut perlu ditambahkan? (Setuju / Tidak / Ragu) — (a) analisis pemangku kepentingan → elisitasi; (b) acceptance criteria → UAT; (c) kebutuhan fungsional & nonfungsional → dokumentasi kebutuhan**

(a) Setuju: perlu menentukan pemilik kebutuhan dan sistem yang terdampak. (b) Setuju: desain UAT perlu kondisi penerimaan yang dapat diperiksa. (c) Setuju: kebutuhan nonfungsional perlu hadir bersama fungsi agar spesifikasi tidak kehilangan batas kinerja, keamanan, atau keandalan yang relevan.

**E3. Apakah skill berikut layak jadi skill tersendiri untuk BA junior? (Wajib / Penting / Pelengkap / Tidak) — root-cause & gap analysis; acceptance criteria; requirements traceability**

Root-cause & gap analysis: Penting. Acceptance criteria: Wajib pada tingkat dasar. Requirements traceability: Penting; dapat menjadi Wajib pada konteks proyek yang secara eksplisit menuntut keterlacakan penuh.

**E4. Apakah rute belajar sebaiknya dibedakan per jenis BA (proses/bisnis, sistem/teknis, data)? Bila ya, skill mana yang berbeda kedalamannya?**

Ya. BA sistem perlu memperdalam use case, kontrak API, model data dasar, validasi, dan UAT; BA proses lebih dalam pada operasi serta manfaat; BA data lebih dalam pada SQL dan kualitas data. Literasi API harus dibedakan dari kemampuan membangun API.


## Rangkuman perbedaan tiga perspektif

| Aspek | Perspektif 1: dosen SI | Perspektif 2: BA proses | Perspektif 3: BA sistem |
|---|---|---|---|
| Penekanan | Konsep, tingkat kemampuan, dan bukti belajar | Masalah proses dan manfaat bisnis | Kebutuhan sistem yang jelas dan dapat diuji |
| Tiga skill teratas C1 | Elisitasi, dokumentasi, proses | Elisitasi, proses, dokumentasi | Dokumentasi, elisitasi, SDLC |
| Prioritas khusus B | Konsep data dan diagram dinilai penting | Proses dan KPI dinilai wajib dalam jalurnya | SDLC wajib; API, kolaborasi, dan wireframe penting |
| SQL | Penting sebagai bekal | Pelengkap, tergantung pekerjaan | Penting untuk investigasi sistem |
| ERP/CRM | Pelengkap | Pelengkap secara umum; proses membantu saat implementasi | Pelengkap sesuai sistem perusahaan |
| Wireframe | Pelengkap | Pelengkap | Penting untuk kebutuhan antarmuka |
| Urutan awal C4 | Proses → elisitasi → dokumentasi | Proses → elisitasi → dokumentasi | SDLC → elisitasi → dokumentasi |
| Bukti kemampuan | Artefak konsisten dan pembelaan keputusan | Kasus as-is/to-be, gap, aturan, dan manfaat | Spesifikasi, acceptance criteria, serta skenario uji |

Perbedaan tersebut mencerminkan penekanan analisis berdasarkan cakupan setiap peran.

### Perbandingan seluruh jawaban A

Tabel ini merangkum pilihan dari jawaban beralasan di atas.

| No | Perspektif 1 | Perspektif 2 | Perspektif 3 |
|---|---|---|---|
| A1 | Tidak setuju | Tidak setuju | Tidak setuju |
| A2 | Tidak setuju | Tidak setuju | Tidak setuju |
| A3 | Tidak setuju | Tidak setuju | Tidak setuju |
| A4 | Tidak setuju | Tidak setuju | Tidak setuju |
| A5 | Ragu | Tidak setuju | Ragu |
| A6 | Setuju | Setuju | Setuju |
| A7 | Tidak setuju | Tidak setuju | Tidak setuju |
| A8 | Tidak setuju | Tidak setuju | Tidak setuju |
| A9 | Setuju | Setuju | Setuju |
| A10 | Setuju | Setuju | Setuju |
| A11 | Setuju | Setuju | Setuju |
| A12 | Tidak setuju | Tidak setuju | Tidak setuju |
| A13 | Tidak setuju | Ragu | Tidak setuju |
| A14 | Setuju | Ragu | Setuju |
| A15 | Tidak setuju | Tidak setuju | Tidak setuju |
| A16 | Setuju | Ragu | Setuju |
| A17 | Ragu | Ragu | Setuju |
| A18 | Tidak setuju | Tidak setuju | Tidak setuju |
| A19 | Setuju | Setuju | Setuju |
| A20 | Tidak setuju | Tidak setuju | Tidak setuju |
| A21 | Setuju | Setuju | Setuju |
| A22 | Setuju | Setuju | Setuju |
| A23 | Setuju | Ragu | Setuju |
| A24 | Tidak setuju | Tidak setuju | Tidak setuju |
| A25 | Setuju | Setuju | Setuju |
| A26 | Ragu | Setuju | Ragu |
| A27 | Tidak setuju | Tidak setuju | Tidak setuju |
| A28 | Ragu | Ragu | Setuju |
| A29 | Tidak setuju | Tidak setuju | Tidak setuju |
| A30 | Tidak setuju | Tidak setuju | Tidak setuju |
| A31 | Setuju | Setuju | Setuju |

### Perbandingan seluruh jawaban B

| No | Perspektif 1 | Perspektif 2 | Perspektif 3 |
|---|---|---|---|
| B1 | Wajib | Wajib | Wajib |
| B2 | Wajib | Wajib | Wajib |
| B3 | Penting | Wajib | Penting |
| B4 | Penting | Penting | Penting |
| B5 | Penting | Penting | Wajib |
| B6 | Penting | Pelengkap | Penting |
| B7 | Pelengkap | Pelengkap | Penting |
| B8 | Penting | Penting | Penting |
| B9 | Pelengkap | Pelengkap | Pelengkap |
| B10 | Penting | Penting | Penting |
| B11 | Penting | Pelengkap | Penting |
| B12 | Pelengkap | Pelengkap | Penting |
| B13 | Penting | Pelengkap | Penting |
| B14 | Pelengkap | Pelengkap | Pelengkap |
| B15 | Penting | Penting | Penting |
| B16 | Penting | Wajib | Penting |
| B17 | Penting | Penting | Penting |
| B18 | Pelengkap | Pelengkap | Pelengkap |
| B19 | Pelengkap | Pelengkap | Penting |
| B20 | Pelengkap | Pelengkap | Pelengkap |
