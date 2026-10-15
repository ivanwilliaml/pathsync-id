"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Clock, Lock } from "lucide-react";
import { api, FEATURE_LABELS, type Competency, type Dashboard, type PathStep, type RankRow } from "@/lib/api";
import { CLUSTER_ORDER, LEVEL, REC, firstSentence, hours, num, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { track, trackOnce } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequireStudent } from "@/components/require-student";
import { ReadinessRing } from "@/components/readiness-ring";
import { SkillSheet, type SkillDetail } from "@/components/skill-sheet";
import { EmptyState, ErrorNote, LinkButton, Loading, MasteryBar, Panel, SectionTitle, Tag } from "@/components/kit";

export default function DashboardPage() {
  return <RequireStudent>{(sid) => <DashboardView sid={sid} />}</RequireStudent>;
}

function DashboardView({ sid }: { sid: string }) {
  const { data: d, error } = useApi<Dashboard>(`/students/${sid}/dashboard`);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const pulseReady = usePulseReady();
  useEffect(() => trackOnce("next_step_viewed", `next-${sid}`), [sid]);
  const comps = useMemo(() => Object.fromEntries((d?.competencies ?? []).map((c) => [c.skill_id, c])), [d]);
  const ranks = useMemo(() => Object.fromEntries((d?.ranking ?? []).map((r) => [r.skill_id, r])), [d]);

  if (error) return <ErrorNote error={error} />;
  if (!d) return <Loading label="Building your route…" />;

  const hasEvidence = d.diagnostic_done || Object.entries(d.evidence_summary).some(([, v]) => v > 0);
  const names = Object.fromEntries(d.competencies.map((c) => [c.skill_id, titleCase(c.name)]));
  const open = (skillId: string) => {
    markPulseReady();
    track("why_opened", { skill: skillId });
    const r = ranks[skillId];
    const step = d.path.find((p) => p.skill_id === skillId);
    setDetail({
      skill_id: skillId,
      name: r?.name ?? step?.name ?? names[skillId],
      rank: r?.rank,
      rec_type: r?.rec_type ?? step?.rec_type,
      bottleneck: r?.explanation?.bottleneck,
      explanation: r?.explanation ?? step?.explanation,
      step,
      competency: comps[skillId],
    });
  };
  const top = d.ranking[0];
  const weekly = Number(d.student.preferences.weekly_hours ?? 6);
  const f = d.features ?? { evidence: true, graph: true, adaptive: true, explanations: true, path: true };
  if (!f.path) return <ControlListView d={d} sid={sid} />;

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid gap-6 rounded-3xl bg-route-soft p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <h1 className="text-[30px] font-extrabold leading-tight text-ink sm:text-[36px]">Hi, {d.student.display_name}</h1>
          <p className="mt-1 text-ink/70">
            Your route to <span className="font-semibold text-ink">{d.role.name}</span>, based on {d.role.n_postings} real job postings.
          </p>
          {!hasEvidence ? (
            <div className="mt-6 rounded-2xl bg-card p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-ink">Make This Route Yours</h2>
              <p className="mt-1 text-sm text-ink/70">
                Right now everyone starts from zero. Add your transcript or take the quick check so we know what you can already do.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href="/assessment" size="lg" className="h-10">
                  Take the Quick Check
                </LinkButton>
                <LinkButton href="/evidence" variant="outline" size="lg" className="h-10">
                  Add My Evidence
                </LinkButton>
              </div>
            </div>
          ) : top ? (
            <div className="mt-6 rounded-2xl bg-card p-5 shadow-sm">
              <p className="text-sm font-medium text-indigo">Your Next Step</p>
              <h2 className="mt-1 text-[22px] font-bold leading-snug text-ink">{titleCase(top.name)}</h2>
              <p className="mt-1.5 text-sm text-ink/75">{top.explanation ? firstSentence(top.explanation.why_now) : null}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="lg" className="h-10" onClick={() => open(top.skill_id)}>
                  See Why and How
                </Button>
                <LinkButton href={`/assessment/${top.skill_id}`} variant="outline" size="lg" className="h-10">
                  I Already Know This
                </LinkButton>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-card p-5 text-ink/80">You meet every requirement we track for this role. Nice work.</p>
          )}
        </div>
        <div className="flex items-center gap-5 lg:flex-col lg:text-center">
          {f.evidence ? <ReadinessRing value={hasEvidence ? d.coverage : null} label="Role Readiness" /> : null}
          <p className="max-w-[220px] text-sm text-ink/70">
            {hasEvidence
              ? "How much of what employers ask for you can already show."
              : "Not measured yet. Your readiness appears after your first evidence or quick check."}
          </p>
        </div>
      </section>

      {d.student.preferences.demo ? <DemoGuide topId={top?.skill_id} topName={top ? titleCase(top.name) : undefined} /> : null}
      {d.study_arm ? <StudyPlanCard sid={sid} /> : null}
      {pulseReady ? <ClarityPulse sid={sid} /> : null}
      {f.evidence && d.confirmations.length > 0 ? <Attention items={d.confirmations} onOpen={open} /> : null}

      <LearningRoute steps={d.path} names={names} onOpen={open} totalHours={d.path_hours} weekly={weekly} />

      <section aria-labelledby="priorities">
        <SectionTitle id="priorities">Top Priorities</SectionTitle>
        <ul className="divide-y rounded-2xl border bg-card">
          {d.ranking.slice(0, 3).map((r) => (
            <PriorityRow key={r.skill_id} r={r} comp={comps[r.skill_id]} onOpen={() => open(r.skill_id)} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="explore">
        <SectionTitle id="explore">Explore Your Profile</SectionTitle>
        <Tabs defaultValue="areas">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="areas">Skills by Area</TabsTrigger>
            <TabsTrigger value="all">All Skills</TabsTrigger>
            <TabsTrigger value="order">Why This Order</TabsTrigger>
            <TabsTrigger value="ranking">How We Ranked</TabsTrigger>
          </TabsList>
          <TabsContent value="areas">
            <Areas d={d} measured={hasEvidence} />
          </TabsContent>
          <TabsContent value="all">
            <AllSkills comps={d.competencies} onOpen={open} />
          </TabsContent>
          <TabsContent value="order">
            <WhyOrder d={d} names={names} />
          </TabsContent>
          <TabsContent value="ranking">
            <HowRanked ranking={d.ranking} />
          </TabsContent>
        </Tabs>
      </section>

      <SkillSheet detail={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}

function Attention({ items, onOpen }: { items: Dashboard["confirmations"]; onOpen: (id: string) => void }) {
  return (
    <section aria-labelledby="attention" className="rounded-2xl border border-ember/30 bg-[#fff7f1] p-5">
      <h2 id="attention" className="flex items-center gap-2 font-semibold text-ember-ink">
        <AlertTriangle className="size-4" aria-hidden="true" /> Worth Confirming
      </h2>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 4).map((c, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink/85">
              <button type="button" className="font-semibold text-ink underline-offset-2 hover:underline" onClick={() => onOpen(c.skill_id)}>
                {titleCase(c.name)}
              </button>
              : {c.message}
            </span>
            <LinkButton href={`/assessment/${c.skill_id}`} variant="outline" size="sm">
              Prove It
            </LinkButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The signature element: the route, drawn with the brand gradient. */
function LearningRoute({ steps, names, onOpen, totalHours, weekly }: { steps: PathStep[]; names: Record<string, string>; onOpen: (id: string) => void; totalHours: number; weekly: number }) {
  if (!steps.length) return null;
  const weeks = weekly ? Math.max(1, Math.round(totalHours / weekly)) : null;
  return (
    <section aria-labelledby="route">
      <SectionTitle
        id="route"
        action={
          <span className="flex items-center gap-1.5 text-sm text-ink/70">
            <Clock className="size-4" aria-hidden="true" /> About {hours(totalHours)}
            {weeks ? `, ${weeks} week${weeks > 1 ? "s" : ""} at ${weekly} h a week` : ""}
          </span>
        }
      >
        Your Learning Route
      </SectionTitle>
      <ol className="relative grid gap-4 md:grid-cols-[repeat(var(--steps),minmax(0,1fr))] md:gap-3" style={{ ["--steps" as string]: steps.length }}>
        {steps.map((s, i) => {
          const prereq = s.role_in_path !== "prioritas";
          return (
            <li key={s.skill_id} className="relative flex md:flex-col">
              {/* connector */}
              <span
                className="absolute left-[19px] top-10 h-[calc(100%+16px)] w-1 bg-route-v md:left-10 md:top-[18px] md:h-1 md:w-[calc(100%+12px)] md:bg-route"
                style={{ display: i === steps.length - 1 ? "none" : undefined }}
                aria-hidden="true"
              />
              <span
                className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-4 border-background text-sm font-bold text-white ${prereq ? "bg-iris" : "bg-indigo"}`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onOpen(s.skill_id)}
                className="ml-3 flex-1 rounded-2xl border bg-card p-4 text-left transition-[border-color,box-shadow] hover:border-indigo/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:ml-0 md:mt-3"
              >
                <span className="flex flex-wrap gap-1.5">
                  <Tag tone={prereq ? "ember" : "indigo"}>{prereq ? "Prerequisite" : `Priority #${s.rank}`}</Tag>
                </span>
                <span className="mt-2 block font-semibold leading-snug text-ink">{titleCase(s.name)}</span>
                <span className="mt-1 block text-xs text-ink/65">
                  Start with a ~{hours(s.first_module_hours ?? s.hours)} first module. Full gap: {LEVEL[s.level_now]} to {LEVEL[s.level_target]}, about {hours(s.hours)}
                </span>
                {s.waiting_for.length ? (
                  <span className="mt-2 flex items-center gap-1 text-xs text-ember-ink">
                    <Lock className="size-3" aria-hidden="true" /> After {s.waiting_for.map((w) => names[w] ?? w).join(", ")}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PriorityRow({ r, comp, onOpen }: { r: RankRow; comp?: Competency; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{r.rank}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{titleCase(r.name)}</span>
            {r.explanation?.bottleneck ? <Tag tone="ember">Bottleneck</Tag> : null}
            <Tag tone={r.rec_type === "buktikan" ? "mint" : "neutral"}>{REC[r.rec_type]}</Tag>
          </span>
          {r.explanation ? <span className="mt-1 block truncate text-sm text-ink/65">{firstSentence(r.explanation.why)}</span> : null}
          {comp ? <MasteryBar value={comp.p} target={comp.required} className="mt-3 max-w-md" /> : null}
        </span>
        <ChevronRight className="size-5 text-ink/40" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Shown only on one-click demo profiles: what to try, in the order that shows the adaptive cycle. */
function DemoGuide({ topId, topName }: { topId?: string; topName?: string }) {
  return (
    <section aria-labelledby="demo-guide" className="rounded-2xl border border-indigo/30 bg-card p-5">
      <h2 id="demo-guide" className="font-semibold text-ink">
        You are looking at a demo student
      </h2>
      <p className="mt-1 text-sm text-ink/75">
        Rani studies Information Systems (semester 6) and wants to become a Business Analyst. Her transcript is already in. Three
        things to try:
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink/80">
        <li>Open the first priority and read why it comes first: the job-ad quotes, what it unlocks, and what would change the order.</li>
        <li>
          {topId ? (
            <Link href={`/assessment/${topId}`} className="font-medium text-indigo underline-offset-4 hover:underline">
              Take the short check for {topName}
            </Link>
          ) : (
            "Take a short skill check"
          )}{" "}
          and watch the route reorder from the new evidence.
        </li>
        <li>
          Open{" "}
          <Link href="/history" className="font-medium text-indigo underline-offset-4 hover:underline">
            Path History
          </Link>{" "}
          to see every change and the reason for it.
        </li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">Demo profiles are deleted automatically after 2 days and are never used in research.</p>
    </section>
  );
}

function Areas({ d, measured }: { d: Dashboard; measured: boolean }) {
  const order = CLUSTER_ORDER.filter((k) => d.coverage_by_cluster[k]);
  if (!measured)
    return (
      <Panel>
        <p className="text-sm text-ink/70">
          Nothing measured yet. Add your transcript, a certificate or a project, or take the quick check, and your coverage per area appears here.
        </p>
      </Panel>
    );
  return (
    <Panel>
      <ul className="grid gap-6 sm:grid-cols-2">
        {order.map((k) => {
          const c = d.coverage_by_cluster[k];
          return (
            <li key={k}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-medium text-ink">{c.label}</span>
                <span className="tabular text-sm font-semibold text-ink">{c.measured === false ? "Not measured" : pct(c.coverage)}</span>
              </div>
              <MasteryBar value={c.measured === false ? 0 : c.coverage} tone="indigo" />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function AllSkills({ comps, onOpen }: { comps: Competency[]; onOpen: (id: string) => void }) {
  const [onlyGaps, setOnlyGaps] = useState(true);
  const rows = (onlyGaps ? comps.filter((c) => c.gap > 0.01) : comps).slice().sort((a, b) => b.demand - a.demand);
  return (
    <Panel className="p-0 sm:p-0">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <p className="text-sm text-ink/70">{rows.length} skills, most in-demand first</p>
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)} className="size-4 accent-[#4338ca]" />
          Only skills to improve
        </label>
      </div>
      <ul className="divide-y">
        {rows.map((c) => (
          <li key={c.skill_id}>
            <button
              type="button"
              onClick={() => onOpen(c.skill_id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,40%)] items-center gap-4 px-5 py-3 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{titleCase(c.name)}</span>
                <span className="block text-xs text-ink/60">
                  {LEVEL[c.level]}, asked in {pct(c.demand)} of postings{c.low_confidence ? ", little evidence yet" : ""}
                </span>
              </span>
              <MasteryBar value={c.p} target={c.required} tone="indigo" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function WhyOrder({ d, names }: { d: Dashboard; names: Record<string, string> }) {
  const cf = d.counterfactual;
  return (
    <Panel>
      <p className="mb-5 max-w-2xl text-sm text-ink/75">
        We compared your route with simpler ways of ordering the same skills. &ldquo;Stuck&rdquo; means a step comes before something it depends on.
      </p>
      <ul className="space-y-3">
        {cf.alternatives.map((a, i) => (
          <li key={a.label} className={`rounded-xl border p-4 ${i === 0 ? "border-indigo/40 bg-secondary/40" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink">{i === 0 ? "Your Route" : titleCase(a.label)}</span>
              <Tag tone={a.blocked ? "red" : "mint"}>{a.blocked ? `Stuck ${a.blocked}×` : "Never stuck"}</Tag>
            </div>
            <p className="mt-1.5 text-sm text-ink/70">{a.order.map((s) => names[s] ?? s).join(", then ")}</p>
          </li>
        ))}
      </ul>
      {cf.notes.length ? <p className="mt-4 text-sm text-ink/70">{cf.notes[0]}</p> : null}
    </Panel>
  );
}

function HowRanked({ ranking }: { ranking: RankRow[] }) {
  const f = ["G", "R", "D", "U", "K"] as const;
  return (
    <Panel className="overflow-x-auto">
      <p className="mb-4 max-w-2xl text-sm text-ink/75">
        Each skill gets a priority score from these signals. Bigger gaps, higher demand, and skills that unlock others rank higher.
      </p>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs text-ink/60">
          <tr>
            <th className="py-2 pr-3 font-medium">Skill</th>
            {f.map((k) => (
              <th key={k} className="py-2 pr-3 text-right font-medium">
                {FEATURE_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {ranking.slice(0, 10).map((r) => (
            <tr key={r.skill_id} className="border-t">
              <td className="py-2 pr-3 text-ink">
                {r.rank}. {titleCase(r.name)}
              </td>
              {f.map((k) => (
                <td key={k} className="py-2 pr-3 text-right text-ink/75">
                  {num(r.features[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}


// ------------------------------------------------------------- study arm A (control: skill list only)
function ControlListView({ d, sid }: { d: Dashboard; sid: string }) {
  const rows = [...d.competencies].sort((a, b) => b.demand - a.demand).slice(0, 15);
  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-route-soft p-6 sm:p-8">
        <h1 className="text-[30px] font-extrabold leading-tight text-ink">Hi, {d.student.display_name}</h1>
        <p className="mt-1 text-ink/70">
          Skills employers ask for in {d.role.n_postings} real <span className="font-semibold text-ink">{d.role.name}</span> job postings. Use this list to plan
          your own learning.
        </p>
      </section>
      {d.study_arm ? <StudyPlanCard sid={sid} /> : null}
      <ClarityPulse sid={sid} />
      <section>
        <SectionTitle>Most Requested Skills</SectionTitle>
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((c) => (
            <li key={c.skill_id} className="flex items-center justify-between gap-3 p-4">
              <span className="font-medium text-ink">{titleCase(c.name)}</span>
              <span className="tabular text-sm text-ink/70">in {pct(c.demand)} of postings</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ------------------------------------------------------------- learning-experience instruments
function ClarityPulse({ sid }: { sid: string }) {
  const week = (() => {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    return `${d.getFullYear()}-${Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)}`;
  })();
  const key = `pathsync.pulse.${sid}.${week}`;
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (done) return null;
  async function answer(v: number) {
    await api.post(`/students/${sid}/pulse`, { item: "clarity", value: v, context: "dashboard" });
    try {
      localStorage.setItem(key, "1");
    } catch {}
    setDone(true);
  }
  return (
    <section aria-label="Quick question" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
      <p className="text-sm text-ink/85">
        <span className="font-medium text-ink">Quick question:</span> &ldquo;I know which skill to learn next and why.&rdquo;
      </p>
      <div role="group" aria-label="1 strongly disagree, 5 strongly agree" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} type="button" onClick={() => answer(v)} className="size-9 rounded-lg border text-sm font-medium hover:border-indigo hover:bg-secondary">
            {v}
          </button>
        ))}
      </div>
    </section>
  );
}

function StudyPlanCard({ sid }: { sid: string }) {
  const [started, setStarted] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  if (sent) return null;
  async function start() {
    const r = await api.post<{ started_at: string }>(`/students/${sid}/study/plan/start`);
    setStarted(r.started_at);
  }
  async function submit() {
    setErr(null);
    try {
      await api.post(`/students/${sid}/study/plan`, { plan_text: text, started_at: started });
      setSent(true);
    } catch (x) {
      setErr(x);
    }
  }
  return (
    <Panel>
      <h2 className="font-semibold text-ink">Study Task: Write Your Learning Plan</h2>
      <p className="mt-1 text-sm text-ink/70">
        Write what you will learn over the next four weeks, in what order and why. Experts rate plans without knowing who wrote them.
      </p>
      {!started ? (
        <Button className="mt-3" onClick={start}>
          Start Writing
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            aria-label="Your learning plan"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={8000}
            className="w-full rounded-lg border bg-background p-3 text-sm"
          />
          <ErrorNote error={err} />
          <Button onClick={submit} disabled={text.trim().length < 40}>
            Submit Plan
          </Button>
        </div>
      )}
    </Panel>
  );
}


// The clarity pulse asks "do you know what to learn next and why?", so it only appears once the student has opened the
// explanation or returned for a second visit (PM audit UX-8).
const PULSE_KEY = "pathsync.pulseReady";
const PULSE_EVENT = "pathsync-pulse";
function markPulseReady() {
  try {
    localStorage.setItem(PULSE_KEY, "1");
    window.dispatchEvent(new Event(PULSE_EVENT));
  } catch {}
}
function usePulseReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setReady(localStorage.getItem(PULSE_KEY) === "1");
      } catch {}
    };
    try {
      // count one visit per browser session, however many times the dashboard mounts
      if (!sessionStorage.getItem("pathsync.visitCounted")) {
        sessionStorage.setItem("pathsync.visitCounted", "1");
        const visits = Number(localStorage.getItem("pathsync.visits") ?? 0) + 1;
        localStorage.setItem("pathsync.visits", String(visits));
        if (visits >= 2) localStorage.setItem(PULSE_KEY, "1");
      }
    } catch {}
    read();
    window.addEventListener(PULSE_EVENT, read);
    return () => window.removeEventListener(PULSE_EVENT, read);
  }, []);
  return ready;
}

