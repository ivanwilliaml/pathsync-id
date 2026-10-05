import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PathSync", template: "%s · PathSync" },
  description: "Know which skill to learn next for your target role, based on real Indonesian job postings and your own evidence.",
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
