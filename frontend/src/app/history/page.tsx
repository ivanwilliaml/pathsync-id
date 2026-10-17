"use client";

import { Briefcase, FilePlus2, Flag, RefreshCw, Shuffle } from "lucide-react";
import { fmtDateTime, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Meta } from "@/lib/api";
import { ChangeList } from "@/components/change-list";
import { RequireStudent } from "@/components/require-student";
import { EmptyState, ErrorNote, LinkButton, Loading, PageHeader, Tag } from "@/components/kit";
import { useT } from "@/lib/i18n";

interface HistoryRow {
  id: number;
  created_at: string;
  trigger: string;
  summary: string;
  reasons: string[];
  path: { skill_id: string; name: string; role_in_path: string }[];
  coverage: number;
  careers: Record<string, number> | null;
}

const TRIGGER: Record<string, { label: [string, string]; icon: typeof Flag; tone: "neutral" | "indigo" | "ember" | "mint" }> = {
  initial: { label: ["Route Created", "Rute Dibuat"], icon: Flag, tone: "neutral" },
  evidence: { label: ["New Evidence", "Evidence Baru"], icon: FilePlus2, tone: "mint" },
  market: { label: ["Market Update", "Update Pasar"], icon: RefreshCw, tone: "ember" },
  role: { label: ["Role Changed", "Role Berubah"], icon: Briefcase, tone: "indigo" },
  manual: { label: ["Manual Update", "Update Manual"], icon: Shuffle, tone: "neutral" },
};

export default function HistoryPage() {
  return <RequireStudent>{(sid) => <History sid={sid} />}</RequireStudent>;
}

function History({ sid }: { sid: string }) {
  const h = useApi<HistoryRow[]>(`/students/${sid}/history`);
  const meta = useApi<Meta>("/meta");
  const tr = useT();
  const roleName = Object.fromEntries((meta.data?.roles ?? []).map((r) => [r.id, r.name]));
  if (h.error) return <ErrorNote error={h.error} />;
  if (!h.data) return <Loading />;
  return (
    <div>
      <PageHeader mascot="map-route" title="Path History" description={tr("Every time your route changes, we keep a record of what triggered it and why.", "Setiap kali rutemu berubah, kami mencatat apa pemicunya dan kenapa.")} />
      {h.data.length === 0 ? (
        <EmptyState title={tr("No Changes Yet", "Belum Ada Perubahan")} mascot="map-route" action={<LinkButton href="/assessment">{tr("Take the Quick Check", "Ikuti Quick Check")}</LinkButton>}>
          {tr("Your history starts once you add evidence or take the quick check.", "Riwayatmu dimulai setelah kamu menambah evidence atau mengikuti Quick Check.")}
        </EmptyState>
      ) : (
        <div className="relative">
          <div className="absolute bottom-3 left-[15px] top-3 w-[3px] rounded-full bg-route-v" aria-hidden="true" />
          <ol className="relative space-y-5 pl-10">
          {h.data.map((r, idx) => {
            const t = TRIGGER[r.trigger] ?? TRIGGER.manual;
            // other careers that moved since the previous (older) entry, biggest change first
            const prev = h.data![idx + 1]?.careers;
            const moved = r.careers && prev
              ? Object.entries(r.careers)
                  .map(([id, v]) => ({ id, now: v, before: prev[id] ?? 0 }))
                  .filter((m) => Math.abs(m.now - m.before) >= 0.01 && Math.abs(m.now - r.coverage) > 1e-4)
                  .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
                  .slice(0, 4)
              : [];
            const Icon = t.icon;
            const [head, ...rest] = r.summary.split(": ");
            return (
              <li key={r.id} className="relative">
                <span className="absolute -left-10 top-4 flex size-8 items-center justify-center rounded-full border-4 border-background bg-ink text-white" aria-hidden="true">
                  <Icon className="size-3.5" />
                </span>
                <article className="rounded-2xl border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
                    <Tag tone={t.tone}>{tr(...t.label)}</Tag>
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
                  {moved.length ? (
                    <div className="mt-4 rounded-xl border px-4 pt-3 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tr("Other careers that moved", "Karier lain yang bergerak")}</p>
                      <ChangeList items={moved.map((m) => ({ id: m.id, name: roleName[m.id] ?? titleCase(m.id.replace(/_/g, " ")), before: m.before, now: m.now }))} />
                    </div>
                  ) : null}
                  <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={tr("Route at that time", "Rute saat itu")}>
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
