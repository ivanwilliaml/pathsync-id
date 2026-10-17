import { useId } from "react";

/** Circular progress with the route gradient. `value: null` = not measured yet (no evidence), shown as a dash, not 0%. */
export function ReadinessRing({ value, size = 148, stroke = 14, label }: { value: number | null; size?: number; stroke?: number; label?: string }) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  const text = value === null ? "–" : `${Math.round(v * 100)}%`;
  return (
    <div
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={value === null ? `${label ?? "Progress"}: not measured yet` : `${label ?? "Progress"}: ${text}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--indigo)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--iris)" }} />
            <stop offset="1" style={{ stopColor: "var(--ember)" }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e5f3" strokeWidth={stroke} />
        {value === null ? null : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#ring-${id})`}
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
