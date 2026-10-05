"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CLUSTER_ORDER, num, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useStudentId } from "@/lib/student";
import { cn } from "@/lib/utils";
import { ErrorNote, Loading, MasteryBar, NativeSelect, PageHeader, Panel, Tag } from "@/components/kit";

interface GNode {
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
  bottleneck: boolean;
}
interface GEdge {
  id: number;
  from: string;
  to: string;
  rationale: string;
  status: string;
}
interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  clusters: Record<string, string>;
}

export default function SkillMapPage() {
  const { id, ready } = useStudentId();
  const g = useApi<GraphData>(ready ? (id ? `/students/${id}/graph` : "/graph") : null);
  const [focus, setFocus] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);

  const data = g.data;
  const byId = useMemo(() => Object.fromEntries((data?.nodes ?? []).map((n) => [n.id, n])), [data]);
  const route = useMemo(() => (data?.nodes ?? []).filter((n) => n.in_path).sort((a, b) => (a.path_index ?? 99) - (b.path_index ?? 99)), [data]);

  useEffect(() => {
    if (!data || focus) return;
    const first = data.nodes.find((n) => n.rank === 1) ?? route[0] ?? [...data.nodes].sort((a, b) => b.demand - a.demand)[0];
    setFocus(first?.id ?? null);
  }, [data, focus, route]);

  if (g.error) return <ErrorNote error={g.error} />;
  if (!data || !focus) return <Loading />;

  const node = byId[focus];
  const builds = data.edges.filter((e) => e.to === focus);
  const unlocks = data.edges.filter((e) => e.from === focus);
  const personal = data.nodes.some((n) => n.p != null);

  return (
    <div>
      <PageHeader
        title="Skill Map"
        description="See what each skill builds on and what it opens up. Start from your route, or pick any skill."
      />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="pick" className="text-sm font-medium text-ink">
              Pick Any Skill
            </label>
            <NativeSelect id="pick" value={focus} onChange={(e) => setFocus(e.target.value)}>
              {CLUSTER_ORDER.filter((c) => data.clusters[c]).map((c) => (
                <optgroup key={c} label={data.clusters[c]}>
                  {data.nodes
                    .filter((n) => n.cluster === c)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {titleCase(n.name)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </NativeSelect>
          </div>
          {route.length ? (
            <nav aria-label="Your route">
              <p className="mb-2 text-sm font-medium text-ink">Your Route</p>
              <ol className="space-y-1">
                {route.map((n, i) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => setFocus(n.id)}
                      aria-current={n.id === focus ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        n.id === focus ? "bg-secondary font-semibold text-secondary-foreground" : "text-ink/80 hover:bg-muted",
                      )}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">{i + 1}</span>
                      <span className="min-w-0 truncate">{titleCase(n.name)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-6">
          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,1fr)]">
            <Column title="Builds On" empty="Nothing. This is a starting skill.">
              {builds.map((e) => (
                <MiniCard key={e.id} n={byId[e.from]} note={e.rationale} onClick={() => setFocus(e.from)} personal={personal} />
              ))}
            </Column>
            <Connector />
            <div className="rounded-2xl bg-route p-[2px] md:mt-7">
              <div className="rounded-[14px] bg-card p-5">
                <div className="flex flex-wrap gap-1.5">
                  <Tag tone="neutral">{data.clusters[node.cluster]}</Tag>
                  {node.rank ? <Tag tone="indigo">Priority #{node.rank}</Tag> : null}
                  {node.bottleneck ? <Tag tone="ember">Bottleneck</Tag> : null}
                </div>
                <h2 className="mt-3 text-xl font-bold leading-snug text-ink">{titleCase(node.name)}</h2>
                <p className="mt-1 text-sm text-ink/70">Asked for in {pct(node.demand)} of job postings.</p>
                {node.p != null ? (
                  <div className="mt-4">
                    <MasteryBar value={node.p} target={node.required} />
                    <p className="mt-2 flex justify-between text-xs text-ink/70">
                      <span>You: {num(node.p)}</span>
                      <span>Role needs: {num(node.required)}</span>
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <Connector />
            <Column title="Unlocks" empty="Nothing further. This is an end skill.">
              {unlocks.map((e) => (
                <MiniCard key={e.id} n={byId[e.to]} onClick={() => setFocus(e.to)} personal={personal} />
              ))}
            </Column>
          </div>

          <Panel className="p-0 sm:p-0">
            <button
              type="button"
              onClick={() => setShowFull(!showFull)}
              aria-expanded={showFull}
              className="flex w-full items-center justify-between p-5 text-left font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {showFull ? "Hide the Full Map" : `Show the Full Map (${data.nodes.length} Skills)`}
              <ArrowDown className={cn("size-4 transition-transform", showFull && "rotate-180")} aria-hidden="true" />
            </button>
            {showFull ? <FullMap data={data} focus={focus} onFocus={setFocus} /> : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Column({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-sm font-medium text-ink/70">{title}</h3>
      {children.length ? <ul className="space-y-2">{children}</ul> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function Connector() {
  return (
    <div className="flex justify-center md:mt-16" aria-hidden="true">
      <ArrowDown className="size-5 text-iris md:hidden" />
      <ArrowRight className="hidden size-5 text-iris md:block" />
    </div>
  );
}

function MiniCard({ n, note, onClick, personal }: { n: GNode; note?: string; onClick: () => void; personal: boolean }) {
  if (!n) return null;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl border bg-card p-3 text-left transition-[border-color,box-shadow] hover:border-indigo/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold leading-snug text-ink">{titleCase(n.name)}</span>
          {n.in_path ? <span className="mt-1 size-2 shrink-0 rounded-full bg-ember" title="On your route" aria-label="On your route" /> : null}
        </span>
        {personal && n.p != null ? <MasteryBar value={n.p} target={n.required} tone="indigo" className="mt-2.5 h-1.5" /> : null}
        {note ? <span className="mt-2 block text-xs leading-relaxed text-ink/60">{note}</span> : null}
      </button>
    </li>
  );
}

/** Layered view of every skill, columns = how many prerequisites deep a skill sits. */
function FullMap({ data, focus, onFocus }: { data: GraphData; focus: string; onFocus: (id: string) => void }) {
  const cols = useMemo(() => {
    const m: Record<number, GNode[]> = {};
    data.nodes.forEach((n) => (m[n.depth] ??= []).push(n));
    return Object.entries(m)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, v]) => v.sort((a, b) => CLUSTER_ORDER.indexOf(a.cluster) - CLUSTER_ORDER.indexOf(b.cluster) || a.name.localeCompare(b.name)));
  }, [data]);
  const related = new Set([focus, ...data.edges.filter((e) => e.from === focus).map((e) => e.to), ...data.edges.filter((e) => e.to === focus).map((e) => e.from)]);
  return (
    <div className="overflow-x-auto border-t p-5">
      <p className="mb-4 text-sm text-ink/70">Columns go from starting skills (left) to skills that need the most groundwork (right). Click a skill to focus it.</p>
      <div className="flex min-w-[860px] gap-4">
        {cols.map((col, i) => (
          <ul key={i} className="flex-1 space-y-1.5">
            <li className="pb-1 text-xs font-medium text-ink/60">{i === 0 ? "Starting Skills" : `Level ${i + 1}`}</li>
            {col.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onFocus(n.id)}
                  className={cn(
                    "w-full rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    n.id === focus ? "border-indigo bg-indigo text-white" : related.has(n.id) ? "border-indigo/40 bg-secondary text-secondary-foreground" : "bg-card text-ink/80 hover:bg-muted",
                    n.in_path && n.id !== focus && "font-semibold",
                  )}
                >
                  {titleCase(n.name)}
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
