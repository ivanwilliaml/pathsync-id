"use client";

import { useEffect, useState } from "react";
import { Palette, X } from "lucide-react";

// Team-only theme preview for choosing the palette that goes with the mascot. Hidden unless the page was opened
// once with ?themes=1 (remembered in localStorage); ?themes=0 hides it again. It only overrides the CSS tokens in
// globals.css, so every page and component previews the theme as it would really look.
const FLAG = "pathsync.themelab";
const PICK = "pathsync.theme";

interface Theme {
  id: string;
  name: string;
  note: string;
  primary: string;
  second: string; // fills the "iris" slot (middle of the route gradient)
  warm: string; // fills the "ember" slot (end of the route gradient, highlights)
  success: string; // fills the "mint" slot
  ink: string;
  paper: string;
}

export const THEMES: Theme[] = [
  { id: "current", name: "4. Langit pagi (aktif)", note: "biru, hijau, kuning", primary: "#1d6fd8", second: "#4aa548", warm: "#f5c542", success: "#2ba66a", ink: "#0f2442", paper: "#f0f6ff" },
  { id: "old", name: "5. Lama", note: "indigo, ungu, oranye", primary: "#4338ca", second: "#7c6cf6", warm: "#f2711c", success: "#0e9f8a", ink: "#1b1740", paper: "#f6f6fb" },
  { id: "forest", name: "1. Hutan tropis", note: "hijau, teal, amber", primary: "#1f7a4d", second: "#0e9f8a", warm: "#f2a93b", success: "#2f9e5b", ink: "#13261b", paper: "#f1f7ee" },
  { id: "indigo-green", name: "2. Indigo + hijau", note: "indigo tetap, tanpa oranye", primary: "#4338ca", second: "#3fa34d", warm: "#8fd694", success: "#3fa34d", ink: "#1b1740", paper: "#f6f6fb" },
  { id: "teal-coral", name: "3. Teal + koral", note: "koral pelengkap hijau", primary: "#0b6e60", second: "#66b759", warm: "#f26b4f", success: "#0e9f8a", ink: "#10302b", paper: "#f1f7f5" },
  { id: "navy-mint", name: "6. Navy + mint", note: "navy, mint, peach", primary: "#14306b", second: "#2bb673", warm: "#f7a072", success: "#2bb673", ink: "#0d1b33", paper: "#f2f7fb" },
  { id: "olive", name: "7. Zaitun + terakota", note: "earthy, hangat", primary: "#4f7a28", second: "#a3c585", warm: "#d9734e", success: "#5e9e3a", ink: "#23301a", paper: "#f7f5ec" },
  { id: "lavender", name: "8. Hijau + lavender", note: "ungu lembut, kuning", primary: "#2e7d52", second: "#a78bfa", warm: "#fbbf24", success: "#2e9e62", ink: "#1e293b", paper: "#f5f3ff" },
  { id: "jewel", name: "9. Zamrud + plum", note: "jewel tone, emas", primary: "#047857", second: "#6d28d9", warm: "#eab308", success: "#059669", ink: "#1f1535", paper: "#f6f5fb" },
  { id: "mono", name: "10. Monokrom hijau", note: "satu keluarga hijau", primary: "#14532d", second: "#22a35a", warm: "#86e3a8", success: "#22a35a", ink: "#0b1f14", paper: "#f3faf5" },
];

const mix = (c: string, pct: number, base = "white") => `color-mix(in srgb, ${c} ${pct}%, ${base})`;

function tokens(t: Theme): Record<string, string> {
  return {
    "--ink": t.ink,
    "--indigo": t.primary,
    "--iris": t.second,
    "--ember": t.warm,
    "--ember-ink": mix(t.warm, 55, "black"),
    "--mint": t.success,
    "--mint-ink": mix(t.success, 70, "black"),
    "--paper": t.paper,
    "--route": `linear-gradient(90deg, ${t.primary} 0%, ${t.second} 55%, ${t.warm} 100%)`,
    "--route-soft": `linear-gradient(135deg, ${mix(t.primary, 8)} 0%, ${mix(t.second, 8)} 55%, ${mix(t.warm, 10)} 100%)`,
    "--secondary": mix(t.primary, 10),
    "--secondary-foreground": mix(t.primary, 75, "black"),
    "--accent": mix(t.primary, 10),
    "--accent-foreground": mix(t.primary, 75, "black"),
    "--sidebar-accent": mix(t.primary, 10),
    "--sidebar-accent-foreground": mix(t.primary, 75, "black"),
    "--muted": mix(t.ink, 5),
    "--muted-foreground": mix(t.ink, 70),
    "--border": mix(t.ink, 12),
    "--input": mix(t.ink, 16),
    "--primary": t.primary,
    "--sidebar-primary": t.primary,
    "--foreground": t.ink,
    "--card-foreground": t.ink,
    "--popover-foreground": t.ink,
    "--sidebar-foreground": t.ink,
    "--background": t.paper,
    "--ring": t.primary,
    "--chart-1": t.primary,
    "--chart-2": t.second,
    "--chart-3": t.warm,
    "--chart-4": t.success,
  };
}

function apply(t: Theme) {
  const root = document.documentElement;
  for (const k of Object.keys(tokens(THEMES[0]))) root.style.removeProperty(k);
  if (t.id === "current") return;
  for (const [k, v] of Object.entries(tokens(t))) root.style.setProperty(k, v);
}

export function ThemeLab() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("current");

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("themes");
      if (q === "1") localStorage.setItem(FLAG, "1");
      if (q === "0") localStorage.removeItem(FLAG);
      const on = localStorage.getItem(FLAG) === "1";
      setEnabled(on);
      const saved = THEMES.find((t) => t.id === localStorage.getItem(PICK));
      if (on && saved) {
        setPick(saved.id);
        apply(saved);
      }
      if (on && q === "1") setOpen(true);
    } catch {}
  }, []);

  if (!enabled) return null;

  const choose = (t: Theme) => {
    setPick(t.id);
    apply(t);
    try {
      localStorage.setItem(PICK, t.id);
    } catch {}
  };

  return (
    <div className="fixed bottom-4 left-4 z-[60] print:hidden">
      {open ? (
        <div className="w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-card p-3 shadow-xl">
          <div className="flex items-center gap-3 rounded-xl p-2" style={{ background: "var(--route-soft)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot/sync-wave.webp" alt="" width={56} height={56} className="size-14" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Theme lab</p>
              <p className="text-xs text-muted-foreground">Preview only, for the team</p>
            </div>
            <button type="button" aria-label="Close theme lab" onClick={() => setOpen(false)} className="rounded-md p-1 text-ink/60 hover:bg-white/60">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-2 h-1.5 rounded-full" style={{ background: "var(--route)" }} />
          <ul className="mt-2 max-h-[55vh] space-y-1 overflow-y-auto pr-1">
            {THEMES.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => choose(t)}
                  aria-pressed={pick === t.id}
                  className={`flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    pick === t.id ? "border-primary bg-secondary" : "border-transparent hover:bg-muted"
                  }`}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-md border" aria-hidden="true">
                    {[t.primary, t.second, t.warm, t.ink, t.paper].map((c) => (
                      <span key={c} className="h-6 w-3.5" style={{ background: c }} />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{t.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.note}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
            The logo and readiness ring follow the theme. Open with <code>?themes=0</code> to hide this panel.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-medium text-ink shadow-lg hover:bg-muted"
        >
          <Palette className="size-4 text-primary" aria-hidden="true" /> Theme
        </button>
      )}
    </div>
  );
}
