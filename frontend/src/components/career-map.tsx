"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorNote, LinkButton, Loading, Panel, Tag } from "./kit";
import { Mascot } from "./mascot";

// Career Map (docs/CAREER_VIZ_DISCOVERY.md): the 14 roles as a constellation. Families are clusters, lines join roles whose
// postings ask for many of the same skills, node size is how many postings back the role, and brightness is how much of
// what employers ask the student can already show. Brightness is continuous on purpose: there is no fake "unlocked" moment.

export interface CareerNode { id: string; name: string; family: string; n_postings: number; limited_data: boolean; n_skills: number }
interface CareerGraph { nodes: CareerNode[]; edges: { a: string; b: string; overlap: number; shared: number }[]; families: Record<string, string> }
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
}
export interface CareersData { careers: Career[]; any_evidence: boolean }

// Drawn at a fixed, roomy size and scrolled inside a frame, so labels never shrink to fit a narrow column.
const W = 1640;
const H = 900;
// Family positions are placed by hand (7 fixed families): related families sit next to each other, the big clusters
// (data, software, infra) get room, and single-role families sit along the bottom. Positions never move between visits.
const FAMILY_SPOT: Record<string, { x: number; y: number; ring: number; label: "above" | "below" }> = {
  business: { x: 170, y: 330, ring: 0, label: "above" },
  data: { x: 540, y: 300, ring: 140, label: "above" },
  software: { x: 1080, y: 290, ring: 170, label: "above" },
  infra: { x: 1420, y: 640, ring: 130, label: "below" },
  finance: { x: 230, y: 700, ring: 0, label: "below" },
  marketing: { x: 590, y: 720, ring: 0, label: "below" },
  design: { x: 960, y: 720, ring: 0, label: "below" },
};

interface Placed { x: number; y: number; lx: number; ly: number; anchor: "start" | "middle" | "end" }

/** Roles on a small ring around their family's spot, labels pushed away from the family centre. */
function layout(nodes: CareerNode[], radius: (n: CareerNode) => number) {
  const pos: Record<string, Placed> = {};
  const fam: Record<string, { x: number; y: number }> = {};
  let extra = 0;
  for (const f of new Set(nodes.map((n) => n.family))) {
    const spot = FAMILY_SPOT[f] ?? { x: 880, y: 120 + 90 * extra++, ring: 0, label: "below" as const };
    const members = nodes.filter((n) => n.family === f).sort((x, y) => y.n_postings - x.n_postings);
    const ring = members.length > 1 ? spot.ring : 0;
    const biggest = Math.max(...members.map(radius));
    fam[f] = { x: spot.x, y: spot.label === "above" ? spot.y - ring * 0.72 - biggest - 44 : spot.y + ring * 0.72 + biggest + (members.length > 1 ? 70 : 74) };
    members.forEach((n, j) => {
      const b = -Math.PI / 2 + (j / members.length) * Math.PI * 2 + (members.length === 2 ? Math.PI / 2 : 0);
      const x = spot.x + Math.cos(b) * ring;
      const y = spot.y + Math.sin(b) * ring * 0.72;
      // labels always sit under their node: sideways labels ran into the neighbouring family
      pos[n.id] = { x, y, lx: x, ly: y + radius(n) + 24, anchor: "middle" };
    });
  }
  return { pos, fam };
}

const shortName = (n: string) => n.replace(" / ML Engineer", "").replace(" Engineer", " Eng.").replace(" Developer", " Dev.");

export function CareerMap({ sid }: { sid: string }) {
  const graph = useApi<CareerGraph>("/careers/graph");
  const mine = useApi<CareersData>(`/students/${sid}/careers`);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const centred = useRef(false);

  const byId = useMemo(() => Object.fromEntries((mine.data?.careers ?? []).map((c) => [c.id, c])), [mine.data]);
  const maxN = Math.max(1, ...(graph.data?.nodes.map((n) => n.n_postings) ?? [1]));
  const radius = (n: CareerNode) => 26 + 30 * Math.sqrt(n.n_postings / maxN);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lay = useMemo(() => (graph.data ? layout(graph.data.nodes, radius) : null), [graph.data, maxN]);

  // open scrolled so the student's own target is in view (once, after the map first renders)
  useEffect(() => {
    const el = frame.current;
    const tid = mine.data?.careers.find((c) => c.is_target)?.id;
    if (centred.current || !el || !lay || !tid || !lay.pos[tid]) return;
    const tp = lay.pos[tid];
    el.scrollTo({ left: Math.max(0, tp.x - el.clientWidth / 2), top: Math.max(0, tp.y - el.clientHeight / 2) });
    centred.current = true;
  }, [lay, mine.data]);

  if (graph.error || mine.error) return <ErrorNote error={graph.error || mine.error} />;
  if (!graph.data || !mine.data || !lay) return <Loading label="Drawing your career map…" />;

  const target = mine.data.careers.find((c) => c.is_target);

  const focus = selected ?? target?.id ?? null;
  const active = hover ?? focus;
  const linked = new Set(graph.data.edges.filter((e) => e.a === active || e.b === active).flatMap((e) => [e.a, e.b]));
  const sel = focus ? byId[focus] : null;

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Each circle is a career. Brighter means you can already show more of what its job postings ask for; bigger means more postings back it.
        Lines join careers that ask for many of the same skills, so progress on one moves the others too.
        {!mine.data.any_evidence ? " Add evidence or take the quick check to light up the map." : ""}
      </p>
      <Panel className="p-0 sm:p-0">
        <div ref={frame} className="max-h-[70vh] overflow-auto rounded-2xl bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:28px_28px]">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-none" role="group" aria-label="Career map">
            {Object.entries(lay.fam).map(([f, a]) => (
              <text key={f} x={a.x} y={a.y} textAnchor="middle" className="fill-muted-foreground text-[14px] font-semibold uppercase tracking-wider" aria-hidden="true">
                {graph.data!.families[f] ?? f}
              </text>
            ))}
            {graph.data.edges.map((e) => {
              const a = lay.pos[e.a], b = lay.pos[e.b];
              const on = active && (e.a === active || e.b === active);
              return (
                <line key={`${e.a}-${e.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeLinecap="round"
                  style={{ stroke: on ? "var(--indigo)" : "var(--border)", strokeWidth: 1.5 + e.overlap * 9, opacity: on ? 0.75 : active ? 0.35 : 0.8, transition: "opacity 200ms" }} />
              );
            })}
            {graph.data.nodes.map((n) => {
              const c = byId[n.id];
              const p = lay.pos[n.id];
              const r = radius(n);
              const glow = c ? 0.18 + 0.82 * c.readiness : 0.18;
              const dim = active && n.id !== active && !linked.has(n.id);
              return (
                <g key={n.id} transform={`translate(${p.x} ${p.y})`} style={{ opacity: dim ? 0.45 : 1, transition: "opacity 200ms" }}>
                  <circle r={r + 7} style={{ fill: "var(--iris)", opacity: glow * 0.25 }} aria-hidden="true" />
                  {c?.is_target ? <circle r={r + 6} fill="none" strokeWidth={3} style={{ stroke: "var(--iris)" }} aria-hidden="true" /> : null}
                  <circle
                    r={r}
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.name}: you can show ${c ? pct(c.readiness) : "0%"} of what employers ask, ${n.n_postings} postings${n.limited_data ? ", limited data" : ""}${c?.is_target ? ", your target" : ""}`}
                    aria-pressed={focus === n.id}
                    onClick={() => setSelected(n.id)}
                    onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), setSelected(n.id))}
                    onMouseEnter={() => setHover(n.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(n.id)}
                    onBlur={() => setHover(null)}
                    className="cursor-pointer outline-none"
                    style={{ fill: "var(--indigo)", fillOpacity: glow, stroke: focus === n.id ? "var(--ink)" : "var(--card)", strokeWidth: focus === n.id ? 3 : 2,
                      strokeDasharray: n.limited_data ? "5 4" : undefined }}
                  />
                  <text y={4} textAnchor="middle" className="pointer-events-none text-[16px] font-bold" style={{ fill: glow > 0.55 ? "#fff" : "var(--ink)" }} aria-hidden="true">
                    {c ? pct(c.readiness) : "–"}
                  </text>
                  <text x={p.lx - p.x} y={p.ly - p.y} textAnchor={p.anchor} className="pointer-events-none fill-ink text-[16px] font-semibold" aria-hidden="true">
                    {shortName(n.name)}
                    {n.limited_data ? (
                      <tspan x={p.lx - p.x} dy={17} className="fill-muted-foreground text-[12px] font-normal">
                        Beta · {n.n_postings} postings
                      </tspan>
                    ) : null}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <Legend />
      </Panel>
      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside aria-live="polite">{sel ? <CareerPanel sid={sid} c={sel} onTargetChanged={() => mine.reload()} /> : null}</aside>
        <CareerList careers={mine.data.careers} selected={focus} onSelect={setSelected} />
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t px-5 py-4 text-xs text-muted-foreground">
      <li className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: "var(--indigo)", opacity: 0.25 }} /> Little you can show yet</li>
      <li className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: "var(--indigo)" }} /> Much you can show</li>
      <li className="flex items-center gap-2"><span className="size-3 rounded-full border-2" style={{ borderColor: "var(--iris)" }} /> Your target</li>
      <li className="flex items-center gap-2"><span className="size-3 rounded-full border-2 border-dashed" style={{ borderColor: "var(--indigo)" }} /> Beta: fewer than 30 postings</li>
    </ul>
  );
}

function CareerPanel({ sid, c, onTargetChanged }: { sid: string; c: Career; onTargetChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const makeTarget = async () => {
    setBusy(true);
    try {
      await api.patch(`/students/${sid}`, { target_role: c.id });
      toast.success(`${c.name} is now your target. Your route was rebuilt.`);
      onTargetChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change your target.");
    } finally {
      setBusy(false);
    }
  };
  const measuredAll = c.n_measured === 0;
  return (
    <Panel className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-ink">{c.name}</h3>
          {c.is_target ? <Tag tone="indigo">Your target</Tag> : null}
          {c.limited_data ? <Tag tone="ember">Beta</Tag> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {measuredAll ? "Not measured yet" : `You can show ${pct(c.readiness)} of what employers ask`} · {c.n_measured} of {c.n_skills} skills measured ·{" "}
          {c.n_postings} postings
        </p>
      </div>
      <ul className="space-y-3" aria-label="Readiness by area">
        {c.clusters.map((cl) => (
          <li key={cl.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink">{cl.label}</span>
              <span className="tabular text-xs text-muted-foreground">{cl.measured ? pct(cl.coverage) : "Not measured"}</span>
            </div>
            <div className={cn("h-2 overflow-hidden rounded-full", cl.measured ? "bg-muted" : "border border-dashed border-input bg-transparent")}>
              {cl.measured ? <div className="h-full rounded-full" style={{ width: `${Math.max(2, cl.coverage * 100)}%`, background: "var(--route)" }} /> : null}
            </div>
          </li>
        ))}
      </ul>
      {c.top_gaps.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biggest gaps</p>
          <ul className="space-y-1.5 text-sm">
            {c.top_gaps.map((g) => (
              <li key={g.skill_id} className="flex justify-between gap-3">
                <span className="text-ink">{g.name}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">{g.level_now} → {g.level_needed}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {c.is_target ? (
          <LinkButton href="/dashboard" size="lg" className="h-10">See My Route</LinkButton>
        ) : (
          <Button size="lg" className="h-10" onClick={makeTarget} disabled={busy}>
            <Target /> Make This My Target
          </Button>
        )}
        <LinkButton href={`/market?role=${c.id}`} variant="outline" size="lg" className="h-10">See the Postings</LinkButton>
      </div>
      {!c.is_target ? <p className="text-xs text-muted-foreground">Changing your target rebuilds your route. Your evidence stays.</p> : null}
    </Panel>
  );
}

function CareerList({ careers, selected, onSelect }: { careers: Career[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <section aria-labelledby="career-list">
      <div className="mb-4 flex items-center gap-3">
        <Mascot name="signpost" size={56} />
        <h3 id="career-list" className="text-base font-semibold text-ink">All Careers, Closest First</h3>
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
                  {c.n_measured} of {c.n_skills} skills measured · {c.n_postings} postings
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="hidden h-2 w-28 overflow-hidden rounded-full bg-muted sm:block" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(2, c.readiness * 100)}%`, background: "var(--route)" }} />
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
