"use client";

import { useEffect, useMemo, useState } from "react";
import { SkillTree, TreeLegend, treeScope } from "./skill-tree";
import { CLUSTER_ORDER, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useStudentId } from "@/lib/student";
import { cn } from "@/lib/utils";
import { ErrorNote, Loading, NativeSelect, PageHeader, Panel } from "./kit";

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
  active?: boolean;
}
interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  clusters: Record<string, string>;
}


/** Prerequisite map: what each skill builds on and what it opens up (personal when a profile exists). */
export function Connections({ embedded }: { embedded?: boolean }) {
  const { id, ready } = useStudentId();
  const g = useApi<GraphData>(ready ? (id ? `/students/${id}/graph` : "/graph") : null);
  const [focus, setFocus] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState(false);
  const pick = (id: string) => {
    setFocus(id);
    setPicked(true);
  };
  const t = useT();

  const data = g.data;
  const route = useMemo(() => (data?.nodes ?? []).filter((n) => n.in_path).sort((a, b) => (a.path_index ?? 99) - (b.path_index ?? 99)), [data]);
  const activeEdges = useMemo(() => (data?.edges ?? []).filter((e) => e.active !== false), [data]);
  const scope = useMemo(() => treeScope(data?.nodes ?? [], activeEdges, showAll), [data, activeEdges, showAll]);

  useEffect(() => {
    if (!data || focus) return;
    const first = data.nodes.find((n) => n.rank === 1) ?? route[0] ?? [...data.nodes].sort((a, b) => b.demand - a.demand)[0];
    setFocus(first?.id ?? null);
  }, [data, focus, route]);

  if (g.error) return <ErrorNote error={g.error} />;
  if (!data || !focus) return <Loading />;

  const personal = data.nodes.some((n) => n.p != null);

  return (
    <div>
      {embedded ? null : (
        <PageHeader
          mascot="nodes"
          title={t("Skill Tree", "Pohon Skill")}
          description={t(
            "How skills build on each other, from foundations on the left to advanced skills on the right. Links are reviewed by Business Analyst experts; your route is numbered. Click a skill to light up what it needs and what it opens.",
            "Bagaimana skill saling membangun, dari dasar di kiri ke skill lanjutan di kanan. Tautannya ditinjau pakar Business Analyst; rutemu diberi nomor. Klik skill untuk menyalakan apa yang dibutuhkannya dan apa yang dibukanya.",
          )}
        />
      )}
      <Panel className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-xs space-y-1.5">
            <label htmlFor="pick" className="text-sm font-medium text-ink">
              {t("Find a skill", "Cari skill")}
            </label>
            <NativeSelect id="pick" value={focus} onChange={(e) => pick(e.target.value)}>
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
          <div role="group" aria-label={t("Skills shown", "Skill yang ditampilkan")} className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={showAll === v}
                onClick={() => setShowAll(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  showAll === v ? "bg-card text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
                )}
              >
                {v
                  ? t(`All skills (${data.nodes.length})`, `Semua skill (${data.nodes.length})`)
                  : t(`For my role (${scope.size})`, `Untuk role-ku (${scope.size})`)}
              </button>
            ))}
          </div>
        </div>
        <SkillTree
          nodes={data.nodes.filter((n) => scope.has(n.id) || n.id === focus)}
          edges={activeEdges.filter((e) => (scope.has(e.from) || e.from === focus) && (scope.has(e.to) || e.to === focus))}
          focus={focus}
          onFocus={pick}
          personal={personal}
          clusters={data.clusters}
          lit={picked}
        />
        <TreeLegend personal={personal} />
      </Panel>

    </div>
  );
}
