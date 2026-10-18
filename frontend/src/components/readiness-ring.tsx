"use client";

import { useT } from "@/lib/i18n";

/** Circular progress in the primary colour. `value: null` = not measured yet (no evidence), shown as a dash, not 0%. */
export function ReadinessRing({ value, size = 148, stroke = 14, label }: { value: number | null; size?: number; stroke?: number; label?: string }) {
  const t = useT();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  const text = value === null ? "–" : `${Math.round(v * 100)}%`;
  return (
    <div
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={value === null ? `${label ?? t("Progress", "Progres")}: ${t("not measured yet", "belum terukur")}` : `${label ?? t("Progress", "Progres")}: ${text}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: "var(--indigo)", strokeOpacity: 0.15 }} strokeWidth={stroke} />
        {value === null ? null : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            style={{ stroke: "var(--indigo)" }}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-[32px] font-extrabold leading-none text-ink">{text}</span>
        {label ? <span className="mt-1 text-xs text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  );
}
