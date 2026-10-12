import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Tentang & Kontak",
  description: "Siapa di balik PathSync, bagaimana cara kerjanya, dan cara menghubungi kami.",
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@pathsync.example";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/privacy" className="text-sm font-medium text-ink/75 hover:text-ink">
          Kebijakan Privasi
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6" lang="id">
        <h1 className="text-[32px] font-extrabold leading-tight text-ink">Tentang PathSync</h1>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink/80">
          <p>
            PathSync adalah navigator belajar untuk mahasiswa Indonesia. Kami membaca lowongan kerja nyata, memeriksa apa yang sudah bisa Anda
            buktikan, lalu menyusun rute belajar berurutan: keterampilan mana dulu, kenapa, dan dari materi gratis yang mana.
          </p>
          <p>
            Dibangun oleh Team cupuu. Sumber data: Karirhub (Kemnaker) dan halaman karier perusahaan. Cara kerja lengkap, termasuk model yang
            dipakai dan batasannya, ada di{" "}
            <Link href="/how-it-works" className="font-medium text-indigo underline">
              How the AI Works
            </Link>
            .
          </p>
          <p>
            <strong>Status:</strong> beta tertutup. Saat ini mendukung dua peran (Business Analyst dan Data Analyst). Peran lain menyusul;
            daftarkan email Anda di beranda untuk diberi tahu.
          </p>
        </div>
        <h2 className="mt-10 text-xl font-bold text-ink">Kontak</h2>
        <p className="mt-3 text-[15px] text-ink/80">
          Ada masalah atau saran? Pakai tombol <em>Report a Problem</em> di dalam aplikasi, atau email{" "}
          <a className="font-medium text-indigo underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </main>
    </div>
  );
}
