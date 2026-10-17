"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { LEVEL, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorNote, LinkButton, Loading, NativeSelect, Panel, Tag } from "./kit";
import { Mascot } from "./mascot";
import { MascotLoader } from "./mascot-loader";
import { ChangeList } from "./change-list";
import { useT, type T } from "@/lib/i18n";

// Career Map (docs/design/CAREER_VIZ_DISCOVERY.md): the 14 roles as a constellation. Families are clusters, lines join roles whose
// postings ask for many of the same skills, node size is how many postings back the role, and brightness is how much of
// what employers ask the student can already show. Brightness is continuous on purpose: there is no fake "unlocked" moment.

export interface CareerNode { id: string; name: string; family: string; n_postings: number; limited_data: boolean; n_skills: number }
export interface Career {
  id: string;
  name: string;
  family: string;
  is_target: boolean;
  readiness: number;
  n_skills: number;
  n_measured: number;
  n_postings: number;
  limited_data: boolean;
  clusters: { id: string; label: string; n_skills: number; coverage: number; measured: number }[];
  top_gaps: { skill_id: string; name: string; level_now: string; level_needed: string }[];
  skills: { skill_id: string; name: string }[];
}
export interface CareersData { careers: Career[]; any_evidence: boolean }

const shortName = (n: string) => n.replace(" / ML Engineer", "").replace(" Engineer", " Eng.").replace(" Developer", " Dev.");

// Opportunity matrix (docs/design/CAREER_VIZ_DISCOVERY.md, option B): every career is a dot. Right = how much of what its
// postings ask for the student can already show; up = how many postings back it. The top-right zone answers "which careers
// am I close to that employers also ask for a lot". Careers under 30 postings sit in the Beta band at the bottom.
const VW = 920;
const VH = 520;
const PL = 72;
const PR = 28;
const PT = 26;
const PB = 64;
const READY_SPLIT = 0.4;
const DEMAND_SPLIT = 30;

function scales(careers: Career[]) {
  const xMax = Math.min(1, Math.max(0.6, Math.ceil((Math.max(...careers.map((c) => c.readiness)) + 0.08) * 10) / 10));
  const yMax = Math.max(DEMAND_SPLIT * 2, ...careers.map((c) => c.n_postings)) * 1.08;
  const x = (v: number) => PL + (v / xMax) * (VW - PL - PR);
  // square-root scale: a few careers have 130+ postings and would squash the rest against the axis
  const y = (n: number) => VH - PB - (Math.sqrt(n) / Math.sqrt(yMax)) * (VH - PB - PT);
  const xTicks = Array.from({ length: Math.round(xMax * 10) + 1 }, (_, i) => i / 10).filter((v) => Math.round(v * 10) % 2 === 0);
  const yTicks = [10, 30, 60, 100, 150].filter((t) => t < yMax);
  return { x, y, xMax, yMax, xTicks, yTicks };
}

/** Greedy label placement: try right, left, above, below; keep the first spot that hits no dot and no earlier label. */
function placeLabels(points: { id: string; x: number; y: number; r: number; text: string }[]) {
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = points.map((p) => ({ x0: p.x - p.r, y0: p.y - p.r, x1: p.x + p.r, y1: p.y + p.r }));
  const out: Record<string, { x: number; y: number; anchor: "start" | "end" | "middle"; lead?: { x1: number; y1: number; x2: number; y2: number } }> = {};
  const hit = (b: { x0: number; y0: number; x1: number; y1: number }) => boxes.some((o) => b.x0 < o.x1 && o.x0 < b.x1 && b.y0 < o.y1 && o.y0 < b.y1);
  for (const p of [...points].sort((a, b) => a.x - b.x)) {
    const w = p.text.length * 7.1;
    const opts = [
      { x: p.x + p.r + 7, y: p.y + 4, anchor: "start" as const, b: { x0: p.x + p.r + 5, y0: p.y - 8, x1: p.x + p.r + 9 + w, y1: p.y + 8 } },
      { x: p.x - p.r - 7, y: p.y + 4, anchor: "end" as const, b: { x0: p.x - p.r - 9 - w, y0: p.y - 8, x1: p.x - p.r - 5, y1: p.y + 8 } },
      { x: p.x, y: p.y - p.r - 8, anchor: "middle" as const, b: { x0: p.x - w / 2, y0: p.y - p.r - 22, x1: p.x + w / 2, y1: p.y - p.r - 6 } },
      { x: p.x, y: p.y + p.r + 17, anchor: "middle" as const, b: { x0: p.x - w / 2, y0: p.y + p.r + 4, x1: p.x + w / 2, y1: p.y + p.r + 20 } },
      // diagonals and a wider gap, for crowded corners (the Beta band)
      { x: p.x + p.r + 4, y: p.y - p.r - 6, anchor: "start" as const, b: { x0: p.x + p.r + 2, y0: p.y - p.r - 20, x1: p.x + p.r + 6 + w, y1: p.y - p.r - 4 } },
      { x: p.x + p.r + 4, y: p.y + p.r + 15, anchor: "start" as const, b: { x0: p.x + p.r + 2, y0: p.y + p.r + 2, x1: p.x + p.r + 6 + w, y1: p.y + p.r + 18 } },
      { x: p.x - p.r - 4, y: p.y - p.r - 6, anchor: "end" as const, b: { x0: p.x - p.r - 6 - w, y0: p.y - p.r - 20, x1: p.x - p.r - 2, y1: p.y - p.r - 4 } },
      { x: p.x - p.r - 4, y: p.y + p.r + 15, anchor: "end" as const, b: { x0: p.x - p.r - 6 - w, y0: p.y + p.r + 2, x1: p.x - p.r - 2, y1: p.y + p.r + 18 } },
      { x: p.x + p.r + 22, y: p.y + 4, anchor: "start" as const, b: { x0: p.x + p.r + 20, y0: p.y - 8, x1: p.x + p.r + 24 + w, y1: p.y + 8 } },
      { x: p.x - p.r - 22, y: p.y + 4, anchor: "end" as const, b: { x0: p.x - p.r - 24 - w, y0: p.y - 8, x1: p.x - p.r - 20, y1: p.y + 8 } },
    ] as { x: number; y: number; anchor: "start" | "end" | "middle"; b: { x0: number; y0: number; x1: number; y1: number }; lead?: boolean }[];
    // last resort: further out with a leader line back to the dot
    for (const dy of [-26, 26, -42, 42, -58, 58])
      for (const side of [1, -1]) {
        const lx = p.x + side * (p.r + 34);
        opts.push({ x: lx, y: p.y + dy + 4, anchor: side > 0 ? "start" : "end", lead: true,
          b: side > 0 ? { x0: lx - 2, y0: p.y + dy - 8, x1: lx + w + 2, y1: p.y + dy + 8 } : { x0: lx - w - 2, y0: p.y + dy - 8, x1: lx + 2, y1: p.y + dy + 8 } });
      }
    const fit = opts.filter((o) => o.b.x0 > PL - 4 && o.b.x1 < VW - 2 && o.b.y0 > PT - 4 && o.b.y1 < VH - PB + 4);
    const pick = fit.find((o) => !hit(o.b)) ?? fit[0];
    if (!pick) continue;
    boxes.push(pick.b);
    out[p.id] = { x: pick.x, y: pick.y, anchor: pick.anchor, lead: pick.lead ? { x1: p.x + Math.sign(pick.x - p.x) * p.r, y1: p.y, x2: pick.x - Math.sign(pick.x - p.x) * 3, y2: pick.y - 4 } : undefined };
  }
  return out;
}

export function CareerMap({ sid }: { sid: string }) {
  const mine = useApi<CareersData>(`/students/${sid}/careers`);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const t = useT();
  // readiness the student saw last time, kept on this device only; differences pulse on the map and are listed in text
  const [seen, setSeen] = useState<Record<string, number> | null>(null);
  const seenKey = `pathsync.careers.seen.${sid}`;
  useEffect(() => {
    if (!mine.data) return;
    try {
      const raw = localStorage.getItem(seenKey);
      setSeen(raw ? JSON.parse(raw) : {});
      localStorage.setItem(seenKey, JSON.stringify(Object.fromEntries(mine.data.careers.map((c) => [c.id, c.readiness]))));
    } catch {
      setSeen({});
    }
  }, [mine.data, seenKey]);

  const byId = useMemo(() => Object.fromEntries((mine.data?.careers ?? []).map((c) => [c.id, c])), [mine.data]);
  const sc = useMemo(() => (mine.data ? scales(mine.data.careers) : null), [mine.data]);
  const labels = useMemo(
    () => (mine.data && sc ? placeLabels(mine.data.careers.map((c) => ({ id: c.id, x: sc.x(c.readiness), y: sc.y(c.n_postings), r: c.is_target ? 11 : 9, text: shortName(c.name) }))) : {}),
    [mine.data, sc],
  );

  if (mine.error) return <ErrorNote error={mine.error} />;
  if (!mine.data || !sc) return <Loading label={t("Drawing your career map…", "Menggambar career map-mu…")} />;

  const target = mine.data.careers.find((c) => c.is_target);
  const focus = selected ?? target?.id ?? null;
  const sel = focus ? byId[focus] : null;
  const hov = hover ? byId[hover] : null;
  const changes = seen
    ? mine.data.careers
        .filter((c) => seen[c.id] !== undefined && Math.abs(c.readiness - seen[c.id]) >= 0.01)
        .map((c) => ({ id: c.id, name: c.name, before: seen[c.id], now: c.readiness }))
        .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
    : [];
  const changed: Record<string, "up" | "down"> = Object.fromEntries(changes.map((x) => [x.id, x.now > x.before ? "up" : "down"]));
  const xs = sc.x(READY_SPLIT);
  const ys = sc.y(DEMAND_SPLIT);

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        {t(
          "Each dot is a career. Further right means you can already show more of what its job postings ask for; higher means more postings ask for it. Hover a dot for its areas, click or tap it for the full picture.",
          "Setiap titik adalah satu karier. Makin ke kanan, makin banyak yang diminta job posting-nya yang sudah bisa kamu tunjukkan; makin ke atas, makin banyak posting yang memintanya. Arahkan kursor ke titik untuk melihat area-nya, klik atau tap untuk gambaran lengkap.",
        )}
        {!mine.data.any_evidence ? t(" Add evidence or take the quick check to move the dots.", " Tambahkan evidence atau ikuti Quick Check untuk menggerakkan titiknya.") : ""}
      </p>
      <Panel className="p-0 sm:p-0">
        {/* below ~680px the labels would shrink past legibility, so the chart keeps its size and scrolls sideways */}
        <div className="overflow-x-auto">
        <div className="relative min-w-[680px]" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto w-full" role="group" aria-label={t("Opportunity matrix of careers", "Matriks peluang karier")}>
            <rect x={xs} y={PT} width={VW - PR - xs} height={ys - PT} rx={14} style={{ fill: "var(--secondary)" }} aria-hidden="true" />
            <text x={VW - PR - 14} y={PT + 22} textAnchor="end" className="text-[13px] font-semibold" style={{ fill: "var(--secondary-foreground)" }} aria-hidden="true">
              {t("Close and in demand", "Dekat dan banyak dicari")}
            </text>
            <rect x={PL} y={ys} width={VW - PL - PR} height={VH - PB - ys} style={{ fill: "var(--muted)", opacity: 0.6 }} aria-hidden="true" />
            <text x={PL + 10} y={VH - PB - 10} className="fill-muted-foreground text-[11.5px]" aria-hidden="true">
              {t(`Beta: fewer than ${DEMAND_SPLIT} postings, read with care`, `Beta: kurang dari ${DEMAND_SPLIT} posting, baca dengan hati-hati`)}
            </text>
            {sc.xTicks.map((v) => (
              <g key={`x${v}`} aria-hidden="true">
                <line x1={sc.x(v)} x2={sc.x(v)} y1={PT} y2={VH - PB} style={{ stroke: "var(--border)" }} />
                <text x={sc.x(v)} y={VH - PB + 20} textAnchor="middle" className="fill-muted-foreground text-[12px]">{Math.round(v * 100)}%</text>
              </g>
            ))}
            {sc.yTicks.map((v) => (
              <g key={`y${v}`} aria-hidden="true">
                <line x1={PL} x2={VW - PR} y1={sc.y(v)} y2={sc.y(v)} style={{ stroke: "var(--border)" }} />
                <text x={PL - 10} y={sc.y(v) + 4} textAnchor="end" className="fill-muted-foreground text-[12px]">{v}</text>
              </g>
            ))}
            <text x={(PL + VW - PR) / 2} y={VH - 14} textAnchor="middle" className="fill-ink text-[12.5px] font-medium" aria-hidden="true">
              {t("How much of what employers ask you can show →", "Seberapa banyak permintaan employer yang bisa kamu tunjukkan →")}
            </text>
            <text x={18} y={(PT + VH - PB) / 2} textAnchor="middle" transform={`rotate(-90 18 ${(PT + VH - PB) / 2})`} className="fill-ink text-[12.5px] font-medium" aria-hidden="true">
              {t("Job postings →", "Job posting →")}
            </text>
            {mine.data.careers.map((c) => {
              const cx = sc.x(c.readiness);
              const cy = sc.y(c.n_postings);
              const r = c.is_target ? 11 : 9;
              const lb = labels[c.id];
              const on = hover === c.id || focus === c.id;
              return (
                <g key={c.id}>
                  {changed[c.id] ? (
                    <circle cx={cx} cy={cy} r={r + 5} fill="none" strokeWidth={3} className="career-pulse" aria-hidden="true"
                      style={{ stroke: changed[c.id] === "up" ? "var(--mint)" : "var(--destructive)" }} />
                  ) : null}
                  {c.is_target ? <circle cx={cx} cy={cy} r={r + 5} fill="none" strokeWidth={2.5} style={{ stroke: "var(--iris)" }} aria-hidden="true" /> : null}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={on ? r + 2 : r}
                    role="button"
                    tabIndex={0}
                    aria-label={t(
                      `${c.name}: you can show ${pct(c.readiness)} of what employers ask, ${c.n_postings} postings${c.limited_data ? ", limited data" : ""}${c.is_target ? ", your target" : ""}`,
                      `${c.name}: kamu bisa menunjukkan ${pct(c.readiness)} dari yang diminta employer, ${c.n_postings} posting${c.limited_data ? ", data terbatas" : ""}${c.is_target ? ", target-mu" : ""}`,
                    )}
                    aria-pressed={focus === c.id}
                    onClick={() => setSelected(c.id)}
                    onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), setSelected(c.id))}
                    onMouseEnter={() => setHover(c.id)}
                    onFocus={() => setHover(c.id)}
                    onBlur={() => setHover(null)}
                    className="cursor-pointer outline-none transition-[r] duration-150"
                    style={{ fill: c.limited_data ? "var(--card)" : "var(--indigo)", stroke: "var(--indigo)", strokeWidth: c.limited_data ? 2 : on ? 3 : 0,
                      strokeDasharray: c.limited_data ? "3 2" : undefined }}
                  />
                  {lb?.lead ? <line {...lb.lead} strokeWidth={1} style={{ stroke: "var(--input)" }} aria-hidden="true" /> : null}
                  {lb ? (
                    <text x={lb.x} y={lb.y} textAnchor={lb.anchor} className={cn("pointer-events-none text-[12.5px]", on || c.is_target ? "fill-ink font-semibold" : "fill-muted-foreground")} aria-hidden="true">
                      {shortName(c.name)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {hov ? <HoverCard c={hov} x={sc.x(hov.readiness) / VW} y={sc.y(hov.n_postings) / VH} /> : null}
        </div>
        </div>
        <Legend />
      </Panel>
      {changes.length ? (
        <section role="status" aria-labelledby="since-last" className="rounded-2xl border bg-card px-6 py-5">
          <div className="flex items-center gap-3">
            <MascotLoader size={44} className="shrink-0" />
            <div>
              <h3 id="since-last" className="text-base font-semibold text-ink">{t("Since Your Last Visit", "Sejak Kunjungan Terakhirmu")}</h3>
              <p className="text-xs text-muted-foreground">{t("Careers your new evidence moved, biggest change first.", "Karier yang bergerak karena evidence barumu, perubahan terbesar dulu.")}</p>
            </div>
          </div>
          <ChangeList className="mt-3" items={changes.slice(0, 5).map((x) => ({ ...x, target: byId[x.id]?.is_target }))} />
        </section>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside aria-live="polite">{sel ? <CareerPanel sid={sid} c={sel} all={mine.data.careers} onTargetChanged={() => mine.reload()} /> : null}</aside>
        <CareerList careers={mine.data.careers} selected={focus} onSelect={setSelected} />
      </div>
    </div>
  );
}

/** Floating details for the hovered dot: readiness, sample size, a small radar of the areas and the biggest gap. */
function HoverCard({ c, x, y }: { c: Career; x: number; y: number }) {
  const left = x > 0.55;
  const t = useT();
  return (
    <div
      className="pointer-events-none absolute z-10 hidden w-[280px] rounded-2xl border bg-card p-4 shadow-lg sm:block"
      style={{ left: left ? undefined : `calc(${x * 100}% + 18px)`, right: left ? `calc(${(1 - x) * 100}% + 18px)` : undefined, top: `clamp(8px, calc(${y * 100}% - 120px), calc(100% - 330px))` }}
      role="tooltip"
    >
      <p className="font-semibold text-ink">{c.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        <span className="font-semibold text-ink">{c.n_measured ? pct(c.readiness) : t("Not measured", "Belum terukur")}</span> ·{" "}
        {t(`${c.n_measured} of ${c.n_skills} skills measured · ${c.n_postings} postings`, `${c.n_measured} dari ${c.n_skills} skill terukur · ${c.n_postings} posting`)}
        {c.limited_data ? " · Beta" : ""}
      </p>
      <Radar a={c} b={null} size={220} />
      {c.top_gaps[0] ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("Biggest gap", "Gap terbesar")}: <span className="text-ink">{c.top_gaps[0].name}</span> ({lvl(t, c.top_gaps[0].level_now)} → {lvl(t, c.top_gaps[0].level_needed)})
        </p>
      ) : null}
    </div>
  );
}

function Legend() {
  const t = useT();
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t px-5 py-4 text-xs text-muted-foreground">
      <li className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: "var(--indigo)" }} /> {t("Career", "Karier")}</li>
      <li className="flex items-center gap-2"><span className="size-3 rounded-full border-2" style={{ borderColor: "var(--iris)" }} /> {t("Your target", "Target-mu")}</li>
      <li className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-dashed" style={{ borderColor: "var(--indigo)" }} /> {t("Beta: fewer than 30 postings", "Beta: kurang dari 30 posting")}</li>
      <li className="flex items-center gap-2"><span className="h-3 w-5 rounded" style={{ background: "var(--secondary)" }} /> {t("Close and in demand", "Dekat dan banyak dicari")}</li>
    </ul>
  );
}

function CareerPanel({ sid, c, all, onTargetChanged }: { sid: string; c: Career; all: Career[]; onTargetChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [otherId, setOtherId] = useState("");
  const t = useT();
  const other = all.find((x) => x.id === otherId && x.id !== c.id) ?? null;
  const makeTarget = async () => {
    setBusy(true);
    try {
      await api.patch(`/students/${sid}`, { target_role: c.id });
      toast.success(t(`${c.name} is now your target. Your route was rebuilt.`, `${c.name} sekarang target-mu. Rutemu sudah disusun ulang.`));
      onTargetChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Couldn't change your target.", "Gagal mengganti target-mu."));
    } finally {
      setBusy(false);
    }
  };
  const shared = other ? c.skills.filter((s) => other.skills.some((o) => o.skill_id === s.skill_id)) : [];
  return (
    <Panel className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-ink">{c.name}</h3>
          {c.is_target ? <Tag tone="indigo">{t("Your target", "Target-mu")}</Tag> : null}
          {c.limited_data ? <Tag tone="ember">Beta</Tag> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {c.n_measured === 0 ? t("Not measured yet", "Belum terukur") : t(`You can show ${pct(c.readiness)} of what employers ask`, `Kamu bisa menunjukkan ${pct(c.readiness)} dari yang diminta employer`)} ·{" "}
          {t(`${c.n_measured} of ${c.n_skills} skills measured · ${c.n_postings} postings`, `${c.n_measured} dari ${c.n_skills} skill terukur · ${c.n_postings} posting`)}
        </p>
      </div>
      <Radar a={c} b={other} />
      <div>
        <label htmlFor="compare-role" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("Compare with", "Bandingkan dengan")}
        </label>
        <NativeSelect id="compare-role" value={otherId} onChange={(e) => setOtherId(e.target.value)} className="mt-1.5">
          <option value="">{t("No comparison", "Tanpa perbandingan")}</option>
          {all
            .filter((x) => x.id !== c.id)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({pct(x.readiness)})
              </option>
            ))}
        </NativeSelect>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("Readiness by area", "Readiness per area")}{other ? t(` compared with ${other.name}`, ` dibandingkan dengan ${other.name}`) : ""}</caption>
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="pb-2 font-medium">Area</th>
            <th className="pb-2 text-right font-medium">{other ? shortName(c.name) : t("You", "Kamu")}</th>
            {other ? <th className="pb-2 pl-3 text-right font-medium">{shortName(other.name)}</th> : null}
          </tr>
        </thead>
        <tbody>
          {areaRows(c, other).map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-2 pr-3 text-ink">{row.label}</td>
              <td className="tabular py-2 text-right">{cell(row.a, t)}</td>
              {other ? <td className="tabular py-2 pl-3 text-right">{cell(row.b, t)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {other ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`${shared.length} skill${shared.length === 1 ? "" : "s"} both ask for`, `${shared.length} skill diminta keduanya`)}
          </p>
          <p className="mt-1.5 text-sm text-ink/80">
            {shared.length ? shared.slice(0, 8).map((s) => s.name).join(", ") + (shared.length > 8 ? ", …" : "") : t("None at Basic level or above.", "Tidak ada di level Dasar atau lebih.")}
          </p>
        </div>
      ) : c.top_gaps.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Biggest gaps", "Gap terbesar")}</p>
          <ul className="space-y-1.5 text-sm">
            {c.top_gaps.map((g) => (
              <li key={g.skill_id} className="flex justify-between gap-3">
                <span className="text-ink">{g.name}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">
                  {lvl(t, g.level_now)} → {lvl(t, g.level_needed)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {c.is_target ? (
          <LinkButton href="/dashboard" size="lg" className="h-10">
            {t("See My Route", "Lihat Ruteku")}
          </LinkButton>
        ) : (
          <Button size="lg" className="h-10" onClick={makeTarget} disabled={busy}>
            <Target /> {t("Make This My Target", "Jadikan Target-ku")}
          </Button>
        )}
        <LinkButton href={`/market?role=${c.id}`} variant="outline" size="lg" className="h-10">
          {t("See the Postings", "Lihat Posting-nya")}
        </LinkButton>
      </div>
      {!c.is_target ? <p className="text-xs text-muted-foreground">{t("Changing your target rebuilds your route. Your evidence stays.", "Mengganti target akan menyusun ulang rutemu. Evidence-mu tetap.")}</p> : null}
    </Panel>
  );
}

type Cell = { coverage: number; measured: boolean } | null;
const cell = (x: Cell, t: T) => (x === null ? "–" : x.measured ? pct(x.coverage) : t("Not measured", "Belum terukur"));
const lvl = (t: T, code: string) => (LEVEL[code] ? t(...LEVEL[code]) : code);

/** One row per area either career asks for; null = that career's postings never ask for the area. */
function areaRows(a: Career, b: Career | null) {
  const ids = [...a.clusters.map((x) => x.id), ...(b?.clusters ?? []).map((x) => x.id).filter((id) => !a.clusters.some((y) => y.id === id))];
  const label = Object.fromEntries([...a.clusters, ...(b?.clusters ?? [])].map((x) => [x.id, x.label]));
  const get = (c: Career | null, id: string): Cell => {
    const x = c?.clusters.find((y) => y.id === id);
    return x ? { coverage: x.coverage, measured: x.measured > 0 } : null;
  };
  return ids.map((id) => ({ id, label: label[id] as string, a: get(a, id), b: get(b, id) }));
}

/** Readiness per area as a radar. Only measured areas are joined by the shape; unmeasured axes are dashed, never drawn as zero. */
function Radar({ a, b, size = 320 }: { a: Career; b: Career | null; size?: number }) {
  const t = useT();
  const rows = areaRows(a, b).slice(0, 7);
  if (rows.length < 3) return null;
  const S = size;
  const C = S / 2;
  const R = S * 0.29;
  const pt = (i: number, v: number): [number, number] => {
    const ang = -Math.PI / 2 + (i / rows.length) * Math.PI * 2;
    return [C + Math.cos(ang) * R * v, C + Math.sin(ang) * R * v];
  };
  const shape = (which: "a" | "b") => {
    const out: [number, number][] = [];
    rows.forEach((r, i) => {
      const v = r[which];
      if (v && v.measured) out.push(pt(i, Math.max(0.02, v.coverage)));
    });
    return out;
  };
  const poly = (pts: [number, number][]) => pts.map((p) => p.join(",")).join(" ");
  const sa = shape("a");
  const sb = b ? shape("b") : [];
  return (
    <figure>
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-auto w-full" style={{ maxWidth: S }} role="img" aria-label={t(`Readiness by area for ${a.name}${b ? ` and ${b.name}` : ""}`, `Readiness per area untuk ${a.name}${b ? ` dan ${b.name}` : ""}`)}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={poly(rows.map((_, i) => pt(i, f)))} fill="none" style={{ stroke: "var(--border)" }} />
        ))}
        {rows.map((r, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.22);
          const measured = !!(r.a?.measured || r.b?.measured);
          return (
            <g key={r.id}>
              <line x1={C} y1={C} x2={x} y2={y} strokeDasharray={measured ? undefined : "4 4"} style={{ stroke: "var(--input)" }} />
              <text
                x={lx}
                y={ly}
                textAnchor={lx < C - 10 ? "end" : lx > C + 10 ? "start" : "middle"}
                dominantBaseline="middle"
                className={cn("text-[10.5px]", measured ? "fill-ink" : "fill-muted-foreground")}
              >
                {r.label.length > 18 ? r.label.slice(0, 17) + "…" : r.label}
              </text>
            </g>
          );
        })}
        {sb.length >= 3 ? (
          <polygon points={poly(sb)} strokeWidth={2} strokeDasharray="6 4" style={{ fill: "var(--ember)", fillOpacity: 0.18, stroke: "var(--ember-ink)" }} />
        ) : null}
        {sa.length >= 3 ? <polygon points={poly(sa)} strokeWidth={2} style={{ fill: "var(--indigo)", fillOpacity: 0.2, stroke: "var(--indigo)" }} /> : null}
        {sa.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} style={{ fill: "var(--indigo)" }} />
        ))}
        {sb.map(([x, y], i) => (
          <circle key={`b${i}`} cx={x} cy={y} r={4} strokeWidth={2} style={{ fill: "var(--card)", stroke: "var(--ember-ink)" }} />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: "var(--indigo)" }} /> {shortName(a.name)}
        </span>
        {b ? (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: "var(--ember-ink)" }} /> {shortName(b.name)}
          </span>
        ) : null}
        <span>{t("Dashed axis = not measured yet", "Sumbu putus-putus = belum terukur")}</span>
      </figcaption>
    </figure>
  );
}

function CareerList({ careers, selected, onSelect }: { careers: Career[]; selected: string | null; onSelect: (id: string) => void }) {
  const t = useT();
  return (
    <section aria-labelledby="career-list">
      <div className="mb-4 flex items-center gap-3">
        <Mascot name="signpost" size={56} />
        <h3 id="career-list" className="text-base font-semibold text-ink">{t("All Careers, Closest First", "Semua Karier, Terdekat Dulu")}</h3>
      </div>
      <ul className="divide-y rounded-2xl border bg-card">
        {careers.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-pressed={selected === c.id}
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors duration-100 hover:bg-muted/60 active:bg-secondary/60",
                selected === c.id && "bg-secondary/50",
              )}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{c.name}</span>
                  {c.is_target ? <Tag tone="indigo">Target</Tag> : null}
                  {c.limited_data ? <Tag tone="ember">Beta</Tag> : null}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t(`${c.n_measured} of ${c.n_skills} skills measured · ${c.n_postings} postings`, `${c.n_measured} dari ${c.n_skills} skill terukur · ${c.n_postings} posting`)}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="hidden h-2 w-28 overflow-hidden rounded-full bg-muted sm:block" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(2, c.readiness * 100)}%`, background: "var(--indigo)" }} />
                </span>
                <span className="tabular w-12 text-right font-semibold text-ink">{c.n_measured ? pct(c.readiness) : "–"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
