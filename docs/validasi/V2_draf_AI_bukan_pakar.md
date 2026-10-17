# Draf jawaban V2 yang disusun AI (BUKAN validasi pakar)

Asal: diterima tim 18 Okt 2026. Bagian D draf itu sendiri menyatakan disusun dengan ChatGPT, tanpa nama, instansi, atau klaim
sebagai dosen/praktisi BA, dan meminta agar dipakai sebagai bahan diskusi, bukan suara pakar independen. Karena itu:

- tidak diimpor ke database, tidak dihitung di `expert_skill_relevance.json` atau kesepakatan pakar;
- dipakai hanya sebagai masukan desain dan untuk mempertajam lembar pertanyaan pakar (`V2_PERTANYAAN_PAKAR.md`).

## Ringkasan isi

**Bagian A (31 prasyarat):** setuju 16 (A1, A6, A9, A10, A11, A14, A16, A17, A19, A21, A22, A25, A26, A28, A30, A31),
tidak setuju 15 (A2, A3, A4, A5, A7, A8, A12, A13, A15, A18, A20, A23, A24, A27, A29). Alasan umum penolakan: hubungan itu
"membantu", bukan syarat mutlak; alat dan konsep bisa dipelajari paralel; SQL/Python/API bukan syarat universal BA.

**Prasyarat tambahan yang diusulkan:** analisis pemangku kepentingan → elisitasi; kebutuhan fungsional/nonfungsional →
dokumentasi; acceptance criteria → UAT; root-cause/konsep proses → BPMN; domain dan aturan bisnis → elisitasi.

**Bagian B (relevansi):** Wajib: elisitasi, dokumentasi kebutuhan, SDLC (pemahaman dasar). Pelengkap: ERP/CRM, REST API
design, dashboard BI, wireframe, Power BI. Sisanya Penting.

**Bagian C:** tiga skill penentu: elisitasi, dokumentasi, SDLC. Dilebih-lebihkan untuk junior: membangun REST API, platform
ERP/CRM tertentu. Belum ada di daftar: root-cause & gap analysis, acceptance criteria, traceability, change impact analysis.
Rute dari nol: SDLC + konsep BA → elisitasi → dokumentasi, lalu BPMN, acceptance criteria, UAT; SQL paralel untuk BA teknis.
Kebutuhan berbeda per sektor (perbankan, e-commerce, konsultan, pemerintahan).

## Masukan desain yang dicatat (keputusan menunggu pakar manusia)

1. Bedakan prasyarat **wajib** dan **membantu**; hanya yang wajib menurunkan readiness R.
2. Pisahkan konsep dari alat (visualisasi vs Power BI/Tableau; pemodelan proses vs draw.io).
3. Jalur per jenis BA: proses/bisnis, sistem/teknis, data.
4. Frekuensi lowongan ≠ kepentingan; pertimbangkan dimensi kepentingan dan kesulitan terpisah.
5. Kandidat skill baru: root-cause & gap analysis, acceptance criteria, requirements traceability.

Graf prasyarat tidak diubah berdasarkan draf ini.
