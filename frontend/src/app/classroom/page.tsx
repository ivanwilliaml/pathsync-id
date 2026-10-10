"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarCheck, Lightbulb, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { fmtDate, num, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RequireStudent } from "@/components/require-student";
import { EmptyState, ErrorNote, LinkButton, Loading, MasteryBar, PageHeader, Panel, SectionTitle, Tag } from "@/components/kit";

interface CourseSkill {
  skill_id: string;
  name: string;
  strength: number;
  on_path: boolean;
  path_step: number | null;
  rank: number | null;
  p: number | null;
  required: number | null;
  evidence_tip: string;
}
interface CourseCard {
  course: string;
  status: string;
  skills: CourseSkill[];
  aligned_skills: string[];
  alignment: number;
}
interface Goal {
  skill_id: string;
  name: string;
  kind: string;
  minutes: number;
  course: string | null;
  material: { title: string; url: string } | null;
  done: boolean;
  action?: string;
}
interface Plan {
  id: number;
  week_start: string;
  goals: Goal[];
  planned_minutes: number;
  reflection: Record<string, unknown>;
  reflected_at: string | null;
}
interface Classroom {
  courses: CourseCard[];
  week_start: string;
  plan: Plan | null;
  suggested_goals: Goal[] | null;
  needs_reflection: Plan | null;
  summary: { weeks_planned: number; weeks_reflected: number; minutes_done_vs_planned?: number; goals_completed?: number; avg_confidence?: number };
  clarity: { value: number; at: string }[];
  pulse_items: Record<string, string>;
  unlinked_path_steps: string[];
}
interface EnrolledCourse {
  id: number;
  name: string;
}

export default function ClassroomPage() {
  return <RequireStudent>{(sid) => <ClassroomView sid={sid} />}</RequireStudent>;
}

function ClassroomView({ sid }: { sid: string }) {
  const c = useApi<Classroom>(`/students/${sid}/classroom`);
  const courses = useApi<EnrolledCourse[]>(`/students/${sid}/courses`);
  const reload = () => {
    c.reload();
    courses.reload();
  };
  if (c.error) return <ErrorNote error={c.error} />;
  if (!c.data) return <Loading label="Linking your courses to your route…" />;
  const d = c.data;
  return (
    <div className="space-y-10">
      <PageHeader
        title="My Classes"
        description="Your route, anchored in the courses you take this semester: which skills each course builds, which assignments can prove them, and a weekly plan you reflect on."
      />
      {d.needs_reflection ? <Reflection sid={sid} plan={d.needs_reflection} onDone={reload} late /> : null}
      <section aria-labelledby="courses-title">
        <SectionTitle id="courses-title">This Semester&rsquo;s Courses</SectionTitle>
        <AddCourse sid={sid} enrolled={courses.data ?? []} onChange={reload} />
        {d.courses.length === 0 ? (
          <EmptyState title="Add the Courses You Are Taking">
            We map each course to skills and show which assignments can become evidence for your route.
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {d.courses.map((co) => (
              <CourseCompanion key={co.course} co={co} />
            ))}
          </div>
        )}
        {d.courses.length > 0 && d.unlinked_path_steps.length > 0 ? (
          <p className="mt-3 text-sm text-ink/70">
            {d.unlinked_path_steps.length} step{d.unlinked_path_steps.length > 1 ? "s" : ""} of your route have no supporting course this semester: plan them
            as self-study below.
          </p>
        ) : null}
      </section>
      <WeekPlan
        key={d.plan ? `plan-${d.plan.id}-${d.plan.reflected_at ?? ""}` : (d.suggested_goals ?? []).map((g) => `${g.skill_id}:${g.course ?? ""}`).join("|")}
        sid={sid}
        data={d}
        onChange={reload}
      />
      <Progress data={d} />
    </div>
  );
}

function AddCourse({ sid, enrolled, onChange }: { sid: string; enrolled: EnrolledCourse[]; onChange: () => void }) {
  const catalog = useApi<{ courses: { name: string }[] }>("/catalog");
  const [name, setName] = useState("");
  const [err, setErr] = useState<unknown>(null);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post(`/students/${sid}/courses`, { name: name.trim() });
      setName("");
      onChange();
    } catch (x) {
      setErr(x);
    }
  }
  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input
          aria-label="Course name"
          list="course-catalog"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sistem Basis Data…"
          className="h-10 min-w-0 flex-1"
        />
        <datalist id="course-catalog">
          {catalog.data?.courses.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
        <Button type="submit" className="h-10" disabled={name.trim().length < 3}>
          <Plus /> Add Course
        </Button>
      </form>
      <ErrorNote error={err} />
      {enrolled.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {enrolled.map((c) => (
            <li key={c.id} className="flex items-center gap-1 rounded-full border bg-card py-1 pl-3 pr-1 text-sm">
              {c.name}
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                className="rounded-full p-1 text-ink/60 hover:bg-muted hover:text-ink"
                onClick={async () => {
                  await api.del(`/students/${sid}/courses/${c.id}`);
                  onChange();
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CourseCompanion({ co }: { co: CourseCard }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-indigo" aria-hidden="true" />
          <h3 className="font-semibold text-ink">{co.course}</h3>
        </div>
        <Tag tone={co.alignment >= 0.5 ? "mint" : "neutral"}>{Math.round(co.alignment * 100)}% on your route</Tag>
      </div>
      {co.skills.length === 0 ? (
        <p className="mt-3 text-sm text-ink/70">We could not link this course to tracked skills.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {co.skills.map((s) => (
            <li key={s.skill_id} className="rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{titleCase(s.name)}</span>
                {s.on_path ? <Tag tone="indigo">Route step {s.path_step}</Tag> : s.rank ? <Tag>Priority #{s.rank}</Tag> : null}
              </div>
              {s.p != null ? <MasteryBar value={s.p} target={s.required} className="mt-2" /> : null}
              {s.on_path || (s.rank && s.rank <= 6) ? (
                <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo hover:underline" onClick={() => setOpen(open === s.skill_id ? null : s.skill_id)}>
                  <Lightbulb className="size-3.5" aria-hidden="true" /> Use an assignment as proof
                </button>
              ) : null}
              {open === s.skill_id ? (
                <div className="mt-2 text-xs text-ink/80">
                  <p>{s.evidence_tip}</p>
                  <LinkButton href={`/evidence?step=projects`} size="sm" variant="outline" className="mt-2">
                    Upload Assignment
                  </LinkButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function WeekPlan({ sid, data, onChange }: { sid: string; data: Classroom; onChange: () => void }) {
  const [goals, setGoals] = useState<Goal[]>(data.plan?.goals ?? data.suggested_goals ?? []);
  const [busy, setBusy] = useState(false);
  const total = useMemo(() => goals.reduce((a, g) => a + (g.minutes || 0), 0), [goals]);
  async function save() {
    setBusy(true);
    try {
      await api.post(`/students/${sid}/plans`, { goals });
      toast.success("Plan saved for this week");
      onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="week-title">
      <SectionTitle id="week-title">
        <span className="inline-flex items-center gap-2">
          <CalendarCheck className="size-5 text-indigo" aria-hidden="true" /> Plan for the Week of {fmtDate(data.week_start)}
        </span>
      </SectionTitle>
      {goals.length === 0 ? (
        <EmptyState title="No Route Steps Yet">Add evidence or take the quick check so we can suggest goals.</EmptyState>
      ) : (
        <Panel>
          <p className="mb-3 text-sm text-ink/70">
            {data.plan ? "Your saved goals." : "Suggested from your next route steps and the courses that support them. Adjust the minutes, then save."}
          </p>
          <ul className="space-y-3">
            {goals.map((g, i) => (
              <li key={g.skill_id + i} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {g.kind === "prove" ? "Prove" : "Learn"}: {titleCase(g.name)}
                  </p>
                  <p className="text-xs text-ink/70">
                    {g.course ? `Together with ${g.course}. ` : "Self-study. "}
                    {g.material ? (
                      <a href={g.material.url} target="_blank" rel="noreferrer" className="text-indigo hover:underline">
                        {g.material.title}
                      </a>
                    ) : null}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Input
                    type="number"
                    min={0}
                    step={15}
                    value={g.minutes}
                    onChange={(e) => setGoals((gs) => gs.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)))}
                    className="h-9 w-24"
                    aria-label={`Minutes for ${g.name}`}
                  />
                  min
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="tabular text-sm text-ink/70">{Math.round(total / 6) / 10} hours planned</span>
            <Button onClick={save} disabled={busy}>
              {data.plan ? "Update Plan" : "Save This Plan"}
            </Button>
          </div>
        </Panel>
      )}
      {data.plan && !data.plan.reflected_at ? (
        <div className="mt-4">
          <Reflection sid={sid} plan={data.plan} onDone={onChange} />
        </div>
      ) : null}
    </section>
  );
}

function Reflection({ sid, plan, onDone, late }: { sid: string; plan: Plan; onDone: () => void; late?: boolean }) {
  const [done, setDone] = useState<number[]>([]);
  const [minutes, setMinutes] = useState(plan.planned_minutes);
  const [confidence, setConfidence] = useState(3);
  const [clarity, setClarity] = useState(0);
  const [obstacle, setObstacle] = useState("");
  const [err, setErr] = useState<unknown>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.post<{ suggest_skill_checks: string[] }>(`/students/${sid}/plans/${plan.id}/reflect`, {
        done_minutes: minutes,
        confidence,
        goals_done: done,
        obstacle,
        clarity: clarity || null,
      });
      toast.success("Reflection saved", {
        description: r.suggest_skill_checks.length ? "You finished a learning goal: take its skill check to update your route." : undefined,
      });
      onDone();
    } catch (x) {
      setErr(x);
    }
  }
  const scale = (value: number, set: (v: number) => void, label: string) => (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => set(v)}
          className={`size-9 rounded-lg border text-sm font-medium ${value === v ? "border-indigo bg-secondary text-indigo" : "hover:bg-muted"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
  return (
    <Panel className={late ? "border-ember/40" : undefined}>
      <h3 className="font-semibold text-ink">{late ? `Reflect on the week of ${fmtDate(plan.week_start)}` : "End-of-Week Reflection"}</h3>
      <p className="mt-1 text-sm text-ink/70">Two minutes. Reflection is the step of self-regulated learning that turns effort into a better next plan.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Which goals did you finish?</legend>
          {plan.goals.map((g, i) => (
            <label key={i} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={done.includes(i)} onChange={(e) => setDone((d) => (e.target.checked ? [...d, i] : d.filter((x) => x !== i)))} />
              {titleCase(g.name)}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`min-${plan.id}`}>Minutes actually spent</Label>
            <Input id={`min-${plan.id}`} type="number" min={0} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">How confident do you feel now? (1-5)</span>
            {scale(confidence, setConfidence, "Confidence")}
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">&ldquo;{"I know which skill to learn next and why."}&rdquo; (1 disagree, 5 agree)</span>
          {scale(clarity, setClarity, "Direction clarity")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`obs-${plan.id}`}>What got in the way? (optional)</Label>
          <Textarea id={`obs-${plan.id}`} value={obstacle} onChange={(e) => setObstacle(e.target.value)} maxLength={300} rows={2} />
        </div>
        <ErrorNote error={err} />
        <Button type="submit">Save Reflection</Button>
      </form>
    </Panel>
  );
}

function Progress({ data }: { data: Classroom }) {
  const s = data.summary;
  if (!s.weeks_reflected) return null;
  return (
    <section aria-labelledby="progress-title">
      <SectionTitle id="progress-title">Your Learning Rhythm</SectionTitle>
      <dl className="grid gap-3 sm:grid-cols-4">
        {[
          ["Weeks reflected", `${s.weeks_reflected} of ${s.weeks_planned}`],
          ["Time done vs planned", s.minutes_done_vs_planned != null ? `${Math.round(s.minutes_done_vs_planned * 100)}%` : "–"],
          ["Goals completed", s.goals_completed != null ? `${Math.round(s.goals_completed * 100)}%` : "–"],
          ["Direction clarity", data.clarity.length ? `${num(data.clarity[data.clarity.length - 1].value, 0)} / 5` : "–"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-4">
            <dt className="text-sm text-ink/70">{k}</dt>
            <dd className="tabular mt-1 text-2xl font-bold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

