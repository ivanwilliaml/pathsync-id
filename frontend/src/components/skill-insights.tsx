"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { Competency, Dashboard } from "@/lib/api";
import { CLUSTER_ORDER, LEVEL, num, pct, titleCase } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MasteryBar } from "./kit";

// Skill views: evidence worth proving directly, coverage per area, and every skill.

/** Skills whose level rests on indirect evidence only (grades): the estimate can be high and still need proof.
 * A compact side-column block; the reason is said once when it is the same for every item. */
export function Attention({ items, onOpen }: { items: Dashboard["confirmations"]; onOpen: (id: string) => void }) {
  const t = useT();
  const shown = items.slice(0, 4);
  const same = new Set(shown.map((c) => c.message)).size === 1;
  // a summary first (how many, why); the names and the way to prove each one open on request
  return (
    <section aria-labelledby="attention">
      <h2 id="attention" className="flex items-center gap-1.5 text-sm font-semibold text-ember-ink">
        <AlertTriangle className="size-4" aria-hidden="true" /> {t("Worth proving directly", "Perlu dibuktikan langsung")}
      </h2>
      <p className="mt-1 text-sm text-ink/80">
        <span className="tabular font-semibold text-ink">{items.length}</span> {t("skills known from grades only", "skill hanya dari nilai kuliah")}
      </p>
      <details className="mt-1.5">
        <summary className="cursor-pointer text-sm font-medium text-indigo">{t("See which ones", "Lihat skill-nya")}</summary>
        {same ? <p className="mt-1.5 text-xs text-ink/65">{shown[0].message}</p> : null}
      <ul className="mt-1 divide-y text-sm">
        {shown.map((c, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <button type="button" className="text-left font-medium text-ink underline-offset-2 hover:underline" onClick={() => onOpen(c.skill_id)}>
                {titleCase(c.name)}
              </button>
              {same ? null : <span className="block text-xs text-ink/65">{c.message}</span>}
            </span>
            <a href={`/assessment/${c.skill_id}`} className="shrink-0 text-xs font-medium text-indigo underline-offset-4 hover:underline">
              {t("Prove it", "Buktikan")}
            </a>
          </li>
        ))}
      </ul>
      </details>
    </section>
  );
}

/** Coverage per area; each area opens to the skills inside it. */
export function Areas({ d, measured, onOpen }: { d: Dashboard; measured: boolean; onOpen?: (id: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const order = CLUSTER_ORDER.filter((k) => d.coverage_by_cluster[k]);
  if (!measured)
    return (
      <p className="rounded-xl border bg-card px-4 py-4 text-sm text-ink/70">
        {t(
          "Nothing measured yet. Add your transcript, a certificate or a project, or take the skill check, and your coverage per area appears here.",
          "Belum ada yang terukur. Tambahkan transkrip, sertifikat atau project, atau ikuti Cek Kemampuan, dan coverage per area-mu muncul di sini.",
        )}
      </p>
    );
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {order.map((k) => {
        const c = d.coverage_by_cluster[k];
        const skills = d.competencies.filter((x) => x.cluster === k && x.demand > 0).sort((a, b) => b.demand - a.demand);
        const on = open === k;
        return (
          <li key={k}>
            <button
              type="button"
              aria-expanded={on}
              onClick={() => setOpen(on ? null : k)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-x-4 gap-y-1.5 px-4 py-3 text-left hover:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_200px_64px_20px]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{c.label}</span>
                <span className="block text-xs text-muted-foreground">{t(`${skills.length} skills`, `${skills.length} skill`)}</span>
              </span>
              <MasteryBar value={c.measured === false ? 0 : c.coverage} tone="indigo" label={c.label} className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto" />
              <span className="tabular text-right text-sm font-semibold text-ink">{c.measured === false ? t("Not measured", "Belum terukur") : pct(c.coverage)}</span>
              <ChevronDown className={cn("size-4 text-ink/60 transition-transform", on && "rotate-180")} aria-hidden="true" />
            </button>
            {on ? (
              <ul className="border-t bg-muted/30 px-4 py-1">
                {skills.map((s) => (
                  <li key={s.skill_id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                    <button type="button" onClick={() => onOpen?.(s.skill_id)} className="min-w-0 text-left text-ink underline-offset-2 hover:underline">
                      {titleCase(s.name)}
                    </button>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">
                      {t(...LEVEL[s.level])} · {t(`asked in ${pct(s.demand)}`, `diminta ${pct(s.demand)}`)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const COLS = "sm:grid-cols-[minmax(0,1fr)_190px_72px]";

/** Every skill the role's postings mention, as aligned columns: skill, level now against the role's level, demand. */
export function AllSkills({ comps, onOpen }: { comps: Competency[]; onOpen: (id: string) => void }) {
  const [onlyGaps, setOnlyGaps] = useState(true);
  const t = useT();
  const rows = (onlyGaps ? comps.filter((c) => c.gap > 0.01) : comps).slice().sort((a, b) => b.demand - a.demand);
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <p className="text-sm text-ink/70">{t(`${rows.length} skills, most in-demand first`, `${rows.length} skill, paling dicari dulu`)}</p>
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} className="size-4 accent-indigo" />
          {t("Only skills to improve", "Hanya skill yang perlu ditingkatkan")}
        </label>
      </div>
      <div className={cn("hidden gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-ink/60 sm:grid", COLS)} aria-hidden="true">
        <span>Skill</span>
        <span>{t("Now → role needs", "Sekarang → role butuh")}</span>
        <span className="text-right">{t("Asked in", "Diminta")}</span>
      </div>
      <ul className="divide-y">
        {rows.map((c) => (
          <li key={c.skill_id}>
            <button
              type="button"
              onClick={() => onOpen(c.skill_id)}
              className={cn("grid w-full gap-x-4 gap-y-1.5 px-4 py-2.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:items-center", COLS)}
            >
              <span className="min-w-0 text-sm font-medium text-ink">
                {titleCase(c.name)}
                {c.low_confidence ? <span className="ml-1.5 text-xs font-normal text-ember-ink">{t("little evidence", "bukti tipis")}</span> : null}
              </span>
              <span className="min-w-0">
                <MasteryBar value={c.p} target={c.required} tone="indigo" label={titleCase(c.name)} />
                <span className="tabular mt-1 block text-xs text-ink/65">
                  {t(...LEVEL[c.level])} {num(c.p)} → {num(c.required)}
                  <span className="sm:hidden"> · {t(`asked in ${pct(c.demand)}`, `diminta ${pct(c.demand)}`)}</span>
                </span>
              </span>
              <span className="tabular hidden text-right text-sm text-ink/80 sm:block">{pct(c.demand)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
