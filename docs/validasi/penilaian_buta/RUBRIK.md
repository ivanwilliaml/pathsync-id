# Rubrik penilaian buta rencana belajar (H2)

Status: **disiapkan, belum dinilai.** Hasil H2 baru boleh ditulis di karya ilmiah setelah dua penilai manusia
menyelesaikan lembar ini secara terpisah. Skor dari AI tidak boleh dipakai sebagai pengganti penilai.

## Cara kerja

1. Jalankan `python siapkan_lembar.py`. Hasilnya dua lembar dengan urutan acak yang berbeda, tanpa keterangan sebelum
   atau sesudah, ditambah `kunci_kondisi.csv`.
2. Penilai A mengisi `lembar_penilai_A.csv` dan penilai B mengisi `lembar_penilai_B.csv`. Keduanya bekerja sendiri,
   tidak berdiskusi, dan tidak membuka `kunci_kondisi.csv`.
3. Penilai memberi skor 1 sampai 3 pada setiap dimensi. Rencana yang kosong atau tidak bermakna (misalnya "belum
   kepikiran") ditandai `x` di kolom `tidak_dapat_dinilai`.
4. Setelah keduanya selesai, jalankan
   `python analisis_penilaian_buta.py lembar_penilai_A.csv lembar_penilai_B.csv`.

Penilai sebaiknya bukan anggota tim. Bila terpaksa memakai anggota tim, karya ilmiah harus menyebutnya.

## Dimensi dan tingkat skor

Semua dimensi dinilai terhadap role yang diincar responden (kolom `role_yang_diincar`).

| Dimensi | 1 | 2 | 3 |
|---|---|---|---|
| Relevansi | Sebagian besar skill tidak terkait dengan role | Sebagian skill terkait, tetapi ada yang jelas di luar role | Semua skill terkait langsung dengan pekerjaan role |
| Kecocokan dengan bukti | Tidak ada tanda mempertimbangkan kemampuan sendiri | Menyebut kemampuan sendiri secara umum ("masih lemah") | Menyebut dasar yang dapat diperiksa (hasil tes, proyek, nilai, lowongan tertentu) |
| Urutan | Tidak ada urutan, atau urutan bertentangan dengan prasyarat yang lazim | Ada urutan tanpa alasan | Ada urutan dengan alasan yang masuk akal (dasar dulu, prasyarat, kebutuhan magang) |
| Tindakan spesifik | Hanya nama bidang ("data", "IT") | Nama skill yang jelas | Skill beserta kegiatan konkret (latihan, proyek, materi tertentu) |
| Kesesuaian waktu | Tidak menyinggung waktu atau jelas tidak realistis | Menyebut waktu secara umum | Ada perkiraan waktu atau prioritas minggu ini yang realistis |
| Kriteria selesai | Tidak ada | Ada tujuan umum ("bisa SQL") | Ada tanda selesai yang dapat diperiksa (lulus tes, menghasilkan dashboard, proyek selesai) |

Contoh rekaan untuk menyamakan tafsiran (bukan dari data responden):

- Skor rendah: "Belajar IT dan bahasa Inggris."
- Skor sedang: "1. Excel. 2. SQL. 3. Power BI."
- Skor tinggi: "1. SQL dulu karena tes saya masih 2 dari 5 dan dipakai di hampir semua lowongan analis; target selesai
  kursus dasar dan lulus tes ulang dalam dua minggu. 2. Power BI setelah itu, membuat satu dashboard penjualan."

## Keterbatasan yang harus dilaporkan

- Rencana sesudah dapat menyebut nama fitur PathSync (misalnya "Quick Check" atau "Cek Lowongan"), sehingga penilai
  bisa menebak kondisinya. Penilaian tetap disebut buta terhadap label, bukan buta sepenuhnya.
- Rubrik menghargai alasan, urutan, dan kriteria selesai. Format keluaran PathSync juga memuat unsur itu, sehingga
  rubrik cenderung menguntungkan kondisi sesudah. Risiko ini ditulis apa adanya.
- Penilaian ini mengukur mutu rencana tertulis, bukan apakah rencana itu dijalankan atau menghasilkan kemampuan.
