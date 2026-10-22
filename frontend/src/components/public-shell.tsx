"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";
import { Logo } from "./logo";

/** The site header for visitors who are not signed in: the same one as the landing page, on every public page. The
 * page you are on is marked with a bar under its name; the interface is Indonesian, so there is no language switch. */
export function PublicHeader({ onSignIn, onStart }: { onSignIn?: () => void; onStart?: () => void }) {
  const t = useT();
  const path = usePathname();
  const link = (href: string, label: string) => {
    const on = href === "/" ? path === "/" : path.startsWith(href);
    return (
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={cn(
          "relative hidden px-3 py-2 text-sm font-medium transition-colors sm:inline-block",
          on ? "text-indigo after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-indigo" : "text-ink/70 hover:text-ink",
        )}
      >
        {label}
      </Link>
    );
  };
  const action = (label: string, variant: "outline" | "default", onClick: (() => void) | undefined, href: string) =>
    onClick ? (
      <button type="button" onClick={onClick} className={buttonVariants({ variant })}>{label}</button>
    ) : (
      <Link href={href} className={buttonVariants({ variant })}>{label}</Link>
    );
  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href="/" aria-label={t("PathSync home", "Beranda PathSync")}>
        <Logo />
      </Link>
      <nav aria-label={t("Site", "Situs")} className="flex items-center gap-1 sm:gap-2">
        {link("/", t("Home", "Beranda"))}
        {link("/careers", "Job Market")}
        {link("/how-it-works", t("Methodology", "Metode & Data"))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        {action(t("Sign in", "Masuk"), "outline", onSignIn, "/?resume=1")}
        {action(t("Start", "Mulai"), "default", onStart, "/?start=1")}
      </nav>
    </header>
  );
}

/** Public pages (Job Market, How It Works, staff sign-in) for visitors: the landing page's header and width, no app
 * sidebar, because nothing personal is open until a profile exists. */
export function PublicShell({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-7xl px-5 pb-20 pt-4 sm:px-8">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-6 text-xs text-muted-foreground sm:px-8">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>&copy; 2026 PathSync</span>
            <Link href="/about" className="hover:text-ink">{t("About & Contact", "Tentang & Kontak")}</Link>
            <Link href="/privacy" className="hover:text-ink">{t("Privacy Policy", "Kebijakan Privasi")}</Link>
          </span>
          <Link href="/" className="font-medium text-indigo hover:underline">{t("Start your path", "Mulai Path-mu")} →</Link>
        </div>
      </footer>
    </div>
  );
}
