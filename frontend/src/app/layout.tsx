import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangSync } from "@/lib/i18n";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "PathSync: Tahu Persis Apa yang Harus Dipelajari Berikutnya", template: "%s – PathSync" },
  description: "Rute belajar untuk mahasiswa Indonesia, disusun dari job posting nyata dan skill yang bisa kamu buktikan. Gratis.",
  openGraph: { type: "website", siteName: "PathSync", locale: "id_ID", url: SITE },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#f0f6ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-screen antialiased">
        <LangSync />
        <TooltipProvider>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
