# Cek Lowongan Ini: kontrak backend untuk frontend

`POST /api/students/{sid}/check-job` memakai bearer token mahasiswa yang sama dengan dashboard.
Kirim JSON `{ "text": "...persyaratan lowongan..." }` (30–12.000 karakter). Teks hanya dipakai selama
permintaan berjalan: endpoint ini tidak menulis lowongan, skill, atau hasilnya ke database.
Maksimal 10 permintaan per menit per mahasiswa/IP. Ekstraktor yang dipakai adalah leksikon aktif.

Respons contoh (angka hanya ilustrasi, bukan hasil pengukuran):

```json
{
  "extractor": "lexicon",
  "n_recognized_skills": 1,
  "readiness": {
    "score": 0.58,
    "n_with_evidence": 1,
    "meaning": "coverage_of_recognized_skills_not_hiring_probability"
  },
  "skills": [{
    "text": "SQL", "start": 24, "end": 27, "skill_id": "sql",
    "skill_name": "SQL", "level_needed": "mandiri", "level_now": "dasar",
    "evidence_status": "academic"
  }],
  "gaps": [{
    "skill_id": "sql", "skill_name": "SQL", "level_needed": "mandiri",
    "level_now": "dasar", "gap": 0.3045
  }],
  "next_step": {
    "skill_id": "sql", "skill_name": "SQL", "role_in_path": "prioritas",
    "unlocks_requested": [], "quick_check_url": "/assessment/sql"
  },
  "terms_to_review": [],
  "terms_note": "Candidates found by the extractor, not a complete count of unknown terms."
}
```

`start`/`end` adalah offset UTF-16, awal inklusif dan akhir eksklusif, pada **teks asli yang dikirim**.
Frontend dapat memakai `text.slice(start, end)` untuk menyorot. `skills` dapat berisi beberapa kemunculan
skill yang sama; tiap skill unik hanya dihitung sekali dalam skor. Sorotan yang bertumpuk dihindari backend.

`score` memakai rumus cakupan di `pathing.coverage` dan seluruh bukti yang dihitung diagnosis.
Ini bukan peluang diterima kerja. Tampilkan **satu persentase saja** pada layar. Status bukti per skill
ada di `evidence_status`, dengan label tampilan berikut:

| Nilai | Label tampilan | Artinya |
|---|---|---|
| `direct` | Ada bukti langsung | Ada Quick Check, proyek yang dinilai, atau sertifikat. |
| `academic` | Baru dari nilai kuliah | Ada bukti akademik, tetapi belum ada bukti langsung untuk skill ini. |
| `none` | Belum ada bukti | Belum ada bukti untuk skill ini; diagnosis masih memakai prior. |

Nilai kuliah **tidak otomatis berubah menjadi bukti langsung**. Mahasiswa boleh memakai fitur
tanpa membuktikan setiap skill lewat Quick Check; tombol Quick Check membantu bila ingin menguji
skill yang relevan. Untuk satu lowongan, setiap skill yang dikenali punya bobot sama. Level yang tertulis
`dasar`, `mandiri`, `mahir` dipetakan ke kebutuhan 0,60; 0,725; 0,85 dalam rentang model.
Saat tak ada skill yang dikenali, `score` `null`, `gaps` kosong, dan `next_step` `null`.
Saat tak ada gap, `next_step` `null`. `n_with_evidence` membantu frontend menjelaskan skor yang
sebagian masih berasal dari prior diagnosis.

Langkah pertama dihitung ulang untuk skill lowongan ini, memakai model ranking aktif dan graf
prasyarat. `role_in_path` bernilai `prioritas` atau `prasyarat`; `unlocks_requested` hanya menghitung
skill lowongan yang merupakan *dependen langsung* dari langkah tersebut. Frontend dapat menautkan
`quick_check_url` bila `next_step` ada.

`terms_to_review` hanya frasa bebas yang ditangkap pola leksikon dan lolos pemeriksaan kutipan.
Frasa itu belum dinormalisasi dengan embedding: normalisasi tersebut menyimpan vektor frasa ke
cache, sedangkan fitur ini berjanji tidak menyimpan hasil dari teks tempelan. Daftar kandidat
tidak mencakup semua istilah yang gagal ditemukan dan **belum masuk antrean tinjauan admin**.
Pengumpulan istilah dengan persetujuan terpisah memerlukan rancangan penyimpanan dan alur
tinjauan sendiri.
