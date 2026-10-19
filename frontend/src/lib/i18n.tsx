"use client";

// Interface language. Indonesian is the default; English is one switch away. Technical terms (skill, readiness,
// evidence, job posting, dashboard...) stay in English in both, since that is how students meet them in postings.
// Strings live next to their use as t("English", "Indonesia") pairs, so a screen reads the same in either language.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { cn } from "./utils";

export type Lang = "id" | "en";
const KEY = "pathsync.lang";
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // private mode: the switch still works for this page view
  }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void) {
  listeners.add(f);
  const onStorage = (e: StorageEvent) => e.key === KEY && f();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(f);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLang(): Lang {
  // pages are prerendered in Indonesian; an English choice applies right after hydration
  return useSyncExternalStore(subscribe, read, () => "id");
}

export type T = (en: string, id: string) => string;

/** Outside React (e.g. the API client): the language chosen right now. */
export const tNow: T = (en, id) => (typeof window !== "undefined" && read() === "en" ? en : id);

/** t("English", "Indonesia") picks the string for the current language. */
export function useT(): T {
  const lang = useLang();
  return useCallback((en: string, id: string) => (lang === "en" ? en : id), [lang]);
}

/** Two-option segmented switch, ID | EN. */
export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang();
  const opt = (l: Lang, label: string, name: string) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      aria-label={name}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        lang === l ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Bahasa / Language" className={cn("inline-flex gap-0.5 rounded-lg bg-muted p-0.5", className)}>
      {opt("id", "ID", "Bahasa Indonesia")}
      {opt("en", "EN", "English")}
    </div>
  );
}

// Tab titles per route, [English, Indonesian]. The server renders the Indonesian ones (page metadata); this swaps
// them when the visitor picked English. Kept in step with the metadata in each app/*/layout.tsx.
const TITLES: [string, [string, string]][] = [
  ["/dashboard", ["Home", "Beranda"]],
  ["/skills", ["Understand Your Skills", "Kenali Skill"]],
  ["/evidence", ["Add Evidence", "Tambah Bukti"]],
  ["/assessment", ["Skill Check", "Cek Kemampuan"]],
  ["/careers/check", ["Check a Job Posting", "Cek Lowongan"]],
  ["/careers", ["Choose a Career", "Pilih Karier"]],
  ["/learn/practice", ["Practice", "Latihan"]],
  ["/learn", ["Learn", "Belajar"]],
  ["/settings", ["Settings & Data", "Pengaturan & Data"]],
  ["/how-it-works", ["Methodology & Data", "Metode & Data"]],
  ["/advisor", ["Lecturer View", "Tampilan Dosen"]],
  ["/experts", ["Expert Panel", "Panel Pakar"]],
  ["/admin", ["Admin", "Admin"]],
  ["/staff/accept", ["Set Your Password", "Atur Password"]],
  ["/privacy", ["Privacy Policy", "Kebijakan Privasi"]],
  ["/about", ["About & Contact", "Tentang & Kontak"]],
];
const HOME: [string, string] = ["PathSync: Know Exactly What to Learn Next", "PathSync: Tahu Persis Apa yang Harus Dipelajari Berikutnya"];

/** Keeps <html lang> and the tab title in step with the choice (the server always sends Indonesian). */
export function LangSync() {
  const lang = useLang();
  const path = usePathname();
  useEffect(() => {
    document.documentElement.lang = lang;
    const pick = ([en, id]: [string, string]) => (lang === "en" ? en : id);
    const hit = TITLES.find(([p]) => path === p || path.startsWith(p + "/"));
    // after Next has applied the route's own metadata title
    const raf = requestAnimationFrame(() => {
      document.title = path === "/" ? pick(HOME) : hit ? `${pick(hit[1])} · PathSync` : document.title;
    });
    return () => cancelAnimationFrame(raf);
  }, [lang, path]);
  return null;
}
