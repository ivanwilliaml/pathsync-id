"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight, Boxes, Briefcase, ChevronDown, ChevronUp, Code2, Database, Landmark, Megaphone, Palette, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";
import { Tag } from "./kit";

type Role = { id: string; name: string; family: string; blurb: string; n_postings: number; limited_data: boolean };

const ROW = 60;                         // one career per row at the middle of the drum
const VISIBLE = 5;                      // rows in view; the middle one is the pick
const STEP = (20 * Math.PI) / 180;      // angle between two rows on the drum
const RADIUS = ROW / STEP;              // so neighbouring rows sit one ROW apart at the middle
const SETTLE_MS = 140;                  // a wheel or trackpad pause this long snaps to the nearest career

/** colour and icon per career family, for the card */
const FAMILY: Record<string, { tint: string; icon: LucideIcon }> = {
  data: { tint: "#1d6fd8", icon: Database },
  software: { tint: "#6d5bd0", icon: Code2 },
  infra: { tint: "#0f766e", icon: ShieldCheck },
  design: { tint: "#d6457f", icon: Palette },
  business: { tint: "#0891b2", icon: Briefcase },
  marketing: { tint: "#e8613f", icon: Megaphone },
  finance: { tint: "#2f9e57", icon: Landmark },
  management: { tint: "#c2870a", icon: Boxes },
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** "I want to become ___": every career on one drum, like picking a time on a phone alarm. The drum is drawn, not
 * scrolled: the wheel, a trackpad, a drag or the arrow keys move a target, the drum glides to it on a smooth curve and
 * rests on the nearest career once the hand stops, so it never ticks row by row. At either end the page scrolls on. */
export function RoleWheel({ roles, families, onStart }: { roles: Role[]; families?: Record<string, string>; onStart: (id: string) => void }) {
  const t = useT();
  const n = roles.length;
  const stage = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const pos = useRef(0);          // where the drum is (fractional row at the middle)
  const target = useRef(0);       // where it is heading
  const frame = useRef(0);
  const lastT = useRef(0);
  const settle = useRef(0);
  const drag = useRef<{ y: number; start: number; v: number; t: number; moved: boolean } | null>(null);
  const dragged = useRef(false);  // the click that ends a drag must not pick the row under the pointer
  const [index, setIndex] = useState(0);      // the row at the middle right now
  const [shown, setShown] = useState(0);      // the career the card shows: follows `index` once the drum rests

  const clamp = useCallback((v: number) => Math.max(0, Math.min(n - 1, v)), [n]);

  // draw every row on the cylinder for the current position; style writes only, no React render per frame
  const paint = useCallback(() => {
    const p = pos.current;
    rows.current.forEach((el, i) => {
      if (!el) return;
      const th = (i - p) * STEP;
      if (Math.abs(th) > Math.PI / 2.1) {
        el.style.visibility = "hidden";
        return;
      }
      const a = Math.min(1, Math.abs(i - p));
      el.style.visibility = "visible";
      el.style.transform = `translate3d(0, ${ROW * 2 + RADIUS * Math.sin(th)}px, 0) rotateX(${(-th * 180) / Math.PI}deg)`;
      el.style.opacity = String(Math.max(0, Math.cos(th) * 1.15 - 0.15));
      el.style.color = `color-mix(in oklab, var(--ink) ${100 - a * 55}%, var(--muted-foreground))`;
    });
    const i = Math.round(clamp(p));
    setIndex((cur) => (cur === i ? cur : i));
  }, [clamp]);

  // glide towards the target: frame-rate independent easing, no overshoot; stops itself when it arrives
  const tick = useCallback((now: number) => {
    const dt = Math.min(64, now - (lastT.current || now));
    lastT.current = now;
    const d = target.current - pos.current;
    if (drag.current || reducedMotion()) pos.current = target.current;
    else pos.current += d * (1 - Math.exp(-dt / 85));
    if (Math.abs(target.current - pos.current) < 0.0015) pos.current = target.current;
    paint();
    if (pos.current !== target.current || drag.current) frame.current = requestAnimationFrame(tick);
    else {
      frame.current = 0;
      lastT.current = 0;
      if (Number.isInteger(pos.current)) setShown(pos.current);
    }
  }, [paint]);

  const run = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  }, [tick]);

  const go = useCallback((i: number) => {
    target.current = clamp(Math.round(i));
    run();
  }, [clamp, run]);

  useLayoutEffect(() => {
    paint();
  }, [paint, n]);

  // the description box is three lines tall for every career; a longer text steps its size down until it fits whole
  const blurb = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = blurb.current;
    if (!el) return;
    let size = 15;
    el.style.fontSize = `${size}px`;
    while (el.scrollHeight > el.clientHeight + 1 && size > 12.5) el.style.fontSize = `${(size -= 0.5)}px`;
  }, [shown, roles]);
  useEffect(() => () => (cancelAnimationFrame(frame.current), window.clearTimeout(settle.current)), []);

  // wheel and trackpad: move the target continuously, snap after a short pause; let the page scroll at either end.
  // Someone scrolling the page past the drum is not using it: the drum only takes the wheel once the pointer has rested
  // on it for a moment and the page itself is not moving, so the page never gets stuck under the cursor.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let enteredAt = Infinity;
    let pageMovedAt = 0;
    let lastY = window.scrollY;
    const onEnter = () => (enteredAt = performance.now());
    const onLeave = () => (enteredAt = Infinity);
    const onPageScroll = () => {
      if (window.scrollY !== lastY) pageMovedAt = performance.now();
      lastY = window.scrollY;
    };
    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const now = performance.now();
      if (now - enteredAt < 400 || now - pageMovedAt < 300) return;
      if ((dy < 0 && target.current <= 0) || (dy > 0 && target.current >= n - 1)) return;
      e.preventDefault();
      window.clearTimeout(settle.current);
      if (Math.abs(dy) >= 40) {
        // a mouse wheel notch is one career: the drum glides straight to it, nothing to correct afterwards
        go(Math.round(target.current) + Math.sign(dy));
        return;
      }
      // a trackpad streams small deltas: follow them freely, then rest on the nearest career
      target.current = clamp(target.current + dy / (ROW * 1.6));
      run();
      settle.current = window.setTimeout(() => go(target.current), SETTLE_MS);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onPageScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onPageScroll);
    };
  }, [n, clamp, go, run]);

  // drag with a finger, pen or mouse; a flick carries on with its speed, then rests on a career
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, start: target.current, v: 0, t: performance.now(), moved: false };
    dragged.current = false;
    run();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.abs(dy) > 4) {
      g.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (!g.moved) return;
    const now = performance.now();
    const next = clamp(g.start - dy / ROW);
    g.v = (next - target.current) / Math.max(1, now - g.t);   // rows per ms
    g.t = now;
    target.current = next;
  };
  const onPointerUp = () => {
    const g = drag.current;
    drag.current = null;
    dragged.current = !!g?.moved;
    if (g?.moved) go(target.current + g.v * 220);
    else run();
  };

  const pick = roles[index];
  const card = roles[Math.min(shown, n - 1)];
  if (!pick || !card) return <p className="text-sm text-muted-foreground">{t("Loading careers…", "Memuat karier…")}</p>;
  const fam = FAMILY[card.family] ?? FAMILY.business;
  const Icon = fam.icon;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,350px)] lg:gap-10">
      <div>
        <p className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[46px]">{t("I want to become", "Aku mau jadi")}</p>
        <p className="mt-3 text-[15px] font-medium tracking-[-0.01em] text-muted-foreground">
          {t(`${n} careers, built on real job postings`, `${n} karier, berbasis lowongan nyata`)}
        </p>
      </div>

      <div className="relative flex min-w-0 items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <div className="wheel-band pointer-events-none absolute inset-x-0 rounded-[20px]" style={{ top: ROW * 2, height: ROW }} aria-hidden="true" />
          <div
            ref={stage}
            role="listbox"
            aria-label={t("Target career", "Target karier")}
            aria-activedescendant={`wheel-${pick.id}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                go(Math.round(target.current) + (e.key === "ArrowDown" ? 1 : -1));
              } else if (e.key === "Enter") onStart(pick.id);
            }}
            // the drum is drawn, never scrolled: undo any scroll a script or the browser applies to it
            onScroll={(e) => void (e.currentTarget.scrollTop = 0)}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="wheel relative touch-none select-none overflow-hidden rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ height: ROW * VISIBLE, perspective: 900, containerType: "inline-size" }}
          >
            {roles.map((r, i) => (
              <button
                key={r.id}
                ref={(el) => void (rows.current[i] = el)}
                id={`wheel-${r.id}`}
                type="button"
                role="option"
                aria-selected={i === index}
                tabIndex={-1}
                onClick={() => (dragged.current ? null : i === index ? onStart(r.id) : go(i))}
                className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 px-5 text-center font-sans font-bold leading-none tracking-[-0.03em] will-change-transform [backface-visibility:hidden]"
                style={{
                  height: ROW,
                  // each name sizes itself to the drum's width (about 0.54 em per character, plus the Beta tag), up to 28 px
                  fontSize: `min(28px, calc((100cqi - ${r.limited_data ? 110 : 48}px) / ${(r.name.length * 0.54).toFixed(2)}))`,
                }}
              >
                <span className="truncate py-[0.12em]">{r.name}</span>
                {r.limited_data ? <Tag tone="ember" className="rounded-full text-[11px] tracking-normal">Beta</Tag> : null}
              </button>
            ))}
          </div>
        </div>
        {/* small steppers: they say "this list moves" to anyone who would not think to scroll it */}
        <div className="hidden flex-col gap-2 sm:flex">
          <button type="button" onClick={() => go(Math.round(target.current) - 1)} disabled={index === 0} aria-label={t("Previous career", "Karier sebelumnya")} className="wheel-step">
            <ChevronUp className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => go(Math.round(target.current) + 1)} disabled={index === n - 1} aria-label={t("Next career", "Karier berikutnya")} className="wheel-step">
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* the card follows the drum once it rests, so passing careers never flicker through it */}
      <div className="wheel-card min-w-0 overflow-hidden rounded-[28px] lg:w-[350px]" style={{ ["--wheel-tint" as string]: fam.tint }}>
        <div className="wheel-wash relative flex items-end justify-between px-6 pb-4 pt-6 sm:px-7">
          <span key={card.family} className="wheel-icon flex size-[52px] items-center justify-center rounded-[15px] text-white">
            <Icon className="size-6" strokeWidth={2.1} aria-hidden="true" />
          </span>
          {card.limited_data ? (
            <span className="rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-semibold text-ember-ink ring-1 ring-black/[0.05] backdrop-blur">
              Beta
            </span>
          ) : null}
        </div>
        {/* one size for every career: the title keeps one line (long names shrink to fit) and the description always
            takes three lines (short ones leave the room, long ones set a little smaller) */}
        <div className="px-6 pb-6 sm:px-7 sm:pb-7" style={{ containerType: "inline-size" }}>
          <div key={card.id} className="wheel-detail">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--wheel-tint)" }}>
              {families?.[card.family] ?? card.family}
            </p>
            <p className="mt-1.5 h-7 truncate font-bold leading-7 tracking-[-0.025em] text-ink"
              style={{ fontSize: `min(22px, calc(100cqi / ${(card.name.length * 0.56).toFixed(2)}))` }}>{card.name}</p>
            <p ref={blurb} className="mt-2.5 h-[73px] overflow-hidden leading-[1.625] text-ink/65" style={{ fontSize: 15 }}>{card.blurb}</p>
            <div className="mt-5 flex items-baseline gap-2 border-t border-black/[0.06] pt-4">
              {card.n_postings ? (
                <>
                  <span className="text-[13px] font-medium text-muted-foreground">{t("Based on", "Berdasarkan")}</span>
                  <span className="text-[30px] font-bold leading-none tracking-[-0.04em] tabular" style={{ color: "var(--wheel-tint)" }}>{card.n_postings}</span>
                  <span className="whitespace-nowrap text-[13px] font-medium text-muted-foreground">{t("real postings", "lowongan nyata")}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t("Collecting postings", "Mengumpulkan lowongan")}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStart(card.id)}
            className={cn(buttonVariants({ size: "lg" }), "hero-cta group mt-5 h-12 w-full rounded-full px-6 text-[15px] font-semibold")}
          >
            {t("Start this path", "Mulai jalur ini")}
            <ArrowRight className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
