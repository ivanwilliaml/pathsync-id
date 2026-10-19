import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Mascot } from "@/components/mascot";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Data apa yang PathSync simpan, untuk apa, siapa yang bisa melihatnya, berapa lama, dan hak Anda.",
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "privacy@pathsync.example";
const UPDATED = "12 Oktober 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink/80">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/about" className="text-sm font-medium text-ink/75 hover:text-ink">
          Tentang &amp; Kontak
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6" lang="id">
        <div className="flex items-end gap-4">
          <Mascot name="shield" size={88} priority />
          <h1 className="text-[32px] font-extrabold leading-tight text-ink">Kebijakan Privasi</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Diperbarui {UPDATED} · versi persetujuan 2026-10b</p>
        <p className="mt-6 text-[15px] leading-relaxed text-ink/80">
          PathSync membantu Anda menentukan keterampilan apa yang perlu dipelajari berikutnya. Untuk itu kami memproses data Anda. Halaman ini
          menjelaskan dengan jelas apa yang kami simpan dan untuk apa, sesuai Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
        </p>

        <Section title="1. Data yang kami simpan">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Profil: nama panggilan, program studi, semester, peran target. Tanpa email, tanpa kata sandi.</li>
            <li>Bukti belajar yang Anda tambahkan: nilai mata kuliah, nama dan tautan sertifikat, teks proyek atau tugas, teks CV.</li>
            <li>Jawaban Cek Kemampuan dan asesmen ulang, rencana mingguan, refleksi, dan jawaban singkat tentang kejelasan arah.</li>
            <li>Riwayat rute belajar Anda dan perubahannya.</li>
            <li>Data teknis dasar: waktu kunjungan terakhir dan peristiwa penggunaan (misalnya &ldquo;menyelesaikan Cek Kemampuan&rdquo;), tanpa isi dokumen Anda.</li>
          </ul>
          <p>Kami tidak meminta data sensitif (agama, kesehatan, biometrik, dsb.). Mohon tidak memasukkannya ke dalam dokumen yang Anda unggah.</p>
        </Section>

        <Section title="2. Untuk apa data dipakai">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Membangun rute belajar Anda</strong> (dasar pemrosesan: persetujuan Anda). Ini satu-satunya tujuan wajib.</li>
            <li>
              <strong>Peninjauan kualitas oleh manusia.</strong> Sebagian proyek yang Anda unggah (sampel acak ±20%, serta yang terdeteksi mencurigakan)
              dibaca oleh peninjau PathSync untuk memastikan penilaiannya adil.
            </li>
            <li>
              <strong>Perbaikan produk secara agregat</strong>, misalnya berapa persen pengguna yang menyelesaikan Cek Kemampuan. Hasilnya tidak
              menampilkan individu.
            </li>
          </ul>
        </Section>

        <Section title="3. Penelitian: pilihan terpisah, tidak wajib">
          <p>
            Di Pengaturan Anda dapat memilih ikut penelitian (uji pengguna dan kalibrasi model dengan data yang dianonimkan). Pilihan ini{" "}
            <strong>tidak wajib</strong> dan tidak memengaruhi fitur yang Anda dapat. Anda bisa mencabutnya kapan saja; saat dicabut, Anda
            otomatis keluar dari studi yang sedang berjalan.
          </p>
        </Section>

        <Section title="4. Siapa yang dapat melihat data Anda">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Anda sendiri, lewat kunci akses.</li>
            <li>Tim PathSync yang berwenang (admin dan peninjau proyek), hanya untuk tujuan di atas. Akses staf dicatat.</li>
            <li>
              <strong>Dosen/pembimbing hanya melihat ringkasan kelas</strong> bila Anda sendiri bergabung ke kelas dengan kode kelas, dan hanya
              setelah kelas memiliki minimal 5 mahasiswa. Dosen tidak melihat bukti, jawaban, atau nama Anda secara individu.
            </li>
            <li>Kami tidak menjual data dan tidak membagikannya ke pengiklan.</li>
          </ul>
        </Section>

        <Section title="5. Penyedia layanan">
          <p>
            Data disimpan di server PathSync. Bila fitur pembacaan dokumen berbasis model bahasa diaktifkan, potongan teks proyek dapat dikirim ke
            penyedia model (Anthropic) hanya untuk memberi penilaian rubrik; teks tersebut tidak kami jual. Saat ini fitur itu{" "}
            <strong>tidak aktif</strong> dan penilaian memakai aturan lokal di server kami.
          </p>
          <p className="mt-3">
            Asisten <strong>Sync</strong> memakai model bahasa yang dijalankan oleh Groq. Saat Anda bertanya ke Sync, yang dikirim ke Groq
            hanyalah pertanyaan Anda, data skill Anda (nama skill, level, target karier) dan teks lowongan kerja publik yang relevan; nama,
            ID profil, dan kunci akses Anda tidak pernah dikirim. Sync hanya membaca data, tidak mengubah apa pun, dan percakapannya tidak
            kami simpan selain di tab peramban Anda.
          </p>
        </Section>

        <Section title="6. Berapa lama data disimpan">
          <p>
            Selama profil Anda ada. Profil yang tidak dipakai lebih dari 24 bulan akan kami hapus otomatis. Anda dapat menghapus semuanya sendiri kapan saja
            di Pengaturan. Cadangan basis data dihapus otomatis setelah 14 hari.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Peristiwa penggunaan (misalnya &ldquo;membuka dasbor&rdquo;): 180 hari.</li>
            <li>Laporan galat otomatis dari peramban: 90 hari. Pesan yang Anda tulis sendiri lewat &ldquo;Laporkan Masalah&rdquo; disimpan sampai ditangani.</li>
            <li>Catatan aktivitas staf: 365 hari.</li>
            <li>Saat Anda menghapus profil, peristiwa penggunaan Anda ikut dihapus dan laporan yang pernah Anda kirim dilepas dari profil Anda.</li>
          </ul>
        </Section>

        <Section title="7. Hak Anda">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Melihat dan mengunduh semua data Anda (Pengaturan → Unduh Data-ku).</li>
            <li>Menghapus profil dan seluruh data terkait (Pengaturan → Hapus Profilku).</li>
            <li>Mencabut persetujuan penelitian, mengganti kunci akses, dan menanyakan cara data Anda diproses.</li>
          </ul>
          <p>
            Pertanyaan atau permintaan: <a className="font-medium text-indigo underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>. Kami berusaha
            menjawab dalam 3 hari kerja.
          </p>
        </Section>

        <Section title="8. Keamanan">
          <p>
            Kunci akses Anda hanya disimpan dalam bentuk hash. Akses antar-perangkat memakai HTTPS. Kunci akses berfungsi seperti kata sandi: jangan
            membagikannya. Bila hilang, kami tidak dapat memulihkannya karena kami memang tidak menyimpannya.
          </p>
        </Section>

        <Section title="9. Perubahan kebijakan">
          <p>Bila ada perubahan penting, kami menampilkan pemberitahuan di aplikasi dan menaikkan versi persetujuan.</p>
        </Section>

        <p className="mt-12 border-t pt-6 text-sm text-muted-foreground">
          Ringkasan dalam bahasa Inggris: PathSync stores the profile, evidence and answers you add; uses them to build your route, for sampled human
          quality review, and for aggregate product metrics; research use is a separate optional opt-in; lecturers see only class aggregates (k ≥ 5);
          you can export or delete everything at any time.
        </p>
      </main>
    </div>
  );
}
