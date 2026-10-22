"use client";

import { useState } from "react";
import { Briefcase, FilePlus2, Flag, RefreshCw, Shuffle } from "lucide-react";
import { fmtDateTime, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useDesktop } from "@/lib/use-desktop";
import type { Meta } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChangeList } from "./change-list";
import { EmptyState, ErrorNote, LinkButton, Loading, PageHeader, Tag } from "./kit";
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
  evidence: { label: ["New Evidence", "Bukti Baru"], icon: FilePlus2, tone: "mint" },
  market: { label: ["Market Update", "Update Pasar"], icon: RefreshCw, tone: "ember" },
  role: { label: ["Role Changed", "Role Berubah"], icon: Briefcase, tone: "indigo" },
  manual: { label: ["Manual Update", "Update Manual"], icon: Shuffle, tone: "neutral" },
};

/** The summary without its trigger label (the tag already says it) and without a trailing technical note such as a
 * data snapshot id, which is shown separately as provenance. */
const headline = (r: HistoryRow) => {
  const [head, ...rest] = r.summary.split(": ");
  const full = rest.length ? rest.join(": ") : head;
  const m = full.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  const text = m ? m[1] : full;
  return { text: text.charAt(0).toUpperCase() + text.slice(1), note: m ? m[2] : null };
};

/** Every change to the student's route with its trigger and reasons. `embedded` (inside Learn): no page header, and an
 * index of dated events beside the chosen event's detail (on phones the detail opens under its event). */
export function RouteHistory({ sid, embedded }: { sid: string; embedded?: boolean }) {
  const h = useApi<HistoryRow[]>(`/students/${sid}/history`);
  const meta = useApi<Meta>("/meta");
  const desktop = useDesktop();
  const [picked, setPicked] = useState<number | null>(null);
  const tr = useT();
  const roleName = Object.fromEntries((meta.data?.roles ?? []).map((r) => [r.id, r.name]));
  if (h.error) return <ErrorNote error={h.error} />;
  if (!h.data) return <Loading />;
  const rows = h.data;
  const sel = rows.find((r) => r.id === picked) ?? rows[0];
  const detail = (r: HistoryRow) => <EventDetail r={r} prev={rows[rows.indexOf(r) + 1]} roleName={roleName} />;
  return (
    <div>
      {embedded ? null : (
        <PageHeader mascot="map-route" title={tr("Route History", "Riwayat Rute")} description={tr("Every time your route changes, we keep a record of what triggered it and why.", "Setiap kali rutemu berubah, kami mencatat apa pemicunya dan kenapa.")} />
      )}
      {rows.length === 0 ? (
        <EmptyState title={tr("No Changes Yet", "Belum Ada Perubahan")} mascot="map-route" action={<LinkButton href="/assessment">{tr("Take the Skill Check", "Ikuti Cek Kemampuan")}</LinkButton>}>
          {tr("Your history starts once you add evidence or take the skill check.", "Riwayatmu dimulai setelah kamu menambah bukti atau mengikuti Cek Kemampuan.")}
        </EmptyState>
      ) : (
        <div className={cn("grid gap-6", desktop && "lg:grid-cols-[280px_minmax(0,1fr)]")}>
          <ol className="divide-y border-y" aria-label={tr("Route changes, newest first", "Perubahan rute, terbaru dulu")}>
            {rows.map((r) => {
              const tg = TRIGGER[r.trigger] ?? TRIGGER.manual;
              const Icon = tg.icon;
              const on = r.id === sel.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-expanded={desktop ? undefined : on}
                    onClick={() => setPicked(r.id)}
                    className={cn("flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60", on && "bg-secondary/50")}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-ink/60" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{tr(...tg.label)}</span>
                      <time dateTime={r.created_at} className="block text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</time>
                    </span>
                  </button>
                  {!desktop && on ? <div className="border-t px-3 py-3">{detail(r)}</div> : null}
                </li>
              );
            })}
          </ol>
          {desktop ? <div className="min-w-0">{detail(sel)}</div> : null}
        </div>
      )}
    </div>
  );
}

/** One change: what changed first, then why, then the route at that time and other careers that moved. */
function EventDetail({ r, prev, roleName }: { r: HistoryRow; prev?: HistoryRow; roleName: Record<string, string> }) {
  const tr = useT();
  const tg = TRIGGER[r.trigger] ?? TRIGGER.manual;
  // other careers that moved since the previous (older) entry, biggest change first
  const moved = r.careers && prev?.careers
    ? Object.entries(r.careers)
        .map(([id, v]) => ({ id, now: v, before: prev.careers![id] ?? 0 }))
        .filter((m) => Math.abs(m.now - m.before) >= 0.01 && Math.abs(m.now - r.coverage) > 1e-4)
        .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
        .slice(0, 4)
    : [];
  return (
    <article className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
          <Tag tone={tg.tone}>{tr(...tg.label)}</Tag>
          <span>Readiness {pct(r.coverage)}{prev ? ` (${tr("was", "sebelumnya")} ${pct(prev.coverage)})` : ""}</span>
        </div>
        <h3 className="mt-2 text-base font-semibold text-ink">{headline(r).text}</h3>
        {headline(r).note ? <p className="mt-0.5 text-xs text-muted-foreground">{tr("Source", "Sumber")}: {headline(r).note}</p> : null}
      </div>
      {r.reasons.length ? (
        <div>
          <p className="text-xs font-semibold text-ink/60">{tr("Why", "Kenapa")}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/80">
            {r.reasons.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-semibold text-ink/60">{tr("Route at that time", "Rute saat itu")}</p>
        <ol className="mt-1.5 flex flex-wrap gap-1.5">
          {r.path.map((p, i) => (
            <li key={p.skill_id}>
              <Tag tone={p.role_in_path === "prioritas" ? "indigo" : "ember"}>
                {i + 1}. {titleCase(p.name)}
              </Tag>
            </li>
          ))}
        </ol>
      </div>
      {moved.length ? (
        <details className="border-y py-2">
          <summary className="cursor-pointer text-sm font-medium text-ink">{tr(`Other careers that moved (${moved.length})`, `Karier lain yang bergerak (${moved.length})`)}</summary>
          <ChangeList items={moved.map((m) => ({ id: m.id, name: roleName[m.id] ?? titleCase(m.id.replace(/_/g, " ")), before: m.before, now: m.now }))} />
        </details>
      ) : null}
    </article>
  );
}
