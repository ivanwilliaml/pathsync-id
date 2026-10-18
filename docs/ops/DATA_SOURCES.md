# Sumber Data Lowongan (plan BE-03)

Diperiksa 17 Okt 2026. Dokumen ini mencatat dari mana data lowongan diambil, apa yang disimpan, dan dasar penggunaannya. Bagian "Keputusan" berisi rekomendasi; keputusannya milik tim.

## Ringkasan

| Sumber | Cara akses | Lowongan unik | Status hukum | Rekomendasi |
|---|---|---|---|---|
| **Karirhub (Kemnaker)** | Endpoint publik yang dipakai frontend situs (`api.kemnaker.go.id/karirhub/vacancy/v2/...`), laju sopan | 1.223 dari 1.749 (sekitar 70%) | Tidak ditemukan halaman syarat layanan. `robots.txt` hanya berisi blok komentar "content signals" tanpa aturan izin atau larangan. Tidak ada izin tertulis | Minta izin tertulis ke Kemnaker (Pusdatin) atau pakai data terbuka resmi bila tersedia. Cantumkan atribusi |
| **Kalibrr** | Endpoint pencarian publik yang dipakai frontend situs (`/kjs/job_board/search`) | 317 | Syarat layanan (diperbarui Maret 2026): konten tidak boleh disalin atau didistribusikan tanpa izin tertulis Kalibrr; unduhan hanya untuk penggunaan pribadi non-komersial; Kalibrr memantau untuk menghentikan "automated extraction, scraping". `robots.txt` tidak melarang endpoint ini | **Berisiko.** Hentikan scraping baru dan keluarkan dari peta pasar (`PATHSYNC_EXCLUDED_SOURCES=kalibrr`) sampai ada izin tertulis, atau minta izin sekarang |
| **ATS publik** (Workable, Lever, Greenhouse, SmartRecruiters, Workday) | API publik lowongan yang memang disediakan untuk pemasangan ulang di situs perusahaan | 209 | API ini dibuat untuk ditampilkan di luar situs ATS. Risiko rendah | Perbanyak sumber ini untuk mengurangi ketergantungan pada Karirhub |
| **ESCO** | API publik Komisi Eropa | (profil okupasi) | Lisensi terbuka dengan atribusi | Tetap, cantumkan atribusi |

Jumlah lowongan unik per id sumber di tabel `postings` per 17 Okt 2026 (1.749 total, sebelum penghapusan duplikat lintas sumber). Berkas mentah `backend/data/raw/*.jsonl` berisi 3.860 baris karena satu lowongan bisa muncul di beberapa snapshot.

## Yang disimpan

Setiap lowongan: judul, perusahaan, lokasi, tanggal terbit, URL sumber, teks deskripsi, dan metadata pekerjaan dari sumbernya (jenis kerja, pendidikan, pengalaman, industri). Tidak ada akun, kata sandi, atau data pelamar.

**Data pribadi.** Dari 3.860 baris mentah, 1 memuat alamat email dan 1 memuat nomor telepon (kontak perekrut). Sejak 17 Okt, `pathsync.text.redact_contacts` menyamarkan keduanya saat data dimuat ke database (`pipeline.build_market`), sehingga tidak pernah masuk peta pasar atau tampil sebagai kutipan. Berkas mentah lama masih memuatnya; hapus atau samarkan juga di berkas mentah sebelum repo dibagikan ke publik.

## Bagaimana data dipakai

- Teks lowongan dibaca ekstraktor untuk menghitung skill apa yang diminta (peta permintaan).
- Kutipan pendek (satu kalimat) ditampilkan sebagai bukti di aplikasi, dengan tautan ke lowongan asli.
- Teks lengkap tidak ditampilkan ulang di aplikasi dan tidak dijual.

Menampilkan kutipan dari Kalibrr tetap termasuk "mendistribusikan konten" menurut syarat layanannya, jadi izin tertulis tetap dibutuhkan untuk Kalibrr.

## Keputusan yang diperlukan (default: rekomendasi)

1. **Kalibrr:** keluarkan dari peta pasar sampai ada izin. Set `PATHSYNC_EXCLUDED_SOURCES=kalibrr` di `.env` produksi, lalu jalankan ulang `python -m pipeline.build_market`. Dampaknya: sekitar 18% baris hilang, dan beberapa role bisnis akan kembali ke status Beta. Ukur ulang setelah keputusan.
2. **Karirhub:** kirim permintaan izin ke Kemnaker. Sambil menunggu, cantumkan atribusi dan tautan ke lowongan asli di halaman About dan setiap kutipan (sudah ada tautan sumber per kutipan).
3. **Repositori:** berkas mentah ada di git. Jangan buat repo publik sebelum keputusan 1 dan 2 diambil dan kontak di berkas mentah disamarkan.
4. **Jalur penghapusan:** bila penyedia meminta datanya dihapus, set sumber itu di `PATHSYNC_EXCLUDED_SOURCES`, hapus berkas mentahnya, dan bangun ulang pasar.

## Cara memeriksa

```bash
cd backend
PATHSYNC_EXCLUDED_SOURCES=kalibrr python -m pipeline.build_market --extractor lexicon   # peta pasar tanpa Kalibrr
python -m pipeline.report                                                              # angka setelahnya
```
