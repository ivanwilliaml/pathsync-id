"use client";

import { Briefcase, FilePlus2, Flag, RefreshCw, Shuffle } from "lucide-react";
import { fmtDateTime, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { RequireStudent } from "@/components/require-student";
import { EmptyState, ErrorNote, LinkButton, Loading, PageHeader, Tag } from "@/components/kit";

interface HistoryRow {
  id: number;
  created_at: string;
  trigger: string;
  summary: string;
  reasons: string[];
  path: { skill_id: string; name: string; role_in_path: string }[];
  coverage: number;
}

const TRIGGER: Record<string, { label: string; icon: typeof Flag; tone: "neutral" | "indigo" | "ember" | "mint" }> = {
  initial: { label: "Route Created", icon: Flag, tone: "neutral" },
  evidence: { label: "New Evidence", icon: FilePlus2, tone: "mint" },
  market: { label: "Market Update", icon: RefreshCw, tone: "ember" },
  role: { label: "Role Changed", icon: Briefcase, tone: "indigo" },
  manual: { label: "Manual Update", icon: Shuffle, tone: "neutral" },
};

export default function HistoryPage() {
  return <RequireStudent>{(sid) => <History sid={sid} />}</RequireStudent>;
}

function History({ sid }: { sid: string }) {
  const h = useApi<HistoryRow[]>(`/students/${sid}/history`);
  if (h.error) return <ErrorNote error={h.error} />;
  if (!h.data) return <Loading />;
  return (
    <div>
      <PageHeader mascot="map-route" title="Path History" description="Every time your route changes, we keep a record of what triggered it and why." />
      {h.data.length === 0 ? (
        <EmptyState title="No Changes Yet" mascot="map-route" action={<LinkButton href="/assessment">Take the Quick Check</LinkButton>}>
          Your history starts once you add evidence or take the quick check.
        </EmptyState>
      ) : (
        <div className="relative">
          <div className="absolute bottom-3 left-[15px] top-3 w-[3px] rounded-full bg-route-v" aria-hidden="true" />
          <ol className="relative space-y-5 pl-10">
          {h.data.map((r) => {
            const t = TRIGGER[r.trigger] ?? TRIGGER.manual;
            const Icon = t.icon;
            const [head, ...rest] = r.summary.split(": ");
            return (
              <li key={r.id} className="relative">
                <span className="absolute -left-10 top-4 flex size-8 items-center justify-center rounded-full border-4 border-background bg-ink text-white" aria-hidden="true">
                  <Icon className="size-3.5" />
                </span>
                <article className="rounded-2xl border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
                    <Tag tone={t.tone}>{t.label}</Tag>
                    <time dateTime={r.created_at}>{fmtDateTime(r.created_at)}</time>
                    <span>Readiness {pct(r.coverage)}</span>
                  </div>
                  <h2 className="mt-2 font-semibold text-ink">{rest.length ? rest.join(": ") : head}</h2>
                  {r.reasons.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/75">
                      {r.reasons.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  ) : null}
                  <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Route at that time">
                    {r.path.map((p, i) => (
                      <li key={p.skill_id}>
                        <Tag tone={p.role_in_path === "prioritas" ? "indigo" : "ember"}>
                          {i + 1}. {titleCase(p.name)}
                        </Tag>
                      </li>
                    ))}
                  </ol>
                </article>
              </li>
            );
          })}
          </ol>
        </div>
      )}
    </div>
  );
}
