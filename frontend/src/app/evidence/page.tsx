"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { EvidenceList } from "@/components/evidence-list";
import { RequireStudent } from "@/components/require-student";
import { ErrorNote, LinkButton, Loading, NativeSelect, PageHeader, Tag } from "@/components/kit";
import type { MascotName } from "@/components/mascot";
import { useT } from "@/lib/i18n";

type StepId = "transcript" | "certificates" | "projects" | "cv" | "preferences";
// label and hint: [English, Indonesian]
const STEPS: { id: StepId; label: [string, string]; icon: typeof GraduationCap; kind?: string; hint: [string, string] }[] = [
  { id: "transcript", label: ["Transcript", "Transkrip"], icon: GraduationCap, kind: "academic", hint: ["Your course grades", "Nilai mata kuliahmu"] },
  { id: "certificates", label: ["Certificates", "Sertifikat"], icon: Award, kind: "certificate", hint: ["Courses and exams", "Kursus dan ujian"] },
  { id: "projects", label: ["Projects", "Project"], icon: FolderKanban, kind: "project", hint: ["Work you can show", "Karya yang bisa ditunjukkan"] },
  { id: "cv", label: ["CV", "CV"], icon: UserRound, kind: "cv", hint: ["Skills you mention", "Skill yang kamu sebut"] },
  { id: "preferences", label: ["Preferences", "Preferensi"], icon: SlidersHorizontal, hint: ["How you like to learn", "Cara belajar favoritmu"] },
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
  const t = useT();
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
    toast.success(t(`${label} saved`, `${label} tersimpan`), next ? { action: { label: `${t("Next", "Lanjut")}: ${t(...next.label)}`, onClick: () => go(next.id) } } : undefined);
  };

  return (
    <div>
      <PageHeader
        className="mb-5"
        title={t("Add Evidence", "Tambah Bukti")}
        description={t("Every step is optional; pick any. The more you add, the more accurate your route gets.", "Setiap langkah opsional; pilih yang mana saja. Makin banyak yang kamu tambahkan, makin akurat rutemu.")}
        actions={
          <LinkButton href="/skills" variant="outline" size="sm">
            {t("See My Skills", "Lihat Skill-ku")}
          </LinkButton>
        }
      />

      {/* compact stepper: one row (scrolls sideways on phones), every step reachable directly */}
      <nav aria-label={t("Evidence steps", "Langkah bukti")} className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex min-w-max gap-1.5">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const isDone = done(s);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(s.id)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${t(...s.label)}${isDone ? t(", done", ", selesai") : ""}`}
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-indigo bg-secondary text-secondary-foreground" : "bg-card text-ink/75 hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      isDone ? "bg-mint text-white" : active ? "bg-indigo text-white" : "bg-muted text-ink/70",
                    )}
                  >
                    {isDone ? <Check className="size-3.5" aria-label={t("Done", "Selesai")} /> : i + 1}
                  </span>
                  {t(...s.label)}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* the form and the step navigation share one card: saving is inside the form, moving on is its footer */}
        <div className="min-w-0 rounded-2xl border bg-card">
          {step === "transcript" && <Transcript sid={sid} catalog={catalog.data} names={names} onSaved={() => saved(t("Transcript", "Transkrip"))} />}
          {step === "certificates" && <Certificates sid={sid} catalog={catalog.data} names={names} onSaved={() => saved(t("Certificates", "Sertifikat"))} />}
          {step === "projects" && <Projects sid={sid} names={names} onSaved={() => saved("Project")} />}
          {step === "cv" && <CV sid={sid} names={names} onSaved={() => saved("CV")} />}
          {step === "preferences" && student.data && meta.data && (
            <Preferences student={student.data} meta={meta.data} names={names} onSaved={() => {
              student.reload();
              toast.success(t("Preferences saved", "Preferensi tersimpan"), { action: { label: t("See My Route", "Lihat Ruteku"), onClick: () => router.push("/dashboard") } });
            }} />
          )}
          <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
            <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => go(STEPS[idx - 1].id)}>
              ← {t("Back", "Kembali")}
            </Button>
            {next ? (
              <Button variant="ghost" size="sm" onClick={() => go(next.id)}>
                {done(STEPS[idx]) ? t(`Next: ${t(...next.label)}`, `Berikutnya: ${t(...next.label)}`) : t(`Skip to ${t(...next.label)}`, `Lewati ke ${t(...next.label)}`)} →
              </Button>
            ) : (
              <LinkButton href="/assessment" size="sm" variant="outline">
                {t("Take the Skill Check", "Ikuti Cek Kemampuan")}
              </LinkButton>
            )}
          </div>
        </div>
        <EvidenceList sid={sid} student={student.data} onChange={student.reload} />
      </div>
    </div>
  );
}



// ------------------------------------------------------------------ shared bits
/** The body of one step inside the wizard card: a short heading and the form. (`mascot` is kept for the call sites;
 * the page header no longer repeats an illustration inside every step.) */
function StepPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode; mascot?: MascotName }) {
  return (
    <div className="p-5 sm:p-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PasteOrUpload({ id, label, text, setText, file, setFile, accept, placeholder }: {
  id: string; label: string; text: string; setText: (s: string) => void; file: File | null; setFile: (f: File | null) => void; accept: string; placeholder: string;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} disabled={!!file} className="min-h-40 font-mono text-[13px]" />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 font-medium text-ink hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
          <Upload className="size-4" aria-hidden="true" /> {t("Upload a File", "Unggah File")}
          <input type="file" accept={accept} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <span className="text-xs text-muted-foreground">{accept.replaceAll(",", ", ")}</span>
        {file ? (
          <span className="flex items-center gap-2 text-ink/80">
            <FileText className="size-4" aria-hidden="true" /> {file.name}
            <button type="button" className="text-xs font-medium text-indigo underline" onClick={() => setFile(null)}>
              {t("Remove", "Hapus")}
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SkillChips({ scores, names }: { scores: Record<string, number>; names: Record<string, string> }) {
  const t = useT();
  const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t("No skills matched.", "Tidak ada skill yang cocok.")}</p>;
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
  const t = useT();

  async function read() {
    setBusy("read");
    setErr(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("text", text);
      const r = await api.post<{ courses: CourseRow[] }>(`/students/${sid}/transcript/parse`, fd);
      setRows(r.courses);
      if (!r.courses.length) setErr(new Error(t("We couldn't find any 'course, grade' lines. Check the format or add courses by hand.", "Kami tidak menemukan baris 'mata kuliah, nilai'. Cek formatnya atau tambahkan mata kuliah secara manual.")));
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
    <StepPanel mascot="transcript" title={t("Add Your Transcript", "Tambahkan Transkripmu")} description={t("Paste your grades or upload your transcript. Grades are indirect evidence of knowledge, so they carry the lightest weight.", "Tempel nilaimu atau unggah transkrip. Nilai adalah bukti tidak langsung tentang pengetahuan, jadi bobotnya paling ringan.")}>
      {rows.length === 0 ? (
        <>
          <PasteOrUpload
            id="transcript"
            label={t("Courses and Grades", "Mata Kuliah dan Nilai")}
            text={text}
            setText={setText}
            file={file}
            setFile={setFile}
            accept=".pdf,.docx,.txt,.csv"
            placeholder={"Basis Data, A\nAnalisis dan Perancangan Sistem, B+\nStatistika Bisnis, B"}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" className="h-10" onClick={read} disabled={busy !== null || (!file && text.trim().length < 4)}>
              {busy === "read" ? t("Reading…", "Membaca…") : t("Read Transcript", "Baca Transkrip")}
            </Button>
            <Button variant="ghost" size="lg" className="h-10" onClick={() => setRows([{ name: "", grade: "A" }])}>
              <Plus /> {t("Add Courses by Hand", "Tambah Mata Kuliah Manual")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink/75">{t(`Check the ${rows.length} courses we found, then save.`, `Cek ${rows.length} mata kuliah yang kami temukan, lalu simpan.`)}</p>
          <datalist id="courses">
            {catalog?.courses.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="flex gap-2">
                <Input list="courses" aria-label={t(`Course ${i + 1}`, `Mata kuliah ${i + 1}`)} value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="h-10" />
                <NativeSelect aria-label={t(`Grade for course ${i + 1}`, `Nilai mata kuliah ${i + 1}`)} value={r.grade} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))} className="w-24">
                  {grades.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </NativeSelect>
                <Button variant="ghost" size="icon-lg" aria-label={t(`Remove course ${i + 1}`, `Hapus mata kuliah ${i + 1}`)} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg" className="h-10" onClick={save} disabled={busy !== null}>
              {busy === "save" ? t("Saving…", "Menyimpan…") : t("Save Transcript", "Simpan Transkrip")}
            </Button>
            <Button variant="ghost" size="lg" className="h-10" onClick={() => setRows([...rows, { name: "", grade: "A" }])}>
              <Plus /> {t("Add a Course", "Tambah Mata Kuliah")}
            </Button>
            <Button variant="ghost" size="lg" className="h-10" onClick={() => setRows([])}>
              {t("Start Over", "Mulai Ulang")}
            </Button>
          </div>
        </>
      )}
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>
      {result ? (
        <ResultPanel title={t("Saved. These skills now count your coursework:", "Tersimpan. Skill ini sekarang menghitung mata kuliahmu:")}>
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
  const t = useT();

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
    <StepPanel
      mascot="certificate"
      title={t("Add Certificates", "Tambahkan Sertifikat")}
      description={t(
        "Pick from our list or type any course name, and paste the credential link (Coursera, Dicoding, Credly, Google, Microsoft…). A certificate with a verifiable link counts fully; one without a link counts as a claim, at half weight.",
        "Pilih dari daftar kami atau ketik nama kursus apa pun, lalu tempel tautan kredensialnya (Coursera, Dicoding, Credly, Google, Microsoft…). Sertifikat dengan tautan yang bisa diverifikasi dihitung penuh; tanpa tautan dihitung sebagai klaim, setengah bobot.",
      )}
    >
      <datalist id="certs">
        {catalog?.certificates.map((c) => <option key={c.name} value={c.name} />)}
      </datalist>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap gap-2">
            <Input
              list="certs"
              aria-label={t(`Certificate ${i + 1}`, `Sertifikat ${i + 1}`)}
              placeholder={t("e.g. Google Data Analytics Professional Certificate…", "mis. Google Data Analytics Professional Certificate…")}
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
              aria-label={t(`Credential link ${i + 1}`, `Tautan kredensial ${i + 1}`)}
              placeholder={t("Credential link, https://…", "Tautan kredensial, https://…")}
              value={r.url}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              className="h-10 min-w-0 flex-1 basis-60"
            />
            <Button variant="ghost" size="icon-lg" aria-label={t(`Remove certificate ${i + 1}`, `Hapus sertifikat ${i + 1}`)} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="lg" className="h-10" onClick={save} disabled={busy || !rows.some((r) => r.name.trim())}>
          {busy ? t("Saving…", "Menyimpan…") : t("Save Certificates", "Simpan Sertifikat")}
        </Button>
        {!rows.some((r) => r.name.trim()) ? <span className="self-center text-xs text-ink/60">{t("Type or pick a certificate name first.", "Ketik atau pilih nama sertifikat dulu.")}</span> : null}
        <Button variant="ghost" size="lg" className="h-10" onClick={() => setRows([...rows, { name: "", score: "", url: "" }])}>
          <Plus /> {t("Add Another", "Tambah Lagi")}
        </Button>
      </div>
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>
      {result ? (
        <ResultPanel title={t("Saved. These skills now count your certificates:", "Tersimpan. Skill ini sekarang menghitung sertifikatmu:")}>
          <SkillChips scores={result} names={names} />
          {claimed ? <p className="mt-2 text-xs text-ink/70">{t(`${claimed} certificate(s) have no verifiable link, so they count as claims at half weight. Add the link to count them fully.`, `${claimed} sertifikat tidak punya tautan yang bisa diverifikasi, jadi dihitung sebagai klaim setengah bobot. Tambahkan tautannya agar dihitung penuh.`)}</p> : null}
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
  const t = useT();
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
    <StepPanel
      mascot="portfolio"
      title={t("Add a Project", "Tambahkan Project")}
      description={t("A report, notebook, SQL file, or requirements document. Each skill is rated from what the work actually shows, with a quote as proof.", "Laporan, notebook, file SQL, atau dokumen requirements. Setiap skill dinilai dari apa yang benar-benar ditunjukkan karyamu, dengan kutipan sebagai bukti.")}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ptitle">{t("Project Title", "Judul Project")}</Label>
          <Input id="ptitle" name="project-title" autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Customer Churn Analysis…", "mis. Analisis Churn Pelanggan…")} className="h-10" />
        </div>
        {courses.data?.length ? (
          <div className="space-y-1.5">
            <Label htmlFor="pcourse">{t("From a course? (optional)", "Dari mata kuliah? (opsional)")}</Label>
            <NativeSelect id="pcourse" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">{t("Personal or other project", "Project pribadi atau lainnya")}</option>
              {courses.data.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
        <PasteOrUpload id="ptext" label={t("Project Content", "Isi Project")} text={text} setText={setText} file={file} setFile={setFile} accept=".pdf,.docx,.txt,.ipynb,.sql,.md,.py" placeholder={t("Paste the content of your project…", "Tempel isi project-mu…")} />
      </div>
      <Button size="lg" className="mt-5 h-10" onClick={save} disabled={busy || (!file && text.trim().length < 30)}>
        {busy ? t("Rating…", "Menilai…") : t("Rate My Project", "Nilai Project-ku")}
      </Button>
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>
      {result ? (
        <ResultPanel title={t(`Saved. ${result.ratings.length} skill${result.ratings.length === 1 ? "" : "s"} shown in this project:`, `Tersimpan. ${result.ratings.length} skill ditunjukkan di project ini:`)}>
          <ul className="space-y-3">
            {result.ratings.map((r) => (
              <li key={r.skill_id}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {names[r.skill_id] ?? r.skill_id} <Tag tone="indigo">{t(...RUBRIC[r.level])}</Tag>
                </p>
                <p className="mt-1 border-l-2 border-iris pl-3 font-mono text-xs text-ink/70">{r.quote}</p>
              </li>
            ))}
          </ul>
          {result.rejected.length ? <p className="mt-3 text-xs text-ink/70">{t(`${result.rejected.length} rating(s) dropped because their quote wasn't in your project.`, `${result.rejected.length} penilaian dibuang karena kutipannya tidak ada di project-mu.`)}</p> : null}
          {result.review_status === "pending" ? (
            <p className="mt-3 text-xs text-ember-ink">
              {t(`A reviewer will check this rating (${result.review_reason}). Until then it counts at half weight.`, `Reviewer akan memeriksa penilaian ini (${result.review_reason}). Sampai saat itu bobotnya setengah.`)}
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
  const t = useT();
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
    <StepPanel
      mascot="thinking"
      title={t("Add Your CV", "Tambahkan CV-mu")}
      description={t("Skills on your CV don't raise your level. They tell us where a quick check could prove what you already know.", "Skill di CV tidak menaikkan level-mu. Itu memberi tahu kami di mana Cek Kemampuan bisa membuktikan yang sudah kamu kuasai.")}
    >
      <PasteOrUpload id="cv" label={t("CV Content", "Isi CV")} text={text} setText={setText} file={file} setFile={setFile} accept=".pdf,.docx,.txt" placeholder={t("Paste your CV…", "Tempel CV-mu…")} />
      <Button size="lg" className="mt-5 h-10" onClick={save} disabled={busy || (!file && text.trim().length < 20)}>
        {busy ? t("Reading…", "Membaca…") : t("Read My CV", "Baca CV-ku")}
      </Button>
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>
      {result ? (
        <ResultPanel title={t(`Saved. You mention ${result.claims.length} skill${result.claims.length === 1 ? "" : "s"}:`, `Tersimpan. Kamu menyebut ${result.claims.length} skill:`)}>
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
  const t = useT();

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
    <StepPanel
      mascot="calendar"
      title={t("Set Your Preferences", "Atur Preferensimu")}
      description={t("We use these to size your route and choose materials. Changing your role rebuilds your route.", "Kami memakai ini untuk menakar rutemu dan memilih materi. Mengganti role akan menyusun ulang rutemu.")}
    >
      <div className="space-y-6">
        {/* one control for the target; comparing careers in depth lives in Pilih Karier */}
        <div className="max-w-sm">
          <Label htmlFor="target-role" className="mb-2 block">{t("Target Role", "Target Role")}</Label>
          <NativeSelect id="target-role" value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(meta.families ?? {}).map(([fid, fname]) => (
              <optgroup key={fid} label={fname}>
                {meta.roles.filter((r) => r.family === fid).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.limited_data ? " (Beta)" : ""}</option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Not sure yet? ", "Belum yakin? ")}
            <Link href="/careers" className="font-medium text-indigo underline-offset-4 hover:underline">{t("Compare careers first", "Bandingkan karier dulu")}</Link>
          </p>
        </div>
        <div>
          <Label htmlFor="hours" className="mb-2 block">
            {t("Study Time per Week", "Waktu Belajar per Minggu")}: <span className="tabular font-semibold">{hoursPerWeek} {t("hours", "jam")}</span>
          </Label>
          <input id="hours" type="range" min={1} max={20} step={1} value={hoursPerWeek} onChange={(e) => setHours(Number(e.target.value))} className="w-full max-w-md accent-indigo" />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t("Preferred Format", "Format Favorit")}</legend>
          <div className="flex flex-wrap gap-2">
            {[["", t("Any", "Apa saja")], ["video", "Video"], ["teks", t("Articles", "Artikel")], ["kursus", t("Courses", "Kursus")], ["latihan", t("Practice", "Latihan")]].map(([v, l]) => seg(v, format, setFormat, l))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t("Material Language", "Bahasa Materi")}</legend>
          <div className="flex flex-wrap gap-2">
            {seg("id", language, setLanguage, t("Prefer Indonesian", "Utamakan Bahasa Indonesia"))}
            {seg("en", language, setLanguage, t("English Is Fine", "Bahasa Inggris Tidak Masalah"))}
          </div>
        </fieldset>
        <div className="rounded-xl bg-muted/70 p-4">
          <p className="text-sm font-medium text-ink">{t("Rate Yourself (Optional)", "Nilai Dirimu (Opsional)")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Doesn\u2019t change your level. It shows where your confidence and your evidence disagree.", "Tidak mengubah level-mu. Ini menunjukkan di mana keyakinanmu dan evidence-mu berbeda.")}
            {rated ? t(` You rated ${rated} skill${rated > 1 ? "s" : ""}.`, ` Kamu sudah menilai ${rated} skill.`) : ""}
          </p>
          <Button variant="outline" size="lg" className="mt-3 h-10" onClick={() => setRateOpen(true)}>
            {rated ? t("Edit My Ratings", "Ubah Penilaianku") : t("Rate My Skills", "Nilai Skill-ku")}
          </Button>
        </div>
      </div>
      <div className="mt-6">
        <ErrorNote error={err} />
      </div>
      <Button size="lg" className="mt-4 h-10" onClick={() => save()} disabled={busy}>
        {busy ? t("Saving…", "Menyimpan…") : t("Save Preferences", "Simpan Preferensi")}
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

const SCALE: [string, string][] = [["Never Used", "Belum Pernah"], ["Beginner", "Pemula"], ["Some Practice", "Sedikit Latihan"], ["Confident", "Percaya Diri"], ["Expert", "Ahli"]];

function SelfRatingDialog({ open, onOpenChange, role, names, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; role: string; names: Record<string, string>; initial: Record<string, number>; onSave: (r: Record<string, number>) => void;
}) {
  const market = useApi<{ skills: MarketSkill[] }>(open ? `/market/${role}` : null);
  const [r, setR] = useState<Record<string, number>>(initial);
  const t = useT();
  useEffect(() => {
    if (open) setR(initial);
  }, [open, initial]);
  const skills = (market.data?.skills ?? []).slice(0, 12);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("Rate Your Skills", "Nilai Skill-mu")}</DialogTitle>
          <DialogDescription>{t("The 12 skills employers ask for most in this role. Be honest; this never lowers or raises your level.", "12 skill yang paling banyak diminta employer untuk role ini. Jujur saja; ini tidak pernah menurunkan atau menaikkan level-mu.")}</DialogDescription>
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
                      key={label[0]}
                      type="button"
                      role="radio"
                      aria-checked={r[s.skill_id] === i + 1}
                      onClick={() => setR({ ...r, [s.skill_id]: i + 1 })}
                      className={cn(
                        "min-h-10 rounded-lg border px-1 text-xs font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
                        r[s.skill_id] === i + 1 ? "border-indigo bg-indigo text-white" : "bg-card text-ink/80 hover:bg-muted",
                      )}
                    >
                      {t(...label)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button size="lg" className="h-10" onClick={() => onSave(r)}>
            {t("Save Ratings", "Simpan Penilaian")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
