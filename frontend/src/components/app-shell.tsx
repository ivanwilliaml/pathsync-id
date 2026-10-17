"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Cpu,
  GraduationCap,
  ClipboardCheck,
  FolderOpen,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LangSwitch, useT } from "@/lib/i18n";
import { setStudent, useStudentId } from "@/lib/student";
import { staffSignOut, useStaffSession } from "@/lib/staff";
import { FeedbackButton } from "./feedback-button";
import { KeyGuard } from "./key-guard";
import { LinkButton } from "./kit";
import { Logo } from "./logo";

// label: [English, Indonesian]
type NavItem = { href: string; label: [string, string]; icon: typeof LayoutDashboard };

const JOURNEY: NavItem[] = [
  { href: "/dashboard", label: ["Dashboard", "Dashboard"], icon: LayoutDashboard },
  { href: "/classroom", label: ["My Classes", "Kelas Saya"], icon: BookOpen },
  { href: "/evidence", label: ["My Evidence", "Evidence Saya"], icon: FolderOpen },
  { href: "/assessment", label: ["Assessment", "Assessment"], icon: ClipboardCheck },
  { href: "/skill-map", label: ["Skill Map", "Skill Map"], icon: Network },
  { href: "/history", label: ["Path History", "Path History"], icon: History },
  { href: "/settings", label: ["Settings & Data", "Pengaturan & Data"], icon: ShieldCheck },
];
const EXPLORE: NavItem[] = [
  { href: "/market", label: ["Job Market", "Job Market"], icon: BarChart3 },
  { href: "/how-it-works", label: ["How the AI Works", "Cara Kerja AI"], icon: Cpu },
];
const TEAM: NavItem[] = [
  { href: "/advisor", label: ["Lecturer View", "Tampilan Dosen"], icon: GraduationCap },
  { href: "/experts", label: ["Expert Panel", "Panel Pakar"], icon: Users },
  { href: "/admin", label: ["Admin", "Admin"], icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const t = useT();
  if (path === "/") return <>{children}</>;
  const bare = path === "/privacy" || path === "/about";
  if (bare) return <>{children}</>;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        {t("Skip to content", "Langsung ke konten")}
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar lg:flex">
        <SidebarNav />
      </aside>
      <div className="min-w-0">
        <MobileBar />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 border-t px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-10">
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">{t("Privacy", "Privasi")}</Link>
            <Link href="/about" className="hover:text-ink">{t("About & Contact", "Tentang & Kontak")}</Link>
          </span>
          <FeedbackButton />
        </footer>
        <KeyGuard />
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const t = useT();
  const { id } = useStudentId();
  const { session } = useStaffSession();
  const section = (title: string, items: NavItem[]) => (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{title}</p>
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-secondary text-secondary-foreground" : "text-ink/75 hover:bg-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(...label)}
          </Link>
        );
      })}
    </div>
  );
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href={id ? "/dashboard" : "/"} onClick={onNavigate} className="px-2 py-1">
        <Logo />
      </Link>
      <nav aria-label={t("Main", "Utama")} className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {id ? section(t("Your Journey", "Perjalananmu"), JOURNEY) : null}
        {section(t("Explore", "Jelajahi"), EXPLORE)}
        {session ? section(t("Team Workspace", "Ruang Kerja Tim"), TEAM.filter((x) => session.role === "admin" || x.href === (session.role === "expert" ? "/experts" : "/advisor"))) : null}
      </nav>
      {session ? (
        <button type="button" onClick={() => void staffSignOut()} className="px-3 text-left text-xs font-medium text-ink/70 hover:text-ink">
          {t("Staff: sign out", "Staf: keluar")} ({session.role})
        </button>
      ) : null}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted-foreground">{t("Language", "Bahasa")}</span>
        <LangSwitch />
      </div>
      <ProfileChip onNavigate={onNavigate} />
    </div>
  );
}

function ProfileChip({ onNavigate }: { onNavigate?: () => void }) {
  const { id } = useStudentId();
  const t = useT();
  if (!id) {
    return (
      <LinkButton href="/" onClick={onNavigate} size="lg" className="h-10 w-full">
        {t("Start Your Path", "Mulai Path-mu")}
      </LinkButton>
    );
  }
  return (
    <div className="rounded-xl bg-route-soft p-3">
      <p className="text-xs text-muted-foreground">{t("Profile ID", "ID Profil")}</p>
      <p className="font-mono text-sm" translate="no">
        {id}
      </p>
      <button
        type="button"
        onClick={() => {
          setStudent(null);
          window.location.href = "/";
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink/70 hover:text-ink focus-visible:outline-none focus-visible:underline"
      >
        <LogOut className="size-3.5" aria-hidden="true" /> {t("Switch Profile", "Ganti Profil")}
      </button>
    </div>
  );
}

function MobileBar() {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">
        <LangSwitch />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="outline" size="icon-lg" aria-label={t("Open menu", "Buka menu")} />}>
            <Menu />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
