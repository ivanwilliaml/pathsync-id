"use client";

// Small app-level building blocks on top of shadcn/ui.
import Link from "next/link";
import { useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mascot, type MascotName } from "./mascot";
import { MascotLoader } from "./mascot-loader";
import { useT } from "@/lib/i18n";

/** Navigation that looks like a button (keeps <a> semantics for Cmd/Ctrl-click). */
export function LinkButton({
  href,
  className,
  variant,
  size,
  children,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}

/** One compact page header: title and a single meta line on the left, actions on the right, and the page's tabs (if
 * any) as its bottom edge, so header and tabs read as one unit and the work starts right under them. The mascot
 * belongs to orientation moments (empty states, loading, results), not to every working page, so `mascot` is
 * accepted for the call sites but not drawn here. */
export function PageHeader({ title, description, actions, className, tabs, stats }: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  mascot?: MascotName;
  tabs?: ReactNode;
  /** where you stand, as a few labelled numbers under the title (label small, value bold), not one long sentence */
  stats?: [string, ReactNode][];
}) {
  return (
    <header className={cn("mb-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-4xl">
          <h1 className="text-[26px] font-bold leading-tight text-ink sm:text-[28px]">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          {stats?.length ? (
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
              {stats.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="tabular mt-0.5 text-[15px] font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs ? <div className="mt-4">{tabs}</div> : null}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="scroll-mt-24 text-[20px] font-semibold text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Panel({ children, className, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 sm:p-6", className)} {...props}>
      {children}
    </section>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
      <MascotLoader size={72} />
      {label ?? t("Loading…", "Memuat…")}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{msg}</span>
    </div>
  );
}

/** Empty or finished states. Shows Sync with an empty box unless another pose (or a photo via `image`) is given. */
export function EmptyState({ title, children, action, image, mascot = "empty-box" }: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  image?: string;
  mascot?: MascotName;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={160} height={107} loading="lazy" className="mb-5 h-[107px] w-40 rounded-xl object-cover" />
      ) : (
        <Mascot name={mascot} size={128} className="mb-4" />
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children ? <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Mastery bar. Solid fill = level now; a light band of the same colour runs to the target, so the band left
 * uncovered is the gap still to close. Once the target is reached the fill turns green. */
export function MasteryBar({ value, target, className, tone = "indigo", label }: { value: number; target?: number | null; className?: string; tone?: "indigo" | "mint"; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const t = target == null ? null : Math.max(0, Math.min(1, target));
  const met = t != null && v >= t;
  const fill = tone === "mint" || met ? "bg-mint" : "bg-indigo";
  return (
    <div
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={t != null ? `${Math.round(v * 100)} / ${Math.round(t * 100)}` : undefined}
    >
      {t != null && !met ? <div className="absolute inset-y-0 left-0 rounded-full bg-indigo/20" style={{ width: `${t * 100}%` }} aria-hidden="true" /> : null}
      <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300", fill)} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Tag({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "indigo" | "ember" | "mint" | "red"; className?: string }) {
  const t = {
    neutral: "bg-muted text-ink/80",
    indigo: "bg-secondary text-secondary-foreground",
    ember: "bg-[#fff6d9] text-ember-ink",
    mint: "bg-[#e3f5ea] text-mint-ink",
    red: "bg-destructive/10 text-destructive",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium", t, className)}>{children}</span>;
}

export const fieldCls =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50";

/** Native select styled like the inputs (reliable on mobile, explicit colours for Windows dark mode). */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(fieldCls, "appearance-auto bg-card pr-8 text-ink", className)} {...props}>
      {children}
    </select>
  );
}

/** Two-way switch between views of the same data (a toggle, not navigation). */
export function Segmented<V extends string>({ label, value, onChange, options, showLabel }: {
  label: string; value: V; onChange: (v: V) => void; options: [V, string][]; showLabel?: boolean;
}) {
  const group = (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border bg-muted/60 p-0.5">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3",
            value === v ? "bg-card font-semibold text-ink ring-1 ring-border" : "text-ink/65 hover:text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
  if (!showLabel) return group;
  return (
    <div className="inline-flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline" aria-hidden="true">{label}:</span>
      {group}
    </div>
  );
}

/** Underline tabs for switching between parts of one page (Kenali Skill: skills / evidence). Navigation, so it looks
 * different from a view switch (Segmented) or a filter. */
export function PageTabs<V extends string>({ label, value, onChange, options }: {
  label: string; value: V; onChange: (v: V) => void; options: [V, string][];
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            value === v ? "border-indigo text-ink" : "border-transparent text-ink/60 hover:text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Folder tabs: the active tab is drawn as the top of the panel under it (same surface, no line between them), so a
 * tab and its content read as one object. Arrow keys move between tabs; only the active one is in the tab order.
 * Pair with <TabPanel id={panelId}>. */
export function FolderTabs<V extends string>({ label, value, onChange, options, panelId, extra }: {
  label: string; value: V; onChange: (v: V) => void; options: [V, string][]; panelId: string; extra?: ReactNode;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex(([k]) => k === value);
    const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : null;
    if (j === null) return;
    e.preventDefault();
    const next = options[(j + options.length) % options.length][0];
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    // `extra` (a view switch for the active tab) sits at the right end of the same row, so it costs no line of its own
    <div className="flex items-end justify-between gap-3">
    <div className="-mx-5 min-w-0 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div role="tablist" aria-label={label} onKeyDown={onKey} className="relative z-10 -mb-px flex min-w-max gap-1">
        {options.map(([v, text]) => {
          const on = value === v;
          return (
            <button
              key={v}
              ref={(el) => {
                refs.current[v] = el;
              }}
              type="button"
              role="tab"
              id={`${panelId}-tab-${v}`}
              aria-selected={on}
              aria-controls={panelId}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(v)}
              className={cn(
                "whitespace-nowrap rounded-t-xl border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                on ? "border-b-card bg-card text-ink" : "border-transparent text-ink/60 hover:bg-muted/70 hover:text-ink",
              )}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
    {extra ? <div className="shrink-0 pb-1.5">{extra}</div> : null}
    </div>
  );
}

/** The surface under FolderTabs: the active tab opens into it. */
export function TabPanel<V extends string>({ id, value, first, children, className }: {
  id: string; value: V; first?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={`${id}-tab-${value}`}
      className={cn("min-w-0 rounded-2xl border bg-card p-4 sm:p-6", first && "rounded-tl-none", className)}
    >
      {children}
    </div>
  );
}
