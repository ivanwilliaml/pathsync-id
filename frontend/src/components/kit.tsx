"use client";

// Small app-level building blocks on top of shadcn/ui.
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
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
    <header className={cn("mb-8", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-4xl">
          <h1 className="hero-rise text-balance text-[32px] font-extrabold leading-[1.06] tracking-[-0.035em] text-ink sm:text-[40px]" style={{ ["--d" as string]: "0ms" }}>{title}</h1>
          {description ? <p className="hero-rise mt-2.5 max-w-2xl text-pretty text-[15.5px] leading-relaxed text-ink/60" style={{ ["--d" as string]: "70ms" }}>{description}</p> : null}
          {stats?.length ? (
            <dl className="hero-rise mt-5 flex flex-wrap gap-x-10 gap-y-4" style={{ ["--d" as string]: "120ms" }}>
              {stats.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
                  <dd className="tabular mt-1 text-[17px] font-bold tracking-[-0.02em] text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {actions ? <div className="hero-rise flex flex-wrap items-center gap-2.5" style={{ ["--d" as string]: "160ms" }}>{actions}</div> : null}
      </div>
      {tabs ? <div className="hero-rise mt-6" style={{ ["--d" as string]: "200ms" }}>{tabs}</div> : null}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="scroll-mt-24 text-[22px] font-bold tracking-[-0.025em] text-ink">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Panel({ children, className, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("p-card rounded-[24px] p-5 sm:p-7", className)} {...props}>
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
      <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(.32,.72,0,1)]", fill)} style={{ width: `${v * 100}%` }} />
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
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", t, className)}>{children}</span>;
}

export const fieldCls =
  "h-10 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-300 placeholder:text-muted-foreground focus-visible:border-indigo focus-visible:ring-4 focus-visible:ring-indigo/15 disabled:opacity-50";

/** Where the active option of a row of pills is, so a white thumb can glide to it instead of jumping. */
function useThumb(value: string, count: number) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const b = wrap.current?.querySelector<HTMLElement>(`[data-v="${CSS.escape(value)}"]`);
      if (b) setThumb({ left: b.offsetLeft, width: b.offsetWidth });
    };
    place();
    const ro = new ResizeObserver(place);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, count]);
  return [wrap, thumb] as const;
}

function Thumb({ at }: { at: { left: number; width: number } | null }) {
  return at ? <span className="smh-thumb" aria-hidden="true" style={{ left: at.left, width: at.width, top: 3, bottom: 3 }} /> : null;
}

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
  const [wrap, thumb] = useThumb(value, options.length);
  const group = (
    <div ref={wrap} role="group" aria-label={label} className="relative inline-flex rounded-full bg-muted/70 p-[3px] ring-1 ring-inset ring-black/[0.04]">
      <Thumb at={thumb} />
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          data-v={v}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "relative z-[1] whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-semibold tracking-[-0.01em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3.5",
            value === v ? "text-ink" : "text-ink/55 hover:text-ink",
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
  const [wrap, thumb] = useThumb(value, options.length);
  return (
    <div ref={wrap} role="tablist" aria-label={label} className="relative inline-flex rounded-full bg-muted/70 p-[3px] ring-1 ring-inset ring-black/[0.04]">
      <Thumb at={thumb} />
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="tab"
          data-v={v}
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "relative z-[1] whitespace-nowrap rounded-full px-4 py-1.5 text-[13.5px] font-semibold tracking-[-0.01em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            value === v ? "text-ink" : "text-ink/55 hover:text-ink",
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
  const [wrap, thumb] = useThumb(value, options.length);
  return (
    // `extra` (a view switch for the active tab) sits at the right end of the same row, so it costs no line of its own
    <div className="mb-4 flex items-center justify-between gap-3">
    <div className="-mx-5 min-w-0 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div ref={wrap} role="tablist" aria-label={label} onKeyDown={onKey} className="relative flex min-w-max rounded-full bg-muted/70 p-[3px] ring-1 ring-inset ring-black/[0.04]">
        <Thumb at={thumb} />
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
              data-v={v}
              id={`${panelId}-tab-${v}`}
              aria-selected={on}
              aria-controls={panelId}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(v)}
              className={cn(
                "relative z-[1] whitespace-nowrap rounded-full px-4 py-1.5 text-[13.5px] font-semibold tracking-[-0.01em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                on ? "text-ink" : "text-ink/55 hover:text-ink",
              )}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
    {extra ? <div className="shrink-0">{extra}</div> : null}
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
      className={cn("p-card min-w-0 rounded-[24px] p-4 sm:p-7", className)}
    >
      {/* each tab's content eases in instead of snapping */}
      <div key={value} className="smh-swap">{children}</div>
    </div>
  );
}

/** A page's table of contents beside the article: a small heading, one vertical rule, and the section being read
 * marked on that rule. On phones it is a single row of links above the article. */
export function Toc({ label, items }: { label: string; items: [string, string][] }) {
  const [active, setActive] = useState(items[0]?.[0] ?? "");
  // the section being read is the last heading above the upper third of the screen, read from the scroll position so a
  // long jump lands on the right item too
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const line = window.innerHeight * 0.33;
      let cur = items[0]?.[0] ?? "";
      for (const [id] of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = items[items.length - 1]?.[0] ?? cur;
      setActive(cur);
    };
    const on = () => (raf ||= requestAnimationFrame(read));
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => (window.removeEventListener("scroll", on), window.removeEventListener("resize", on), cancelAnimationFrame(raf));
  }, [items]);
  const list = useRef<HTMLOListElement>(null);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const a = list.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`);
    if (a) setBar({ top: a.offsetTop, height: a.offsetHeight });
  }, [active]);
  return (
    <nav aria-label={label} className="lg:sticky lg:top-8 lg:self-start">
      <p className="mb-4 hidden text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground lg:block">{label}</p>
      <ol ref={list} className="relative flex flex-wrap gap-x-4 gap-y-1 border-b pb-3 text-sm lg:flex-col lg:gap-0 lg:border-b-0 lg:border-l lg:border-black/[0.07] lg:pb-0">
        {/* on wide screens a bar glides to the section being read */}
        {bar ? <span className="side-bar absolute -left-px hidden w-[2px] rounded-full bg-indigo lg:block" style={{ top: bar.top, height: bar.height }} aria-hidden="true" /> : null}
        {items.map(([id, text]) => (
          <li key={id} data-id={id}>
            <a
              href={`#${id}`}
              onClick={(e) => {
                const el = document.getElementById(id);
                if (!el) return;
                e.preventDefault();
                el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
              }}
              aria-current={active === id ? "location" : undefined}
              className={cn(
                "block py-1.5 tracking-[-0.01em] transition-colors duration-300 lg:py-2 lg:pl-4",
                active === id ? "font-semibold text-ink" : "text-ink/55 hover:text-ink",
              )}
            >
              {text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
