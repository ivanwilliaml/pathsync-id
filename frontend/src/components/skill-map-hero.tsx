"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApi } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SkillTree, type TreeEdge, type TreeNode } from "./skill-tree";

type Graph = { nodes: TreeNode[]; edges: TreeEdge[]; clusters: Record<string, string> };
type Market = { role_name: string; n_postings: number };
type Mode = "market" | "bottleneck" | "route";
const MODES: Mode[] = ["market", "bottleneck", "route"];
const HOT = "#e8613f";

/** The landing hero: the same skill map students use in Belajar → Peta, for one career, read three ways. "Market"
 * shows how often postings ask for each skill; "Bottleneck" and "Route" are the engine's own output for a student
 * with no evidence yet (GET /graph?beginner=true runs the real ranking), so the hero shows what the app would say. */
export function SkillMapHero({ roles }: { roles: { id: string; label: string }[] }) {
  const t = useT();
  const [role, setRole] = useState(roles[0]?.id ?? "business_analyst");
  const [mode, setMode] = useState<Mode>("market");
  const [auto, setAuto] = useState(true);
  const graph = useApi<Graph>(`/graph?role=${role}&beginner=true`);
  const market = useApi<Market>(`/market/${role}`);
  const map = useMemo(() => (graph.data ? build(graph.data) : null), [graph.data]);

  // the three readings play on their own until the visitor takes over (never with reduced motion)
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length]), 5000);
    return () => window.clearInterval(id);
  }, [auto]);
  const take = (fn: () => void) => {
    setAuto(false);
    fn();
  };

  const nodes = useMemo(() => {
    if (!map) return [];
    return map.nodes.map((n) => ({
      ...n,
      bottleneck: mode === "bottleneck" && n.id === map.hot,
      in_path: mode === "route" && map.route.includes(n.id),
      path_index: mode === "route" ? map.route.indexOf(n.id) : null,
    }));
  }, [map, mode]);
  const only = !map ? null : mode === "bottleneck" ? new Set([map.hot, ...map.held]) : mode === "route" ? new Set(map.route) : null;

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
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [nodes.length, role]);

  const label: Record<Mode, string> = {
    market: t("Market demand", "Permintaan pasar"),
    bottleneck: t("Bottleneck", "Titik hambat"),
    route: t("Route", "Rute"),
  };
  const hotName = map ? map.nodes.find((n) => n.id === map.hot)?.name : "";
  const caption = !map
    ? ""
    : mode === "market"
      ? t("The bar is how often postings ask for the skill.", "Bar = seberapa sering lowongan meminta skill itu.")
      : mode === "bottleneck"
        ? t(`${hotName} is ready to learn and opens ${map.held.length} skills employers ask for.`, `${hotName} siap dipelajari dan membuka ${map.held.length} skill yang diminta employer.`)
        : t(`A beginner's first ${map.route.length} steps, prerequisites first.`, `${map.route.length} langkah pertama untuk pemula, prasyarat lebih dulu.`);

  return (
    <figure>
      <div className="overflow-hidden rounded-[24px] border bg-card shadow-[0_30px_80px_-40px_rgb(29_111_216/0.45)]">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <p className="truncate text-sm font-semibold text-ink">
            {t("Skill map:", "Peta skill")} {market.data?.role_name ?? "…"}
          </p>
          <p className="shrink-0 text-xs text-muted-foreground">{market.data ? t(`${market.data.n_postings} real postings`, `${market.data.n_postings} lowongan nyata`) : ""}</p>
        </div>

        <div ref={box} className="overflow-hidden px-4 pt-4" style={{ height: fit.h ? fit.h + 16 : 360 }}>
          {map ? (
            <div ref={inner} style={{ transform: `scale(${fit.scale})`, transformOrigin: "top left", width: `${100 / fit.scale}%` }}>
              <SkillTree nodes={nodes} edges={map.edges} focus={null} onFocus={() => setAuto(false)} personal={false} clusters={graph.data!.clusters} lit={false} compact demand={mode === "market"} only={only} flow={mode !== "market"} />
            </div>
          ) : (
            <p className="pt-32 text-center text-sm text-muted-foreground">{graph.error ? t("The map couldn't load.", "Peta belum bisa dimuat.") : t("Reading the postings…", "Membaca lowongan…")}</p>
          )}
        </div>

        <figcaption className="flex flex-wrap items-center gap-3 border-t px-5 py-3">
          <div role="group" aria-label={t("Read the map as", "Baca peta sebagai")} className="inline-flex rounded-full border bg-muted/60 p-0.5">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => take(() => setMode(m))}
                className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors", mode === m ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink")}
              >
                {m === "bottleneck" ? <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: HOT }} /> : null}
                {label[m]}
              </button>
            ))}
          </div>
          <p className="min-w-0 flex-1 text-xs text-ink/75 sm:text-right" aria-live="polite">{caption}</p>
        </figcaption>
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

/** The engine's route and its top-ranked bottleneck, the skills postings ask for most, and what those build on: about
 * ten cards, with depths counted inside this smaller map. */
function build(g: Graph) {
  const active = g.edges.filter((e) => e.active !== false);
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const before: Record<string, string[]> = {};
  active.forEach((e) => (before[e.to] ??= []).push(e.from));

  const route = g.nodes.filter((n) => n.in_path).sort((a, b) => (a.path_index ?? 0) - (b.path_index ?? 0)).map((n) => n.id);
  const hot = g.nodes.filter((n) => n.bottleneck).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0]?.id ?? route[0];
  const keep = new Set<string>([...route, ...(hot ? [hot] : [])]);
  g.nodes.filter((n) => n.demand > 0).sort((a, b) => b.demand - a.demand).forEach((n) => keep.size < 8 && keep.add(n.id));
  const stack = [...keep];
  while (stack.length) for (const q of before[stack.pop()!] ?? []) if (!keep.has(q) && keep.size < 11) (keep.add(q), stack.push(q));
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
