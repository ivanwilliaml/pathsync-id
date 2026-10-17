import { useId } from "react";

/** Wordmark: a route line with three stops, the same gradient used for learning paths. */
export function Logo({ light = false }: { light?: boolean }) {
  // unique per instance: a gradient defined inside a hidden (display:none) copy would not render elsewhere
  const gid = `logo-route-${useId().replace(/:/g, "")}`;
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "var(--indigo)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--iris)" }} />
            <stop offset="1" style={{ stopColor: "var(--ember)" }} />
          </linearGradient>
        </defs>
        <rect width="30" height="30" rx="9" style={{ fill: light ? "#ffffff" : "var(--ink)" }} />
        <path d="M7 21 C 11 21, 11 15, 15 15 S 19 9, 23 9" fill="none" stroke={`url(#${gid})`} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="7" cy="21" r="2.4" style={{ fill: "var(--indigo)" }} />
        <circle cx="15" cy="15" r="2.4" style={{ fill: "var(--iris)" }} />
        <circle cx="23" cy="9" r="2.4" style={{ fill: "var(--ember)" }} />
      </svg>
      <span className={`text-[17px] font-bold tracking-tight ${light ? "text-white" : "text-ink"}`} translate="no">
        PathSync
      </span>
    </span>
  );
}
