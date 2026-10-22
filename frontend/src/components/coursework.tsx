"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarCheck, Lightbulb, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { fmtDate, num, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { EmptyState, ErrorNote, LinkButton, Loading, MasteryBar, Tag } from "./kit";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { safeUrl } from "@/lib/safe-url";

// Coursework companion and the weekly plan -> reflection cycle (backend: pathsync/classroom.py): two views of Learn.

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

/** How much of a course feeds the route, in words: a count of its skills, so it never reads like a grade. */
function onRoute(co: CourseCard, t: ReturnType<typeof useT>) {
  const n = co.skills.filter((s) => s.on_path).length;
  if (!co.skills.length) return t("Not linked to tracked skills yet", "Belum terhubung ke skill yang dilacak");
  return n
    ? t(`Builds ${n} of your route's skills`, `Membangun ${n} skill di rutemu`)
    : t(`Builds ${co.skills.length} skill${co.skills.length > 1 ? "s" : ""}, none on your route now`, `Membangun ${co.skills.length} skill, belum ada yang di rutemu`);
}

/** The add-a-course form, as the toolbar of the coursework view. */
function AddCourse({ sid, onChange }: { sid: string; onChange: () => void }) {
  const catalog = useApi<{ courses: { name: string }[] }>("/catalog");
  const [name, setName] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const t = useT();
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
    <div className="space-y-2">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input
          aria-label={t("Course name", "Nama mata kuliah")}
          list="course-catalog"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("e.g. Sistem Basis Data…", "mis. Sistem Basis Data…")}
          className="h-9 min-w-0 flex-1"
        />
        <datalist id="course-catalog">
          {catalog.data?.courses.map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>
        <Button type="submit" className="h-9" disabled={name.trim().length < 3}>
          <Plus /> {t("Add", "Tambah")}
        </Button>
      </form>
      <ErrorNote error={err} />
    </div>
  );
}

/** One course mapped onto the route: a row per skill (skill, its place on the route, the way to prove it). */
function CourseDetail({ co }: { co: CourseCard }) {
  const [open, setOpen] = useState<string | null>(null);
  const t = useT();
  return (
    <section aria-labelledby="course-detail" className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="course-detail" className="flex items-center gap-2 text-base font-semibold text-ink">
          <BookOpen className="size-4 text-indigo" aria-hidden="true" /> {co.course}
        </h3>
        <span className="text-sm text-ink/75">{onRoute(co, t)}</span>
      </div>
      {co.skills.length === 0 ? (
        <p className="mt-3 text-sm text-ink/70">{t("We could not link this course to tracked skills.", "Kami belum bisa menghubungkan mata kuliah ini ke skill yang dilacak.")}</p>
      ) : (
        <ul className="mt-3 divide-y border-y">
          {co.skills.map((s) => {
            const canProve = s.on_path || (s.rank && s.rank <= 6);
            return (
              <li key={s.skill_id} className="px-3 py-2.5">
                <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{titleCase(s.name)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.on_path ? t(`Route step ${s.path_step}`, `Langkah rute ${s.path_step}`) : s.rank ? t(`Priority #${s.rank}`, `Prioritas #${s.rank}`) : t("Not on your route", "Tidak di rutemu")}
                    </p>
                  </div>
                  {s.p != null ? <MasteryBar value={s.p} target={s.required} label={titleCase(s.name)} /> : <span />}
                  {canProve ? (
                    <button
                      type="button"
                      aria-expanded={open === s.skill_id}
                      className="inline-flex items-center gap-1 justify-self-start text-xs font-medium text-indigo hover:underline sm:justify-self-end"
                      onClick={() => setOpen(open === s.skill_id ? null : s.skill_id)}
                    >
                      <Lightbulb className="size-3.5" aria-hidden="true" /> {t("Use an assignment as proof", "Pakai tugas sebagai bukti")}
                    </button>
                  ) : null}
                </div>
                {open === s.skill_id ? (
                  <div className="mt-2 rounded-lg bg-muted/60 p-3 text-xs text-ink/80">
                    <p>{s.evidence_tip}</p>
                    <LinkButton href={`/evidence?step=projects`} size="sm" variant="outline" className="mt-2">
                      {t("Upload Assignment", "Unggah Tugas")}
                    </LinkButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WeekPlan({ sid, data, onChange }: { sid: string; data: Classroom; onChange: () => void }) {
  const [goals, setGoals] = useState<Goal[]>(data.plan?.goals ?? data.suggested_goals ?? []);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const total = useMemo(() => goals.reduce((a, g) => a + (g.minutes || 0), 0), [goals]);
  async function save() {
    setBusy(true);
    try {
      await api.post(`/students/${sid}/plans`, { goals });
      toast.success(t("Plan saved for this week", "Rencana minggu ini tersimpan"));
      onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="week-title" className="min-w-0">
      <h2 id="week-title" className="flex items-center gap-2 text-base font-semibold text-ink">
        <CalendarCheck className="size-4 text-indigo" aria-hidden="true" /> {t("Plan for the Week of", "Rencana Minggu")} {fmtDate(data.week_start)}
      </h2>
      {goals.length === 0 ? (
        <div className="mt-3">
          <EmptyState title={t("No Route Steps Yet", "Belum Ada Langkah Rute")} mascot="calendar">{t("Add evidence or take the skill check so we can suggest goals.", "Tambahkan bukti atau ikuti Cek Kemampuan supaya kami bisa menyarankan target.")}</EmptyState>
        </div>
      ) : (
        <>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">{data.plan ? t("Saved", "Tersimpan") : t("Suggested from your route", "Saran dari rutemu")}</p>
          <ul className="divide-y border-y">
            {goals.map((g, i) => (
              <li key={g.skill_id + i} className="grid gap-3 px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {g.kind === "prove" ? t("Prove", "Buktikan") : t("Learn", "Pelajari")}: {titleCase(g.name)}
                  </p>
                  <p className="text-xs text-ink/70">
                    {g.course ? t(`Together with ${g.course}. `, `Bersama ${g.course}. `) : t("Self-study. ", "Belajar mandiri. ")}
                    {g.material ? (
                      <a href={safeUrl(g.material.url)} target="_blank" rel="noreferrer" className="text-indigo hover:underline">
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
                    className="h-10 w-24 text-base"
                    aria-label={t(`Minutes for ${g.name}`, `Menit untuk ${g.name}`)}
                  />
                  {t("min", "menit")}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <span className="tabular text-sm text-ink/70">{t(`${Math.round(total / 6) / 10} hours planned`, `${Math.round(total / 6) / 10} jam direncanakan`)}</span>
            <Button onClick={save} disabled={busy}>
              {data.plan ? t("Update Plan", "Perbarui Rencana") : t("Save This Plan", "Simpan Rencana Ini")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function Reflection({ sid, plan, onDone, onCancel }: { sid: string; plan: Plan; onDone: () => void; onCancel: () => void }) {
  const [done, setDone] = useState<number[]>([]);
  const [minutes, setMinutes] = useState(plan.planned_minutes);
  const [confidence, setConfidence] = useState(3);
  const [clarity, setClarity] = useState(0);
  const [obstacle, setObstacle] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const t = useT();
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
      toast.success(t("Reflection saved", "Refleksi tersimpan"), {
        description: r.suggest_skill_checks.length ? t("You finished a learning goal: take its skill check to update your route.", "Kamu menyelesaikan target belajar: ikuti Cek Kemampuan-nya untuk memperbarui rutemu.") : undefined,
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
    <section aria-labelledby={`reflect-${plan.id}`} className="min-w-0">
      <button type="button" onClick={onCancel} className="mb-2 text-sm font-medium text-indigo underline-offset-4 hover:underline">
        ← {t("Back to this week's plan", "Kembali ke rencana minggu ini")}
      </button>
      <h2 id={`reflect-${plan.id}`} className="text-base font-semibold text-ink">{t(`Reflect on the week of ${fmtDate(plan.week_start)}`, `Refleksi minggu ${fmtDate(plan.week_start)}`)}</h2>
      <p className="mt-1 text-sm text-ink/70">{t("Two minutes: what you finished, how long it took, what got in the way. It shapes your next plan.", "Dua menit: apa yang selesai, berapa lama, apa yang menghambat. Ini membentuk rencana berikutnya.")}</p>
      <form onSubmit={submit} className="mt-5 space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("Which goals did you finish?", "Target mana yang sudah selesai?")}</legend>
          {plan.goals.map((g, i) => (
            <label key={i} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={done.includes(i)} onChange={(e) => setDone((d) => (e.target.checked ? [...d, i] : d.filter((x) => x !== i)))} />
              {titleCase(g.name)}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`min-${plan.id}`}>{t("Minutes actually spent", "Menit yang benar-benar dipakai")}</Label>
            <Input id={`min-${plan.id}`} type="number" min={0} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-9 w-32" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("How confident do you feel now? (1-5)", "Seberapa yakin kamu sekarang? (1-5)")}</span>
            {scale(confidence, setConfidence, t("Confidence", "Keyakinan"))}
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">{t("“I know which skill to learn next and why.” (1 disagree, 5 agree)", "“Aku tahu skill mana yang harus dipelajari berikutnya dan kenapa.” (1 tidak setuju, 5 setuju)")}</span>
          {scale(clarity, setClarity, t("Direction clarity", "Kejelasan arah"))}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`obs-${plan.id}`}>{t("What got in the way? (optional)", "Apa yang menghambat? (opsional)")}</Label>
          <Textarea id={`obs-${plan.id}`} value={obstacle} onChange={(e) => setObstacle(e.target.value)} maxLength={300} rows={2} />
        </div>
        <ErrorNote error={err} />
        <Button type="submit">{t("Save Reflection", "Simpan Refleksi")}</Button>
      </form>
    </section>
  );
}

function Rhythm({ data }: { data: Classroom }) {
  const s = data.summary;
  const t = useT();
  if (!s.weeks_reflected) return null;
  const rows: [string, string][] = [
    [t("Weeks reflected", "Minggu direfleksikan"), t(`${s.weeks_reflected} of ${s.weeks_planned}`, `${s.weeks_reflected} dari ${s.weeks_planned}`)],
    [t("Time done vs planned", "Waktu terpakai vs rencana"), s.minutes_done_vs_planned != null ? `${Math.round(s.minutes_done_vs_planned * 100)}%` : "–"],
    [t("Goals completed", "Target selesai"), s.goals_completed != null ? `${Math.round(s.goals_completed * 100)}%` : "–"],
    [t("Direction clarity", "Kejelasan arah"), data.clarity.length ? `${num(data.clarity[data.clarity.length - 1].value, 0)} / 5` : "–"],
  ];
  return (
    <section aria-labelledby="rhythm-title">
      <h3 id="rhythm-title" className="text-sm font-semibold text-ink">{t("Your Learning Rhythm", "Ritme Belajarmu")}</h3>
      <dl className="mt-2 divide-y text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink/70">{k}</dt>
            <dd className="tabular font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function useClassroom(sid: string) {
  const c = useApi<Classroom>(`/students/${sid}/classroom`);
  const t = useT();
  const body = (node: (d: Classroom) => React.ReactNode) =>
    c.error ? <ErrorNote error={c.error} /> : !c.data ? <Loading label={t("Linking your courses to your route…", "Menghubungkan mata kuliahmu ke rutemu…")} /> : node(c.data);
  return { c, body };
}

/** This week: the plan is the work; a pending reflection (last week's, or this week's once it is planned) waits in the
 * side column and opens its form in the main column when asked. */
export function WeekView({ sid }: { sid: string }) {
  const { c, body } = useClassroom(sid);
  const [reflecting, setReflecting] = useState<Plan | null>(null);
  const t = useT();
  return body((d) => {
    const pending = d.needs_reflection ?? (d.plan && !d.plan.reflected_at ? d.plan : null);
    const late = !!d.needs_reflection;
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {reflecting ? (
          <Reflection sid={sid} plan={reflecting} onCancel={() => setReflecting(null)} onDone={() => (setReflecting(null), c.reload())} />
        ) : (
          <WeekPlan
            key={d.plan ? `plan-${d.plan.id}-${d.plan.reflected_at ?? ""}` : (d.suggested_goals ?? []).map((g) => `${g.skill_id}:${g.course ?? ""}`).join("|")}
            sid={sid}
            data={d}
            onChange={c.reload}
          />
        )}
        <aside className="space-y-8 lg:border-l lg:pl-8">
          {pending && !reflecting ? (
            <section aria-labelledby="pending-reflection" className={late ? "rounded-xl border border-ember/40 bg-[#fff7f1] p-3" : "rounded-xl bg-muted/60 p-3"}>
              <h3 id="pending-reflection" className="text-sm font-semibold text-ink">
                {late ? t(`Last week is not reflected yet`, `Minggu lalu belum direfleksikan`) : t("End-of-week reflection", "Refleksi akhir minggu")}
              </h3>
              <p className="mt-1 text-xs text-ink/70">
                {late
                  ? t(`Week of ${fmtDate(pending.week_start)}. Two minutes, and your next plan gets better.`, `Minggu ${fmtDate(pending.week_start)}. Dua menit, dan rencana berikutnya jadi lebih tepat.`)
                  : t("Fill it in when the week is over.", "Isi saat minggu ini selesai.")}
              </p>
              <Button size="sm" variant={late ? "default" : "outline"} className="mt-2" onClick={() => setReflecting(pending)}>
                {t("Reflect now", "Isi refleksi")}
              </Button>
            </section>
          ) : null}
          <Rhythm data={d} />
          <Courses sid={sid} data={d} onChange={c.reload} />
        </aside>
      </div>
    );
  });
}

/** The semester's courses in the week's side column: add one, see how much of it feeds the route, open one for
 * its full mapping (skill by skill, and which assignments can prove them). */
function Courses({ sid, data, onChange }: { sid: string; data: Classroom; onChange: () => void }) {
  const courses = useApi<EnrolledCourse[]>(`/students/${sid}/courses`);
  const [open, setOpen] = useState<CourseCard | null>(null);
  const t = useT();
  const reload = () => {
    onChange();
    courses.reload();
  };
  return (
    <section aria-labelledby="courses-title" className="space-y-3">
      <h2 id="courses-title" className="text-sm font-semibold text-ink">{t("Your courses this semester", "Mata kuliahmu semester ini")}</h2>
      {data.courses.length ? (
        <ul className="divide-y border-y">
          {data.courses.map((co) => {
            const enrolled = courses.data?.find((e) => e.name === co.course);
            return (
              <li key={co.course} className="flex items-center gap-1">
                <button type="button" onClick={() => setOpen(co)} className="min-w-0 flex-1 py-2 text-left">
                  <span className="block truncate text-sm font-medium text-ink hover:text-indigo">{co.course}</span>
                  <span className="block text-xs text-muted-foreground">{onRoute(co, t)}</span>
                </button>
                {enrolled ? (
                  <button
                    type="button"
                    aria-label={t(`Remove ${co.course}`, `Hapus ${co.course}`)}
                    className="rounded-md p-1.5 text-ink/50 hover:bg-muted hover:text-ink"
                    onClick={async () => {
                      await api.del(`/students/${sid}/courses/${enrolled.id}`);
                      reload();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("Add the courses you take; we link them to your route.", "Tambahkan mata kuliah yang kamu ambil; kami hubungkan ke rutemu.")}</p>
      )}
      <AddCourse sid={sid} onChange={reload} />
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b p-6">
            <SheetTitle className="text-xl font-bold text-ink">{open?.course}</SheetTitle>
            <SheetDescription>{open ? onRoute(open, t) : ""}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-6">{open ? <CourseDetail co={open} /> : null}</div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </section>
  );
}
