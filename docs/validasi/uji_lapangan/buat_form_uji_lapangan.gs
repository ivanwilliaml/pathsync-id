/**
 * Uji lapangan PathSync (target 100 responden): membuat Google Form + Google Sheet respons dalam sekali jalan.
 *
 * Cara pakai:
 *   1. Buka https://script.google.com > New project, hapus isi Code.gs, tempel seluruh berkas ini.
 *   2. Pilih fungsi buatForm, klik Run, lalu izinkan akses Google Forms dan Sheets untuk akunmu sendiri.
 *   3. Buka Execution log: ada tautan untuk responden, tautan edit, dan tautan Sheet respons.
 *
 * Kode [P0] ... [P34] di judul pertanyaan dibaca analisis_uji_lapangan.py. Jangan dihapus.
 *
 * Alur: masalah yang dialami (urgensi) -> cara lama + rencana belajar sebelum -> mencoba PathSync ->
 * penilaian yang sama + rencana belajar sesudah -> fitur -> kebergunaan -> nilai bagi pengguna.
 */

var SKALA = ['1', '2', '3', '4', '5'];
var SETUJU = '1 = sangat tidak setuju, 5 = sangat setuju';

// Empat hal yang menurut Bab I tidak dimiliki mahasiswa: apa, mengapa, urutan, kapan berubah (+ relevansi, tindak lanjut).
var ARAH = [
  'A. Saya tahu skill apa yang harus saya pelajari pertama kali.',
  'B. Saya tahu mengapa skill itu penting untuk pekerjaan yang saya incar.',
  'C. Saya tahu urutan skill yang sebaiknya saya pelajari.',
  'D. Arahan itu sesuai dengan kemampuan saya saat ini.',
  'E. Saya bisa langsung menjalankan langkah pertamanya minggu ini.',
  'F. Saya tahu kapan saya sudah cukup menguasai sebuah skill dan perlu lanjut ke skill berikutnya.'
];

var ROLE = [
  'Business Analyst', 'Data Analyst', 'Data Scientist', 'Data Engineer', 'Backend Developer',
  'Frontend Developer', 'Fullstack Developer', 'Mobile Developer', 'QA Engineer', 'DevOps Engineer',
  'Cybersecurity Analyst', 'UI/UX Designer', 'Digital Marketing', 'Financial Analyst', 'Accountant',
  'Tax Specialist', 'Internal Auditor', 'HR Specialist', 'Supply Chain Analyst', 'Project Coordinator',
  'Belum tahu'
];

var FITUR = [
  'Pilih Karier (skill yang paling diminta lowongan)',
  'Tambah Bukti (transkrip, CV, sertifikat, proyek)',
  'Dashboard dan langkah berikutnya',
  'Alasan rekomendasi ("Bagaimana ini diputuskan?")',
  'Quick Check',
  'Belajar: Pelajari, Latihan, Buktikan',
  'Cek Lowongan'
];

var MASALAH = [
  'Tahu skill yang benar-benar diminta perusahaan',
  'Tahu posisi kemampuan saya dibanding yang diminta',
  'Tahu skill mana yang harus didahulukan',
  'Tahu kapan rencana belajar perlu diubah',
  'Bisa membuktikan kemampuan, bukan hanya dari nilai kuliah',
  'Tidak ada yang terbantu'
];

function buatForm() {
  var form = FormApp.create('Uji Lapangan PathSync');
  form.setDescription(
    'Terima kasih sudah mau membantu. PathSync adalah aplikasi gratis yang menyusun rute belajar skill dari ' +
    'lowongan kerja Indonesia dan bukti kemampuanmu sendiri. Kuesioner ini membutuhkan sekitar 25 menit, ' +
    'termasuk sekitar 15 menit mencoba aplikasinya. Tidak ada jawaban benar atau salah.');
  form.setCollectEmail(false);
  form.setProgressBar(true);
  form.setAllowResponseEdits(false);

  // 1. Persetujuan
  var setuju = form.addMultipleChoiceItem()
    .setTitle('[P0] Persetujuan')
    .setHelpText(
      'Jawabanmu dipakai untuk penelitian tim PathSync (Innovation Case Competition 2026) dan hanya dilaporkan ' +
      'sebagai angka gabungan. Kami tidak meminta nama atau nomor induk. Kamu boleh berhenti kapan saja. Email di ' +
      'bagian akhir bersifat opsional, hanya dipakai untuk menghubungi ulang, dan dihapus setelah studi selesai.')
    .setRequired(true);
  setuju.setChoices([
    setuju.createChoice('Ya, saya setuju ikut', FormApp.PageNavigationType.CONTINUE),
    setuju.createChoice('Tidak', FormApp.PageNavigationType.SUBMIT)
  ]);

  // 2. Profil
  form.addPageBreakItem().setTitle('Tentang kamu');
  form.addMultipleChoiceItem().setTitle('[P1] Status kamu saat ini').setRequired(true).showOtherOption(true)
    .setChoiceValues(['Mahasiswa aktif', 'Fresh graduate (lulus kurang dari 1 tahun)',
      'Pencari kerja (lulus lebih dari 1 tahun)', 'Sudah bekerja, ingin pindah bidang']);
  form.addMultipleChoiceItem().setTitle('[P2] Semester (bila mahasiswa)').setRequired(true)
    .setChoiceValues(['1-2', '3-4', '5-6', '7-8', 'Lebih dari 8', 'Bukan mahasiswa']);
  form.addMultipleChoiceItem().setTitle('[P3] Bidang studi').setRequired(true).showOtherOption(true)
    .setChoiceValues(['Bisnis atau Manajemen', 'Akuntansi atau Keuangan', 'Ekonomi', 'Sistem Informasi',
      'Informatika atau Ilmu Komputer', 'Teknik lain', 'Desain atau Komunikasi']);
  form.addTextItem().setTitle('[P4] Kampus (opsional)');
  form.addListItem().setTitle('[P5] Role pekerjaan yang kamu incar').setRequired(true).setChoiceValues(ROLE);

  // 3. Masalah yang dialami (urgensi)
  form.addPageBreakItem().setTitle('Masalah yang kamu alami')
    .setHelpText('Jawab berdasarkan pengalamanmu sendiri, sebelum mencoba PathSync.');
  form.addMultipleChoiceItem()
    .setTitle('[P6] Dalam 3 bulan terakhir, seberapa sering kamu bingung menentukan skill apa yang harus dipelajari?')
    .setRequired(true).setChoiceValues(['Tidak pernah', 'Jarang', 'Kadang-kadang', 'Sering', 'Selalu']);
  form.addMultipleChoiceItem()
    .setTitle('[P7] Rata-rata berapa jam per minggu kamu habiskan hanya untuk mencari tahu skill apa yang perlu dipelajari (membaca lowongan, bertanya, mencari di internet)?')
    .setRequired(true).setChoiceValues(['Kurang dari 1 jam', '1-3 jam', '3-5 jam', 'Lebih dari 5 jam']);
  form.addCheckboxItem().setTitle('[P8] Apa yang biasanya kamu pakai untuk menentukan skill yang dipelajari?')
    .setRequired(true).showOtherOption(true)
    .setChoiceValues(['Google atau artikel', 'ChatGPT atau chatbot AI lain', 'YouTube atau TikTok',
      'Teman atau senior', 'Dosen atau konselor karier', 'Membaca lowongan di job portal',
      'Kursus online (Coursera, MySkill, RevoU, dll.)', 'Belum pernah mencari']);
  form.addMultipleChoiceItem().setTitle('[P9] Berapa kursus online yang pernah kamu mulai tetapi tidak selesai?')
    .setRequired(true).setChoiceValues(['0', '1', '2-3', '4-5', 'Lebih dari 5']);
  form.addMultipleChoiceItem()
    .setTitle('[P10] Pernahkah kamu merasa sudah siap untuk sebuah lowongan, tetapi ternyata skill-mu belum cukup (ditolak, gagal tes, atau baru sadar saat membaca syaratnya)?')
    .setRequired(true).setChoiceValues(['Ya, beberapa kali', 'Ya, sekali', 'Belum pernah', 'Belum pernah melamar']);
  form.addGridItem().setTitle('[P11] Seberapa setuju kamu dengan pernyataan berikut?').setHelpText(SETUJU)
    .setRows([
      'A. Saya sulit mengetahui skill apa yang benar-benar diminta perusahaan untuk role incaran saya.',
      'B. Saya tidak yakin seberapa jauh kemampuan saya sekarang dibanding yang diminta.',
      'C. Saya tidak tahu skill mana yang harus saya dahulukan.',
      'D. Saya tidak tahu kapan rencana belajar saya perlu diubah.',
      'E. Nilai kuliah saya belum menunjukkan apakah saya benar-benar bisa memakai skill tersebut.'
    ]).setColumns(SKALA).setRequired(true);
  form.addScaleItem().setTitle('[P12] Seberapa penting bagimu memiliki rute belajar yang jelas dan sesuai lowongan kerja?')
    .setBounds(1, 5).setLabels('Tidak penting', 'Sangat penting').setRequired(true);

  // 4. Cara lama + rencana sebelum
  form.addPageBreakItem().setTitle('Cara yang kamu pakai sekarang');
  form.addGridItem().setTitle('[P13] Tentang cara yang biasa kamu pakai untuk menentukan arah belajar')
    .setHelpText(SETUJU).setRows(ARAH).setColumns(SKALA).setRequired(true);
  form.addParagraphTextItem()
    .setTitle('[P14] Tuliskan 3 skill yang akan kamu pelajari untuk role incaranmu, sesuai urutan, beserta alasan singkat')
    .setHelpText('Contoh: 1. SQL, karena banyak diminta. 2. ... Tulis apa adanya; tidak ada jawaban benar atau salah.')
    .setRequired(true);

  // 5. Coba PathSync
  form.addPageBreakItem().setTitle('Coba PathSync (sekitar 15 menit)').setHelpText(
    'Buka https://pathsync-id.vercel.app di tab baru, lalu coba langkah berikut:\n' +
    '1. Pilih role yang kamu incar.\n' +
    '2. Tambahkan buktimu (transkrip, CV, atau sertifikat). Bila tidak ingin, gunakan Profil Demo.\n' +
    '3. Lihat langkah belajar pertamamu di dashboard dan baca alasannya.\n' +
    '4. Kerjakan satu Quick Check.\n' +
    '5. Buka menu Belajar dan kerjakan minimal satu soal latihan.\n' +
    '6. Tempel satu teks lowongan di Cek Lowongan.\n' +
    'Setelah selesai, kembali ke form ini.');
  form.addCheckboxItem().setTitle('[P15] Langkah yang berhasil kamu selesaikan').setRequired(true)
    .setChoiceValues(['1. Memilih role', '2. Menambah bukti atau memakai profil demo', '3. Melihat langkah pertama',
      '4. Satu Quick Check', '5. Satu soal latihan', '6. Cek Lowongan']);
  form.addMultipleChoiceItem().setTitle('[P16] Data apa yang kamu pakai?').setRequired(true)
    .setChoiceValues(['Data saya sendiri', 'Profil demo', 'Campuran keduanya']);
  form.addMultipleChoiceItem().setTitle('[P17] Berapa lama kamu memakai PathSync?').setRequired(true)
    .setChoiceValues(['Kurang dari 10 menit', '10-20 menit', '20-30 menit', 'Lebih dari 30 menit']);

  // 6. Sesudah memakai PathSync
  form.addPageBreakItem().setTitle('Setelah memakai PathSync');
  form.addGridItem().setTitle('[P18] Tentang PathSync').setHelpText(SETUJU)
    .setRows(ARAH.map(function (s) { return s.replace('Arahan itu', 'Rekomendasi PathSync'); }))
    .setColumns(SKALA).setRequired(true);
  form.addParagraphTextItem()
    .setTitle('[P19] Setelah memakai PathSync, tuliskan lagi 3 skill yang akan kamu pelajari, sesuai urutan, beserta alasan singkat')
    .setRequired(true);
  form.addMultipleChoiceItem().setTitle('[P20] Dibanding rencana pertamamu (P14), rencana keduamu menurutmu...')
    .setRequired(true).setChoiceValues(['Jauh lebih baik', 'Sedikit lebih baik', 'Sama saja', 'Lebih buruk']);
  form.addGridItem().setTitle('[P21] Ketepatan dan kepercayaan').setHelpText(SETUJU)
    .setRows([
      'A. Skill yang diminta di Pilih Karier atau Cek Lowongan sesuai dengan lowongan yang pernah saya lihat.',
      'B. Skill yang ditandai kuat dan lemah memang sesuai dengan kemampuan saya.',
      'C. Skill yang disarankan pertama masuk akal setelah saya membaca alasannya.',
      'D. Saya percaya rekomendasinya karena alasannya ditunjukkan dengan data.',
      'E. Latihan dan feedback-nya membantu saya memahami skill tersebut.',
      'F. Quick Check membuat saya lebih tahu apakah saya benar-benar bisa.',
      'G. Untuk baris ini, pilih angka 4.'
    ]).setColumns(SKALA).setRequired(true);

  // 7. Fitur
  form.addPageBreakItem().setTitle('Fitur PathSync');
  form.addGridItem().setTitle('[P22] Seberapa berguna setiap fitur?')
    .setHelpText('Pilih "Tidak mencoba" bila kamu belum membuka fitur tersebut.')
    .setRows(FITUR)
    .setColumns(['Tidak mencoba', 'Tidak berguna', 'Kurang berguna', 'Cukup berguna', 'Berguna', 'Sangat berguna'])
    .setRequired(true);
  form.addMultipleChoiceItem().setTitle('[P23] Fitur mana yang paling membantu?').setRequired(true)
    .setChoiceValues(FITUR);
  form.addCheckboxItem().setTitle('[P24] Masalah mana yang terbantu oleh PathSync?').setRequired(true)
    .setChoiceValues(MASALAH);

  // 8. Kebergunaan (System Usability Scale)
  form.addPageBreakItem().setTitle('Kemudahan dipakai');
  form.addGridItem().setTitle('[P25] Kemudahan memakai PathSync').setHelpText(SETUJU)
    .setRows([
      '1. Saya rasa saya akan sering menggunakan aplikasi ini.',
      '2. Aplikasi ini terasa rumit tanpa alasan.',
      '3. Aplikasi ini mudah digunakan.',
      '4. Saya rasa saya membutuhkan bantuan orang yang paham teknis untuk bisa memakai aplikasi ini.',
      '5. Fitur-fitur di aplikasi ini terintegrasi dengan baik.',
      '6. Ada terlalu banyak hal yang tidak konsisten di aplikasi ini.',
      '7. Saya rasa kebanyakan orang akan cepat belajar memakai aplikasi ini.',
      '8. Aplikasi ini terasa merepotkan untuk dipakai.',
      '9. Saya merasa yakin saat memakai aplikasi ini.',
      '10. Saya perlu belajar banyak hal sebelum bisa memakai aplikasi ini.'
    ]).setColumns(SKALA).setRequired(true);

  // 9. Nilai bagi pengguna
  form.addPageBreakItem().setTitle('Penilaian akhir');
  form.addMultipleChoiceItem().setTitle('[P26] Bagaimana perasaanmu bila PathSync tidak bisa dipakai lagi?')
    .setRequired(true).setChoiceValues(['Sangat kecewa', 'Agak kecewa', 'Tidak kecewa']);
  form.addMultipleChoiceItem()
    .setTitle('[P27] Bila PathSync suatu saat berbayar, berapa yang bersedia kamu bayar per bulan?')
    .setRequired(true).setChoiceValues(['Hanya mau bila gratis', 'Sampai Rp10.000', 'Rp10.000-25.000',
      'Rp25.000-50.000', 'Lebih dari Rp50.000']);
  form.addCheckboxItem().setTitle('[P28] Setelah ini, apa yang akan kamu lakukan?').setRequired(true)
    .setChoiceValues(['Mulai belajar skill pertama yang disarankan minggu ini',
      'Mengerjakan Quick Check untuk skill lain', 'Memakai Cek Lowongan saat melamar kerja',
      'Membagikan PathSync ke teman', 'Belum ada rencana']);
  form.addScaleItem().setTitle('[P29] Seberapa mungkin kamu merekomendasikan PathSync ke teman?')
    .setBounds(0, 10).setLabels('Sangat tidak mungkin', 'Sangat mungkin').setRequired(true);
  form.addMultipleChoiceItem().setTitle('[P30] Apakah kamu akan memakai PathSync lagi dalam 2 minggu ke depan?')
    .setRequired(true).setChoiceValues(['Ya', 'Mungkin', 'Tidak']);
  form.addTextItem().setTitle('[P31] Skill pertama yang disarankan PathSync untukmu').setRequired(true);
  form.addParagraphTextItem().setTitle('[P32] Bagian mana yang paling membantu, dan mengapa?');
  form.addParagraphTextItem().setTitle('[P33] Bagian mana yang membingungkan atau perlu diperbaiki?');
  form.addTextItem().setTitle('[P34] Email (opsional, hanya untuk dihubungi ulang 2 minggu lagi)');

  var ss = SpreadsheetApp.create('Respons Uji Lapangan PathSync');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log('Tautan untuk responden: ' + form.getPublishedUrl());
  Logger.log('Tautan edit form: ' + form.getEditUrl());
  Logger.log('Sheet respons: ' + ss.getUrl());
}
