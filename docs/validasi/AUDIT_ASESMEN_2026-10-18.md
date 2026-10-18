# Audit bank soal asesmen (18 Okt 2026)

Dikerjakan oleh asisten AI (Claude) atas permintaan tim, tanpa data jawaban mahasiswa. Bukan pengganti analisis butir dari
jawaban nyata (AI-10) atau tinjauan pakar materi. Angka dari `backend/data/models/metrics.json` dan
`item_cue_audit*.json`.

## Cakupan dan cara

705 soal × 2 bahasa (Indonesia di `data/seed/items/`, Inggris di `data/seed/items_en/`), tiga lapis:

1. **Pemeriksaan otomatis seluruh bank**: struktur (4 opsi, tidak ada opsi kembar, ada penjelasan, tingkat kesulitan 1–3),
   kesetaraan dua bahasa, "semua jawaban benar/tidak ada yang benar", kalimat negatif, kata absolut, sisa bahasa Inggris di
   versi Indonesia, petunjuk panjang dan overlap kata, serta **kecocokan kunci antarbahasa** (embedding multibahasa: apakah
   kunci versi Inggris benar-benar berpasangan dengan kunci versi Indonesia).
2. **Tinjauan isi manual** soal 12 skill BA teratas (versi Indonesia beserta penjelasan): kunci benar, satu jawaban terbaik,
   pengecoh jelas salah.
3. **Perbaikan**, lalu audit ulang. Aturan: makna kunci tidak berubah; teks Indonesia tetap Indonesia, hanya istilah teknis
   dalam bahasa Inggris.

## Temuan dan tindakan

| Temuan | Jumlah | Tindakan |
|---|---|---|
| **Kunci salah di versi Indonesia** (`siem_monitoring-4`: opsi pertama "pengguna lupa kata sandi", seharusnya serangan brute force) | 1 | Diperbaiki. Pemindaian embedding seluruh bank: 7 kandidat lain diperiksa manual, semuanya kunci benar (opsi berupa urutan yang diacak) |
| **Frasa pengisi** dari alat penyeimbang panjang lama ("in a real project", "as the work grows", "dalam praktik sehari-hari", "di lingkungan kerja", …) membuat kalimat janggal, mis. "2% dari jumlah bruto di lingkungan kerja" | 347 opsi Inggris + 76 opsi Indonesia | Dibuang |
| **Kata kunci kode ikut "diterjemahkan"** di versi Inggris: `any`/`never` menjadi `some`/`rarely` (`typescript-4`), `x: some` (`typescript-5`), "@Binding alone" (`ios_swift-4`), "Gradle wrapper alone" | 4 soal | Diperbaiki |
| **Nama tabel tidak konsisten** di versi Indonesia: soal mendefinisikan `pelanggan`/`pesanan`, opsi memakai `customers`/`orders` (`sql-2`, `sql-3`) | 2 | Diseragamkan ke nama Indonesia |
| **Jawaban benar sebagai "opsi tengah"** (pengecoh masing-masing hanya mengubah satu bagian kunci) | ±30 | Pengecoh ditulis ulang agar saling berbagi bagian yang salah, mis. pola 2×2 pada soal kode |
| **Petunjuk panjang**: kunci jauh lebih panjang/pendek dari pengecoh; setelah pengisi dibuang, kunci menjadi opsi terpanjang atau kedua terpanjang pada 67% soal Inggris | ±340 set opsi | Kunci ditulis lebih ringkas atau pengecoh diperjelas dengan isi bermakna (bukan pengisi). Sebaran peringkat panjang kunci sekarang 25/28/22/25% (Inggris) dan 26/26/23/26% (Indonesia) |
| Tinjauan isi manual 12 skill BA (±75 soal) | 0 kunci salah, 0 soal ambigu | — |

Diff: 30 berkas, 525 baris (satu baris per soal yang berubah).

## Hasil audit pola jawaban (rata-rata 5 pembagian lipat)

| | Sebelum audit (pagi 18 Okt) | Setelah audit | Batas acak p95 |
|---|---|---|---|
| Inggris | ±0,30 | **0,340** | 0,265 |
| Indonesia | ±0,31 | **0,333** | 0,263 |

**Catatan jujur: angka ini naik, bukan turun.** Frasa pengisi lama sengaja ditempel untuk mengacak peringkat panjang kunci;
setelah dibuang demi kualitas bahasa, petunjuk panjang alami penulis kembali muncul. Setelah ±340 set opsi diseimbangkan
ulang, akurasi sempat naik ke sekitar 0,38/0,35 lalu turun ke 0,340/0,333: di bawah gerbang tes 0,35, tetapi masih di atas batas acak dan di atas
angka sebelum audit. Sisa petunjuk terbesar:

- **kata absolut lebih sering di pengecoh** (Inggris 9% vs kunci 3%; Indonesia 13% vs 6%). Sebagian memang alasan opsi itu
  salah; detektornya juga menghitung kata netral ("setiap", "tanpa", "any"). Mengganti kata demi mengecoh detektor tidak
  dilakukan;
- **koma di kunci** (kunci sering berupa daftar "A, B, dan C").

Kompensasi yang sudah berjalan: penilaian memakai peluang tebak per soal (`p_cue`, dibatasi 0,25–0,60) dari audit ini, jadi
soal yang mudah ditebak bobot buktinya lebih kecil. Perbaikan tuntas butuh analisis butir dari jawaban nyata (AI-10) atau
penulisan ulang pengecoh dengan kata absolut secara terarah.

## Belum dicakup

- Tinjauan isi manual untuk ±80 skill non-BA (hanya pemeriksaan otomatis).
- Penilaian tingkat kesulitan aktual (butuh data jawaban).
- Tinjauan oleh pakar materi per bidang.
