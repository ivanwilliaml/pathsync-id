"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ErrorNote, LinkButton, Loading, NativeSelect, Panel, Tag } from "./kit";
import { Mascot } from "./mascot";
import { MascotLoader } from "./mascot-loader";
import { ChangeList } from "./change-list";

// Career Map (docs/design/CAREER_VIZ_DISCOVERY.md): the 14 roles as a constellation. Families are clusters, lines join roles whose
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
  skills: { skill_id: string; name: string }[];
}
export interface CareersData { careers: Career[]; any_evidence: boolean }

// Orderly layout: one column per career family (related families side by side), careers in a column sorted
// closest-first and evenly spaced. Drawn at a fixed size and scrolled inside a frame so text never shrinks.
const FAMILY_ORDER = ["business", "data", "software", "infra", "design", "marketing", "finance"];
const COL_W = 220;
const PAD_X = 30;
const HEAD_Y = 52;
const ROW0 = 140;
const ROW_H = 132;

interface Placed { x: number; y: number }

function layout(nodes: CareerNode[], readiness: (id: string) => number) {
  const fams = [...FAMILY_ORDER.filter((f) => nodes.some((n) => n.family === f)), ...[...new Set(nodes.map((n) => n.family))].filter((f) => !FAMILY_ORDER.includes(f))];
  const pos: Record<string, Placed> = {};
  const cols: { family: string; x: number }[] = [];
  let rows = 1;
  fams.forEach((f, i) => {
    const x = PAD_X + COL_W * i + COL_W / 2;
    cols.push({ family: f, x });
    const members = nodes.filter((n) => n.family === f).sort((a, b) => readiness(b.id) - readiness(a.id) || b.n_postings - a.n_postings);
    rows = Math.max(rows, members.length);
    members.forEach((n, j) => (pos[n.id] = { x, y: ROW0 + j * ROW_H }));
  });
  return { pos, cols, W: PAD_X * 2 + COL_W * fams.length, H: ROW0 + (rows - 1) * ROW_H + 110 };
}

/** Smooth link: across columns an S-curve, inside one column a bow to the right so it does not run through the nodes between. */
function linkPath(a: Placed, b: Placed) {
  if (Math.abs(a.x - b.x) < 1) {
    const bow = 46 + Math.abs(a.y - b.y) * 0.18;
    return `M ${a.x} ${a.y} C ${a.x + bow} ${a.y}, ${b.x + bow} ${b.y}, ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

const shortName = (n: string) => n.replace(" / ML Engineer", "").replace(" Engineer", " Eng.").replace(" Developer", " Dev.");

export function CareerMap({ sid }: { sid: string }) {
  const graph = useApi<CareerGraph>("/careers/graph");
  const mine = useApi<CareersData>(`/students/${sid}/careers`);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const centred = useRef(false);
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
  const maxN = Math.max(1, ...(graph.data?.nodes.map((n) => n.n_postings) ?? [1]));
  const lay = useMemo(() => (graph.data ? layout(graph.data.nodes, (id) => byId[id]?.readiness ?? 0) : null), [graph.data, byId]);

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
  const changes = seen
    ? mine.data.careers
        .filter((c) => seen[c.id] !== undefined && Math.abs(c.readiness - seen[c.id]) >= 0.01)
        .map((c) => ({ id: c.id, name: c.name, before: seen[c.id], now: c.readiness }))
        .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
    : [];
  const changed: Record<string, "up" | "down"> = Object.fromEntries(changes.map((x) => [x.id, x.now > x.before ? "up" : "down"]));

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Each circle is a career. Brighter means you can already show more of what its job postings ask for; bigger means more postings back it.
        Lines join careers that ask for many of the same skills, so progress on one moves the others too.
        {!mine.data.any_evidence ? " Add evidence or take the quick check to light up the map." : ""}
      </p>
      <Panel className="p-0 sm:p-0">
        <div ref={frame} className="max-h-[70vh] overflow-auto rounded-2xl bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:28px_28px]">
          <svg viewBox={`0 0 ${lay.W} ${lay.H}`} width={lay.W} height={lay.H} className="block max-w-none" role="group" aria-label="Career map">
            {lay.cols.map((c) => (
              <g key={c.family} aria-hidden="true">
                <rect x={c.x - COL_W / 2 + 10} y={18} width={COL_W - 20} height={lay.H - 36} rx={18} style={{ fill: "var(--muted)", opacity: 0.45 }} />
                <text x={c.x} y={HEAD_Y} textAnchor="middle" className="fill-muted-foreground text-[12.5px] font-semibold uppercase tracking-wider">
                  {graph.data!.families[c.family] ?? c.family}
                </text>
              </g>
            ))}
            {graph.data.edges.map((e) => {
              const on = active && (e.a === active || e.b === active);
              return (
                <path key={`${e.a}-${e.b}`} d={linkPath(lay.pos[e.a], lay.pos[e.b])} fill="none" strokeLinecap="round"
                  style={{ stroke: on ? "var(--indigo)" : "var(--input)", strokeWidth: 1 + e.overlap * 5, opacity: on ? 0.8 : active ? 0.25 : 0.55, transition: "opacity 200ms" }} />
              );
            })}
            {graph.data.nodes.map((n) => {
              const c = byId[n.id];
              const p = lay.pos[n.id];
              const r = 15 + 11 * Math.sqrt(n.n_postings / maxN);
              const glow = c ? 0.15 + 0.85 * c.readiness : 0.15;
              const dim = active && n.id !== active && !linked.has(n.id);
              return (
                <g key={n.id} transform={`translate(${p.x} ${p.y})`} style={{ opacity: dim ? 0.4 : 1, transition: "opacity 200ms" }}>
                  {changed[n.id] ? (
                    <circle r={r + 4} fill="none" strokeWidth={3} className="career-pulse" aria-hidden="true"
                      style={{ stroke: changed[n.id] === "up" ? "var(--mint)" : "var(--destructive)" }} />
                  ) : null}
                  {c?.is_target ? <circle r={r + 6} fill="none" strokeWidth={2.5} style={{ stroke: "var(--iris)" }} aria-hidden="true" /> : null}
                  <circle r={r} style={{ fill: "var(--card)" }} aria-hidden="true" />
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
                    style={{ fill: "var(--indigo)", fillOpacity: glow, stroke: focus === n.id ? "var(--ink)" : "var(--indigo)", strokeOpacity: focus === n.id ? 1 : 0.35,
                      strokeWidth: focus === n.id ? 2.5 : 1.5, strokeDasharray: n.limited_data ? "4 3" : undefined }}
                  />
                  <text y={r + 22} textAnchor="middle" className="pointer-events-none fill-ink text-[14px] font-semibold" aria-hidden="true">
                    {shortName(n.name)}
                  </text>
                  <text y={r + 40} textAnchor="middle" className="pointer-events-none fill-muted-foreground text-[12px]" aria-hidden="true">
                    <tspan className="fill-ink font-semibold">{c && c.n_measured ? pct(c.readiness) : "–"}</tspan>
                    {` · ${n.n_postings} postings${n.limited_data ? " · Beta" : ""}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <Legend />
      </Panel>
      {changes.length ? (
        <section role="status" aria-labelledby="since-last" className="rounded-2xl border bg-card px-6 py-5">
          <div className="flex items-center gap-3">
            <MascotLoader size={44} className="shrink-0" />
            <div>
              <h3 id="since-last" className="text-base font-semibold text-ink">Since Your Last Visit</h3>
              <p className="text-xs text-muted-foreground">Careers your new evidence moved, biggest change first.</p>
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

function CareerPanel({ sid, c, all, onTargetChanged }: { sid: string; c: Career; all: Career[]; onTargetChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [otherId, setOtherId] = useState("");
  const other = all.find((x) => x.id === otherId && x.id !== c.id) ?? null;
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
  const shared = other ? c.skills.filter((s) => other.skills.some((o) => o.skill_id === s.skill_id)) : [];
  return (
    <Panel className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-ink">{c.name}</h3>
          {c.is_target ? <Tag tone="indigo">Your target</Tag> : null}
          {c.limited_data ? <Tag tone="ember">Beta</Tag> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {c.n_measured === 0 ? "Not measured yet" : `You can show ${pct(c.readiness)} of what employers ask`} · {c.n_measured} of {c.n_skills} skills
          measured · {c.n_postings} postings
        </p>
      </div>
      <Radar a={c} b={other} />
      <div>
        <label htmlFor="compare-role" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Compare with
        </label>
        <NativeSelect id="compare-role" value={otherId} onChange={(e) => setOtherId(e.target.value)} className="mt-1.5">
          <option value="">No comparison</option>
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
        <caption className="sr-only">Readiness by area{other ? ` compared with ${other.name}` : ""}</caption>
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="pb-2 font-medium">Area</th>
            <th className="pb-2 text-right font-medium">{other ? shortName(c.name) : "You"}</th>
            {other ? <th className="pb-2 pl-3 text-right font-medium">{shortName(other.name)}</th> : null}
          </tr>
        </thead>
        <tbody>
          {areaRows(c, other).map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-2 pr-3 text-ink">{row.label}</td>
              <td className="tabular py-2 text-right">{cell(row.a)}</td>
              {other ? <td className="tabular py-2 pl-3 text-right">{cell(row.b)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {other ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {shared.length} skill{shared.length === 1 ? "" : "s"} both ask for
          </p>
          <p className="mt-1.5 text-sm text-ink/80">
            {shared.length ? shared.slice(0, 8).map((s) => s.name).join(", ") + (shared.length > 8 ? ", …" : "") : "None at Basic level or above."}
          </p>
        </div>
      ) : c.top_gaps.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Biggest gaps</p>
          <ul className="space-y-1.5 text-sm">
            {c.top_gaps.map((g) => (
              <li key={g.skill_id} className="flex justify-between gap-3">
                <span className="text-ink">{g.name}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">
                  {g.level_now} → {g.level_needed}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {c.is_target ? (
          <LinkButton href="/dashboard" size="lg" className="h-10">
            See My Route
          </LinkButton>
        ) : (
          <Button size="lg" className="h-10" onClick={makeTarget} disabled={busy}>
            <Target /> Make This My Target
          </Button>
        )}
        <LinkButton href={`/market?role=${c.id}`} variant="outline" size="lg" className="h-10">
          See the Postings
        </LinkButton>
      </div>
      {!c.is_target ? <p className="text-xs text-muted-foreground">Changing your target rebuilds your route. Your evidence stays.</p> : null}
    </Panel>
  );
}

type Cell = { coverage: number; measured: boolean } | null;
const cell = (x: Cell) => (x === null ? "–" : x.measured ? pct(x.coverage) : "Not measured");

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
function Radar({ a, b }: { a: Career; b: Career | null }) {
  const rows = areaRows(a, b).slice(0, 7);
  if (rows.length < 3) return null;
  const S = 320;
  const C = S / 2;
  const R = 92;
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
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-auto w-full max-w-[320px]" role="img" aria-label={`Readiness by area for ${a.name}${b ? ` and ${b.name}` : ""}`}>
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
        <span>Dashed axis = not measured yet</span>
      </figcaption>
    </figure>
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
