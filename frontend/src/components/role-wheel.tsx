"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";
import { Tag } from "./kit";

type Role = { id: string; name: string; family: string; blurb: string; n_postings: number; limited_data: boolean };

const ROW = 60;     // one career per row
const VISIBLE = 5;  // rows in view; the middle one is the pick

/** "I want to become ___": every career on one drum you scroll, like picking a time on a phone alarm. The row in the
 * middle is the pick; the rest tilt away. Snap scrolling does the physics, so it works with a wheel, a trackpad, a
 * finger or the arrow keys, and clicking a row brings it to the middle. */
export function RoleWheel({ roles, families, onStart }: { roles: Role[]; families?: Record<string, string>; onStart: (id: string) => void }) {
  const t = useT();
  const drum = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0); // fractional row under the middle band
  const index = Math.max(0, Math.min(roles.length - 1, Math.round(pos)));
  const pick = roles[index];

  // read the drum's position once per frame while it scrolls
  const raf = useRef(0);
  const onScroll = () => {
    raf.current ||= requestAnimationFrame(() => {
      raf.current = 0;
      if (drum.current) setPos(drum.current.scrollTop / ROW);
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const go = (i: number) => drum.current?.scrollTo({ top: Math.max(0, Math.min(roles.length - 1, i)) * ROW, behavior: "smooth" });

  if (!pick) return <p className="text-sm text-muted-foreground">{t("Loading careers…", "Memuat karier…")}</p>;
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[auto_1fr_minmax(0,360px)]">
      <p className="text-[32px] font-extrabold leading-tight text-ink sm:text-[44px]">{t("I want to become", "Aku mau jadi")}</p>

      <div className="relative">
        {/* the band that marks the pick */}
        <div className="pointer-events-none absolute inset-x-0 rounded-2xl border border-indigo/25 bg-secondary/70" style={{ top: ROW * 2, height: ROW }} aria-hidden="true" />
        <div
          ref={drum}
          role="listbox"
          aria-label={t("Target career", "Target karier")}
          aria-activedescendant={`wheel-${pick.id}`}
          tabIndex={0}
          onScroll={onScroll}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              go(index + (e.key === "ArrowDown" ? 1 : -1));
            } else if (e.key === "Enter") onStart(pick.id);
          }}
          className="wheel relative snap-y snap-mandatory overflow-y-scroll rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ height: ROW * VISIBLE, perspective: 900, paddingBlock: ROW * 2 }}
        >
          {roles.map((r, i) => {
            const d = i - pos; // rows away from the middle
            return (
              <button
                key={r.id}
                id={`wheel-${r.id}`}
                type="button"
                role="option"
                aria-selected={i === index}
                tabIndex={-1}
                onClick={() => (i === index ? onStart(r.id) : go(i))}
                className={cn("flex w-full snap-center items-center justify-center gap-2 px-4 text-center font-bold leading-none text-ink", i === index ? "text-[26px] sm:text-[30px]" : "text-[22px] sm:text-[26px]")}
                style={{
                  height: ROW,
                  transform: `rotateX(${Math.max(-70, Math.min(70, -d * 22))}deg)`,
                  opacity: Math.max(0.12, 1 - Math.abs(d) * 0.38),
                  transformOrigin: "center",
                }}
              >
                <span className="truncate">{r.name}</span>
                {r.limited_data ? <Tag tone="ember">Beta</Tag> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div key={pick.id} className="wheel-detail">
        <p className="text-sm font-medium text-muted-foreground">{families?.[pick.family] ?? pick.family}</p>
        <p className="mt-2 text-ink/75">{pick.blurb}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {pick.n_postings ? t(`Based on ${pick.n_postings} real postings`, `Berdasarkan ${pick.n_postings} lowongan nyata`) : t("Collecting postings", "Mengumpulkan lowongan")}
        </p>
        <button
          type="button"
          onClick={() => onStart(pick.id)}
          className={cn(buttonVariants({ size: "lg" }), "mt-6")}
        >
          {t(`Start as ${pick.name}`, `Mulai sebagai ${pick.name}`)} <ArrowRight className="size-4" aria-hidden="true" />
        </button>
        <p className="mt-3 text-xs text-muted-foreground">{t("Scroll the list, or use the arrow keys.", "Gulir daftarnya, atau pakai tombol panah.")}</p>
      </div>
    </div>
  );
}
