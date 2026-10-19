import { BookOpenCheck, Compass, Cpu, LayoutDashboard, ListChecks, ShieldCheck, type LucideIcon } from "lucide-react";

// Student navigation (concept A, journey based): Home plus the three stages in journey order
// (understand your skills -> choose a career -> learn); they are not gates, every stage is reachable at any time.
// Pages that belong to a stage without being a menu item (the evidence wizard, the quick check) list it in `also`.
// Labels are [English, Indonesian]; `short` is the mobile bottom-bar label. `public` works without a profile.

export interface NavItem {
  href: string;
  label: [string, string];
  short: [string, string];
  icon: LucideIcon;
  public?: boolean;
  also?: string[];
}

export const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: ["Home", "Beranda"], short: ["Home", "Beranda"], icon: LayoutDashboard },
  { href: "/skills", label: ["Understand Your Skills", "Kenali Skill"], short: ["Skills", "Skill"], icon: ListChecks, also: ["/evidence", "/assessment"] },
  { href: "/careers", label: ["Choose a Career", "Pilih Karier"], short: ["Careers", "Karier"], icon: Compass, public: true },
  { href: "/learn", label: ["Learn", "Belajar"], short: ["Learn", "Belajar"], icon: BookOpenCheck, public: true },
];

export const UTILITY: NavItem[] = [
  { href: "/how-it-works", label: ["Methodology & Data", "Metode & Data"], short: ["Method", "Metode"], icon: Cpu, public: true },
  { href: "/settings", label: ["Settings & Data", "Pengaturan & Data"], short: ["Settings", "Pengaturan"], icon: ShieldCheck },
];

export const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** The menu item to highlight for a path (a stage also owns the pages listed in `also`). */
export function activeNav(path: string): string | undefined {
  return [...PRIMARY, ...UTILITY].find((i) => [i.href, ...(i.also ?? [])].some((h) => isActive(path, h)))?.href;
}

/** Items a visitor sees: everything with a profile, only public stages without one. */
export const visible = (items: NavItem[], signedIn: boolean) => items.filter((i) => signedIn || i.public);
