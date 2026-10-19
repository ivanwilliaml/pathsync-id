"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useDesktop } from "@/lib/use-desktop";
import { LEVEL, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorNote, LinkButton, Loading, NativeSelect, PageHeader, Panel, Segmented, Tag } from "./kit";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { MascotLoader } from "./mascot-loader";
import { ChangeList } from "./change-list";
import { MarketPostings, MarketSkills } from "./market-evidence";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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

/** Pilih Karier in two views (?view=). List: your target first, then every other career, beside the workspace of the
 * chosen one (fit, market skills, postings). Matrix: the whole page is the opportunity matrix and a dot opens the same
 * workspace in a side panel. Phones get the list, with the workspace in the panel. ?role= keeps the chosen career. */
export function CareerMap({ sid }: { sid: string }) {
  const mine = useApi<CareersData>(`/students/${sid}/careers`);
  const [selected, setSelectedState] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("role");
    if (q) setSelectedState(q);
  }, []);
  const setSelected = useCallback((id: string) => {
    setSelectedState(id);
    const u = new URL(window.location.href);
    u.searchParams.set("role", id);
    window.history.replaceState(window.history.state, "", u);
  }, []);
  const [hover, setHover] = useState<string | null>(null);
  const close = useCallback(() => {
    setSelectedState(null);
    const u = new URL(window.location.href);
    u.searchParams.delete("role");
    window.history.replaceState(window.history.state, "", u);
  }, []);
  const t = useT();
  const desktop = useDesktop();
  const [mode, setModeState] = useState<"list" | "matrix">("list");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "matrix") setModeState("matrix");
  }, []);
  const setMode = useCallback((v: "list" | "matrix") => {
    setModeState(v);
    const u = new URL(window.location.href);
    if (v === "matrix") u.searchParams.set("view", v);
    else u.searchParams.delete("view");
    u.searchParams.delete("role");
    window.history.replaceState(window.history.state, "", u);
    setSelectedState(null);
  }, []);
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
  // list: the chosen career, your target by default; matrix and phones: only what was opened
  const view = desktop ? mode : "list";
  const inPanel = !desktop || view === "matrix";
  const focus = inPanel ? selected : selected ?? target?.id ?? null;
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

  if (desktop === null) return <Loading label={t("Drawing your career map…", "Menggambar career map-mu…")} />;

  const matrix = (
      <Panel className="p-0 sm:p-0">
        {/* below ~680px the labels would shrink past legibility, so the chart keeps its size and scrolls sideways */}
        <div className="overflow-x-auto">
        <div className="relative mx-auto min-w-[680px]" style={{ maxWidth: "max(680px, calc((100vh - 230px) * 1.77))" }} onMouseLeave={() => setHover(null)}>
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
                      `${c.name}: ${c.n_measured ? `you can show ${pct(c.readiness)} of what employers ask` : "not measured yet"}, ${c.n_postings} postings${c.limited_data ? ", limited data" : ""}${c.is_target ? ", your target" : ""}`,
                      `${c.name}: ${c.n_measured ? `kamu bisa menunjukkan ${pct(c.readiness)} dari yang diminta employer` : "belum terukur"}, ${c.n_postings} posting${c.limited_data ? ", data terbatas" : ""}${c.is_target ? ", target-mu" : ""}`,
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
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Choose a Career", "Pilih Karier")}
        stats={
          view === "matrix" && target
            ? [
                [t("Target", "Target"), target.name],
                [t("Readiness", "Readiness"), target.n_measured ? pct(target.readiness) : "–"],
              ]
            : undefined
        }
        actions={
          desktop ? (
            <Segmented label={t("View", "Tampilan")} value={mode} onChange={setMode} options={[["list", t("List", "Daftar")], ["matrix", t("Matrix", "Matriks")]]} />
          ) : null
        }
      />
      {changes.length ? (
        <section role="status" aria-labelledby="since-last" className="rounded-2xl border bg-card px-6 py-5">
          <div className="flex items-center gap-3">
            <MascotLoader size={44} className="shrink-0" />
            <h3 id="since-last" className="text-base font-semibold text-ink">{t("Since Your Last Visit", "Sejak Kunjungan Terakhirmu")}</h3>
          </div>
          <ChangeList className="mt-3" items={changes.slice(0, 5).map((x) => ({ ...x, target: byId[x.id]?.is_target }))} />
        </section>
      ) : null}
      {view === "matrix" ? (
        matrix
      ) : desktop ? (
        <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <CareerList careers={mine.data.careers} selected={focus} onSelect={setSelected} compact />
          <div aria-live="polite" className="min-w-0">
            {sel ? <CareerWorkspace key={sel.id} sid={sid} c={sel} all={mine.data.careers} onTargetChanged={() => mine.reload()} /> : null}
          </div>
        </div>
      ) : (
        <CareerList careers={mine.data.careers} selected={focus} onSelect={setSelected} />
      )}

      <Sheet open={inPanel && sel !== null} onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetTitle className="sr-only">{sel?.name ?? ""}</SheetTitle>
          <SheetDescription className="sr-only">{t("Fit, skills asked and postings for this career.", "Kecocokan, skill yang diminta, dan lowongan karier ini.")}</SheetDescription>
          <ScrollArea className="min-h-0 flex-1">
            {sel ? <CareerWorkspace key={sel.id} sid={sid} c={sel} all={mine.data.careers} onTargetChanged={() => mine.reload()} bare /> : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>
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

/** The chosen career: identity, readiness and the target action together at the top, then one body at a time:
 * the fit (areas, gaps, comparison), the skills its postings ask for, and the postings themselves. */
function CareerWorkspace({ sid, c, all, onTargetChanged, bare }: { sid: string; c: Career; all: Career[]; onTargetChanged: () => void; bare?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [otherId, setOtherId] = useState("");
  const [chart, setChart] = useState<"bars" | "radar">("bars");
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
  const target = all.find((x) => x.is_target);
  return (
    <Panel className={cn("space-y-7 p-6 sm:p-8 xl:px-10", bare && "rounded-none border-0 pt-12 sm:p-8 sm:pt-12")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {c.is_target ? t("Your target", "Target-mu") : t(`Previewing · your target stays ${target?.name ?? "the same"}`, `Sedang dilihat · target-mu tetap ${target?.name ?? "sama"}`)}
          </p>
          <h3 className="mt-0.5 text-xl font-bold text-ink">{c.name}</h3>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="tabular text-[28px] font-bold leading-none text-ink">{c.n_measured ? pct(c.readiness) : "–"}</span>
            <span className="text-sm text-ink/75">{c.n_measured ? t("ready", "siap") : t("not measured yet", "belum terukur")}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`${c.n_measured} of ${c.n_skills} skills measured · ${c.n_postings} postings`, `${c.n_measured} dari ${c.n_skills} skill terukur · ${c.n_postings} posting`)}
            {c.limited_data ? t(" · Beta: fewer than 30 postings, read with care", " · Beta: kurang dari 30 posting, baca dengan hati-hati") : ""}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          {c.is_target ? (
            <LinkButton href="/learn" size="sm">{t("See My Route", "Lihat Ruteku")}</LinkButton>
          ) : (
            <Button size="sm" onClick={makeTarget} disabled={busy}>
              <Target /> {t("Make This My Target", "Jadikan Target-ku")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="fit">
        <TabsList className="mb-6">
          <TabsTrigger value="fit">{t("Fit", "Kecocokan")}</TabsTrigger>
          <TabsTrigger value="market">{t("Skills Asked", "Skill Pasar")}</TabsTrigger>
          <TabsTrigger value="postings">{t("Postings", "Lowongan")}</TabsTrigger>
        </TabsList>
        <TabsContent value="fit">
          {/* one chart, read either as bars or as a radar; comparing draws the second career into the same chart */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <label htmlFor="compare-role" className="shrink-0 text-sm text-muted-foreground">
                {t("Compare with", "Bandingkan dengan")}
              </label>
              <NativeSelect id="compare-role" value={otherId} onChange={(e) => setOtherId(e.target.value)} className="h-8 w-auto min-w-0 max-w-[16rem] py-0 text-sm">
                <option value="">{t("— choose a career —", "— pilih karier —")}</option>
                {all
                  .filter((x) => x.id !== c.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({x.n_measured ? pct(x.readiness) : "–"})
                    </option>
                  ))}
              </NativeSelect>
            </div>
            <Segmented label={t("Chart", "Grafik")} value={chart} onChange={setChart} options={[["bars", t("Bars", "Batang")], ["radar", "Radar"]]} />
          </div>

          {other ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-indigo" /> {c.name} · <b className="tabular text-ink">{c.n_measured ? pct(c.readiness) : "–"}</b></span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{ background: "var(--ember-ink)" }} /> {other.name} · <b className="tabular text-ink">{other.n_measured ? pct(other.readiness) : "–"}</b></span>
            </div>
          ) : null}

          <div className="mt-6">
            {chart === "bars" ? <AreaBars c={c} other={other} /> : <Radar a={c} b={other} size={380} />}
          </div>

          {other ? (
            <div className="mt-7 border-t pt-5 text-sm">
              <p className="text-ink">
                {compareSentence(c, other, t)}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-indigo">
                  {t(`${shared.length} skill${shared.length === 1 ? "" : "s"} both ask for`, `${shared.length} skill diminta keduanya`)}
                </summary>
                <p className="mt-1 text-ink/80">
                  {shared.length ? shared.map((x) => x.name).join(", ") : t("None at Basic level or above.", "Tidak ada di level Dasar atau lebih.")}
                </p>
              </details>
            </div>
          ) : c.top_gaps.length ? (
            <div className="mt-7 border-t pt-5">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{t("Biggest gaps", "Gap terbesar")}</p>
              <ul className="divide-y text-sm">
                {c.top_gaps.map((g) => (
                  <li key={g.skill_id} className="flex justify-between gap-3 py-1.5">
                    <span className="text-ink">{g.name}</span>
                    <span className="shrink-0 text-xs capitalize text-muted-foreground">
                      {lvl(t, g.level_now)} → {lvl(t, g.level_needed)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="market">
          <MarketSkills role={c.id} />
        </TabsContent>
        <TabsContent value="postings">
          <MarketPostings role={c.id} />
        </TabsContent>
      </Tabs>
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

/** One sentence that says what the comparison means: which career you are closer to, and by how much. */
function compareSentence(a: Career, b: Career, t: T) {
  if (!a.n_measured || !b.n_measured) return t("One of these careers is not measured yet, so they can't be compared.", "Salah satu karier ini belum terukur, jadi belum bisa dibandingkan.");
  const d = Math.round((a.readiness - b.readiness) * 100);
  if (Math.abs(d) < 3) return t(`You are about as ready for both.`, `Kesiapanmu untuk keduanya hampir sama.`);
  const [hi, lo] = d > 0 ? [a, b] : [b, a];
  return t(`You are ${Math.abs(d)} points closer to ${hi.name} than to ${lo.name}.`, `Kamu ${Math.abs(d)} poin lebih siap untuk ${hi.name} dibanding ${lo.name}.`);
}

/** Readiness per area as labelled bars. With a comparison, each area gets a second, thinner bar for the other career;
 * an area a career never asks for says so. Unmeasured areas say so instead of showing 0. */
function AreaBars({ c, other }: { c: Career; other: Career | null }) {
  const t = useT();
  const value = (x: Cell, strong: boolean) =>
    x === null ? <span className="font-normal text-muted-foreground">{t("not asked", "tidak diminta")}</span>
    : x.measured ? <span className={strong ? "font-semibold text-ink" : "font-medium"}>{pct(x.coverage)}</span>
    : <span className="font-normal text-muted-foreground">{t("not measured", "belum terukur")}</span>;
  const bar = (x: Cell, color: string, h: string) => (
    <div className={cn("overflow-hidden rounded-full bg-muted", h)} aria-hidden="true">
      {x?.measured ? <div className="h-full rounded-full" style={{ width: `${Math.max(2, x.coverage * 100)}%`, background: color }} /> : null}
    </div>
  );
  return (
    <ul className="space-y-4" aria-label={t("Readiness by area", "Readiness per area")}>
      {areaRows(c, other).map((r) => (
        <li key={r.id}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 text-ink">{r.label}</span>
            <span className="tabular flex shrink-0 gap-3">
              {value(r.a, true)}
              {other ? <span style={{ color: "var(--ember-ink)" }}>{value(r.b, false)}</span> : null}
            </span>
          </div>
          <div className="mt-1 space-y-1">
            {bar(r.a, "var(--indigo)", "h-1.5")}
            {other ? bar(r.b, "var(--ember-ink)", "h-1") : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Readiness per area as a radar. Only measured areas are joined by the shape; unmeasured axes are dashed, never drawn as zero. */
function Radar({ a, b, size = 320 }: { a: Career; b: Career | null; size?: number }) {
  const t = useT();
  const rows = areaRows(a, b).slice(0, 7);
  if (rows.length < 3) return null;
  const S = size;
  const C = S / 2;
  const R = S * 0.33;
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
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-auto w-full overflow-visible" style={{ maxWidth: S }} role="img" aria-label={t(`Readiness by area for ${a.name}${b ? ` and ${b.name}` : ""}`, `Readiness per area untuk ${a.name}${b ? ` dan ${b.name}` : ""}`)}>
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
                <title>{r.label}</title>
                {r.label.length > 14 ? r.label.slice(0, 13) + "…" : r.label}
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

/** Your target first, then every other career closest first. `compact`: the narrow desktop picker, without bars. */
function CareerList({ careers, selected, onSelect, compact }: { careers: Career[]; selected: string | null; onSelect: (id: string) => void; compact?: boolean }) {
  const t = useT();
  const groups: [string, Career[]][] = [
    [t("Your target", "Target-mu"), careers.filter((c) => c.is_target)],
    [t("Other careers", "Karier lain"), careers.filter((c) => !c.is_target)],
  ];
  return (
    <section aria-labelledby="career-list" className="space-y-5">
      <h3 id="career-list" className="sr-only">{t("Careers", "Karier")}</h3>
      {groups.filter(([, list]) => list.length).map(([label, list]) => (
      <div key={label}>
      <p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="divide-y border-y">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-pressed={selected === c.id}
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left transition-colors duration-100 hover:bg-muted/60 active:bg-secondary/60",
                selected === c.id && "bg-secondary/50",
              )}
            >
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{c.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(`${c.n_postings} postings`, `${c.n_postings} posting`)}
                  {c.limited_data ? t(" · Beta", " · Beta") : ""}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className={cn("hidden h-2 w-28 overflow-hidden rounded-full bg-muted", !compact && "sm:block")} aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(2, c.readiness * 100)}%`, background: "var(--indigo)" }} />
                </span>
                <span className="tabular w-12 text-right font-semibold text-ink">{c.n_measured ? pct(c.readiness) : "–"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      </div>
      ))}
    </section>
  );
}
