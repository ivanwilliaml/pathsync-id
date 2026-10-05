"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  FolderOpen,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Settings2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { setStudentId, useStudentId } from "@/lib/student";
import { LinkButton } from "./kit";
import { Logo } from "./logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const JOURNEY: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/evidence", label: "My Evidence", icon: FolderOpen },
  { href: "/assessment", label: "Assessment", icon: ClipboardCheck },
  { href: "/skill-map", label: "Skill Map", icon: Network },
  { href: "/history", label: "Path History", icon: History },
];
const EXPLORE: NavItem[] = [{ href: "/market", label: "Job Market", icon: BarChart3 }];
const TEAM: NavItem[] = [
  { href: "/experts", label: "Expert Panel", icon: Users },
  { href: "/admin", label: "Admin", icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path === "/") return <>{children}</>;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar lg:flex">
        <SidebarNav />
      </aside>
      <div className="min-w-0">
        <MobileBar />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { id } = useStudentId();
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
            {label}
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
      <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {id ? section("Your Journey", JOURNEY) : null}
        {section("Explore", EXPLORE)}
        {section("Team Workspace", TEAM)}
      </nav>
      <ProfileChip onNavigate={onNavigate} />
    </div>
  );
}

function ProfileChip({ onNavigate }: { onNavigate?: () => void }) {
  const { id } = useStudentId();
  if (!id) {
    return (
      <LinkButton href="/" onClick={onNavigate} size="lg" className="h-10 w-full">
        Start Your Path
      </LinkButton>
    );
  }
  return (
    <div className="rounded-xl bg-route-soft p-3">
      <p className="text-xs text-muted-foreground">Profile ID</p>
      <p className="font-mono text-sm" translate="no">
        {id}
      </p>
      <button
        type="button"
        onClick={() => {
          setStudentId(null);
          window.location.href = "/";
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink/70 hover:text-ink focus-visible:outline-none focus-visible:underline"
      >
        <LogOut className="size-3.5" aria-hidden="true" /> Switch Profile
      </button>
    </div>
  );
}

function MobileBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/">
        <Logo />
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="icon-lg" aria-label="Open menu" />}>
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
