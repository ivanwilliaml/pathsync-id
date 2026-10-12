"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Award, Check, FileText, FolderKanban, GraduationCap, Plus, SlidersHorizontal, Trash2, Upload, UserRound } from "lucide-react";
import { track } from "@/lib/track";
import { toast } from "sonner";
import { api, type Meta, type Student } from "@/lib/api";
import { RUBRIC, num, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RequireStudent } from "@/components/require-student";
import { ErrorNote, LinkButton, Loading, NativeSelect, PageHeader, Panel, Tag } from "@/components/kit";

type StepId = "transcript" | "certificates" | "projects" | "cv" | "preferences";
const STEPS: { id: StepId; label: string; icon: typeof GraduationCap; kind?: string; hint: string }[] = [
  { id: "transcript", label: "Transcript", icon: GraduationCap, kind: "academic", hint: "Your course grades" },
  { id: "certificates", label: "Certificates", icon: Award, kind: "certificate", hint: "Courses and exams" },
  { id: "projects", label: "Projects", icon: FolderKanban, kind: "project", hint: "Work you can show" },
  { id: "cv", label: "CV", icon: UserRound, kind: "cv", hint: "Skills you mention" },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal, hint: "How you like to learn" },
];

interface Catalog {
  courses: { name: string; programs: string[] }[];
  certificates: { name: string; level: string; score_scale: string | null }[];
  grades: string[];
}

export default function EvidencePage() {
  return (
    <RequireStudent>
      {(sid) => (
        <Suspense fallback={<Loading />}>
          <Evidence sid={sid} />
        </Suspense>
      )}
    </RequireStudent>
  );
}

function Evidence({ sid }: { sid: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const step = (STEPS.find((s) => s.id === params.get("step"))?.id ?? "transcript") as StepId;
  const idx = STEPS.findIndex((s) => s.id === step);
  const student = useApi<Student>(`/students/${sid}`);
  const meta = useApi<Meta>("/meta");
  const catalog = useApi<Catalog>("/catalog");
  const names = useMemo(() => Object.fromEntries((meta.data?.skills ?? []).map((s) => [s.id, titleCase(s.name)])), [meta.data]);

  const go = (id: StepId) => router.replace(`${pathname}?step=${id}`, { scroll: false });
  const next = STEPS[idx + 1];
  const done = (s: (typeof STEPS)[number]) =>
    s.kind ? !!student.data?.evidence.some((e) => e.kind === s.kind) : !!student.data && Object.keys(student.data.self_ratings ?? {}).length > 0;
  const saved = (label: string) => {
    track("evidence_saved", { kind: label });
    student.reload();
    toast.success(`${label} saved`, next ? { action: { label: `Next: ${next.label}`, onClick: () => go(next.id) } } : undefined);
  };

  return (
    <div>
      <PageHeader
        title="My Evidence"
        description="Add whatever you have. Every step is optional, and the more you add, the more accurate your route gets."
        actions={
          <LinkButton href="/dashboard" size="lg" className="h-10">
            See My Route
          </LinkButton>
        }
      />

      <nav aria-label="Evidence steps" className="mb-8">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const isDone = done(s);
            return (
              <li key={s.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => go(s.id)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${s.label}${isDone ? ", done" : ""}`}
                  className={cn(
                    "flex w-full min-w-0 flex-row items-center gap-2 rounded-xl border p-2 text-left sm:p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-indigo bg-card shadow-sm" : "bg-card/60 hover:bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      isDone ? "bg-mint text-white" : active ? "bg-indigo text-white" : "bg-muted text-ink/70",
                    )}
                  >
                    {isDone ? <Check className="size-4" aria-label="Done" /> : i + 1}
                  </span>
                  <span className="w-full min-w-0">
                    <span className="block text-xs font-semibold text-ink sm:text-sm">{s.label}</span>
                    <span className="hidden truncate text-xs text-muted-foreground md:block">{s.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {step === "transcript" && <Transcript sid={sid} catalog={catalog.data} names={names} onSaved={() => saved("Transcript")} />}
          {step === "certificates" && <Certificates sid={sid} catalog={catalog.data} names={names} onSaved={() => saved("Certificates")} />}
          {step === "projects" && <Projects sid={sid} names={names} onSaved={() => saved("Project")} />}
          {step === "cv" && <CV sid={sid} names={names} onSaved={() => saved("CV")} />}
          {step === "preferences" && student.data && meta.data && (
            <Preferences student={student.data} meta={meta.data} names={names} onSaved={() => {
              student.reload();
              toast.success("Preferences saved", { action: { label: "See My Route", onClick: () => router.push("/dashboard") } });
            }} />
          )}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" size="lg" disabled={idx === 0} onClick={() => go(STEPS[idx - 1].id)}>
              Back
            </Button>
            {next ? (
              <Button variant="outline" size="lg" onClick={() => go(next.id)}>
                {done(STEPS[idx]) ? `Continue to ${next.label}` : `Skip to ${next.label}`}
              </Button>
            ) : (
              <LinkButton href="/assessment" size="lg">
                Take the Quick Check
              </LinkButton>
            )}
          </div>
        </div>
        <EvidenceList sid={sid} student={student.data} onChange={student.reload} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ saved evidence
const KIND: Record<string, string> = { academic: "Transcript", certificate: "Certificates", cv: "CV", project: "Project" };

function EvidenceList({ sid, student, onChange }: { sid: string; student: Student | null; onChange: () => void }) {
  const [pending, setPending] = useState<{ id: number; title: string } | null>(null);
  async function remove() {
    if (!pending) return;
    await api.del(`/students/${sid}/evidence/${pending.id}`);
    toast.success("Evidence removed");
    setPending(null);
    onChange();
  }
  return (
    <aside aria-labelledby="saved" className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-8">
      <h2 id="saved" className="font-semibold text-ink">
        Saved Evidence
      </h2>
      {!student ? (
        <Loading />
      ) : student.evidence.length === 0 && student.n_responses === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing yet. What you save shows up here.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {student.evidence.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 rounded-xl bg-muted/70 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-indigo">{KIND[e.kind] ?? e.kind}</p>
                <p className="truncate text-sm font-medium text-ink" title={e.title}>
                  {e.kind === "academic" ? "Transcript" : e.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.kind === "cv" ? `${((e.details.claim_ids as string[]) ?? []).length} skills mentioned` : `${Object.keys(e.scores).length} skills found`}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove ${KIND[e.kind] ?? e.kind}`} onClick={() => setPending({ id: e.id, title: KIND[e.kind] ?? e.title })}>
                <Trash2 />
              </Button>
            </li>
          ))}
          {student.n_responses > 0 ? (
            <li className="rounded-xl bg-muted/70 px-3 py-2.5">
              <p className="text-xs font-medium text-mint-ink">Assessment</p>
              <p className="text-sm font-medium text-ink">{student.n_responses} questions answered</p>
            </li>
          ) : null}
        </ul>
      )}
      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove This {pending?.title}?</AlertDialogTitle>
            <AlertDialogDescription>Your route will be recalculated without it. You can add it again later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep It</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

// ------------------------------------------------------------------ shared bits
function StepPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Panel>
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

function PasteOrUpload({ id, label, text, setText, file, setFile, accept, placeholder }: {
  id: string; label: string; text: string; setText: (s: string) => void; file: File | null; setFile: (f: File | null) => void; accept: string; placeholder: string;
}) {
  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} disabled={!!file} className="min-h-40 font-mono text-[13px]" />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 font-medium text-ink hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
          <Upload className="size-4" aria-hidden="true" /> Upload a File
          <input type="file" accept={accept} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <span className="text-xs text-muted-foreground">{accept.replaceAll(",", ", ")}</span>
        {file ? (
          <span className="flex items-center gap-2 text-ink/80">
            <FileText className="size-4" aria-hidden="true" /> {file.name}
            <button type="button" className="text-xs font-medium text-indigo underline" onClick={() => setFile(null)}>
              Remove
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SkillChips({ scores, names }: { scores: Record<string, number>; names: Record<string, string> }) {
  const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p className="text-sm text-muted-foreground">No skills matched.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {rows.map(([k, v]) => (
        <li key={k}>
          <Tag tone="indigo">
            {names[k] ?? k} <span className="tabular opacity-70">{num(v)}</span>
          </Tag>
        </li>
      ))}
    </ul>
  );
}

function ResultPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-mint/30 bg-[#effaf7] p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-mint-ink">
        <Check className="size-4" aria-hidden="true" /> {title}
      </p>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ transcript
interface CourseRow {
  name: string;
  grade: string;
}

function Transcript({ sid, catalog, names, onSaved }: { sid: string; catalog: Catalog | null; names: Record<string, string>; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const grades = catalog?.grades ?? ["A", "A-", "B+", "B", "B-", "C+", "C", "D", "E"];

  async function read() {
    setBusy("read");
    setErr(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("text", text);
      const r = await api.post<{ courses: CourseRow[] }>(`/students/${sid}/transcript/parse`, fd);
      setRows(r.courses);
      if (!r.courses.length) setErr(new Error("We couldn't find any 'course, grade' lines. Check the format or add courses by hand."));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  }
  async function save() {
    setBusy("save");
    setErr(null);
    try {
      const r = await api.post<{ scores: Record<string, number> }>(`/students/${sid}/evidence/academic`, { courses: rows.filter((r) => r.name.trim() && r.grade) });
      setResult(r.scores);
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <StepPanel title="Add Your Transcript" description="Paste your grades or upload your transcript. Grades count as background knowledge, not proof, so they carry the lightest weight.">
      {rows.length === 0 ? (
        <>
          <PasteOrUpload
            id="transcript"
            label="Courses and Grades"
            text={text}
            setText={setText}
            file={file}
            setFile={setFile}
            accept=".pdf,.docx,.txt,.csv"
            placeholder={"Basis Data, A\nAnalisis dan Perancangan Sistem, B+\nStatistika Bisnis, B"}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" className="h-10" onClick={read} disabled={busy !== null || (!file && text.trim().length < 4)}>
              {busy === "read" ? "Reading…" : "Read Transcript"}
            </Button>
            <Button variant="ghost" size="lg" className="h-10" onClick={() => setRows([{ name: "", grade: "A" }])}>
              <Plus /> Add Courses by Hand
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink/75">Check the {rows.length} courses we found, then save.</p>
          <datalist id="courses">
            {catalog?.courses.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="flex gap-2">
                <Input list="courses" aria-label={`Course ${i + 1}`} value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="h-10" />
                <NativeSelect aria-label={`Grade for course ${i + 1}`} value={r.grade} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} className="w-24">
                  {grades.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </NativeSelect>
                <Button variant="ghost" size="icon-lg" aria-label={`Remove course ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg" className="h-10" onClick={save} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save Transcript"}
            </Button>
            <Button variant="ghost" size="lg" className="h-10" onClick={() => setRows([...rows, { name: "", grade: "A" }])}>
              <Plus /> Add a Course
            </Button>
            <Button variant="ghost" size="lg" className="h-10" onClick={() => setRows([])}>
              Start Over
            </Button>
          </div>
        </>
      )}
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>
      {result ? (
        <ResultPanel title="Saved. These skills now count your coursework:">
          <SkillChips scores={result} names={names} />
        </ResultPanel>
      ) : null}
    </StepPanel>
  );
}

// ------------------------------------------------------------------ certificates
function Certificates({ sid, catalog, names, onSaved }: { sid: string; catalog: Catalog | null; names: Record<string, string>; onSaved: () => void }) {
  const [rows, setRows] = useState<{ name: string; score: string; url: string }[]>([{ name: "", score: "", url: "" }]);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [claimed, setClaimed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const scale = (n: string) => catalog?.certificates.find((c) => c.name === n)?.score_scale;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const certificates = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), url: r.url.trim(), ...(r.score ? { score: Number(r.score) } : {}) }));
      const r = await api.post<{ scores: Record<string, number>; claimed?: number }>(`/students/${sid}/evidence/certificate`, { certificates });
      setResult(r.scores);
      setClaimed(r.claimed ?? 0);
      setRows([{ name: "", score: "", url: "" }]);
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <StepPanel title="Add Certificates" description="Pick from our list or type any course name, and paste the credential link (Coursera, Dicoding, Credly, Google, Microsoft…). A certificate with a verifiable link counts fully; one without a link counts as a claim, at half weight.">
      <datalist id="certs">
        {catalog?.certificates.map((c) => <option key={c.name} value={c.name} />)}
      </datalist>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap gap-2">
            <Input
              list="certs"
              aria-label={`Certificate ${i + 1}`}
              placeholder="e.g. Google Data Analytics Professional Certificate…"
              value={r.name}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              className="h-10"
            />
            {scale(r.name) ? (
              <Input
                inputMode="numeric"
                aria-label={`${scale(r.name)?.toUpperCase()} score`}
                placeholder={`${scale(r.name)?.toUpperCase()} score…`}
                value={r.score}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, score: e.target.value } : x)))}
                className="h-10 w-36"
              />
            ) : null}
            <Input
              type="url"
              aria-label={`Credential link ${i + 1}`}
              placeholder="Credential link, https://…"
              value={r.url}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              className="h-10 min-w-0 flex-1 basis-60"
            />
            <Button variant="ghost" size="icon-lg" aria-label={`Remove certificate ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="lg" className="h-10" onClick={save} disabled={busy || !rows.some((r) => r.name.trim())}>
          {busy ? "Saving…" : "Save Certificates"}
        </Button>
        {!rows.some((r) => r.name.trim()) ? <span className="self-center text-xs text-ink/60">Type or pick a certificate name first.</span> : null}
        <Button variant="ghost" size="lg" className="h-10" onClick={() => setRows([...rows, { name: "", score: "", url: "" }])}>
          <Plus /> Add Another
        </Button>
      </div>
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>
      {result ? (
        <ResultPanel title="Saved. These skills now count your certificates:">
          <SkillChips scores={result} names={names} />
          {claimed ? <p className="mt-2 text-xs text-ink/70">{claimed} certificate(s) have no verifiable link, so they count as claims at half weight. Add the link to count them fully.</p> : null}
        </ResultPanel>
      ) : null}
    </StepPanel>
  );
}

// ------------------------------------------------------------------ projects
interface Rating {
  skill_id: string;
  level: number;
  quote: string;
  rationale: string;
}

function Projects({ sid, names, onSaved }: { sid: string; names: Record<string, string>; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ ratings: Rating[]; rejected: Rating[]; review_status?: string; review_reason?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [course, setCourse] = useState("");
  const courses = useApi<{ id: number; name: string }[]>(`/students/${sid}/courses`);
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("title", title || file?.name || "Project");
      if (course) fd.append("course", course);
      if (file) fd.append("file", file);
      else fd.append("text", text);
      setResult(await api.post(`/students/${sid}/evidence/project`, fd));
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <StepPanel title="Add a Project" description="A report, notebook, SQL file, or requirements document. Each skill is rated from what the work actually shows, with a quote as proof.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ptitle">Project Title</Label>
          <Input id="ptitle" name="project-title" autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Customer Churn Analysis…" className="h-10" />
        </div>
        {courses.data?.length ? (
          <div className="space-y-1.5">
            <Label htmlFor="pcourse">From a course? (optional)</Label>
            <NativeSelect id="pcourse" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Personal or other project</option>
              {courses.data.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <PasteOrUpload id="ptext" label="Project Content" text={text} setText={setText} file={file} setFile={setFile} accept=".pdf,.docx,.txt,.ipynb,.sql,.md,.py" placeholder="Paste the content of your project…" />
      </div>
      <Button size="lg" className="mt-5 h-10" onClick={save} disabled={busy || (!file && text.trim().length < 30)}>
        {busy ? "Rating…" : "Rate My Project"}
      </Button>
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>
      {result ? (
        <ResultPanel title={`Saved. ${result.ratings.length} skill${result.ratings.length === 1 ? "" : "s"} shown in this project:`}>
          <ul className="space-y-3">
            {result.ratings.map((r) => (
              <li key={r.skill_id}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {names[r.skill_id] ?? r.skill_id} <Tag tone="indigo">{RUBRIC[r.level]}</Tag>
                </p>
                <p className="mt-1 border-l-2 border-iris pl-3 font-mono text-xs text-ink/70">{r.quote}</p>
              </li>
            ))}
          </ul>
          {result.rejected.length ? <p className="mt-3 text-xs text-ink/70">{result.rejected.length} rating(s) dropped because their quote wasn't in your project.</p> : null}
          {result.review_status === "pending" ? (
            <p className="mt-3 text-xs text-ember-ink">
              A reviewer will check this rating ({result.review_reason}). Until then it counts at half weight.
            </p>
          ) : null}
        </ResultPanel>
      ) : null}
    </StepPanel>
  );
}

// ------------------------------------------------------------------ CV
function CV({ sid, names, onSaved }: { sid: string; names: Record<string, string>; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ claims: { skill_id: string; quote: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("text", text);
      setResult(await api.post(`/students/${sid}/evidence/cv`, fd));
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <StepPanel title="Add Your CV" description="Skills on your CV don't raise your level. They tell us where a quick check could prove what you already know.">
      <PasteOrUpload id="cv" label="CV Content" text={text} setText={setText} file={file} setFile={setFile} accept=".pdf,.docx,.txt" placeholder="Paste your CV…" />
      <Button size="lg" className="mt-5 h-10" onClick={save} disabled={busy || (!file && text.trim().length < 20)}>
        {busy ? "Reading…" : "Read My CV"}
      </Button>
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>
      {result ? (
        <ResultPanel title={`Saved. You mention ${result.claims.length} skill${result.claims.length === 1 ? "" : "s"}:`}>
          <ul className="flex flex-wrap gap-2">
            {result.claims.map((c) => (
              <li key={c.skill_id}>
                <Tag tone="neutral">{names[c.skill_id] ?? c.skill_id}</Tag>
              </li>
            ))}
          </ul>
        </ResultPanel>
      ) : null}
    </StepPanel>
  );
}

// ------------------------------------------------------------------ preferences
interface MarketSkill {
  skill_id: string;
  name: string;
  demand: number;
}

function Preferences({ student, meta, names, onSaved }: { student: Student; meta: Meta; names: Record<string, string>; onSaved: () => void }) {
  const prefs = student.preferences as { weekly_hours?: number; format?: string | null; language?: string };
  const [role, setRole] = useState(student.target_role);
  const [hoursPerWeek, setHours] = useState(Number(prefs.weekly_hours ?? 6));
  const [format, setFormat] = useState(prefs.format ?? "");
  const [language, setLanguage] = useState(prefs.language ?? "id");
  const [ratings, setRatings] = useState<Record<string, number>>(student.self_ratings ?? {});
  const [rateOpen, setRateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  async function save(extra?: Record<string, number>) {
    setBusy(true);
    setErr(null);
    try {
      await api.patch(`/students/${student.id}`, {
        target_role: role,
        preferences: { weekly_hours: hoursPerWeek, format: format || null, language },
        self_ratings: extra ?? ratings,
      });
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  const seg = (value: string, current: string, set: (v: string) => void, label: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={current === value}
      onClick={() => set(value)}
      className={cn(
        "h-10 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        current === value ? "border-indigo bg-secondary text-secondary-foreground" : "bg-card hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
  const rated = Object.keys(ratings).length;

  return (
    <StepPanel title="Set Your Preferences" description="We use these to size your route and choose materials. Changing your role rebuilds your route.">
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Target Role</legend>
          <div className="flex flex-wrap gap-2">{meta.roles.map((r) => seg(r.id, role, setRole, r.name))}</div>
        </fieldset>
        <div>
          <Label htmlFor="hours" className="mb-2 block">
            Study Time per Week: <span className="tabular font-semibold">{hoursPerWeek} hours</span>
          </Label>
          <input id="hours" type="range" min={1} max={20} step={1} value={hoursPerWeek} onChange={(e) => setHours(Number(e.target.value))} className="w-full max-w-md accent-[#4338ca]" />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Preferred Format</legend>
          <div className="flex flex-wrap gap-2">
            {[["", "Any"], ["video", "Video"], ["teks", "Articles"], ["kursus", "Courses"], ["latihan", "Practice"]].map(([v, l]) => seg(v, format, setFormat, l))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Material Language</legend>
          <div className="flex flex-wrap gap-2">
            {seg("id", language, setLanguage, "Prefer Indonesian")}
            {seg("en", language, setLanguage, "English Is Fine")}
          </div>
        </fieldset>
        <div className="rounded-xl bg-muted/70 p-4">
          <p className="text-sm font-medium text-ink">Rate Yourself (Optional)</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Doesn&rsquo;t change your level. It shows where your confidence and your evidence disagree.
            {rated ? ` You rated ${rated} skill${rated > 1 ? "s" : ""}.` : ""}
          </p>
          <Button variant="outline" size="lg" className="mt-3 h-10" onClick={() => setRateOpen(true)}>
            {rated ? "Edit My Ratings" : "Rate My Skills"}
          </Button>
        </div>
      </div>
      <div className="mt-6">
        <ErrorNote error={err} />
      </div>
      <Button size="lg" className="mt-4 h-10" onClick={() => save()} disabled={busy}>
        {busy ? "Saving…" : "Save Preferences"}
      </Button>
      <SelfRatingDialog
        open={rateOpen}
        onOpenChange={setRateOpen}
        role={role}
        names={names}
        initial={ratings}
        onSave={(r) => {
          setRatings(r);
          setRateOpen(false);
          save(r);
        }}
      />
    </StepPanel>
  );
}

const SCALE = ["Never Used", "Beginner", "Some Practice", "Confident", "Expert"];

function SelfRatingDialog({ open, onOpenChange, role, names, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; role: string; names: Record<string, string>; initial: Record<string, number>; onSave: (r: Record<string, number>) => void;
}) {
  const market = useApi<{ skills: MarketSkill[] }>(open ? `/market/${role}` : null);
  const [r, setR] = useState<Record<string, number>>(initial);
  useEffect(() => {
    if (open) setR(initial);
  }, [open, initial]);
  const skills = (market.data?.skills ?? []).slice(0, 12);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Rate Your Skills</DialogTitle>
          <DialogDescription>The 12 skills employers ask for most in this role. Be honest; this never lowers or raises your level.</DialogDescription>
        </DialogHeader>
        {!market.data ? (
          <Loading />
        ) : (
          <ul className="divide-y">
            {skills.map((s) => (
              <li key={s.skill_id} className="py-3">
                <p className="text-sm font-medium text-ink">{names[s.skill_id] ?? titleCase(s.name)}</p>
                <div role="radiogroup" aria-label={names[s.skill_id] ?? s.name} className="mt-2 grid grid-cols-5 gap-1.5">
                  {SCALE.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={r[s.skill_id] === i + 1}
                      onClick={() => setR({ ...r, [s.skill_id]: i + 1 })}
                      className={cn(
                        "min-h-10 rounded-lg border px-1 text-[11px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
                        r[s.skill_id] === i + 1 ? "border-indigo bg-indigo text-white" : "bg-card text-ink/80 hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button size="lg" className="h-10" onClick={() => onSave(r)}>
            Save Ratings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
