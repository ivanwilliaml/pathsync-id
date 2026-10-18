"use client";

import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export interface Change {
  id: string;
  name: string;
  before: number;
  now: number;
  target?: boolean;
}

/** Readiness changes per career as aligned rows: name, a before→after bar, and the change in percentage points.
 * Used by the Career Map ("since your last visit"), the Quick Check result and Path History, so they read the same. */
export function ChangeList({ items, className }: { items: Change[]; className?: string }) {
  const t = useT();
  return (
    <ul className={cn("divide-y", className)}>
      {items.map((c) => {
        const up = c.now >= c.before;
        const delta = Math.round((c.now - c.before) * 100);
        return (
          <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {c.name}
                {c.target ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t("your target", "target-mu")}</span> : null}
              </p>
              <p className="tabular text-xs text-muted-foreground">
                {pct(c.before)} → {pct(c.now)}
              </p>
            </div>
            <div className="relative order-last col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1" aria-hidden="true">
              <div className="absolute inset-y-0 left-0 rounded-full bg-input" style={{ width: `${Math.max(c.before, c.now) * 100}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${c.now * 100}%`, background: up ? "var(--indigo)" : "var(--destructive)" }} />
            </div>
            <span
              className={cn(
                "tabular min-w-12 justify-self-end rounded-full px-2.5 py-0.5 text-center text-xs font-semibold",
                up ? "bg-[#e3f5ea] text-mint-ink" : "bg-destructive/10 text-destructive",
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta} pt
            </span>
          </li>
        );
      })}
    </ul>
  );
}
