# Panduan Anotasi Skill Lowongan (Plan A1)

Tujuan: dua anotator manusia melabeli skill pada 130 lowongan yang sama secara independen (100 dari set terkunci `gold_split.json` untuk 14 role awal, ditambah 30 dari `gold_split_bisnis.json` untuk 6 role bisnis). Hasilnya dipakai untuk mengukur ekstraktor (presisi, recall, F1) dan kesepakatan antar-anotator (kappa). Totalnya sekitar 3 sampai 4 jam per anotator, boleh dibagi beberapa sesi.

## Cara kerja

1. Buka **Admin > Annotation**, isi nama (pakai nama yang sama di setiap sesi), lalu **Start Annotating**.
2. Lowongan dari set terkunci (`data/seed/gold_split.json`, 50 dev dan 50 uji) muncul lebih dulu, urutannya sama untuk semua anotator.
3. Baca **seluruh** teks lowongan, lalu centang skill taksonomi yang memenuhi aturan di bawah. Simpan, lanjut ke lowongan berikutnya.
4. Jangan melihat keluaran ekstraktor (peta pasar, halaman Job Market) selama periode anotasi, dan jangan berdiskusi dengan anotator lain sampai keduanya selesai.
5. Setelah keduanya selesai: `python -m pipeline.gold consensus`. Pasangan (lowongan, skill) yang berbeda masuk daftar sengketa di `data/models/gold_agreement.json`; penilai ketiga memutuskan di `data/seed/gold_adjudication.json`.

## Yang dihitung

- **Syarat atau tugas yang tertulis eksplisit.** "Mampu menulis kueri SQL", "membuat dashboard Power BI", "menyusun BRD".
- **Daftar alternatif.** "Python, R, atau sejenis": hitung skill yang tercantum (Python atau R untuk analitik).
- **Nilai tambah.** "Diutamakan", "nice to have", "a plus": tetap dihitung.
- **Alat yang disebut sebagai alat kerja.** "Menggunakan Jira untuk backlog", "Excel tingkat lanjut".

## Yang tidak dihitung

- Bidang gelar ("S1 Sistem Informasi"), nama tim, nama perusahaan, produk perusahaan.
- Domain bisnis tanpa kemampuan yang diminta ("perusahaan fintech", "industri retail").
- Soft skill (komunikasi, kerja sama, kepemimpinan). Soft skill dicatat di lapisan terpisah dan tidak masuk taksonomi hard skill.
- Kata yang hanya muncul di deskripsi perusahaan atau benefit ("kami memakai teknologi cloud").

## Skill yang sering tumpang tindih

| Teks lowongan | Label |
|---|---|
| "REST API", "membangun endpoint" | `rest_api_design` |
| "integrasi sistem", "menghubungkan API pihak ketiga", "API" tanpa kata membangun | `api_integration` |
| Keduanya disebut terpisah | dua label |
| Python untuk analisis data, pandas, notebook | `python_analytics` |
| Python dengan Django, FastAPI, Flask | `python_backend` |
| Python tanpa konteks | `python_programming` |
| SIEM, Splunk, QRadar, pemantauan log keamanan | `siem_monitoring` |
| Penanganan insiden, forensik digital | `incident_response_forensics` |
| "Membuat laporan" rutin tanpa alat BI atau dashboard | jangan diberi `dashboard_reporting` |
| Power BI, Tableau, dashboard | `dashboard_reporting` (ditambah label alat BI bila disebut) |

### Role bisnis (taksonomi v4)

| Teks lowongan | Label |
|---|---|
| "perpajakan", lapor SPT, e-Faktur, e-Bupot, Coretax, kepatuhan pajak umum | `tax_compliance_id` |
| Menghitung atau memotong PPh badan, PPh 22, 23, 25, 26, 29, PPh final (tulisan "PPh 23" maupun "PPh23") | `pph_corporate_withholding` (tambahkan `tax_compliance_id` hanya bila pelaporan umum juga disebut) |
| Mekanisme PPN: faktur pajak, PKP, PPN masukan dan keluaran, PPnBM | `vat_ppn_mechanics` |
| PPh 21 karyawan dalam konteks penggajian | `payroll_processing` (tambahkan `tax_compliance_id` bila pelaporan pajak juga disebut) |
| Pemeriksaan, keberatan, banding pajak | `tax_dispute_audit` |
| Audit internal umum, kontrol internal, kertas kerja | `audit_internal_control` |
| Menyusun rencana audit, melaksanakan fieldwork | `audit_planning_fieldwork` |
| Laporan audit, temuan, tindak lanjut temuan | `audit_reporting_followup` |
| Manajemen risiko perusahaan, ERM, ISO 31000, risiko operasional | `enterprise_risk_management` |
| Risiko dan isu proyek, RAID log, change request proyek | `project_risk_change` |
| Jira, Confluence | `jira_confluence` |
| Trello, Asana, Notion, Basecamp, Wrike untuk mengelola proyek | `project_tools_workspace` |
| SAP, Oracle ERP, Odoo sebagai sistem bisnis | `erp_crm` |
| Rekrutmen, sourcing kandidat, wawancara | `recruitment_selection` |
| HRIS, sistem informasi SDM | `hris_systems` |

Bila ragu antara dua label, pilih yang paling spesifik dan catat id lowongannya di catatan bersama tim. Skill yang sering diragukan menjadi masukan taksonomi versi berikutnya.

## Aturan keputusan (ditulis sebelum hasil keluar)

- Kappa antar-anotator ≥ 0,70. Bila lebih rendah, panduan ini diperbaiki dan lowongan yang bermasalah dilabeli ulang.
- Alias, prompt, dan ambang hanya boleh disetel di paruh **dev**. Angka yang dilaporkan hanya dari paruh **uji**: `python -m pipeline.eval_extractor --gold gold_consensus.json --split test --extractor <lexicon|llm|union|intersection>`.
- Ekstraktor yang dipakai: F1 tertinggi di paruh uji dengan presisi ≥ 0,80. Bila selisih F1 < 0,02, pakai leksikon (lebih murah dan deterministik).

## Label normalisasi frasa (plan A3)

300 frasa bebas dari lowongan (100 per pita kemiripan: di bawah 0,70, 0,70 sampai 0,85, dan 0,85 ke atas) sudah dikunci di `backend/data/seed/normalisation_sample.json`. Sistem tidak menampilkan tebakannya ke pelabel.

1. `python -m pipeline.normalisation sheet <nama>` membuat lembar Excel untuk satu pelabel di `backend/data/processed/` (dropdown id skill, urutan diacak, pita kemiripan tidak ditampilkan).
2. Pilih id skill taksonomi yang benar dari dropdown, atau `none` bila frasa itu bukan skill atau skillnya tidak ada di taksonomi. Kerjakan sendiri tanpa melihat lembar pelabel lain.
3. `python -m pipeline.normalisation import <xlsx-1> <xlsx-2>`, lalu `python -m pipeline.normalisation eval`.

Aturan (ditulis sebelum label ada): ambang otomatis adalah ambang terendah dengan presisi ≥ 0,95. Frasa yang labelnya berbeda antara dua pelabel tidak dihitung sampai penilai ketiga mengisi `adjudicated`.
