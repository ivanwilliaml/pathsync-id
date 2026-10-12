import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "PathSync: tahu persis apa yang harus dipelajari berikutnya", template: "%s · PathSync" },
  description: "Rute belajar untuk mahasiswa Indonesia, dari lowongan kerja nyata dan bukti kemampuanmu. Gratis, tanpa email dan kata sandi.",
  openGraph: { type: "website", siteName: "PathSync", locale: "id_ID", url: SITE },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#f6f6fb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen antialiased">
        <TooltipProvider>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
