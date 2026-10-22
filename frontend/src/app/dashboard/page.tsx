"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Check, ChevronRight, ExternalLink } from "lucide-react";
import { api, type Dashboard } from "@/lib/api";
import { firstSentence, fmtDateTime, hours, pct, titleCase, weeks } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { usePulseReady } from "@/lib/pulse";
import { trackOnce } from "@/lib/track";
import { Button } from "@/components/ui/button";
import type { CareersData } from "@/components/career-map";
import { ErrorNote, LinkButton, Loading, Panel, SectionTitle } from "@/components/kit";
import { Mascot } from "@/components/mascot";
import { ReadinessRing } from "@/components/readiness-ring";
import { RequireStudent } from "@/components/require-student";
import { useSkillSheet } from "@/components/skill-sheet";
import { safeUrl } from "@/lib/safe-url";

export default function DashboardPage() {
  return <RequireStudent>{(sid) => <DashboardView sid={sid} />}</RequireStudent>;
}

/** Home: a short orientation. Where you are headed, the one action that matters most now and why, where your skills
 * stand, the journey at a glance, then a few pointers (next learning step, close careers, latest change). The full
 * views live in their stages: skills in /skills, the route in /learn, careers in /careers. */
function DashboardView({ sid }: { sid: string }) {
  const { data: d, error } = useApi<Dashboard>(`/students/${sid}/dashboard`);
  const t = useT();
  const pulseReady = usePulseReady();
  const { open, sheet } = useSkillSheet(d ?? null);
  useEffect(() => trackOnce("next_step_viewed", `next-${sid}`), [sid]);

  if (error) return <ErrorNote error={error} />;
  if (!d) return <Loading label={t("Building your route…", "Menyusun rutemu…")} />;

  const hasEvidence = d.diagnostic_done || Object.entries(d.evidence_summary).some(([, v]) => v > 0);
  const nEvidence = Object.entries(d.evidence_summary).filter(([k]) => k !== "assessment_items").reduce((a, [, v]) => a + v, 0);
  const top = d.ranking[0];
  const f = d.features ?? { evidence: true, graph: true, adaptive: true, explanations: true, path: true };
  if (!f.path) return <ControlListView d={d} sid={sid} />;
  // the one action that matters most now: get evidence in, then the skill check, then the top priority
  const stage = !hasEvidence ? "evidence" : !d.diagnostic_done ? "check" : top ? "learn" : "done";
  const nextStep = d.path.find((p) => !p.waiting_for.length) ?? d.path[0];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight text-ink sm:text-[30px]">Hi, {d.student.display_name}</h1>
          <p className="mt-1 text-sm text-ink/70">
            {t("Your route to", "Rutemu menuju")} <span className="font-semibold text-ink">{d.role.name}</span>
            {t(`, from ${d.role.n_postings} real job postings. `, `, dari ${d.role.n_postings} job posting nyata. `)}
            <Link href="/careers" className="font-medium text-indigo underline-offset-4 hover:underline">
              {t("Change", "Ganti")}
            </Link>
          </p>
        </div>
      </header>

      <JourneyStrip d={d} hasEvidence={hasEvidence} />

      {/* main: what to do now and what to study; side: where you stand and what changed */}
      <div className="grid items-start gap-10 lg:grid-cols-12">
        <div className="min-w-0 space-y-10 lg:col-span-8">
          <section aria-labelledby="primary-action" className="relative rounded-2xl bg-route-soft p-5 sm:p-6 sm:pr-36">
            {stage === "evidence" ? (
              <>
                <Mascot name="checklist" size={104} className="absolute right-4 bottom-3 hidden sm:block" />
                <p className="text-sm font-medium text-indigo">{t("Start here", "Mulai dari sini")}</p>
                <h2 id="primary-action" className="mt-1 text-[19px] font-bold leading-snug text-ink">{t("Show what you can already do", "Tunjukkan apa yang sudah bisa kamu lakukan")}</h2>
                <p className="mt-1.5 text-sm text-ink/70">{t("A transcript, a project or the skill check is enough to start.", "Transkrip, project, atau Cek Kemampuan sudah cukup untuk mulai.")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <LinkButton href="/evidence" size="lg" className="h-10">{t("Add Evidence", "Tambah Bukti")}</LinkButton>
                  <LinkButton href="/assessment" variant="outline" size="lg" className="h-10">{t("Take the Skill Check", "Ikuti Cek Kemampuan")}</LinkButton>
                </div>
              </>
            ) : stage === "check" ? (
              <>
                <Mascot name="stopwatch" size={104} className="absolute right-4 bottom-3 hidden sm:block" />
                <p className="text-sm font-medium text-indigo">{t("Sharpen your route", "Perkuat pemetaan")}</p>
                <h2 id="primary-action" className="mt-1 text-[19px] font-bold leading-snug text-ink">{t("Take the Skill Check", "Ikuti Cek Kemampuan")}</h2>
                <p className="mt-1.5 text-sm text-ink/70">{t("About 20 minutes. Makes your route much sharper.", "Sekitar 20 menit. Membuat rutemu jauh lebih tepat.")}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <LinkButton href="/assessment" size="lg" className="h-10">{t("Start the Check", "Mulai Cek")}</LinkButton>
                  {nextStep ? (
                    <Link href={`/learn#step-${nextStep.skill_id}`} className="text-sm font-medium text-indigo underline-offset-4 hover:underline">
                      {t("or start learning now", "atau mulai belajar sekarang")}
                    </Link>
                  ) : null}
                </div>
              </>
            ) : stage === "learn" && top ? (
              <>
                <Mascot name="compass" size={104} className="absolute right-4 bottom-3 hidden sm:block" />
                <p className="text-sm font-medium text-indigo">{t("Start learning", "Mulai belajar")}</p>
                <h2 id="primary-action" className="mt-1 text-[19px] font-bold leading-snug text-ink">{titleCase(top.name)}</h2>
                <p className="mt-1.5 text-sm text-ink/75">{top.explanation ? firstSentence(top.explanation.why_now) : null}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <LinkButton href={`/learn#step-${top.skill_id}`} size="lg" className="h-10">{t("Open the Materials", "Buka Materinya")}</LinkButton>
                  <button type="button" className="text-sm font-medium text-indigo underline-offset-4 hover:underline" onClick={() => open(top.skill_id)}>
                    {t("See why", "Lihat alasannya")}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4 text-ink/80">
                <Mascot name="trophy" size={88} />
                <p id="primary-action">{t("You meet every requirement we track for this role. Nice work.", "Kamu memenuhi semua syarat yang kami lacak untuk role ini. Mantap.")}</p>
              </div>
            )}
          </section>

          {nextStep ? <ActiveStep step={nextStep} /> : null}
          {d.study_arm ? <StudyPlanCard sid={sid} /> : null}
        </div>

        <aside className="min-w-0 space-y-8 lg:col-span-4 lg:border-l lg:pl-8">
          <Link href="/skills" className="group block">
            <span className="block text-sm font-semibold text-ink">{t("Role readiness", "Readiness role")}</span>
            {f.evidence ? <span className="tabular mt-0.5 block text-[28px] font-bold leading-tight text-ink">{hasEvidence ? pct(d.coverage) : "–"}</span> : null}
            <span className="mt-1 block text-sm font-medium text-indigo group-hover:underline">{t("See my skills →", "Lihat skill-ku →")}</span>
          </Link>
          {hasEvidence && d.path_hours > 0 ? (
            <Link href="/learn" className="group block">
              <span className="block text-sm font-semibold text-ink">{t("Ready in", "Perkiraan siap")}</span>
              <span className="tabular mt-0.5 block text-[22px] font-bold leading-tight text-ink">{weeks(d.path_weeks)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {t(`${hours(d.path_hours)} left at your weekly pace`, `sisa ${hours(d.path_hours)} dengan ritme mingguanmu`)}
              </span>
            </Link>
          ) : null}
          {hasEvidence ? <AlsoClose sid={sid} /> : null}
          <LatestChange sid={sid} />
          {pulseReady ? <ClarityPulse sid={sid} /> : null}
        </aside>
      </div>
      {sheet}
    </div>
  );
}

/** The step to study now with its first materials, so Home leads straight into the work. */
function ActiveStep({ step }: { step: Dashboard["path"][number] }) {
  const t = useT();
  const left = step.materials.filter((m) => !m.done);
  return (
    <section aria-labelledby="active-step">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-indigo">{t("Learning now", "Sedang dipelajari")}</p>
          <h2 id="active-step" className="text-base font-semibold text-ink">{titleCase(step.name)}</h2>
        </div>
        <span className="tabular text-xs text-muted-foreground">
          {t(`${step.materials.length - left.length} of ${step.materials.length} materials, about ${hours(step.hours)}`, `${step.materials.length - left.length} dari ${step.materials.length} materi, sekitar ${hours(step.hours)}`)}
        </span>
      </div>
      {left.length ? (
        <ul className="mt-3 divide-y border-y">
          {left.slice(0, 2).map((m) => (
            <li key={m.id}>
              <a href={safeUrl(m.url)} target="_blank" rel="noreferrer" className="flex items-start gap-2.5 py-3 text-sm hover:text-indigo">
                <BookOpen className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{m.title}</span>
                  <span className="block text-xs text-muted-foreground">{m.provider}, {m.hours} {t("h", "jam")}</span>
                </span>
                <ExternalLink className="ml-auto mt-0.5 size-3 shrink-0 text-ink/40" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={`/learn#step-${step.skill_id}`} className="mt-3 inline-block text-sm font-medium text-indigo underline-offset-4 hover:underline">
        {t("Open this step in Learn →", "Buka langkah ini di Belajar →")}
      </Link>
    </section>
  );
}

/** The latest route change with its reason (Change History lives in Learn). Shown once there is more than the first route. */
function LatestChange({ sid }: { sid: string }) {
  const t = useT();
  const h = useApi<{ id: number; created_at: string; trigger: string; summary: string; reasons: string[] }[]>(`/students/${sid}/history`);
  const last = h.data?.[0];
  if (!last || last.trigger === "initial") return null;
  const [head, ...rest] = last.summary.split(": ");
  // the trailing technical note, e.g. "(new project)", belongs to the full history, not the one-line summary
  const line = (rest.length ? rest.join(": ") : head).replace(/\s*\([^()]+\)\s*$/, "");
  return (
    <section aria-labelledby="latest-change">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="latest-change" className="text-sm font-semibold text-ink">{t("Latest change", "Perubahan terakhir")}</h2>
        <time dateTime={last.created_at} className="text-xs text-muted-foreground">{fmtDateTime(last.created_at)}</time>
      </div>
      <p className="mt-1 text-sm text-ink">{line}</p>
      {last.reasons[0] ? <p className="mt-1 line-clamp-2 text-xs text-ink/70">{last.reasons[0]}</p> : null}
      <Link href="/learn?tab=history" className="mt-2 inline-block text-sm font-medium text-indigo underline-offset-4 hover:underline">
        {t("Every change and why →", "Semua perubahan dan alasannya →")}
      </Link>
    </section>
  );
}

// ------------------------------------------------------------- study arm A (control: skill list only)
function ControlListView({ d, sid }: { d: Dashboard; sid: string }) {
  const rows = [...d.competencies].sort((a, b) => b.demand - a.demand).slice(0, 15);
  const t = useT();
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-route-soft p-5 sm:p-6">
        <h1 className="text-[26px] font-extrabold leading-tight text-ink">Hi, {d.student.display_name}</h1>
        <p className="mt-1 text-ink/70">
          {t(`Skills employers ask for in ${d.role.n_postings} real`, `Skill yang diminta employer di ${d.role.n_postings} job posting nyata`)}{" "}
          <span className="font-semibold text-ink">{d.role.name}</span>
          {t(" job postings. Use this list to plan your own learning.", ". Gunakan daftar ini untuk merencanakan belajarmu sendiri.")}
        </p>
      </section>
      {d.study_arm ? <StudyPlanCard sid={sid} /> : null}
      <ClarityPulse sid={sid} />
      <section>
        <SectionTitle>{t("Most Requested Skills", "Skill Paling Banyak Diminta")}</SectionTitle>
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((c) => (
            <li key={c.skill_id} className="flex items-center justify-between gap-3 p-4">
              <span className="font-medium text-ink">{titleCase(c.name)}</span>
              <span className="tabular text-sm text-ink/70">{t(`in ${pct(c.demand)} of postings`, `di ${pct(c.demand)} posting`)}</span>
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
  const t = useT();
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
    <section aria-label={t("Quick question", "Pertanyaan singkat")} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink/85">
        <span className="font-medium text-ink">{t("Quick question:", "Pertanyaan singkat:")}</span> {t("\u201cI know which skill to learn next and why.\u201d", "\u201cAku tahu skill mana yang harus dipelajari berikutnya dan kenapa.\u201d")}
      </p>
      <div role="group" aria-label={t("1 strongly disagree, 5 strongly agree", "1 sangat tidak setuju, 5 sangat setuju")} className="flex gap-1">
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
  const t = useT();
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
      <h2 className="font-semibold text-ink">{t("Study Task: Write Your Learning Plan", "Tugas Studi: Tulis Rencana Belajarmu")}</h2>
      <p className="mt-1 text-sm text-ink/70">
        {t(
          "Write what you will learn over the next four weeks, in what order and why. Experts rate plans without knowing who wrote them.",
          "Tulis apa yang akan kamu pelajari empat minggu ke depan, dengan urutan apa dan kenapa. Pakar menilai rencana tanpa tahu siapa penulisnya.",
        )}
      </p>
      {!started ? (
        <Button className="mt-3" onClick={start}>
          {t("Start Writing", "Mulai Menulis")}
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            aria-label={t("Your learning plan", "Rencana belajarmu")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={8000}
            className="w-full rounded-lg border bg-background p-3 text-sm"
          />
          <ErrorNote error={err} />
          <Button onClick={submit} disabled={text.trim().length < 40}>
            {t("Submit Plan", "Kirim Rencana")}
          </Button>
        </div>
      )}
    </Panel>
  );
}




/** Careers the same evidence already brings the student close to (links to Pilih Karier). */
function AlsoClose({ sid }: { sid: string }) {
  const careers = useApi<CareersData>(`/students/${sid}/careers`);
  const t = useT();
  const others = (careers.data?.careers ?? []).filter((c) => !c.is_target && c.n_measured > 0).slice(0, 3);
  if (!others.length) return null;
  return (
    <section aria-labelledby="also-close">
      <h2 id="also-close" className="text-sm font-semibold text-ink">{t("Also close to", "Juga dekat dengan")}</h2>
      <ul className="mt-1.5 divide-y text-sm">
        {others.map((c) => (
          <li key={c.id}>
            <Link href={`/careers?role=${c.id}`} className="flex items-baseline justify-between gap-3 py-1.5 hover:text-indigo">
              <span className="min-w-0 text-ink">{c.name}</span>
              <span className="tabular shrink-0 font-semibold text-ink">{pct(c.readiness)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/careers" className="mt-1.5 inline-block text-sm font-medium text-indigo underline-offset-4 hover:underline">
        {t("Compare all careers →", "Bandingkan semua karier →")}
      </Link>
    </section>
  );
}

/** The three stages of the journey as one compact strip, each with its live status and a link into the stage. */
function JourneyStrip({ d, hasEvidence }: { d: Dashboard; hasEvidence: boolean }) {
  const t = useT();
  const nEvidence = Object.entries(d.evidence_summary).filter(([k]) => k !== "assessment_items").reduce((a, [, v]) => a + v, 0);
  const mats = d.path.flatMap((p) => p.materials);
  const matsDone = mats.filter((m) => m.done).length;
  const stages = [
    {
      href: hasEvidence ? "/skills" : "/evidence", title: t("Understand Your Skills", "Kenali Skill"), done: hasEvidence,
      status: t(`${nEvidence} evidence, check ${d.diagnostic_done ? "done" : "not yet"}`, `${nEvidence} bukti, Cek ${d.diagnostic_done ? "selesai" : "belum"}`),
    },
    {
      href: "/careers", title: t("Choose a Career", "Pilih Karier"), done: hasEvidence,
      status: hasEvidence ? t(`${d.role.name}, ${pct(d.coverage)} ready`, `${d.role.name}, siap ${pct(d.coverage)}`) : d.role.name,
    },
    {
      href: "/learn", title: t("Learn", "Belajar"), done: mats.length > 0 && matsDone === mats.length,
      status: t(`${d.path.length} steps, ${matsDone}/${mats.length} materials`, `${d.path.length} langkah, ${matsDone}/${mats.length} materi`),
    },
  ];
  return (
    <nav aria-label={t("Your journey", "Perjalananmu")}>
      <ol className="grid gap-4 sm:grid-cols-3 sm:gap-0">
        {stages.map((s, i) => (
          <li key={s.href} className="relative min-w-0 sm:pr-6">
            {/* the line that joins this step to the next one */}
            {i < stages.length - 1 ? <span className="absolute left-3 right-0 top-3 hidden h-px bg-border sm:block" aria-hidden="true" /> : null}
            <Link href={s.href} className="group relative flex items-start gap-3 focus-visible:outline-none">
              <span className={`relative flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-4 ring-background ${s.done ? "bg-mint" : "bg-indigo"}`} aria-hidden="true">
                {s.done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="relative inline-block bg-background pr-3 text-sm font-semibold text-ink group-hover:text-indigo group-focus-visible:underline">{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.status}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
