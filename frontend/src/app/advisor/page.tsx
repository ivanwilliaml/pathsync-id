"use client";

import { useState } from "react";
import { GraduationCap, Lock } from "lucide-react";
import { pct, titleCase } from "@/lib/format";
import type { Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { setStaffToken, useStaffToken } from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { StaffLogin } from "@/components/staff-login";
import { EmptyState, ErrorNote, Loading, MasteryBar, NativeSelect, PageHeader, Panel, SectionTitle, Tag } from "@/components/kit";

interface CohortRow {
  id: string;
  name: string;
  institution: string;
  join_code: string;
  n_students: number;
}
interface SkillRow {
  skill_id: string;
  name: string;
  cluster: string;
  mean_mastery: number;
  required: number;
  share_below_required: number;
  demand: number;
}
interface Report {
  n_students: number;
  hidden: boolean;
  message?: string;
  skills?: SkillRow[];
  top_gaps?: SkillRow[];
  courses?: { course: string; students: number }[];
  clarity_mean?: number | null;
  clarity_n?: number;
  weekly_goal_completion?: number | null;
}

export default function AdvisorPage() {
  const { token, ready } = useStaffToken("advisor");
  const cohorts = useApi<CohortRow[]>(token ? "/advisor/cohorts" : null);
  const [sel, setSel] = useState<string>("");
  const meta = useApi<Meta>("/meta");
  const [role, setRole] = useState("business_analyst");
  const current = sel || cohorts.data?.[0]?.id || "";
  const report = useApi<Report>(current ? `/advisor/cohorts/${current}/report?role=${role}` : null);

  if (!ready) return <Loading />;
  if (!token || cohorts.error)
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title="Lecturer View" description="Class-level insight: where your students stand against what employers ask for." />
        <Panel>
          <StaffLogin role="advisor" error={cohorts.error} hint="Use the lecturer key you received when your class was created." />
        </Panel>
      </div>
    );
  if (!cohorts.data) return <Loading />;
  if (!cohorts.data.length) return <EmptyState title="No Classes Yet">Ask the PathSync team to create a class for you.</EmptyState>;
  const co = cohorts.data.find((c) => c.id === current)!;
  return (
    <div className="space-y-8">
      <PageHeader
        title="Lecturer View"
        description="Anonymous, class-level gaps against the job market. Use it to plan class sessions, assignments and electives."
        actions={
          <Button variant="outline" onClick={() => setStaffToken("advisor", null)}>
            Sign Out
          </Button>
        }
      />
      <Panel className="flex flex-wrap items-center gap-4">
        <GraduationCap className="size-6 text-indigo" aria-hidden="true" />
        <NativeSelect aria-label="Class" value={current} onChange={(e) => setSel(e.target.value)} className="min-w-0 flex-1">
          {cohorts.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.n_students} students)
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Target role" value={role} onChange={(e) => setRole(e.target.value)}>
          {(meta.data?.roles ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
        <span className="text-sm">
          Students join with code{" "}
          <code className="font-mono font-semibold text-indigo" translate="no">
            {co.join_code}
          </code>
        </span>
      </Panel>
      {report.error ? <ErrorNote error={report.error} /> : !report.data ? <Loading /> : report.data.hidden ? (
        <EmptyState title={`${report.data.n_students} Student${report.data.n_students === 1 ? "" : "s"} So Far`}>
          <span className="inline-flex items-center gap-1">
            <Lock className="size-4" aria-hidden="true" /> {report.data.message}
          </span>
        </EmptyState>
      ) : (
        <CohortReport r={report.data} />
      )}
    </div>
  );
}

function CohortReport({ r }: { r: Report }) {
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-ink/70">Students in this view</dt>
          <dd className="tabular mt-1 text-2xl font-bold">{r.n_students}</dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-ink/70">Direction clarity (1-5)</dt>
          <dd className="tabular mt-1 text-2xl font-bold">{r.clarity_mean ?? "–"}</dd>
          <dd className="text-xs text-muted-foreground">{r.clarity_n ?? 0} answers from weekly reflections</dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-ink/70">Weekly goals completed</dt>
          <dd className="tabular mt-1 text-2xl font-bold">{r.weekly_goal_completion != null ? pct(r.weekly_goal_completion) : "–"}</dd>
        </div>
      </dl>
      <section>
        <SectionTitle>Biggest Gaps Against the Market</SectionTitle>
        <p className="mb-3 text-sm text-ink/70">Ordered by demand × (required level − class average mastery).</p>
        <ul className="space-y-3">
          {r.top_gaps?.map((s) => (
            <li key={s.skill_id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{titleCase(s.name)}</span>
                <span className="flex gap-2">
                  <Tag tone="ember">{pct(s.share_below_required)} below required</Tag>
                  <Tag>in {pct(s.demand)} of postings</Tag>
                </span>
              </div>
              <MasteryBar value={s.mean_mastery} target={s.required} className="mt-2" />
            </li>
          ))}
        </ul>
      </section>
      {r.courses?.length ? (
        <section>
          <SectionTitle>Courses Your Students Link to Their Route</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {r.courses.map((c) => (
              <li key={c.course}>
                <Tag>
                  {c.course} · {c.students}
                </Tag>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
