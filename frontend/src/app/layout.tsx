import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "PathSync — Navigator Belajar Adaptif",
  description: "Jalur belajar adaptif berbasis bukti kompetensi dan data lowongan kerja nyata.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen font-sans antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted sm:px-6">
          PathSync · ICC 2026 · Tim cupuu — purwarupa riset. Data pasar dari lowongan publik (Karirhub Kemnaker, ATS perusahaan).
        </footer>
      </body>
    </html>
  );
}
