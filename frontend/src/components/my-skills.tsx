"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Flame, ShieldCheck, Sparkles, Target } from "lucide-react";
import type { Competency, Dashboard } from "@/lib/api";
import { LEVEL, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { ErrorNote, LinkButton, Loading, MasteryBar, Panel, Tag } from "./kit";

/** Only skills that a meaningful share of postings ask for (or that the route already ranks) appear on the map. */
const RELEVANT_DEMAND = 0.15;

type Status = "fix" | "strong" | "close" | "unproven";

interface Row {
  c: Competency;
  status: Status;
  rank: number | null;
  why: string | null;
}

/** Plain-language status of one skill from the role requirement, the student's level and whether there is any evidence. */
function classify(c: Competency, rank: number | null): Status {
  const hasEvidence = Object.keys(c.components ?? {}).length > 0 || c.n_items > 0;
  if (c.required != null && c.p >= c.required) return "strong";
  if (rank != null && rank <= 5) return "fix";
  if (!hasEvidence) return "unproven";
  if (c.gap <= 0.2) return "close";
  return "fix";
}

const SECTIONS: { id: Status; title: string; blurb: string; icon: typeof Flame; tone: "ember" | "mint" | "indigo" | "neutral" }[] = [
  { id: "fix", title: "Fix First", blurb: "Employers ask for these a lot and you are below the level they need. Start here.", icon: Flame, tone: "ember" },
  { id: "close", title: "Almost There", blurb: "A little more proof gets you to the level the role needs.", icon: Target, tone: "indigo" },
  { id: "strong", title: "Your Strengths", blurb: "You already meet the level employers ask for. Keep the proof ready.", icon: ShieldCheck, tone: "mint" },
  { id: "unproven", title: "Not Proven Yet", blurb: "In demand, but we have no evidence from you. Take a quick check or add a project.", icon: Sparkles, tone: "neutral" },
];

export function MySkills({ sid }: { sid: string }) {
  const { data: d, error } = useApi<Dashboard>(`/students/${sid}/dashboard`);
  const [open, setOpen] = useState<Record<string, boolean>>({ fix: true, close: true, strong: true, unproven: true });
  const rows = useMemo<Row[]>(() => {
    if (!d) return [];
    const rank = Object.fromEntries(d.ranking.map((r) => [r.skill_id, r]));
    return d.competencies.filter((c) => c.demand >= RELEVANT_DEMAND || rank[c.skill_id]).map((c) => {
      const r = rank[c.skill_id];
      return { c, rank: r?.rank ?? null, why: r?.explanation ? r.explanation.why_now : null, status: classify(c, r?.rank ?? null) };
    });
  }, [d]);
  if (error) return <ErrorNote error={error} />;
  if (!d) return <Loading label="Reading your skills…" />;

  const by = (s: Status) =>
    rows
      .filter((r) => r.status === s)
      .sort((a, b) => (s === "fix" ? (a.rank ?? 99) - (b.rank ?? 99) : b.c.demand - a.c.demand));
  const strongest = by("strong").slice(0, 3);
  const fixFirst = by("fix").slice(0, 3);

  return (
    <div className="space-y-6">
      <Panel className="bg-route-soft">
        <h2 className="text-lg font-semibold text-ink">Where You Stand for {d.role.name}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Summary label="Role readiness" value={pct(d.coverage)} note="of what employers ask for, weighted by how often" />
          <Summary label="Strongest" value={strongest.length ? strongest.map((r) => titleCase(r.c.name)).join(", ") : "Nothing proven yet"} note="skills at or above the required level" small />
          <Summary label="Fix first" value={fixFirst.length ? fixFirst.map((r) => titleCase(r.c.name)).join(", ") : "Nothing urgent"} note="biggest gap that employers care about" small />
        </div>
        <p className="mt-4 text-xs text-ink/65">
          How to read each bar: the fill is your level now, the black tick is the level employers ask for. Only skills asked for in at least 15% of the {d.role.n_postings} real postings are shown.
        </p>
      </Panel>

      {SECTIONS.map((sec) => {
        const list = by(sec.id);
        if (!list.length) return null;
        const Icon = sec.icon;
        return (
          <section key={sec.id} aria-labelledby={`sec-${sec.id}`}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [sec.id]: !o[sec.id] }))}
              aria-expanded={open[sec.id]}
              className="mb-3 flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-5 text-indigo" aria-hidden="true" />
                <span id={`sec-${sec.id}`} className="text-lg font-semibold text-ink">
                  {sec.title}
                </span>
                <Tag tone={sec.tone}>{list.length}</Tag>
              </span>
              <ChevronDown className={cn("size-4 transition-transform", open[sec.id] && "rotate-180")} aria-hidden="true" />
            </button>
            <p className="-mt-1 mb-3 text-sm text-ink/70">{sec.blurb}</p>
            {open[sec.id] ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {list.map((r) => (
                  <SkillRow key={r.c.skill_id} r={r} />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function Summary({ label, value, note, small }: { label: string; value: string; note: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-card p-4">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      <p className={cn("mt-1 font-bold leading-snug text-ink", small ? "text-[15px]" : "text-[28px]")}>{value}</p>
      <p className="mt-1 text-xs text-ink/60">{note}</p>
    </div>
  );
}

function SkillRow({ r }: { r: Row }) {
  const { c } = r;
  const tone = r.status === "strong" ? "mint" : "route";
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-ink">{titleCase(c.name)}</p>
          <p className="mt-0.5 text-xs text-ink/65">
            {LEVEL[c.level] ?? c.level} now{c.required != null ? `, role needs ${levelFor(c.required)}` : ""} · asked in {pct(c.demand)} of postings
          </p>
        </div>
        {r.rank ? <Tag tone="indigo">Priority #{r.rank}</Tag> : null}
      </div>
      <MasteryBar value={c.p} target={c.required} tone={tone} className="mt-3" />
      {r.why ? <p className="mt-2 text-xs leading-relaxed text-ink/70">{r.why}</p> : null}
      {r.status !== "strong" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton href={`/assessment/${c.skill_id}`} size="sm" variant="outline">
            {Object.keys(c.components ?? {}).length || c.n_items ? "Prove It" : "Take a Quick Check"}
          </LinkButton>
          <LinkButton href="/dashboard" size="sm" variant="ghost">
            See Route
          </LinkButton>
        </div>
      ) : (
        <p className="mt-2 text-xs text-mint-ink">{c.n_items ? `${c.n_correct}/${c.n_items} check answers correct` : "Shown by your evidence"}</p>
      )}
    </li>
  );
}

function levelFor(x: number): string {
  return x >= 0.8 ? LEVEL.mahir : x >= 0.6 ? LEVEL.mandiri : x >= 0.35 ? LEVEL.dasar : LEVEL.awal;
}
