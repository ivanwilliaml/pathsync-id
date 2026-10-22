"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, LogOut, Menu, PanelLeftClose, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { PRIMARY, UTILITY, activeNav, visible, type NavItem } from "@/lib/sections";
import { setStudent, useStudentId } from "@/lib/student";
import { staffSignOut, useStaffSession } from "@/lib/staff";
import { FeedbackButton } from "./feedback-button";
import { KeyGuard } from "./key-guard";
import { SyncAgent } from "./sync-agent";
import { LinkButton } from "./kit";
import { Logo } from "./logo";
import { PublicShell } from "./public-shell";

// label: [English, Indonesian]
type TeamItem = { href: string; label: [string, string]; icon: typeof Users };
const TEAM: TeamItem[] = [
  { href: "/advisor", label: ["Lecturer View", "Tampilan Dosen"], icon: GraduationCap },
  { href: "/experts", label: ["Expert Panel", "Panel Pakar"], icon: Users },
  { href: "/admin", label: ["Admin", "Admin"], icon: Settings2 },
];

const COLLAPSE_KEY = "pathsync.sidebar.collapsed";

/** Desktop sidebar collapsed to icons, remembered per browser (expanded when storage is unavailable). */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  return [collapsed, toggle] as const;
}

// pages a visitor without a profile may open; they get the landing page's header, not the app sidebar
const PUBLIC = ["/careers", "/how-it-works", "/staff", "/admin", "/advisor", "/experts"];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const t = useT();
  const [collapsed, toggle] = useCollapsed();
  const student = useStudentId();
  const staff = useStaffSession();
  const known = student.ready && staff.ready;
  const signedIn = !!student.id || !!staff.session;
  const landing = path === "/" || path === "/privacy" || path === "/about";
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));
  // the app itself (Home, Skills, Careers with a profile, Learn...) opens only with a profile: visitors go to the landing
  useEffect(() => {
    if (known && !signedIn && !landing && !isPublic) router.replace("/");
  }, [known, signedIn, landing, isPublic, router]);
  if (landing) return <>{children}</>;
  if (!known) return null;
  if (!signedIn) return isPublic ? <PublicShell>{children}</PublicShell> : null;
  return (
    <div
      className={cn(
        "app-shell min-h-screen lg:grid lg:transition-[grid-template-columns] lg:duration-200",
        collapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[248px_minmax(0,1fr)]",
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        {t("Skip to content", "Langsung ke konten")}
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar lg:flex">
        <SidebarNav collapsed={collapsed} onToggle={toggle} />
      </aside>
      {/* below lg the bottom bar is fixed over the page: keep room for it and the phone's home indicator */}
      <div className="flex min-h-screen min-w-0 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <MobileBar />
        <main id="main" className="mx-auto w-full max-w-[1360px] flex-1 px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center justify-between gap-2 border-t px-5 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink">{t("Privacy", "Privasi")}</Link>
            <Link href="/about" className="hover:text-ink">{t("About & Contact", "Tentang & Kontak")}</Link>
          </span>
          <FeedbackButton />
        </footer>
        <KeyGuard />
      </div>
      <BottomNav />
      <SyncMount />
    </div>
  );
}

function NavLink({ href, label, icon: Icon, active, collapsed, onNavigate }: {
  href: string; label: string; icon: NavItem["icon"]; active: boolean; collapsed?: boolean; onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "justify-center px-0" : "px-3",
        active ? "bg-secondary text-secondary-foreground" : "text-ink/75 hover:bg-muted hover:text-ink",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
      {collapsed ? null : <span className="truncate">{label}</span>}
    </Link>
  );
}

function SidebarNav({ onNavigate, collapsed = false, onToggle }: { onNavigate?: () => void; collapsed?: boolean; onToggle?: () => void }) {
  const path = usePathname();
  const t = useT();
  const { id } = useStudentId();
  const { session } = useStaffSession();
  const current = activeNav(path);
  const toggleLabel = collapsed ? t("Expand sidebar", "Lebarkan sidebar") : t("Collapse sidebar", "Ciutkan sidebar");
  return (
    <div className={cn("flex h-full flex-col gap-5", collapsed ? "px-3 py-4" : "p-4")}>
      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between gap-2")}>
        {/* collapsed, the Sync head itself opens the sidebar again: one control instead of a logo plus a panel icon */}
        {collapsed && onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={false}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="rounded-lg p-0.5 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot/logo.webp" alt="" width={34} height={34} className="size-[34px]" draggable={false} />
          </button>
        ) : (
          <Link href={id ? "/dashboard" : "/"} onClick={onNavigate} aria-label="PathSync" className="px-2 py-1">
            <Logo />
          </Link>
        )}
        {onToggle && !collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="rounded-md p-1.5 text-ink/60 transition-colors hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PanelLeftClose className="size-[18px]" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <nav aria-label={t("Main", "Utama")} className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
        {/* a thin line separates Home from the three stages */}
        {visible(PRIMARY, !!id).map((i, n, all) => (
          <div key={i.href} className={cn(all[n - 1]?.href === "/dashboard" && "mt-1 border-t pt-2")}>
            <NavLink href={i.href} label={t(...i.label)} icon={i.icon} active={current === i.href} collapsed={collapsed} onNavigate={onNavigate} />
          </div>
        ))}
        <div className="mt-auto space-y-1 border-t pt-4">
          {visible(UTILITY, !!id).map((i) => (
            <NavLink key={i.href} href={i.href} label={t(...i.label)} icon={i.icon} active={current === i.href} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        {session ? (
          <div className="mt-4 space-y-1">
            {collapsed ? null : (
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                {t("Team Workspace", "Ruang Kerja Tim")}
                {/* who is signed in: the account name, or "demo" for the read-only demo accounts */}
                {session.name ? <span className="block truncate font-normal text-ink/70">{session.name}</span> : null}
              </p>
            )}
            {TEAM.filter((x) => session.role === "admin" || x.href === (session.role === "expert" ? "/experts" : "/advisor")).map(({ href, label, icon }) => (
              <NavLink key={href} href={href} label={t(...label)} icon={icon} active={path.startsWith(href)} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ) : null}
      </nav>
      {collapsed ? (
        <CollapsedFooter />
      ) : (
        <>
          {session ? (
            <button type="button" onClick={() => void staffSignOut()} className="px-3 text-left text-xs font-medium text-ink/70 hover:text-ink">
              {t("Staff: sign out", "Staf: keluar")} ({session.role})
            </button>
          ) : null}
          <ProfileChip onNavigate={onNavigate} />
        </>
      )}
    </div>
  );
}

/** Collapsed sidebar foot: only switching profile; language, profile ID and staff sign-out come back when expanded. */
function CollapsedFooter() {
  const { id } = useStudentId();
  const t = useT();
  if (!id) return null;
  const label = t("Switch Profile", "Ganti Profil");
  return (
    <button
      type="button"
      onClick={() => {
        setStudent(null);
        window.location.href = "/";
      }}
      aria-label={label}
      title={label}
      className="flex justify-center rounded-lg py-2.5 text-ink/70 hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LogOut className="size-[18px]" aria-hidden="true" />
    </button>
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
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs text-muted-foreground">{t("Profile ID", "ID Profil")}</p>
      <p className="text-sm tabular-nums tracking-wide" translate="no">
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

/** Phone header: logo and the menu with utilities, language, profile and staff links. */
function MobileBar() {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/">
        <Logo />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="icon-lg" aria-label={t("Open menu", "Buka menu")} />}>
          <Menu />
        </SheetTrigger>
        <SheetContent side="right" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}

/** Phone bottom bar with the four destinations (Home, Skills, Careers, Learn). */
function BottomNav() {
  const path = usePathname();
  const t = useT();
  const { id } = useStudentId();
  const current = activeNav(path);
  const items = visible(PRIMARY, !!id);
  return (
    <nav
      aria-label={t("Main", "Utama")}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, short, icon: Icon }) => {
          const on = current === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  on ? "text-indigo" : "text-ink/60 hover:text-ink",
                )}
              >
                <Icon className={cn("size-5", on && "stroke-[2.4]")} aria-hidden="true" />
                {t(...short)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sync, the assistant, for a signed-in student (it answers from their own data). */
function SyncMount() {
  const { id } = useStudentId();
  return id ? <SyncAgent sid={id} /> : null;
}
