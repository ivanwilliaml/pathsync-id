# Draf email permohonan izin penggunaan data lowongan Kalibrr

Kirim dari email kampus ketua tim. Tujuan: alamat kontak/legal di halaman Kalibrr (cek "Contact Us" atau Terms of Service;
jangan menebak alamat). Lampirkan ringkasan proposal 1 halaman bila ada.

---

**Subjek:** Permohonan izin penggunaan data lowongan publik Kalibrr untuk riset mahasiswa (ICC 2026)

Yth. Tim Kalibrr,

Kami mahasiswa [prodi, universitas] yang sedang mengikuti kompetisi [ICC 2026] dengan proyek **PathSync**, alat
nonkomersial yang membantu mahasiswa memetakan keterampilan yang diminta pasar kerja (misalnya untuk posisi Business
Analyst) dan menyusun rencana belajar.

Untuk memetakan permintaan keterampilan, kami membaca teks deskripsi lowongan yang tampil publik. Syarat layanan Kalibrr
melarang penyalinan konten tanpa izin tertulis, sehingga kami memohon izin tersebut sebelum memakai data dari Kalibrr.

Rincian penggunaan yang kami usulkan:

- **Data:** judul posisi, nama perusahaan, tanggal terbit, dan teks deskripsi lowongan publik. Tidak ada data pelamar,
  akun, atau kontak perekrut (kontak disamarkan otomatis).
- **Jumlah dan cara:** sekitar [N] lowongan per bulan, diambil dengan laju rendah (≤ 1 permintaan/detik), atau melalui
  cara lain yang Kalibrr tentukan (ekspor/API).
- **Keluaran:** hanya statistik agregat (misalnya "SQL diminta di 29% lowongan BA"). Teks lowongan tidak ditampilkan ulang
  atau dibagikan, dan tidak dipakai untuk tujuan komersial.
- **Atribusi:** "Sumber data: Kalibrr" di halaman Tentang dan di karya ilmiah kami.
- **Penghapusan:** data dihapus kapan pun atas permintaan Kalibrr.
- **Jangka waktu:** sampai [tanggal akhir kompetisi], dapat diperpanjang dengan persetujuan.

Bila Kalibrr tidak berkenan, kami akan menghapus data Kalibrr dari sistem dan tidak memakainya. Kami terbuka untuk
syarat tambahan.

Terima kasih atas waktu dan pertimbangannya.

Hormat kami,
[Nama ketua tim], [NIM], [prodi, universitas]
[email kampus] · [no. HP]
Tim PathSync (ICC 2026)

---

**Catatan untuk tim:** sampai ada jawaban tertulis, jalankan pasar dengan `PATHSYNC_EXCLUDED_SOURCES=kalibrr` bila juri
menanyakan legalitas, dan catat statusnya di `docs/ops/DATA_SOURCES.md`.
