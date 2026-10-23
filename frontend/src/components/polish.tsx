"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* The public pages' shared look (Job Market, Methodology, the landing page's closing sections): the same language as
 * the landing hero. Large tight headings with a gradient phrase, frosted cards on hairline rings, pill controls, and
 * motion on one curve (cubic-bezier(.32,.72,0,1)). Every moving part stands still with reduced motion. */

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** true once the element has scrolled into view (and stays true) */
export function useSeen<T extends Element>(margin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) return setSeen(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, seen] as const;
}

/** fades in from a soft blur once seen; `delay` staggers siblings */
export function Rise({ children, delay = 0, className, as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" | "section" }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <Tag ref={ref as never} className={cn("p-rise", className)} data-shown={seen} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** a page's opening: big title with an optional gradient phrase, a calm lead, actions beside it */
export function PageHero({ eyebrow, title, accent, description, actions, children }: {
  eyebrow?: ReactNode; title: ReactNode; accent?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className="pb-10 pt-6 sm:pb-14 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? <p className="hero-rise text-[15px] font-semibold tracking-[-0.01em] text-indigo" style={{ ["--d" as string]: "0ms" }}>{eyebrow}</p> : null}
          <h1 className="hero-rise mt-2 text-balance text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[56px]" style={{ ["--d" as string]: "60ms" }}>
            {title}{accent ? <> <span className="hero-grad">{accent}</span></> : null}
          </h1>
          {description ? (
            <p className="hero-rise mt-5 max-w-2xl text-pretty text-[17px] leading-[1.65] text-ink/65" style={{ ["--d" as string]: "140ms" }}>{description}</p>
          ) : null}
        </div>
        {actions ? <div className="hero-rise flex flex-wrap items-center gap-3" style={{ ["--d" as string]: "220ms" }}>{actions}</div> : null}
      </div>
      {children ? <div className="hero-rise mt-8" style={{ ["--d" as string]: "260ms" }}>{children}</div> : null}
    </header>
  );
}

/** one section of a long page: icon tile, tight heading, optional lead, then its content */
export function Section({ id, icon: Icon, title, accent, lead, action, children, className }: {
  id?: string; icon?: LucideIcon; title: ReactNode; accent?: ReactNode; lead?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("scroll-mt-28", className)}>
      <Rise>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            {Icon ? (
              <span className="p-icon mb-4 flex size-10 items-center justify-center rounded-[12px] text-white">
                <Icon className="size-5" strokeWidth={2.1} aria-hidden="true" />
              </span>
            ) : null}
            <h2 id={id} className="scroll-mt-28 text-balance text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[34px]">
              {title}{accent ? <> <span className="hero-grad">{accent}</span></> : null}
            </h2>
            {lead ? <p className="mt-3 text-pretty text-[16px] leading-[1.65] text-ink/65">{lead}</p> : null}
          </div>
          {action}
        </div>
      </Rise>
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** frosted card on a hairline ring */
export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("p-card rounded-[24px] p-6 sm:p-7", className)} {...props}>
      {children}
    </div>
  );
}

/** iOS segmented control: the white thumb slides to the picked option */
export function Seg<V extends string>({ value, onChange, options, label, className }: {
  value: V; onChange: (v: V) => void; options: [V, ReactNode][]; label: string; className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const b = wrap.current?.querySelector<HTMLElement>(`[data-v="${value}"]`);
      if (b) setThumb({ left: b.offsetLeft, width: b.offsetWidth });
    };
    place();
    const ro = new ResizeObserver(place);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [value, options.length]);
  return (
    <div ref={wrap} role="group" aria-label={label} className={cn("relative inline-flex rounded-full bg-muted/70 p-1 ring-1 ring-inset ring-black/[0.04]", className)}>
      {thumb ? <span className="smh-thumb" aria-hidden="true" style={{ left: thumb.left, width: thumb.width, top: 4, bottom: 4 }} /> : null}
      {options.map(([v, text]) => (
        <button key={v} type="button" data-v={v} aria-pressed={value === v} onClick={() => onChange(v)}
          className={cn("relative z-[1] whitespace-nowrap rounded-full px-4 py-1.5 text-[13.5px] font-semibold tracking-[-0.01em] transition-colors duration-300",
            value === v ? "text-ink" : "text-muted-foreground hover:text-ink")}>
          {text}
        </button>
      ))}
    </div>
  );
}

/** a native select (keyboard and screen readers keep working) dressed as a pill */
export function PillSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select className="p-field h-11 w-full cursor-pointer appearance-none rounded-full pl-5 pr-11 text-[15px] font-semibold tracking-[-0.01em] text-ink" {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink/55" aria-hidden="true" />
    </span>
  );
}

/** a bar that grows to its value once it scrolls into view */
export function GrowBar({ value, color = "var(--indigo)", delay = 0, className, track = true }: {
  value: number; color?: string; delay?: number; className?: string; track?: boolean;
}) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  return (
    <span ref={ref} className={cn("relative block h-1.5 overflow-hidden rounded-full", track && "bg-ink/[0.06]", className)}>
      <span className="p-bar absolute inset-y-0 left-0 rounded-full"
        style={{ width: seen ? `${Math.max(0, Math.min(1, value)) * 100}%` : "0%", background: color, transitionDelay: `${delay}ms` }} />
    </span>
  );
}

/** a figure the way spec sheets show it: hairline above, big gradient number, small unit, label and source */
export function Stat({ value, unit, label, note, delay = 0, size = "text-[40px] sm:text-[46px]", fit }: {
  value: ReactNode; unit?: ReactNode; label: ReactNode; note?: ReactNode; delay?: number; size?: string;
  /** largest size in px: a text value then shrinks to its column's width, so a long figure is never clipped */
  fit?: number;
}) {
  // the gradient is clipped to the text box, so anything wider than the column would vanish: size it to fit instead
  const fitted = fit && typeof value === "string"
    ? { fontSize: `min(${fit}px, calc(100cqi / ${(Math.max(4, value.length) * 0.6).toFixed(2)}))` }
    : undefined;
  return (
    <Rise delay={delay} className={fit ? "min-w-0 [container-type:inline-size]" : undefined}>
      <span className="stat-line block" aria-hidden="true" />
      <p className={cn("stat-num mt-5 whitespace-nowrap font-bold leading-none tracking-[-0.045em]", !fitted && size)} style={fitted}>
        {value}
        {unit ? <span className="stat-unit ml-1 text-[0.5em] tracking-[-0.02em]">{unit}</span> : null}
      </p>
      <p className="mt-3 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">{label}</p>
      {note ? <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{note}</p> : null}
    </Rise>
  );
}
