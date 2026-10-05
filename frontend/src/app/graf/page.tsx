"use client";

import { useMemo, useState } from "react";
import { num, pct } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useStudentId } from "@/lib/student";
import { Badge, Card, ErrorBox, PageHeader, Spinner } from "@/components/ui";

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
  bottleneck: boolean;
}
interface GEdge {
  id: number;
  from: string;
  to: string;
  source: string;
  rationale: string;
  status: string;
  active: boolean;
}
interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  clusters: Record<string, string>;
}

const COL_W = 230;
const NODE_W = 190;
const NODE_H = 38;
const ROW_H = 48;
const PAD = 20;

const CLUSTER_COLOR: Record<string, string> = {
  data_analytics: "#2563eb",
  business_process: "#0f766e",
  tools: "#9333ea",
  communication: "#c2410c",
};

export default function GrafPage() {
  const { id, ready } = useStudentId();
  const g = useApi<GraphData>(ready ? (id ? `/students/${id}/graph` : "/graph") : null);
  const [sel, setSel] = useState<string | null>(null);

  const layout = useMemo(() => (g.data ? computeLayout(g.data) : null), [g.data]);
  if (g.error) return <ErrorBox error={g.error} />;
  if (!g.data || !layout) return <Spinner />;
  const data = g.data;
  const byId = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  const related = new Set<string>();
  if (sel) {
    related.add(sel);
    data.edges.forEach((e) => {
      if (e.from === sel) related.add(e.to);
      if (e.to === sel) related.add(e.from);
    });
  }
  const selNode = sel ? byId[sel] : null;
  const personal = data.nodes.some((n) => n.p != null);

  return (
    <div>
      <PageHeader
        title="Graf prasyarat"
        subtitle={`${data.nodes.length} skill, ${data.edges.length} relasi prasyarat (sumber ESCO/tim, divalidasi pakar). Kolom = kedalaman prasyarat. Klik skill untuk melihat prasyarat dan skill yang dibukanya.`}
      />
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        {Object.entries(data.clusters).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm" style={{ background: CLUSTER_COLOR[k] }} /> {v}
          </span>
        ))}
        {personal && (
          <>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm border-2 border-amber-500" /> titik hambat
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm bg-brand-soft ring-2 ring-brand" /> di jalur belajarmu
            </span>
            <span>isi batang = penguasaan, garis = target</span>
          </>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-x-auto p-2">
          <svg width={layout.width} height={layout.height} className="block">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
              </marker>
              <marker id="arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#0f766e" />
              </marker>
            </defs>
            {data.edges.map((e) => {
              const a = layout.pos[e.from];
              const b = layout.pos[e.to];
              if (!a || !b) return null;
              const hi = sel && (e.from === sel || e.to === sel);
              const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={e.id}
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2 - 2},${y2}`}
                  fill="none"
                  stroke={hi ? "#0f766e" : "#cbd5e1"}
                  strokeWidth={hi ? 2 : 1}
                  strokeDasharray={e.status === "rejected" ? "4 3" : undefined}
                  opacity={sel && !hi ? 0.25 : 1}
                  markerEnd={hi ? "url(#arrow-hi)" : "url(#arrow)"}
                >
                  <title>{e.rationale}</title>
                </path>
              );
            })}
            {data.nodes.map((n) => {
              const p = layout.pos[n.id];
              const dim = sel && !related.has(n.id);
              const color = CLUSTER_COLOR[n.cluster] ?? "#64748b";
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} onClick={() => setSel(sel === n.id ? null : n.id)} className="cursor-pointer" opacity={dim ? 0.3 : 1}>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={n.in_path ? "#e6f4f2" : "#fff"}
                    stroke={n.bottleneck ? "#f59e0b" : n.in_path ? "#0f766e" : "#e3e7ec"}
                    strokeWidth={n.bottleneck || n.in_path || sel === n.id ? 2 : 1}
                  />
                  <rect x={0} y={0} width={4} height={NODE_H} rx={2} fill={color} />
                  <text x={10} y={15} fontSize={11} fontWeight={600} fill="#17212b">
                    {n.name.length > 27 ? n.name.slice(0, 26) + "…" : n.name}
                  </text>
                  {n.rank != null && (
                    <text x={NODE_W - 6} y={15} fontSize={10} textAnchor="end" fill="#0f766e" fontWeight={700}>
                      #{n.rank}
                    </text>
                  )}
                  {n.p != null ? (
                    <g transform="translate(10,23)">
                      <rect width={NODE_W - 20} height={6} rx={3} fill="#f2f4f7" />
                      <rect width={(NODE_W - 20) * Math.min(1, n.p)} height={6} rx={3} fill={color} opacity={0.8} />
                      {n.required != null && <rect x={(NODE_W - 20) * Math.min(1, n.required) - 1} y={-2} width={2} height={10} fill="#17212b" />}
                    </g>
                  ) : (
                    <text x={10} y={30} fontSize={10} fill="#5b6672">
                      permintaan {pct(n.demand)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </Card>
        <Card title={selNode ? selNode.name : "Detail"} className="h-fit">
          {!selNode ? (
            <p className="text-sm text-muted">Pilih skill di graf.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>{data.clusters[selNode.cluster]}</Badge>
                {selNode.bottleneck && <Badge tone="warn">titik hambat</Badge>}
                {selNode.in_path && <Badge tone="brand">di jalur</Badge>}
                {selNode.rank != null && <Badge tone="brand">prioritas #{selNode.rank}</Badge>}
              </div>
              <div className="text-xs text-muted">
                Permintaan {pct(selNode.demand)}
                {selNode.p != null && ` · penguasaan ${num(selNode.p)} / target ${num(selNode.required)}`}
              </div>
              <EdgeList title="Prasyarat" edges={data.edges.filter((e) => e.to === selNode.id)} other={(e) => byId[e.from]} onPick={setSel} />
              <EdgeList title="Membuka" edges={data.edges.filter((e) => e.from === selNode.id)} other={(e) => byId[e.to]} onPick={setSel} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function EdgeList({ title, edges, other, onPick }: { title: string; edges: GEdge[]; other: (e: GEdge) => GNode; onPick: (id: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      {edges.length === 0 ? (
        <p className="text-xs text-muted">—</p>
      ) : (
        <ul className="space-y-2">
          {edges.map((e) => {
            const o = other(e);
            return (
              <li key={e.id}>
                <button className="font-medium text-brand hover:underline" onClick={() => onPick(o.id)}>
                  {o.name}
                </button>{" "}
                <Badge tone={e.status === "approved" ? "good" : e.status === "rejected" ? "bad" : "neutral"}>{e.status}</Badge>
                <p className="text-xs text-muted">{e.rationale}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Columns by depth; rows ordered by the mean row of predecessors (one barycentre pass) to reduce crossings. */
function computeLayout(g: GraphData) {
  const cols: Record<number, GNode[]> = {};
  g.nodes.forEach((n) => (cols[n.depth] ??= []).push(n));
  const depths = Object.keys(cols).map(Number).sort((a, b) => a - b);
  const preds: Record<string, string[]> = {};
  g.edges.forEach((e) => (preds[e.to] ??= []).push(e.from));
  const clusterOrder = Object.keys(g.clusters);
  const row: Record<string, number> = {};
  for (const d of depths) {
    const list = cols[d];
    const key = (n: GNode) => {
      const ps = (preds[n.id] ?? []).filter((p) => p in row);
      return ps.length ? ps.reduce((a, p) => a + row[p], 0) / ps.length : clusterOrder.indexOf(n.cluster) * 3;
    };
    list.sort((a, b) => key(a) - key(b) || clusterOrder.indexOf(a.cluster) - clusterOrder.indexOf(b.cluster));
    list.forEach((n, i) => (row[n.id] = i));
  }
  const maxRows = Math.max(...depths.map((d) => cols[d].length));
  const pos: Record<string, { x: number; y: number }> = {};
  for (const d of depths) {
    const offset = ((maxRows - cols[d].length) * ROW_H) / 2;
    cols[d].forEach((n, i) => (pos[n.id] = { x: PAD + d * COL_W, y: PAD + offset + i * ROW_H }));
  }
  return { pos, width: PAD * 2 + (depths.length - 1) * COL_W + NODE_W, height: PAD * 2 + maxRows * ROW_H };
}
