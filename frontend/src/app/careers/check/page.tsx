"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ClipboardPaste, KeyRound, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { LEVEL, pct } from "@/lib/format";
import { useLang, useT, type T } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RequireStudent } from "@/components/require-student";
import { EmptyState, ErrorNote, LinkButton, Panel, SectionTitle, Tag } from "@/components/kit";
import { MascotLoader } from "@/components/mascot-loader";

// Job Check (docs/design/JOB_CHECK.md): one pasted posting against the student's existing evidence. The backend
// (POST /students/{id}/check-job) never stores the text; offsets are UTF-16, the same unit as JS string slices.

type Evidence = "direct" | "academic" | "none";
interface CheckedSkill { text: string; start: number; end: number; skill_id: string; skill_name: string; level_needed: string; level_now: string; evidence_status: Evidence }
interface ReviewTerm { text: string; start: number; end: number; status: string }
interface JobCheck {
  extractor: string;
  n_recognized_skills: number;
  readiness: { score: number | null; n_with_evidence: number; meaning: string };
  skills: CheckedSkill[];
  gaps: { skill_id: string; skill_name: string; level_needed: string; level_now: string; gap: number }[];
  next_step: { skill_id: string; skill_name: string; role_in_path: string; unlocks_requested: { skill_id: string; skill_name: string }[]; quick_check_url: string } | null;
  terms_to_review: ReviewTerm[];
}

const MIN_CHARS = 30;
const MAX_CHARS = 12_000;

const SAMPLE: [string, string] = [
  `Business Analyst (Fresh Graduate)
Responsibilities: run requirement gathering sessions with stakeholders, write user stories and acceptance criteria, model business processes with BPMN, and help the team test new features.
Requirements: Bachelor's degree in Information Systems or similar; familiar with SQL and Power BI; able to present findings clearly; good communication and teamwork.`,
  `Business Analyst (Fresh Graduate)
Tanggung jawab: memimpin requirement gathering bersama stakeholder, menulis user story dan acceptance criteria, memodelkan proses bisnis dengan BPMN, serta membantu tim menguji fitur baru.
Kualifikasi: S1 Sistem Informasi atau sejenis; familiar dengan SQL dan Power BI; mampu mempresentasikan temuan dengan jelas; komunikasi dan kerja sama tim yang baik.`,
];

export default function JobCheckPage() {
  return <RequireStudent>{(sid) => <JobCheckView sid={sid} />}</RequireStudent>;
}

function JobCheckView({ sid }: { sid: string }) {
  const t = useT();
  const lang = useLang();
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<{ text: string; result: JobCheck } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const tooShort = text.trim().length < MIN_CHARS;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<JobCheck>(`/students/${sid}/check-job`, { text });
      setChecked({ text, result });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <Link href="/careers" className="text-sm font-medium text-indigo underline-offset-4 hover:underline">
        ← {t("Choose a Career", "Pilih Karier")}
      </Link>
      <h1 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{t("Check a Job Posting", "Cek Lowongan")}</h1>
      <p className="mt-2 max-w-2xl text-ink/75">
        {t(
          "Paste the requirements of one real posting. PathSync shows which skills it asks for, how ready your evidence says you are, and where to start.",
          "Tempel persyaratan satu lowongan nyata. PathSync menunjukkan skill apa yang diminta, seberapa siap kamu menurut bukti yang ada, dan harus mulai dari mana.",
        )}
      </p>

      <Panel className="mt-6 space-y-3">
        <label htmlFor="job-text" className="text-sm font-medium text-ink">{t("Posting text", "Teks lowongan")}</label>
        <Textarea
          id="job-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHARS}
          rows={8}
          className="min-h-40 bg-card"
          placeholder={t("Paste the job description and requirements here…", "Tempel deskripsi dan kualifikasi lowongan di sini…")}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden="true" />
            {t("The text is read once and not saved.", "Teks hanya dibaca sekali dan tidak disimpan.")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setText(lang === "en" ? SAMPLE[0] : SAMPLE[1])}>
              <ClipboardPaste aria-hidden="true" />
              {t("Use an example", "Pakai contoh")}
            </Button>
            <Button onClick={run} disabled={tooShort || busy}>
              {busy ? t("Checking…", "Mengecek…") : t("Check my readiness", "Cek kesiapanku")}
            </Button>
          </div>
        </div>
        {tooShort && text.length > 0 ? (
          <p className="text-xs text-muted-foreground">{t(`At least ${MIN_CHARS} characters.`, `Minimal ${MIN_CHARS} karakter.`)}</p>
        ) : null}
        <ErrorNote error={error} />
      </Panel>

      {busy ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
          <MascotLoader size={64} />
          {t("Reading the posting…", "Membaca lowongan…")}
        </div>
      ) : checked ? (
        <Result text={checked.text} r={checked.result} t={t} />
      ) : null}
    </div>
  );
}

function Result({ text, r, t }: { text: string; r: JobCheck; t: T }) {
  const lvl = (k: string) => {
    const pair = LEVEL[k];
    return pair ? t(pair[0], pair[1]) : k;
  };
  if (!r.n_recognized_skills) {
    return (
      <div className="mt-6">
        <EmptyState title={t("No known skills found in this text", "Belum ada skill yang dikenali di teks ini")} mascot="thinking">
          {t(
            "PathSync knows the hard skills of its 20 careers. Paste the requirements part of the posting, or try another posting.",
            "PathSync mengenal hard skill dari 20 kariernya. Tempel bagian kualifikasi lowongan, atau coba lowongan lain.",
          )}
        </EmptyState>
      </div>
    );
  }
  // one skill can appear several times; count each requested skill once
  const bySkill = new Map(r.skills.map((s) => [s.skill_id, s]));
  const counts = { direct: 0, academic: 0, none: 0 };
  bySkill.forEach((s) => counts[s.evidence_status]++);
  const ready = r.readiness.score ?? 0;

  return (
    <div className="mt-8 space-y-8">
      <section aria-labelledby="ready-title" className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <Panel>
          <h2 id="ready-title" className="text-sm font-medium text-muted-foreground">{t("Your readiness for this posting", "Kesiapanmu untuk lowongan ini")}</h2>
          <p className="tabular mt-1 text-[40px] font-bold leading-none text-ink">{pct(ready)}</p>
          <p className="mt-2 text-sm text-ink/75">
            {t(`Of the ${bySkill.size} skills this posting asks for that PathSync recognises.`, `Dari ${bySkill.size} skill yang diminta lowongan ini dan dikenali PathSync.`)}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            <Count tone="mint" n={counts.direct} label={t("proven (skill check, project or certificate)", "sudah terbukti (cek kemampuan, project, atau sertifikat)")} />
            <Count tone="ember" n={counts.academic} label={t("only a guess from grades", "baru dugaan dari nilai")} />
            <Count tone="neutral" n={counts.none} label={t("no evidence yet", "belum ada bukti")} />
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            {t("This is coverage of the posting's skills, not the chance of being hired.", "Ini cakupan skill yang diminta lowongan, bukan peluang diterima kerja.")}
          </p>
        </Panel>

        {r.next_step ? (
          <Panel className="flex flex-col border-indigo/30 bg-secondary/40">
            <h2 className="text-sm font-medium text-muted-foreground">{t("Start here", "Mulai dari sini")}</h2>
            <p className="mt-1 text-[22px] font-semibold text-ink">{r.next_step.skill_name}</p>
            <p className="mt-2 text-sm text-ink/80">
              {r.next_step.unlocks_requested.length
                ? t(
                    `It is a prerequisite for ${r.next_step.unlocks_requested.length} other skill(s) this posting asks for: ${r.next_step.unlocks_requested.map((u) => u.skill_name).join(", ")}.`,
                    `Ini prasyarat untuk ${r.next_step.unlocks_requested.length} skill lain yang diminta lowongan ini: ${r.next_step.unlocks_requested.map((u) => u.skill_name).join(", ")}.`,
                  )
                : r.next_step.role_in_path === "prioritas"
                  ? t("The biggest gap among the skills this posting asks for, weighed with what it unlocks.", "Kesenjangan terbesar di antara skill yang diminta lowongan ini, ditimbang dengan apa yang dibukanya.")
                  : t("A prerequisite you need before the skills this posting asks for.", "Prasyarat yang perlu kamu kuasai sebelum skill yang diminta lowongan ini.")}
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <LinkButton href={r.next_step.quick_check_url}>
                <KeyRound aria-hidden="true" />
                {t("Prove it with a quick check", "Buktikan dengan cek singkat")}
              </LinkButton>
              <LinkButton href="/learn" variant="outline">{t("See materials", "Lihat materi")}</LinkButton>
            </div>
          </Panel>
        ) : (
          <Panel className="flex flex-col justify-center border-mint/40 bg-[#e3f5ea]/40">
            <h2 className="text-[20px] font-semibold text-ink">{t("You already meet every recognised skill", "Kamu sudah memenuhi semua skill yang dikenali")}</h2>
            <p className="mt-2 text-sm text-ink/80">
              {t("Make sure the ones from grades are proven before you apply.", "Pastikan yang masih dari nilai sudah dibuktikan sebelum melamar.")}
            </p>
          </Panel>
        )}
      </section>

      <section aria-labelledby="text-title">
        <SectionTitle id="text-title">{t("What PathSync read", "Yang dibaca PathSync")}</SectionTitle>
        <Panel>
          <Highlighted text={text} skills={r.skills} review={r.terms_to_review} lvl={lvl} t={t} />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
            <LegendSwatch className="bg-[#e3f5ea] ring-1 ring-mint/50" label={t("skill, proven", "skill, sudah terbukti")} />
            <LegendSwatch className="bg-[#fff6d9] ring-1 ring-ember/50" label={t("skill, from grades only", "skill, baru dari nilai")} />
            <LegendSwatch className="bg-secondary ring-1 ring-indigo/40" label={t("skill, no evidence yet", "skill, belum ada bukti")} />
            <LegendSwatch className="border border-dashed border-ink/40" label={t("not recognised yet", "belum dikenali")} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("Soft skills such as communication, leadership or teamwork are not counted here: PathSync measures teachable hard skills.",
               "Soft skill seperti komunikasi, kepemimpinan, atau kerja sama tim tidak dihitung di sini: PathSync mengukur hard skill yang bisa dipelajari dan diuji.")}
          </p>
        </Panel>
      </section>

      <section aria-labelledby="skills-title">
        <SectionTitle id="skills-title">{t("Skill by skill", "Per skill")}</SectionTitle>
        <Panel className="p-0 sm:p-0">
          <ul className="divide-y">
            {[...bySkill.values()].map((s) => {
              const gap = r.gaps.find((g) => g.skill_id === s.skill_id);
              return (
                <li key={s.skill_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="font-medium text-ink [overflow-wrap:anywhere]">{s.skill_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("Needed", "Dibutuhkan")}: {lvl(s.level_needed)}, {t("You now", "Kamu sekarang")}: {lvl(s.level_now)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EvidenceTag status={s.evidence_status} t={t} />
                    {gap ? <Tag tone="red">{t("Gap", "Kurang")}</Tag> : <Tag tone="mint">{t("Met", "Terpenuhi")}</Tag>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </section>

      {r.terms_to_review.length ? (
        <section aria-labelledby="review-title">
          <SectionTitle id="review-title">
            {t(`${r.terms_to_review.length} term(s) not recognised yet`, `${r.terms_to_review.length} istilah belum dikenali`)}
          </SectionTitle>
          <Panel>
            <div className="flex flex-wrap gap-2">
              {r.terms_to_review.map((x, i) => (
                <span key={i} className="max-w-full rounded-md border border-dashed border-ink/40 px-2 py-0.5 text-sm text-ink/80 [overflow-wrap:anywhere]">{x.text}</span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t(
                "Phrases the extractor noticed but could not map to a known skill. They are left out of the readiness above instead of guessed, and the list is not a complete count of unknown terms.",
                "Frasa yang tertangkap tetapi belum bisa dipetakan ke skill yang dikenal. Frasa ini tidak dihitung dalam kesiapan di atas (tidak ditebak), dan daftarnya bukan hitungan lengkap istilah yang belum dikenal.",
              )}
            </p>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

function Count({ n, label, tone }: { n: number; label: string; tone: "mint" | "ember" | "neutral" }) {
  const dot = { mint: "bg-mint", ember: "bg-ember", neutral: "bg-ink/25" }[tone];
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-2.5 shrink-0 rounded-full", dot)} aria-hidden="true" />
      <span className="tabular font-semibold text-ink">{n}</span>
      <span className="text-ink/75">{label}</span>
    </li>
  );
}

function EvidenceTag({ status, t }: { status: Evidence; t: T }) {
  if (status === "direct") return <Tag tone="mint">{t("Proven", "Terbukti")}</Tag>;
  if (status === "academic") return <Tag tone="ember">{t("From grades", "Dari nilai")}</Tag>;
  return <Tag>{t("No evidence", "Belum ada bukti")}</Tag>;
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block h-3 w-5 rounded-sm", className)} aria-hidden="true" />
      {label}
    </span>
  );
}

const MARK: Record<Evidence, string> = {
  direct: "bg-[#e3f5ea] ring-1 ring-mint/50",
  academic: "bg-[#fff6d9] ring-1 ring-ember/50",
  none: "bg-secondary ring-1 ring-indigo/40",
};

/** The pasted text with each recognised skill marked by its evidence status, and unrecognised terms dashed. */
function Highlighted({ text, skills, review, lvl, t }: { text: string; skills: CheckedSkill[]; review: ReviewTerm[]; lvl: (k: string) => string; t: T }) {
  type Span = { start: number; end: number; node: (inner: string) => ReactNode };
  const spans: Span[] = [
    ...skills.map((s) => ({
      start: s.start,
      end: s.end,
      node: (inner: string) => (
        <mark
          className={cn("rounded px-0.5 text-ink", MARK[s.evidence_status])}
          title={`${s.skill_name}, ${t("needed", "dibutuhkan")} ${lvl(s.level_needed)}, ${t("you", "kamu")} ${lvl(s.level_now)}`}
        >
          {inner}
          <span className="sr-only"> ({s.skill_name})</span>
        </mark>
      ),
    })),
    ...review.map((x) => ({
      start: x.start,
      end: x.end,
      node: (inner: string) => (
        <span className="rounded border border-dashed border-ink/40 px-0.5" title={t("Not recognised yet", "Belum dikenali")}>
          {inner}
        </span>
      ),
    })),
  ].sort((a, b) => a.start - b.start);

  const out: ReactNode[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start < at || s.end > text.length) continue; // overlapping or stale offsets: keep the text readable
    if (s.start > at) out.push(text.slice(at, s.start));
    out.push(<span key={`${s.start}-${s.end}`}>{s.node(text.slice(s.start, s.end))}</span>);
    at = s.end;
  }
  out.push(text.slice(at));
  return <p className="whitespace-pre-wrap text-[15px] leading-7 text-ink/85 [overflow-wrap:anywhere]">{out}</p>;
}
