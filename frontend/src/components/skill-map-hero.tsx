"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Flag, KeyRound, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SkillTree, type TreeEdge, type TreeNode } from "./skill-tree";

type Graph = { nodes: TreeNode[]; edges: TreeEdge[]; clusters: Record<string, string> };
type Market = { role_name: string; n_postings: number };
type Mode = "market" | "bottleneck" | "route";
const MODES: Mode[] = ["market", "bottleneck", "route"];
const HOT = "#e8613f";
const STEP_MS = 3250;
const RING = 2 * Math.PI * 8.25; // circumference of the progress ring around a step number

/** The landing hero: the same skill map students use in Belajar → Peta, for one career, read three ways. "Market"
 * shows how often postings ask for each skill; "Bottleneck" and "Route" are the engine's own output for a student
 * with no evidence yet (GET /graph?beginner=true runs the real ranking), so the hero shows what the app would say. */
export function SkillMapHero({ roles }: { roles: { id: string; label: string }[] }) {
  const t = useT();
  const [role, setRole] = useState(roles[0]?.id ?? "business_analyst");
  const [mode, setMode] = useState<Mode>("market");
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const careers = useCareers(role, roles.map((r) => r.id));
  const graph = { data: careers.graph, error: careers.error };
  const market = { data: careers.market };
  const loading = careers.loading;
  const map = useMemo(() => (graph.data ? build(graph.data) : null), [graph.data]);
  // the previous career stays on screen (dimmed) while the next one loads; the cross-fade plays when its data arrives
  const swapKey = useMemo(() => (map ? `${Date.now()}` : ""), [map]);

  // the three readings play on their own until the visitor takes over: the progress bar under the current step drives
  // the change (its animation end), so pointing at the map pauses both, and reduced motion (no animation) stops it
  // a role whose engine output has no bottleneck (nothing waits on one skill) skips that step instead of saying "0 skills"
  const modes = useMemo<Mode[]>(() => (!map || map.held.length ? MODES : ["market", "route"]), [map]);
  const shown: Mode = modes.includes(mode) ? mode : "route";
  const next = () => setMode((m) => modes[(modes.indexOf(modes.includes(m) ? m : "route") + 1) % modes.length]);
  const take = (fn: () => void) => {
    setAuto(false);
    fn();
  };

  const nodes = useMemo(() => {
    if (!map) return [];
    return map.nodes.map((n) => ({
      ...n,
      bottleneck: shown === "bottleneck" && n.id === map.hot,
      in_path: shown === "route" && map.route.includes(n.id),
      path_index: shown === "route" ? map.route.indexOf(n.id) : null,
    }));
  }, [map, shown]);
  const only = !map ? null : shown === "bottleneck" ? new Set([map.hot, ...map.held]) : shown === "route" ? new Set(map.route) : null;

  // the map keeps the app's card size; on a narrow column it is scaled down as a whole, never re-flowed
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, h: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const tree = inner.current?.querySelector<HTMLElement>(".relative");
      if (!box.current || !tree) return;
      const scale = Math.min(1, box.current.clientWidth / tree.offsetWidth);
      setFit({ scale, h: tree.offsetHeight * scale });
    };
    measure();
    // the tree's own size too: spacing, late web fonts or a re-wrapped name change its height without changing the box
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    const tree = inner.current?.querySelector<HTMLElement>(".relative");
    if (tree) ro.observe(tree);
    return () => ro.disconnect();
  }, [nodes.length, role, map, swapKey]);

  const label: Record<Mode, string> = {
    market: t("Market demand", "Permintaan pasar"),
    bottleneck: t("Bottleneck", "Titik hambat"),
    route: t("Route", "Rute"),
  };
  const short: Record<Mode, string> = { market: t("Demand", "Pasar"), bottleneck: t("Key", "Kunci"), route: t("Route", "Rute") };
  // the map explains itself: one pinned label per reading on the card it is about, icons instead of sentences
  const top = map ? [...map.nodes].sort((a, b) => b.demand - a.demand)[0] : undefined;
  const badge = !map ? null
    : shown === "market" && top ? { id: top.id, text: t("Most asked for", "Paling dicari"), icon: <TrendingUp className="size-3" aria-hidden="true" /> }
    : shown === "bottleneck" && map.hot ? { id: map.hot, text: t(`Key · opens ${map.held.length}`, `Kunci · buka ${map.held.length}`), icon: <KeyRound className="size-3" aria-hidden="true" /> }
    : shown === "route" && map.route[0] ? { id: map.route[0], text: t("Start", "Mulai"), icon: <Flag className="size-3" aria-hidden="true" /> } : null;

  return (
    <figure onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[24px] border bg-card shadow-[0_30px_80px_-40px_rgb(29_111_216/0.45)]">
        <span className="smh-beam" aria-hidden="true" />
        {/* title and the readings share one row, so the map starts right under it */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2">
          <div className="min-w-0">
            <p className={cn("truncate text-sm font-semibold leading-tight text-ink transition-opacity duration-300", loading && "opacity-50")}>{market.data?.role_name ?? "…"}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {loading ? (
                <span className="size-2 animate-spin rounded-full border-[1.5px] border-muted-foreground/25 border-t-indigo motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <span className="relative flex size-1.5" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-mint" />
                </span>
              )}
              {market.data ? t(`${market.data.n_postings} real postings`, `${market.data.n_postings} lowongan nyata`) : ""}
            </p>
          </div>
          <StepTabs modes={modes} shown={shown} label={label} short={short} auto={auto} paused={paused} restart={`${shown}-${role}`}
            onPick={(m) => take(() => setMode(m))} onDone={next} />
        </div>

        <div ref={box} className="overflow-hidden px-3 pt-0.5" style={{ height: fit.h ? fit.h + 8 : 300 }}>
          {map ? (
            // a new career cross-fades in instead of snapping
            <div key={swapKey} ref={inner} className={cn("smh-swap transition-opacity duration-300", loading && "opacity-50")} style={{ transform: `scale(${fit.scale})`, transformOrigin: "top left", width: `${100 / fit.scale}%` }}>
              <SkillTree nodes={nodes} edges={map.edges} focus={null} onFocus={() => setAuto(false)} personal={false} clusters={graph.data!.clusters} lit={false} compact demand={shown === "market"} only={only} flow={shown !== "market"} story badge={badge} />
            </div>
          ) : (
            <p className="pt-28 text-center text-sm text-muted-foreground">{graph.error ? t("The map couldn't load.", "Peta belum bisa dimuat.") : t("Reading the postings…", "Membaca lowongan…")}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="text-muted-foreground">{t("Try another career:", "Coba karier lain:")}</span>
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={role === r.id}
            onClick={() => take(() => setRole(r.id))}
            className={cn("rounded-full border px-3 py-1 transition-colors", role === r.id ? "border-indigo bg-indigo text-white" : "bg-card text-ink hover:border-indigo/50")}
          >
            {r.label}
          </button>
        ))}
      </div>
    </figure>
  );
}

type Career = { graph: Graph; market: Market };
const CAREERS = new Map<string, Promise<Career>>();

function loadCareer(role: string, lang: string): Promise<Career> {
  const key = `${lang}:${role}`;
  let hit = CAREERS.get(key);
  if (!hit) {
    hit = Promise.all([api.get<Graph>(`/graph?role=${role}&beginner=true`), api.get<Market>(`/market/${role}`)])
      .then(([graph, market]) => ({ graph, market }));
    hit.catch(() => CAREERS.delete(key));
    CAREERS.set(key, hit);
  }
  return hit;
}

/** One career's map and market, with the other hero careers fetched quietly afterwards (the hosted engine takes seconds
 * per career), so a click on "Try another career" shows its map at once. The last loaded career stays until the next
 * one is ready; `loading` says a different one was asked for. */
function useCareers(role: string, all: string[]) {
  const lang = useLang();
  const [state, setState] = useState<{ role: string; data: Career } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const others = all.filter((r) => r !== role).join();
  useEffect(() => {
    let alive = true;
    setError(null);
    loadCareer(role, lang)
      .then(async (data) => {
        if (!alive) return;
        setState({ role, data });
        for (const r of others.split(",").filter(Boolean)) await loadCareer(r, lang).catch(() => null);
      })
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [role, lang, others]);
  return { graph: state?.data.graph ?? null, market: state?.data.market ?? null, error, loading: !!state && state.role !== role };
}

/** The readings as an iOS-style segmented control: the white thumb slides to the picked step, and while the map plays
 * on its own a ring fills around the current step's number; its end moves the story on. */
function StepTabs({ modes, shown, label, short, auto, paused, restart, onPick, onDone }: {
  modes: Mode[]; shown: Mode; label: Record<Mode, string>; short: Record<Mode, string>; auto: boolean; paused: boolean;
  restart: string; onPick: (m: Mode) => void; onDone: () => void;
}) {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const b = wrap.current?.querySelector<HTMLElement>(`[data-mode="${shown}"]`);
      if (b) setThumb({ left: b.offsetLeft, width: b.offsetWidth });
    };
    place();
    const ro = new ResizeObserver(place);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [shown, modes.length]);
  return (
    <div ref={wrap} role="group" aria-label={t("Read the map as", "Baca peta sebagai")} className="relative inline-flex rounded-full bg-muted/70 p-0.5 ring-1 ring-inset ring-black/[0.04]">
      {thumb ? <span className="smh-thumb" aria-hidden="true" style={{ left: thumb.left, width: thumb.width }} /> : null}
      {modes.map((m, i) => {
        const on = shown === m;
        const color = m === "bottleneck" ? HOT : "var(--indigo)";
        return (
          <button key={m} type="button" data-mode={m} aria-pressed={on} onClick={() => onPick(m)}
            className={cn("relative z-[1] flex items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1 pr-3 text-xs font-medium transition-colors duration-300",
              on ? "text-ink" : "text-muted-foreground hover:text-ink")}>
            <span className="relative flex size-[19px] shrink-0 items-center justify-center">
              <span className="smh-num absolute inset-[2px] rounded-full" style={{ background: on ? color : "color-mix(in oklab, var(--ink) 8%, transparent)" }} />
              {on && auto ? (
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 19 19" aria-hidden="true">
                  <circle cx="9.5" cy="9.5" r="8.25" fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="1.5" />
                  <circle key={restart} cx="9.5" cy="9.5" r="8.25" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"
                    strokeDasharray={RING} className="smh-ring" onAnimationEnd={onDone}
                    style={{ ["--ring" as string]: RING, animationDuration: `${STEP_MS}ms`, animationPlayState: paused ? "paused" : "running" }} />
                </svg>
              ) : null}
              <span className={cn("relative text-[10px] font-bold tabular-nums", on ? "text-white" : "text-ink/60")}>{i + 1}</span>
            </span>
            <span className="sm:hidden">{short[m]}</span>
            <span className="hidden sm:inline">{label[m]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The engine's route and its top-ranked bottleneck, the skills postings ask for most, and what those build on: about
 * a dozen cards, with depths counted inside this smaller map. */
function build(g: Graph) {
  const active = g.edges.filter((e) => e.active !== false);
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const before: Record<string, string[]> = {};
  active.forEach((e) => (before[e.to] ??= []).push(e.from));

  const route = g.nodes.filter((n) => n.in_path).sort((a, b) => (a.path_index ?? 0) - (b.path_index ?? 0)).map((n) => n.id);
  const hot = g.nodes.filter((n) => n.bottleneck).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0]?.id ?? route[0];
  const keep = new Set<string>([...route, ...(hot ? [hot] : [])]);
  // skills that build on others first, so the map shows real links into the higher levels (not a column of foundations)
  const asked = g.nodes.filter((n) => n.demand > 0).sort((a, b) => b.demand - a.demand);
  asked.filter((n) => before[n.id]?.length).forEach((n) => keep.size < 8 && keep.add(n.id));
  const stack = [...keep];
  while (stack.length) for (const q of before[stack.pop()!] ?? []) if (!keep.has(q) && keep.size < 13) (keep.add(q), stack.push(q));
  // then the most asked-for foundations, while the foundations column still fits the hero's height
  const MAX_ROOTS = 6;
  const rootIds = () => [...keep].filter((id) => !(before[id] ?? []).some((q) => keep.has(q)));
  asked.forEach((n) => keep.size < 13 && rootIds().length < MAX_ROOTS && !before[n.id]?.length && keep.add(n.id));
  // prerequisites can overfill that column: drop the least asked-for foundations the route and bottleneck do not use
  const fixed = new Set([...route, ...(hot ? [hot] : [])]);
  const spare = rootIds().filter((id) => !fixed.has(id)).sort((a, b) => byId[a].demand - byId[b].demand);
  while (rootIds().length > MAX_ROOTS && spare.length) keep.delete(spare.shift()!);
  const edges = active.filter((e) => keep.has(e.from) && keep.has(e.to));
  const pre: Record<string, string[]> = {};
  const post: Record<string, string[]> = {};
  edges.forEach((e) => ((pre[e.to] ??= []).push(e.from), (post[e.from] ??= []).push(e.to)));

  const depth: Record<string, number> = {};
  const d = (id: string, seen: Set<string>): number => {
    if (depth[id] != null) return depth[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    return (depth[id] = Math.max(0, ...(pre[id] ?? []).map((p) => d(p, seen) + 1)));
  };
  keep.forEach((id) => d(id, new Set()));
  const down = (id: string, acc = new Set<string>()) => {
    (post[id] ?? []).forEach((c) => (acc.has(c) ? null : (acc.add(c), down(c, acc))));
    return acc;
  };
  const held = hot ? [...down(hot)].filter((c) => byId[c].demand > 0) : [];

  const nodes: TreeNode[] = [...keep].map((id) => ({ ...byId[id], depth: depth[id], p: null, required: null, rank: null, in_path: false, path_index: null, bottleneck: false }));
  return { nodes, edges, hot, held, route: route.filter((id) => keep.has(id)) };
}
