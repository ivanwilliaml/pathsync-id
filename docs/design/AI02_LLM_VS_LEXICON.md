# AI-02: ekstraktor LLM vs leksikon (18 Okt 2026)

Angka dari `backend/data/models/metrics.json` (`extraction.sets.consensus_test_*`).

## Setup

- **LLM:** Qwen3-8B (open-weight, Apache-2.0) di Kaggle 2×T4, fp16, decoding greedy, `enable_thinking=False`, satu percobaan
  ulang dengan sampling ringan bila JSON gagal diparse. Prompt dan skema identik dengan jalur Claude (`pipeline/llm_jobs.py`).
  475 lowongan (203 gold + 272 acak), 473 berhasil diparse.
- **Gerbang yang sama untuk kedua ekstraktor:** kutipan harus ada di teks asli; nama skill bebas dinormalisasi ke taksonomi
  dan hanya status `auto` yang dihitung. Dari 1.752 sebutan LLM, 129 (7,4%) ditolak karena kutipannya tidak ada di teks.
- **Set uji:** paruh uji gold konsensus (65 lowongan; 64 untuk LLM karena 1 lowongan gagal diparse), tidak pernah dipakai
  menyetel. Gold = pra-anotasi LLM dua putaran yang diverifikasi satu anggota tim, bukan dua anotator independen.

## Hasil (paruh uji)

| Ekstraktor | Presisi [95% CI] | Recall [95% CI] | F1 [95% CI] |
|---|---|---|---|
| Leksikon | 0,796 [0,752–0,833] | 0,817 [0,775–0,854] | 0,806 [0,766–0,843] |
| LLM (Qwen3-8B) | 0,786 [0,718–0,841] | 0,371 [0,322–0,422] | 0,504 [0,427–0,571] |
| Gabungan (leksikon ∪ LLM) | 0,751 [0,707–0,791] | 0,865 [0,826–0,897] | 0,804 [0,769–0,837] |
| Irisan (leksikon ∩ LLM) | 0,975 [0,928–0,991] | 0,323 [0,277–0,373] | 0,485 [0,400–0,566] |

Paruh dev memberi pola yang sama (leksikon F1 0,827; LLM 0,508; gabungan 0,823; irisan 0,481).

## Keputusan

Aturan yang ditulis sebelum eksperimen (PLAN D4): *pilih F1 tertinggi dengan syarat presisi ≥ 0,80; seri → leksikon.*

- Diterapkan harfiah, hanya **irisan** yang memenuhi presisi ≥ 0,80, padahal recall 0,323: dua pertiga permintaan skill yang
  benar akan hilang dari peta pasar. Aturan itu tidak mengantisipasi kasus ketika tidak ada ekstraktor dengan recall wajar yang
  melewati 0,80.
- **Rekomendasi: tetap leksikon** (F1 tertinggi; presisi 0,796, selang kepercayaannya mencakup 0,80), dengan penyimpangan dari
  aturan harfiah dicatat di sini. Gabungan memberi F1 setara (0,804) tetapi presisi lebih rendah dan bergantung pada GPU.
  Keputusan akhir ada di tim; bila tim memilih menerapkan aturan apa adanya, irisan dapat dipakai sebagai mode "presisi tinggi".
- **Peran LLM:** pembanding dan pemeriksa. Irisan dengan presisi 0,975 berguna untuk menandai sebutan leksikon yang dikonfirmasi
  dua metode; LLM juga tetap dipakai untuk membaca CV.

## Kenapa recall LLM rendah

Yang terukur: sebagian sebutan LLM berupa nama bebas yang masuk antrean tinjauan (87) atau kandidat skill baru (113), bukan
status `auto`, dan 129 ditolak karena kutipannya tidak ada di teks. Dugaan yang belum dicek per kasus: Qwen3-8B cenderung hanya
menyebut skill yang dinyatakan eksplisit sebagai syarat, sementara gold juga melabeli skill yang tersirat dari tanggung jawab. Model lebih besar (Claude) belum diuji karena tidak ada kunci API; itu batas atas yang belum diukur.

## Biaya dan waktu

Kaggle gratis (kuota GPU mingguan). Run 475 lowongan berjalan ±7,5 jam (setelah antre ±1,5 jam) pada 2×T4 dengan model dibagi ke dua GPU, termasuk
pemrosesan satu per satu untuk lowongan panjang setelah kehabisan memori. Leksikon: < 1 detik per lowongan di CPU.

## Mereproduksi

Keluaran mentah model ada di `backend/offline_llm/results/llm_results_postings.json`. Cache ekstraksi tidak di-commit, jadi
sebelum `python -m pipeline.report` di mesin lain jalankan dulu
`python -m pipeline.llm_jobs import-postings offline_llm/results/llm_results_postings.json`; tanpa itu baris
`consensus_test_llm/union/intersection` tidak muncul di `metrics.json`.
