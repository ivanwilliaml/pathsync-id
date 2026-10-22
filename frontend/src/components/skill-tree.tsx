"use client";

import { useMemo, useState } from "react";
import { CLUSTER_ORDER, num, pct, titleCase } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface TreeNode {
  id: string;
  name: string;
  cluster: string;
  depth: number;
  demand: number;
  p: number | null;
  required: number | null;
  rank: number | null;
  in_path: boolean;
  path_index: number | null;
  bottleneck?: boolean;
}
export interface TreeEdge {
  id: number;
  from: string;
  to: string;
  status: string;
  active?: boolean;
}

// node size and spacing; "compact" is the landing-page version of the same map
const SIZES = {
  full: { W: 200, H: 54, GAP_X: 88, GAP_Y: 12, HEAD: 34 },
  compact: { W: 168, H: 54, GAP_X: 48, GAP_Y: 12, HEAD: 28 },
};
const PAD = 12;
const TIP_W = 288;  // hover card
const TIP_H = 190;
const HOT = "#e8613f"; // the bottleneck, the one warm colour on the map

/** Which skills to draw: the student's route, top priorities and skills the role asks for, plus everything they build on. */
export function treeScope(nodes: TreeNode[], edges: TreeEdge[], all: boolean): Set<string> {
  if (all) return new Set(nodes.map((n) => n.id));
  const pre: Record<string, string[]> = {};
  edges.forEach((e) => (pre[e.to] ??= []).push(e.from));
  const keep = new Set(nodes.filter((n) => n.in_path || (n.rank != null && n.rank <= 10) || n.demand >= 0.15).map((n) => n.id));
  const stack = [...keep];
  while (stack.length) {
    for (const q of pre[stack.pop()!] ?? []) if (!keep.has(q)) (keep.add(q), stack.push(q));
  }
  return keep;
}

/** Layered prerequisite tree, foundations on the left. Rows are ordered by the barycentre of their neighbours so
 * lines cross as little as possible. Hovering (or picking) a skill lights it, the skills it needs and the skills it
 * opens, fades the rest, and shows its details in a card beside it. */
export function SkillTree({ nodes, edges, focus, onFocus, personal, clusters, lit = true, compact = false, only = null, demand = false, flow = false }: {
  nodes: TreeNode[];
  edges: TreeEdge[];
  focus: string | null;
  onFocus: (id: string) => void;
  personal: boolean;
  clusters: Record<string, string>;
  /** keep the picked skill lit when nothing is hovered (off until the visitor picks a skill) */
  lit?: boolean;
  /** smaller cards, for the landing page */
  compact?: boolean;
  /** a reading of the map (bottleneck, route): only these skills stay lit */
  only?: Set<string> | null;
  /** show how often postings ask for each skill as a bar in the card */
  demand?: boolean;
  /** animate the lit lines, so the direction of "needs first" is visible */
  flow?: boolean;
}) {
  const t = useT();
  const { W, H, GAP_X, GAP_Y, HEAD } = SIZES[compact ? "compact" : "full"];
  const [hover, setHover] = useState<string | null>(null);
  const layout = useMemo(() => {
    const depths = [...new Set(nodes.map((n) => n.depth))].sort((a, b) => a - b);
    const colOf = Object.fromEntries(depths.map((d, i) => [d, i]));
    const cols: TreeNode[][] = depths.map(() => []);
    nodes.forEach((n) => cols[colOf[n.depth]].push(n));
    cols.forEach((c) => c.sort((a, b) => CLUSTER_ORDER.indexOf(a.cluster) - CLUSTER_ORDER.indexOf(b.cluster) || a.name.localeCompare(b.name)));
    const pre: Record<string, string[]> = {};
    const post: Record<string, string[]> = {};
    edges.forEach((e) => ((pre[e.to] ??= []).push(e.from), (post[e.from] ??= []).push(e.to)));
    const rowOf = () => Object.fromEntries(cols.flatMap((c) => c.map((n, i) => [n.id, i / Math.max(1, c.length - 1)])));
    for (let pass = 0; pass < 4; pass++) {
      const order = pass % 2 === 0 ? cols.map((_, i) => i).slice(1) : cols.map((_, i) => i).reverse().slice(1);
      for (const ci of order) {
        const pos = rowOf();
        const nb = pass % 2 === 0 ? pre : post;
        const key = (n: TreeNode) => {
          const xs = (nb[n.id] ?? []).map((id) => pos[id]).filter((v) => v !== undefined);
          return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : pos[n.id];
        };
        cols[ci].sort((a, b) => key(a) - key(b));
      }
    }
    const tallest = Math.max(...cols.map((c) => c.length));
    const at: Record<string, { x: number; y: number }> = {};
    cols.forEach((c, ci) => {
      const offset = ((tallest - c.length) * (H + GAP_Y)) / 2;
      c.forEach((n, ri) => (at[n.id] = { x: PAD + ci * (W + GAP_X), y: HEAD + PAD + offset + ri * (H + GAP_Y) }));
    });
    return { cols, at, width: PAD * 2 + cols.length * W + (cols.length - 1) * GAP_X, height: HEAD + PAD * 2 + tallest * (H + GAP_Y) - GAP_Y, pre, post };
  }, [nodes, edges, W, H, GAP_X, GAP_Y, HEAD]);

  const active = hover ?? (lit ? focus : null);
  // the active skill plus what flows into it and what it flows out to
  const lineage = useMemo(
    () => (active ? new Set([active, ...(layout.pre[active] ?? []), ...(layout.post[active] ?? [])]) : only),
    [active, layout, only],
  );
  const maxDemand = Math.max(0.01, ...nodes.map((n) => n.demand));
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const { at, cols, width, height } = layout;
  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
          {edges.map((e) => {
            const a = at[e.from];
            const b = at[e.to];
            if (!a || !b) return null;
            const lit = active ? e.from === active || e.to === active : !lineage || (lineage.has(e.from) && lineage.has(e.to));
            const hot = !active && !!lineage && byId[e.from]?.bottleneck;
            const x1 = a.x + W;
            const y1 = a.y + H / 2;
            const x2 = b.x;
            const y2 = b.y + H / 2;
            const c = GAP_X / 2;
            return (
              <path
                key={e.id}
                d={`M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`}
                fill="none"
                strokeWidth={lit && lineage ? 2 : 1.25}
                strokeDasharray={flow && lit && lineage ? "5 6" : e.status === "approved" ? undefined : "4 4"}
                className={flow && lit && lineage ? "smh-flow" : undefined}
                style={{ stroke: hot && lit ? HOT : lit && lineage ? "var(--indigo)" : "var(--input)", opacity: lit ? 1 : 0.3, transition: "opacity 300ms, stroke 300ms" }}
              />
            );
          })}
        </svg>
        {cols.map((_, ci) => (
          <p key={ci} className={cn("absolute font-semibold text-muted-foreground", compact ? "text-[11px]" : "text-xs")} style={{ left: PAD + ci * (W + GAP_X), top: 4 }}>
            {ci === 0 ? t("Foundations", "Dasar") : t(`Level ${ci + 1}`, `Tingkat ${ci + 1}`)}
          </p>
        ))}
        {nodes.map((n) => {
          const p = at[n.id];
          const met = personal && n.p != null && n.required != null && n.p >= n.required;
          const dim = lineage && !lineage.has(n.id);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onFocus(n.id)}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover(null)}
              aria-pressed={focus === n.id}
              aria-label={`${titleCase(n.name)}${n.in_path ? t(`, route step ${(n.path_index ?? 0) + 1}`, `, langkah rute ${(n.path_index ?? 0) + 1}`) : ""}`}
              className={cn(
                "absolute flex flex-col justify-between rounded-xl border bg-card px-2.5 py-1.5 text-left transition-[opacity,box-shadow,border-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                n.bottleneck ? "border-2" : n.in_path ? "border-2 border-indigo" : met ? "border-mint/60" : "hover:border-indigo/40",
                active === n.id && "shadow-md ring-2 ring-indigo/30",
                dim && "opacity-30",
              )}
              style={{ left: p.x, top: p.y, width: W, height: H, ...(n.bottleneck ? { borderColor: HOT, boxShadow: `0 0 0 4px color-mix(in oklab, ${HOT} 18%, transparent)` } : {}) }}
            >
              <span className="flex items-start gap-1.5">
                {n.in_path ? (
                  <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-indigo text-[9.5px] font-bold text-white">
                    {(n.path_index ?? 0) + 1}
                  </span>
                ) : null}
                <span className={cn("line-clamp-2 font-medium leading-tight text-ink", compact ? "text-[11px]" : "text-[12px]")}>{titleCase(n.name)}</span>
              </span>
              {demand && !personal ? (
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="relative block h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-indigo/70" style={{ width: `${(n.demand / maxDemand) * 100}%` }} />
                  </span>
                  <span className="tabular text-[9.5px] text-muted-foreground">{pct(n.demand)}</span>
                </span>
              ) : null}
              {personal && n.p != null ? (
                <span className="relative block h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  {n.required != null && !met ? <span className="absolute inset-y-0 left-0 rounded-full bg-indigo/20" style={{ width: `${Math.min(1, n.required) * 100}%` }} /> : null}
                  <span className={cn("absolute inset-y-0 left-0 rounded-full", met ? "bg-mint" : "bg-indigo")} style={{ width: `${Math.min(1, n.p) * 100}%` }} />
                </span>
              ) : null}
            </button>
          );
        })}
        {active && at[active] ? (
          <HoverCard
            n={byId[active]}
            // in the skill's own column, under it (or above near the bottom): the lit neighbours sit in the other columns
            x={Math.min(at[active].x, width - TIP_W)}
            y={at[active].y + H + 8 + TIP_H <= height ? at[active].y + H + 8 : Math.max(0, at[active].y - TIP_H - 8)}
            cluster={clusters[byId[active].cluster] ?? ""}
            needs={(layout.pre[active] ?? []).map((id) => titleCase(byId[id]?.name ?? id))}
            opens={(layout.post[active] ?? []).map((id) => titleCase(byId[id]?.name ?? id))}
            personal={personal}
          />
        ) : null}
      </div>
    </div>
  );
}

function HoverCard({ n, x, y, cluster, needs, opens, personal }: {
  n: TreeNode; x: number; y: number; cluster: string; needs: string[]; opens: string[]; personal: boolean;
}) {
  const t = useT();
  return (
    <div role="tooltip" className="pointer-events-none absolute z-10 rounded-2xl border bg-card p-4 shadow-lg" style={{ left: x, top: y, width: TIP_W }}>
      <div className="flex flex-wrap gap-1.5">
        {cluster ? <Pill>{cluster}</Pill> : null}
        {n.rank ? <Pill tone="indigo">{t("Priority", "Prioritas")} #{n.rank}</Pill> : null}
        {n.bottleneck ? <Pill tone="ember">Bottleneck</Pill> : null}
      </div>
      <p className="mt-2 font-semibold leading-snug text-ink">{titleCase(n.name)}</p>
      <p className="text-xs text-muted-foreground">{t(`Asked for in ${pct(n.demand)} of job postings`, `Diminta di ${pct(n.demand)} job posting`)}</p>
      {personal && n.p != null ? (
        <p className="mt-1.5 text-xs text-ink/75">
          {t("You", "Kamu")} {num(n.p)}, {t("role needs", "role butuh")} {num(n.required)}
        </p>
      ) : null}
      <dl className="mt-2.5 space-y-1.5 border-t pt-2.5 text-xs">
        <div>
          <dt className="font-medium text-ink/70">{t("Needs first", "Butuh dulu")}</dt>
          <dd className="text-ink">{needs.length ? needs.join(", ") : t("Nothing, a starting skill", "Tidak ada, skill awal")}</dd>
        </div>
        <div>
          <dt className="font-medium text-ink/70">{t("Opens", "Membuka")}</dt>
          <dd className="text-ink">{opens.length ? opens.join(", ") : t("Nothing further", "Tidak ada lagi")}</dd>
        </div>
      </dl>
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "indigo" | "ember" }) {
  const c = { neutral: "bg-muted text-ink/80", indigo: "bg-secondary text-secondary-foreground", ember: "bg-[#fff6d9] text-ember-ink" }[tone];
  return <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-medium", c)}>{children}</span>;
}

export function TreeLegend({ personal }: { personal: boolean }) {
  const t = useT();
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        <span className="flex size-4 items-center justify-center rounded-full bg-indigo text-[9px] font-bold text-white">1</span>
        {t("Step on your route", "Langkah di rutemu")}
      </li>
      <li className="flex items-center gap-2">
        <svg width="28" height="6" aria-hidden="true"><path d="M0,3 H28" strokeWidth="2" style={{ stroke: "var(--input)" }} /></svg>
        {t("Prerequisite approved by experts", "Prasyarat disetujui pakar")}
      </li>
      <li className="flex items-center gap-2">
        <svg width="28" height="6" aria-hidden="true"><path d="M0,3 H28" strokeWidth="2" strokeDasharray="4 4" style={{ stroke: "var(--input)" }} /></svg>
        {t("Proposed, awaiting review", "Usulan, menunggu tinjauan")}
      </li>
      {personal ? (
        <li className="flex items-center gap-2">
          <span className="h-1 w-6 rounded-full bg-mint" />
          {t("At the level the role needs", "Sudah di level yang dibutuhkan")}
        </li>
      ) : null}
    </ul>
  );
}
