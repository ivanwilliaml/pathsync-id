# Kunci Jawaban PathSync untuk Kuesioner V5

Jangan dibagikan ke pakar sebelum mereka selesai mengisi. Angka resmi tetap dihitung dengan `python -m pipeline.expert_v5 score ...` (Spearman memakai nilai p asli, bukan skala 1-5).

## Bagian A. Penilaian kemampuan

Skala 1-5 hanya untuk mencocokkan cepat: p < 20% = 1, 20-39% = 2, 40-59% = 3, 60-79% = 4, >= 80% = 5.

| Kode | Skill | Penguasaan menurut PathSync (p) | Setara skala 1-5 |
|---|---|---|---|
| P1-1 | Pengujian Sistem & UAT | 11% | 1 |
| P1-2 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 27% | 2 |
| P1-3 | Pemodelan Sistem (UML/Use Case) | 64% | 4 |
| P1-4 | SQL & Kueri Basis Data | 41% | 3 |
| P2-1 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 30% | 2 |
| P2-2 | Pemodelan Sistem (UML/Use Case) | 55% | 3 |
| P2-3 | Pengujian Sistem & UAT | 83% | 5 |
| P2-4 | SQL & Kueri Basis Data | 42% | 3 |
| P3-1 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 19% | 1 |
| P3-2 | Elisitasi Kebutuhan | 46% | 3 |
| P3-3 | Pemodelan Sistem (UML/Use Case) | 51% | 3 |
| P3-4 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 56% | 3 |
| P4-1 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 42% | 3 |
| P4-2 | Pemodelan Sistem (UML/Use Case) | 68% | 4 |
| P4-3 | Elisitasi Kebutuhan | 49% | 3 |
| P4-4 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 13% | 1 |
| P5-1 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 58% | 3 |
| P5-2 | SQL & Kueri Basis Data | 38% | 2 |
| P5-3 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 46% | 3 |
| P5-4 | Elisitasi Kebutuhan | 60% | 4 |
| P6-1 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 45% | 3 |
| P6-2 | Elisitasi Kebutuhan | 56% | 3 |
| P6-3 | Pemodelan Sistem (UML/Use Case) | 76% | 4 |
| P6-4 | SQL & Kueri Basis Data | 75% | 4 |
| P7-1 | Pemodelan Proses Bisnis (BPMN/Flowchart) | 78% | 4 |
| P7-2 | Pemodelan Sistem (UML/Use Case) | 69% | 4 |
| P7-3 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 30% | 2 |
| P7-4 | Pengujian Sistem & UAT | 73% | 4 |
| P8-1 | Dokumentasi Kebutuhan (BRD/FSD/User Story) | 21% | 2 |
| P8-2 | Pengujian Sistem & UAT | 51% | 3 |
| P8-3 | Elisitasi Kebutuhan | 63% | 4 |
| P8-4 | Pemodelan Sistem (UML/Use Case) | 56% | 3 |

## Bagian B. Urutan belajar (5 teratas, nomor kandidat)

| Skenario | PathSync (formula 5) | Pembanding: kesenjangan terbesar | Pembanding: kesenjangan x permintaan |
|---|---|---|---|
| S01-base | **1, 3, 2, 6, 4** | 5, 3, 2, 7, 1 | 1, 2, 3, 6, 5 |
| S01-comp | **2, 3, 6, 4, 1** | 5, 3, 2, 7, 6 | 2, 3, 6, 5, 4 |
| S02-base | **1, 2, 4, 6, 3** | 1, 2, 3, 8, 7 | 1, 2, 3, 6, 4 |
| S02-comp | **1, 2, 6, 4, 3** | 1, 2, 3, 8, 7 | 1, 2, 3, 6, 4 |
| S03-base | **1, 2, 3, 4, 6** | 2, 3, 1, 4, 8 | 1, 2, 3, 4, 6 |
| S03-comp | **2, 4, 3, 1, 6** | 2, 3, 4, 8, 6 | 2, 3, 4, 1, 6 |
| S04-base | **1, 3, 4, 2, 6** | 1, 3, 7, 2, 4 | 1, 2, 3, 4, 6 |
| S04-comp | **2, 3, 4, 1, 7** | 3, 7, 2, 4, 6 | 2, 3, 4, 6, 7 |
| S05-base | **1, 2, 8, 4, 5** | 2, 1, 8, 3, 4 | 1, 2, 3, 4, 8 |
| S05-comp | **2, 4, 8, 1, 5** | 2, 8, 3, 4, 6 | 2, 3, 4, 8, 5 |
| S06-base | **1, 2, 5, 3, 4** | 3, 2, 7, 5, 8 | 1, 2, 3, 5, 4 |
| S06-comp | **2, 5, 4, 3, 1** | 3, 2, 7, 5, 8 | 2, 3, 5, 4, 7 |
| S07-base | **1, 3, 2, 4, 7** | 3, 2, 7, 1, 4 | 1, 2, 3, 4, 7 |
| S07-comp | **3, 4, 2, 1, 7** | 3, 2, 7, 4, 8 | 2, 3, 4, 7, 1 |
| S08-base | **1, 3, 2, 6, 5** | 5, 3, 2, 6, 8 | 1, 2, 3, 6, 5 |
| S08-comp | **2, 3, 6, 5, 1** | 5, 3, 2, 6, 8 | 2, 3, 6, 5, 8 |

Urutan PathSync dengan nama skill:

- **S01-base:** Elisitasi Kebutuhan → SQL & Kueri Basis Data → Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pemodelan Proses Bisnis (BPMN/Flowchart) → Siklus Pengembangan Sistem (SDLC)
- **S01-comp:** Dokumentasi Kebutuhan (BRD/FSD/User Story) → SQL & Kueri Basis Data → Pemodelan Proses Bisnis (BPMN/Flowchart) → Siklus Pengembangan Sistem (SDLC) → Elisitasi Kebutuhan
- **S02-base:** API & Integrasi Sistem → Pemodelan Proses Bisnis (BPMN/Flowchart) → Elisitasi Kebutuhan → Siklus Pengembangan Sistem (SDLC) → Pengujian Sistem & UAT
- **S02-comp:** API & Integrasi Sistem → Pemodelan Proses Bisnis (BPMN/Flowchart) → Siklus Pengembangan Sistem (SDLC) → Elisitasi Kebutuhan → Pengujian Sistem & UAT
- **S03-base:** Elisitasi Kebutuhan → Siklus Pengembangan Sistem (SDLC) → Pemodelan Proses Bisnis (BPMN/Flowchart) → Dokumentasi Kebutuhan (BRD/FSD/User Story) → Sistem ERP & CRM
- **S03-comp:** Siklus Pengembangan Sistem (SDLC) → Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pemodelan Proses Bisnis (BPMN/Flowchart) → Elisitasi Kebutuhan → Sistem ERP & CRM
- **S04-base:** Elisitasi Kebutuhan → Pemodelan Proses Bisnis (BPMN/Flowchart) → Siklus Pengembangan Sistem (SDLC) → Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pengujian Sistem & UAT
- **S04-comp:** Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pemodelan Proses Bisnis (BPMN/Flowchart) → Siklus Pengembangan Sistem (SDLC) → Elisitasi Kebutuhan → Pemodelan Sistem (UML/Use Case)
- **S05-base:** Elisitasi Kebutuhan → Pemodelan Proses Bisnis (BPMN/Flowchart) → Jira/Confluence & Alat Kolaborasi → Dokumentasi Kebutuhan (BRD/FSD/User Story) → Siklus Pengembangan Sistem (SDLC)
- **S05-comp:** Pemodelan Proses Bisnis (BPMN/Flowchart) → Dokumentasi Kebutuhan (BRD/FSD/User Story) → Jira/Confluence & Alat Kolaborasi → Elisitasi Kebutuhan → Siklus Pengembangan Sistem (SDLC)
- **S06-base:** Elisitasi Kebutuhan → Pemodelan Proses Bisnis (BPMN/Flowchart) → Siklus Pengembangan Sistem (SDLC) → SQL & Kueri Basis Data → Dokumentasi Kebutuhan (BRD/FSD/User Story)
- **S06-comp:** Pemodelan Proses Bisnis (BPMN/Flowchart) → Siklus Pengembangan Sistem (SDLC) → Dokumentasi Kebutuhan (BRD/FSD/User Story) → SQL & Kueri Basis Data → Elisitasi Kebutuhan
- **S07-base:** Elisitasi Kebutuhan → API & Integrasi Sistem → Pengujian Sistem & UAT → Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pemodelan Data & Basis Data
- **S07-comp:** API & Integrasi Sistem → Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pengujian Sistem & UAT → Elisitasi Kebutuhan → Pemodelan Data & Basis Data
- **S08-base:** Elisitasi Kebutuhan → Pemodelan Proses Bisnis (BPMN/Flowchart) → Dokumentasi Kebutuhan (BRD/FSD/User Story) → API & Integrasi Sistem → Pemodelan Data & Basis Data
- **S08-comp:** Dokumentasi Kebutuhan (BRD/FSD/User Story) → Pemodelan Proses Bisnis (BPMN/Flowchart) → API & Integrasi Sistem → Pemodelan Data & Basis Data → Elisitasi Kebutuhan

## Bagian C. Mutu soal

Kunci setiap soal sudah ditandai **(kunci)** di kuesioner. Yang dicocokkan adalah apakah pakar menjawab *Kunci benar? = Ya*.

## Bagian D. Aturan learning loop

Tidak ada kunci. Yang dilaporkan adalah berapa pakar yang setuju pada setiap aturan (D1-D7) beserta alasan bila tidak setuju.
