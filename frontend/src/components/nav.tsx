"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LogOut } from "lucide-react";
import { setStudentId, useStudentId } from "@/lib/student";

const STUDENT_LINKS = [
  { href: "/dasbor", label: "Dasbor" },
  { href: "/profil", label: "Profil & Bukti" },
  { href: "/asesmen", label: "Asesmen" },
  { href: "/graf", label: "Graf" },
  { href: "/riwayat", label: "Riwayat" },
];
const PUBLIC_LINKS = [
  { href: "/pasar", label: "Peta Pasar" },
  { href: "/pakar", label: "Panel Pakar" },
  { href: "/admin", label: "Admin" },
];

export function Nav() {
  const path = usePathname();
  const { id } = useStudentId();
  const links = id ? [...STUDENT_LINKS, ...PUBLIC_LINKS] : PUBLIC_LINKS;
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href={id ? "/dasbor" : "/"} className="flex items-center gap-2 font-bold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <Compass className="h-5 w-5" />
          </span>
          PathSync
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${active ? "bg-brand-soft font-medium text-brand-strong" : "text-muted hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        {id ? (
          <button
            onClick={() => {
              setStudentId(null);
              window.location.href = "/";
            }}
            className="flex items-center gap-1 whitespace-nowrap text-xs text-muted hover:text-ink"
            title="Keluar dari profil di perangkat ini"
          >
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        ) : (
          <Link href="/" className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">
            Mulai
          </Link>
        )}
      </div>
    </header>
  );
}
