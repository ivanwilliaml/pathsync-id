"use client";

import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  compact: { W: 176, H: 52, GAP_X: 46, GAP_Y: 10, HEAD: 24 },
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
export function SkillTree({ nodes, edges, focus, onFocus, personal, clusters, lit = true, compact = false, only = null, demand = false, flow = false, story = false, badge = null }: {
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
  /** landing page only: stage each reading (bars grow, sparks leave the bottleneck, the route draws step by step) */
  story?: boolean;
  /** landing page only: a short label pinned above one card ("most asked for", "start here") */
  badge?: { id: string; text: string; icon?: React.ReactNode } | null;
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

  // landing story: the detail card lingers a moment after the pointer leaves, so moving between skills glides the card
  // across instead of blinking it out and back in
  const [grace, setGrace] = useState<string | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipId, setTipId] = useState<string | null>(null);
  useEffect(() => {
    if (!story) return;
    if (hover) {
      setTipId(hover);
      setTipOpen(true);
      setGrace(hover);
      return;
    }
    const id = window.setTimeout(() => (setTipOpen(false), setGrace(null)), 160);
    return () => window.clearTimeout(id);
  }, [hover, story]);
  const active = story ? hover ?? grace : hover ?? (lit ? focus : null);
  // the active skill plus what flows into it and what it flows out to
  const lineage = useMemo(
    () => (active ? new Set([active, ...(layout.pre[active] ?? []), ...(layout.post[active] ?? [])]) : only),
    [active, layout, only],
  );
  const maxDemand = Math.max(0.01, ...nodes.map((n) => n.demand));
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const { at, cols, width, height } = layout;
  // story readings, derived from the flags the hero sets: a bottleneck is lit, or the route is numbered
  const hotId = story && !active && lineage ? nodes.find((n) => n.bottleneck)?.id : undefined;
  const routeOn = story && !active && !hotId && nodes.some((n) => n.in_path);
  const routes = useMemo(() => (story ? routeEdges(edges, at, cols, { W, H, GAP_X, HEAD, height }) : null), [story, edges, at, cols, W, H, GAP_X, HEAD, height]);
  const curve = (e: TreeEdge) => {
    if (routes) return routes[e.id]?.d ?? null;
    const a = at[e.from];
    const b = at[e.to];
    if (!a || !b) return null;
    const x1 = a.x + W;
    const y1 = a.y + H / 2;
    const x2 = b.x;
    const y2 = b.y + H / 2;
    const c = GAP_X / 2;
    return `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`;
  };
  const sparkEdges = hotId ? edges.filter((e) => lineage!.has(e.from) && lineage!.has(e.to)) : [];
  const stepEdges = routeOn ? edges.filter((e) => byId[e.from]?.in_path && byId[e.to]?.in_path) : [];
  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
          {edges.map((e) => {
            const a = at[e.from];
            const b = at[e.to];
            if (!a || !b) return null;
            const lit = active ? e.from === active || e.to === active : !lineage || (lineage.has(e.from) && lineage.has(e.to));
            const hot = !active && !!lineage && (story ? !!hotId : byId[e.from]?.bottleneck);
            // story route: the line between two route steps draws itself once, in step order
            const drawn = routeOn && lit && byId[e.from]?.in_path && byId[e.to]?.in_path;
            return (
              <path
                key={e.id}
                d={curve(e)!}
                fill="none"
                pathLength={drawn ? 1 : undefined}
                strokeWidth={lit && lineage ? (drawn ? 2.5 : 2) : story ? 1.1 : 1.25}
                strokeLinecap="round"
                strokeDasharray={drawn ? 1 : flow && lit && lineage ? "5 6" : e.status === "approved" ? undefined : "4 4"}
                className={drawn ? "smh-draw" : flow && lit && lineage ? "smh-flow" : undefined}
                style={{ stroke: hot && lit ? HOT : lit && lineage ? "var(--indigo)" : "var(--input)", opacity: lit ? 1 : story ? 0.18 : 0.3,
                  transition: story ? "opacity 420ms cubic-bezier(.32,.72,0,1), stroke 420ms cubic-bezier(.32,.72,0,1)" : "opacity 300ms, stroke 300ms",
                  ...(drawn ? { animationDelay: `${0.3 + (byId[e.from]?.path_index ?? 0) * 0.45}s` } : {}) }}
              />
            );
          })}
          {/* sparks run from the bottleneck to the skills it holds back; a dot rides each drawn route line */}
          {sparkEdges.map((e, i) => [0, 1].map((k) => (
            // hidden until its motion starts, or it sits at the map's corner (0,0) during the delay
            <circle key={`s${e.id}-${k}`} r="3.5" fill={HOT} className="smh-spark" opacity="0">
              <animateMotion dur="1.6s" repeatCount="indefinite" begin={`${i * 0.2 + k * 0.8}s`} path={curve(e)!} />
              <set attributeName="opacity" to="1" begin={`${i * 0.2 + k * 0.8}s`} />
            </circle>
          )))}
          {stepEdges.map((e) => (
            <circle key={`r${e.id}`} r="4" fill="var(--card)" stroke="var(--indigo)" strokeWidth="2" className="smh-spark" opacity="0">
              <animateMotion dur="2.4s" repeatCount="indefinite" path={curve(e)!} />
              <set attributeName="opacity" to="1" begin="0s" />
            </circle>
          ))}
        </svg>
        {cols.map((_, ci) => (
          <p key={ci} className={cn("absolute font-semibold text-muted-foreground", compact ? "text-[11px]" : "text-xs",
            story && "text-center text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/80")}
            style={{ left: PAD + ci * (W + GAP_X), top: story ? 5 : 4, ...(story ? { width: W } : {}) }}>
            {ci === 0 ? t("Foundations", "Dasar") : t(`Level ${ci + 1}`, `Tingkat ${ci + 1}`)}
          </p>
        ))}
        {nodes.map((n) => {
          const p = at[n.id];
          const met = personal && n.p != null && n.required != null && n.p >= n.required;
          const dim = lineage && !lineage.has(n.id);
          const held = !!hotId && n.id !== hotId && !dim;
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
                active === n.id && !story && "shadow-md ring-2 ring-indigo/30",
                dim && (story ? "opacity-25" : "opacity-30"),
                story && n.id === hotId && "smh-hot",
                held && "border-dashed",
                routeOn && n.in_path && "smh-step",
                story && "smh-card",
                story && active === n.id && "smh-card-on",
              )}
              style={{ left: p.x, top: p.y, width: W, height: H, ...(n.bottleneck ? { borderColor: HOT, boxShadow: `0 0 0 4px color-mix(in oklab, ${HOT} 18%, transparent)` } : {}),
                ...(routeOn && n.in_path ? { animationDelay: `${0.15 + (n.path_index ?? 0) * 0.45}s` } : {}) }}
            >
              {story && badge?.id === n.id ? (
                <span key={badge.text} className="smh-pop smh-badge absolute right-2 flex h-[15px] items-center gap-1 whitespace-nowrap rounded-full px-1.5 text-[9.5px] font-semibold leading-none text-white"
                  style={{ top: -7, background: n.bottleneck ? HOT : "var(--indigo)" }}>
                  {badge.icon}
                  {badge.text}
                </span>
              ) : null}
              {held ? (
                <span className="smh-pop absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border bg-card shadow-sm" title={t("Waits for the bottleneck", "Menunggu titik hambat")}>
                  <Lock className="size-3" style={{ color: HOT }} aria-hidden="true" />
                </span>
              ) : null}
              <span className="flex items-start gap-1.5">
                {n.in_path ? (
                  <span className={cn("mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-indigo text-[9.5px] font-bold text-white", story && "smh-pop")}
                    style={story ? { animationDelay: `${0.15 + (n.path_index ?? 0) * 0.45}s` } : undefined}>
                    {(n.path_index ?? 0) + 1}
                  </span>
                ) : null}
                <span className={cn("line-clamp-2 font-medium leading-tight text-ink", compact ? "text-[11px]" : "text-[12px]")}>{titleCase(n.name)}</span>
              </span>
              {demand && !personal ? (
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="relative block h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className={cn("absolute inset-y-0 left-0 rounded-full bg-indigo/70", story && "smh-grow")} style={{ width: `${(n.demand / maxDemand) * 100}%` }} />
                  </span>
                  <span className={cn("tabular text-[9.5px] text-muted-foreground", compact && "leading-none")}>{pct(n.demand)}</span>
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
        {routes ? (
          // the ends of every line, above the cards, so it is clear which two cards a line joins
          <svg width={width} height={height} className="pointer-events-none absolute inset-0" aria-hidden="true">
            {edges.map((e) => {
              const r = routes[e.id];
              if (!r) return null;
              const on = active ? e.from === active || e.to === active : !lineage || (lineage.has(e.from) && lineage.has(e.to));
              const color = !active && lineage && hotId && on ? HOT : on && lineage ? "var(--indigo)" : "var(--input)";
              return [[r.x1, r.y1], [r.x2, r.y2]].map(([x, y], k) => (
                <circle key={`${e.id}-${k}`} cx={x} cy={y} r={on && lineage ? 3 : 2.2} fill="var(--card)" stroke={color} strokeWidth={1.5}
                  style={{ opacity: on ? 1 : 0.35, transition: "opacity 420ms cubic-bezier(.32,.72,0,1), r 420ms cubic-bezier(.32,.72,0,1)" }} />
              ));
            })}
          </svg>
        ) : null}
        {story ? (
          tipId && at[tipId] ? (
            <StoryTip
              n={byId[tipId]}
              open={tipOpen}
              anchor={at[tipId]}
              size={{ W, H, width, height }}
              cluster={clusters[byId[tipId].cluster] ?? ""}
              needs={(layout.pre[tipId] ?? []).map((id) => titleCase(byId[id]?.name ?? id))}
              opens={(layout.post[tipId] ?? []).map((id) => titleCase(byId[id]?.name ?? id))}
              maxDemand={maxDemand}
            />
          ) : null
        ) : active && at[active] ? (
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

type Box = { x: number; y: number };

/** Landing story lines: each line gets its own attachment point on the card edge (ordered by where the other end is,
 * so lines leave and arrive side by side instead of piling into one dot), and a line that skips a level runs above or
 * below the cards of the level it skips instead of through them. */
function routeEdges(edges: TreeEdge[], at: Record<string, Box>, cols: TreeNode[][], s: { W: number; H: number; GAP_X: number; HEAD: number; height: number }) {
  const { W, H, GAP_X, HEAD, height } = s;
  const colOf: Record<string, number> = {};
  cols.forEach((c, ci) => c.forEach((n) => (colOf[n.id] = ci)));
  const mid = (id: string) => at[id].y + H / 2;
  const live = edges.filter((e) => at[e.from] && at[e.to]);
  const outs: Record<string, TreeEdge[]> = {};
  const ins: Record<string, TreeEdge[]> = {};
  live.forEach((e) => ((outs[e.from] ??= []).push(e), (ins[e.to] ??= []).push(e)));
  Object.values(outs).forEach((l) => l.sort((a, b) => mid(a.to) - mid(b.to)));
  Object.values(ins).forEach((l) => l.sort((a, b) => mid(a.from) - mid(b.from)));
  const port = (list: TreeEdge[], e: TreeEdge, id: string) => {
    const k = list.length;
    const step = k > 1 ? Math.min(9, (H - 18) / (k - 1)) : 0;
    return mid(id) + (list.indexOf(e) - (k - 1) / 2) * step;
  };
  const colX = (ci: number) => (cols[ci]?.[0] ? at[cols[ci][0].id].x : 0);
  const lanes: Record<string, number> = {};
  const out: Record<number, { d: string; x1: number; y1: number; x2: number; y2: number }> = {};
  for (const e of live) {
    const x1 = at[e.from].x + W;
    const y1 = port(outs[e.from], e, e.from);
    const x2 = at[e.to].x;
    const y2 = port(ins[e.to], e, e.to);
    const cs = colOf[e.from];
    const ct = colOf[e.to];
    const c = GAP_X * 0.55;
    if (ct - cs <= 1) {
      out[e.id] = { d: `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`, x1, y1, x2, y2 };
      continue;
    }
    // the free lane above or below the skipped levels, whichever is the shorter way round
    const skipped = cols.slice(cs + 1, ct).flat().map((n) => at[n.id].y);
    const top = Math.min(...skipped) - 9;
    const bottom = Math.max(...skipped) + H + 9;
    const canTop = top > HEAD + 4;
    const canBottom = bottom < height - 4;
    const useTop = canTop && (!canBottom || Math.abs(top - y1) + Math.abs(top - y2) <= Math.abs(bottom - y1) + Math.abs(bottom - y2));
    const key = `${cs}-${ct}-${useTop ? "t" : "b"}`;
    const n = (lanes[key] = (lanes[key] ?? -1) + 1);
    const lane = useTop ? top - n * 5 : bottom + n * 5;
    const xa = colX(cs + 1) - 4;
    const xb = colX(ct - 1) + W + 4;
    out[e.id] = {
      d: `M${x1},${y1} C${x1 + c},${y1} ${xa - c},${lane} ${xa},${lane} L${xb},${lane} C${xb + c},${lane} ${x2 - c},${y2} ${x2},${y2}`,
      x1, y1, x2, y2,
    };
  }
  return out;
}

const STIP_W = 244;

/** The landing page's detail card: frosted, it fades and scales out of the hovered skill and glides to the next one. */
function StoryTip({ n, open, anchor, size, cluster, needs, opens, maxDemand }: {
  n: TreeNode; open: boolean; anchor: Box; size: { W: number; H: number; width: number; height: number };
  cluster: string; needs: string[]; opens: string[]; maxDemand: number;
}) {
  const t = useT();
  // measured, so the card is placed where it fits whole: under the skill, else over it, else as close as the map allows
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(160);
  useLayoutEffect(() => {
    if (ref.current) setH(ref.current.offsetHeight);
  }, [n.id, needs.length, opens.length]);
  const under = anchor.y + size.H + 10;
  const over = anchor.y - 10 - h;
  const below = under + h <= size.height - 4 || over < 4 && size.height - 4 - (under + h) > over;
  const top = below ? Math.min(under, size.height - h - 4) : Math.max(4, over);
  const cx = anchor.x + size.W / 2;
  const left = Math.max(4, Math.min(size.width - STIP_W - 4, cx - STIP_W / 2));
  const arrow = Math.max(16, Math.min(STIP_W - 16, cx - left));
  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn("smh-tip pointer-events-none absolute z-10", open && "smh-tip-open")}
      style={{ left, top, width: STIP_W, transformOrigin: `${arrow}px ${below ? "0%" : "100%"}` }}
    >
      {/* the pointer only when the card sits fully beside the skill; squeezed against the map edge it would point at nothing */}
      <span className={cn("smh-tip-arrow", below ? "-top-1.5" : "-bottom-1.5")} style={{ left: arrow - 6, opacity: top === (below ? under : over) ? 1 : 0 }} />
      <div key={n.id} className="smh-tip-body">
        <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{cluster}</p>
        <p className="mt-0.5 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink">{titleCase(n.name)}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="relative block h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="smh-grow absolute inset-y-0 left-0 rounded-full" style={{ width: `${(n.demand / maxDemand) * 100}%`, background: n.bottleneck ? HOT : "var(--indigo)" }} />
          </span>
          <span className="tabular text-[11px] font-medium text-ink/80">{t(`${pct(n.demand)} of postings`, `${pct(n.demand)} lowongan`)}</span>
        </div>
        <TipRow icon={<ArrowLeft className="size-3" aria-hidden="true" />} label={t("Needs first", "Butuh dulu")} items={needs} empty={t("Nothing, a starting skill", "Tidak ada, skill awal")} />
        <TipRow icon={<ArrowRight className="size-3" aria-hidden="true" />} label={t("Opens", "Membuka")} items={opens} empty={t("Nothing further here", "Tidak ada lagi di peta ini")} />
      </div>
    </div>
  );
}

function TipRow({ icon, label, items, empty }: { icon: React.ReactNode; label: string; items: string[]; empty: string }) {
  return (
    <div className="mt-2">
      <p className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">{icon}{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.length ? items.map((x) => (
          <span key={x} className="rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-medium leading-tight text-ink">{x}</span>
        )) : <span className="text-[11px] text-ink/60">{empty}</span>}
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
