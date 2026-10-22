"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Check, ChevronDown, Crosshair, ExternalLink, GraduationCap, Lock } from "lucide-react";
import { toast } from "sonner";
import { api, type Dashboard, type Material, type PathStep } from "@/lib/api";
import { DIFFICULTY, FORMAT, LEVEL, firstSentence, hours, titleCase, weeks } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useT, type T } from "@/lib/i18n";
import { useStudentId } from "@/lib/student";
import { track } from "@/lib/track";
import { useDesktop } from "@/lib/use-desktop";
import { cn } from "@/lib/utils";
import { WeekView } from "@/components/coursework";
import { EmptyState, ErrorNote, FolderTabs, LinkButton, Loading, MasteryBar, PageHeader, Segmented, TabPanel, Tag } from "@/components/kit";
import { RouteHistory } from "@/components/route-history";
import { HowRanked, WhyOrder } from "@/components/route-insights";
import { Connections } from "@/components/skill-connections";
import { useSkillSheet } from "@/components/skill-sheet";

type Tab = "route" | "week" | "why";
type RouteView = "list" | "map";
const TABS: Tab[] = ["route", "week", "why"];
// links from before (six tabs, ?view=map, ?section=…) land on the tab and the part that now holds them
const LEGACY: Record<string, { tab: Tab; view?: RouteView; focus?: string }> = {
  map: { tab: "route", view: "map" },
  courses: { tab: "week", focus: "courses-title" },
  coursework: { tab: "week", focus: "courses-title" },
  "this-week": { tab: "week" },
  "why-order": { tab: "why" },
  history: { tab: "why", focus: "history" },
};

/** Stage 3, Learn: three jobs, one at a time (?tab=). Route: the steps, as a list or as the prerequisite map
 * (?view=map). This week: the plan, the reflection and the semester's courses. Why: how the order compares with
 * simpler ones, and every change with its reason. Without a profile only the public prerequisite map is shown. */
export default function LearnPage() {
  const { id, ready } = useStudentId();
  if (!ready) return <Loading />;
  return id ? <Learn sid={id} /> : <PublicLearn />;
}

function readState(): { tab: Tab; view: RouteView; focus?: string } {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get("tab");
  const legacy = LEGACY[raw ?? ""] ?? LEGACY[q.get("section") ?? ""] ?? (q.get("view") === "map" ? LEGACY.map : undefined);
  const tab = raw && TABS.includes(raw as Tab) ? (raw as Tab) : legacy?.tab ?? "route";
  const view: RouteView = q.get("view") === "map" || legacy?.view === "map" ? "map" : "list";
  return { tab, view, focus: legacy?.focus };
}

function useLearnState() {
  const [state, setState] = useState<{ tab: Tab; view: RouteView; focus?: string }>({ tab: "route", view: "list" });
  useEffect(() => {
    const read = () => {
      const s = readState();
      setState({ tab: s.tab, view: s.view, focus: s.focus });
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const go = (tab: Tab, view: RouteView = "list") => {
    setState({ tab, view });
    const u = new URL(window.location.href);
    u.searchParams.delete("section");
    if (tab === "route") u.searchParams.delete("tab");
    else u.searchParams.set("tab", tab);
    if (tab === "route" && view === "map") u.searchParams.set("view", "map");
    else u.searchParams.delete("view");
    u.hash = "";
    window.history.pushState(window.history.state, "", u);
  };
  return [state, go] as const;
}

function PublicLearn() {
  const t = useT();
  return (
    <div className="space-y-8">
      <PageHeader
        title={t("Learn", "Belajar")}
        description={t("How skills build on each other, reviewed by Business Analyst experts.", "Bagaimana skill saling membangun, ditinjau pakar Business Analyst.")}
        actions={<LinkButton href="/">{t("Create a free profile", "Buat profil gratis")}</LinkButton>}
      />
      <Connections embedded />
    </div>
  );
}

type ClassroomLite = { courses: { course: string; skills: { skill_id: string; on_path: boolean }[] }[] };

function Learn({ sid }: { sid: string }) {
  const t = useT();
  const d = useApi<Dashboard>(`/students/${sid}/dashboard`);
  const classroom = useApi<ClassroomLite>(`/students/${sid}/classroom`);
  const [{ tab, view, focus }, go] = useLearnState();
  const desktop = useDesktop();
  const { open, sheet } = useSkillSheet(d.data);
  // an old link to a section (history, courses) scrolls there once the page has its data and shows that tab
  const loaded = !!d.data;
  useEffect(() => {
    if (!focus || !loaded) return;
    const id = setTimeout(() => document.getElementById(focus)?.scrollIntoView({ block: "start", behavior: "smooth" }), 300);
    return () => clearTimeout(id);
  }, [focus, loaded, tab]);
  // optimistic ticks on top of what the server reported
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (d.data) setDone(Object.fromEntries(d.data.path.flatMap((s) => s.materials.map((m) => [m.id, !!m.done]))));
  }, [d.data]);
  // the chosen step (desktop detail) and the unfolded steps (phone accordion); a link to #step-<skill> picks one
  const [picked, setPicked] = useState<string | null>(null);
  const [unfolded, setUnfolded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const fromHash = () => {
      const m = window.location.hash.match(/^#step-(.+)$/);
      if (!m) return;
      const id = decodeURIComponent(m[1]);
      setPicked(id);
      setUnfolded((u) => ({ ...u, [id]: true }));
      requestAnimationFrame(() => document.getElementById(`step-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [d.data]);

  if (d.error) return <ErrorNote error={d.error} />;
  if (!d.data || desktop === null) return <Loading label={t("Gathering your route…", "Menyiapkan rutemu…")} />;
  const data = d.data;
  const f = data.features ?? { evidence: true, graph: true, adaptive: true, explanations: true, path: true };
  const steps = data.path;
  const names = Object.fromEntries(data.competencies.map((c) => [c.skill_id, titleCase(c.name)]));
  const all = steps.flatMap((s) => s.materials);
  const finished = all.filter((m) => done[m.id]).length;
  const weekly = Number(data.student.preferences.weekly_hours ?? 6);
  // the active step: the first one not waiting for a prerequisite that still has materials left
  const next = steps.find((s) => !s.waiting_for.length && s.materials.some((m) => !done[m.id])) ?? steps[0];
  const current = steps.find((s) => s.skill_id === picked) ?? next;
  const whyNow = (s: PathStep) => data.ranking.find((r) => r.skill_id === s.skill_id)?.explanation?.why_now ?? s.explanation?.why_now ?? s.why_prereq;
  const isOpen = (id: string) => unfolded[id] ?? id === next?.skill_id;
  // which of this semester's courses build each route skill (shown in the step)
  const coursesFor = (skill: string) => (classroom.data?.courses ?? []).filter((c) => c.skills.some((x) => x.skill_id === skill)).map((c) => c.course);

  const toggle = async (m: Material, skill: string) => {
    const nextDone = !done[m.id];
    setDone((x) => ({ ...x, [m.id]: nextDone }));
    try {
      await api.put(`/students/${sid}/materials/${m.id}`, { done: nextDone });
      if (nextDone) track("material_done", { skill });
    } catch {
      setDone((x) => ({ ...x, [m.id]: !nextDone }));
      toast.error(t("Could not save. Try again.", "Gagal menyimpan. Coba lagi."));
    }
  };
  const items: [Tab, string][] = [
    ["route", t("Route", "Rute")],
    ["week", t("This Week", "Minggu Ini")],
    ["why", t("Why This Route", "Kenapa Rutenya Begini")],
  ];

  return (
    <div>
      <PageHeader
        className="mb-5"
        title={t("Learn", "Belajar")}
        stats={[
          [t("Target", "Target"), data.role.name],
          // the bootcamp question: how long until I'm ready, at the pace I set
          [t("Ready in", "Perkiraan siap"), data.path_hours > 0 ? weeks(data.path_weeks ?? data.path_hours / weekly) : t("Route done", "Rute selesai")],
          [t("Whole route", "Seluruh rute"), (
            <span key="pace">
              {t(`about ${hours(data.path_hours)}`, `sekitar ${hours(data.path_hours)}`)}
              <span className="font-normal text-muted-foreground">, {t(`${weekly} h/week`, `${weekly} jam/minggu`)} </span>
              <Link href="/settings" className="font-normal text-indigo hover:underline">{t("change", "ubah")}</Link>
            </span>
          )],
          [t("Materials", "Materi"), t(`${finished} of ${all.length} done`, `${finished} dari ${all.length} selesai`)],
        ]}
        actions={<LinkButton href="/careers" variant="outline" size="sm">{t("Change target", "Ganti target")}</LinkButton>}
      />

      <FolderTabs
        label={t("Learn", "Belajar")}
        value={tab}
        onChange={(v) => go(v)}
        options={items}
        panelId="learn-panel"
        extra={tab === "route" ? (
          <Segmented
            label={t("Route view", "Tampilan rute")}
            value={view}
            onChange={(v) => go("route", v)}
            options={[["list", t("Steps", "Langkah")], ["map", t("Map", "Peta")]]}
          />
        ) : null}
      />
      <TabPanel id="learn-panel" value={tab} first={tab === "route"}>
        {tab === "week" ? (
          <WeekView sid={sid} />
        ) : tab === "why" ? (
          <div className="space-y-10">
            {f.path && steps.length ? (
              <div className="space-y-4">
                <WhyOrder d={data} names={names} />
                <HowRanked ranking={data.ranking} />
              </div>
            ) : null}
            <section id="history" aria-labelledby="history-title" className="scroll-mt-24 space-y-4 border-t pt-8 first:border-t-0 first:pt-0">
              <h2 id="history-title" className="text-[20px] font-semibold text-ink">{t("How your route changed", "Bagaimana rutemu berubah")}</h2>
              <RouteHistory sid={sid} embedded />
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            {view === "map" ? (
              <Connections embedded />
            ) : steps.length === 0 ? (
              <EmptyState title={t("No Route Steps Yet", "Belum Ada Langkah Rute")} mascot="map-route" action={<LinkButton href="/skills">{t("Add evidence", "Tambah bukti")}</LinkButton>}>
                {t("Add evidence or take the skill check so we can build your route.", "Tambahkan bukti atau ikuti Cek Kemampuan supaya kami bisa menyusun rutemu.")}
              </EmptyState>
            ) : desktop ? (
          // desktop: an index of steps beside the chosen step, whose materials are the main content
          <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <nav aria-label={t("Route steps", "Langkah rute")} className="space-y-3 lg:sticky lg:top-6">
              <ol className="divide-y border-y">
                {steps.map((s, i) => {
                  const fin = s.materials.filter((m) => done[m.id]).length;
                  const complete = s.materials.length > 0 && fin === s.materials.length;
                  const on = s.skill_id === current?.skill_id;
                  return (
                    <li key={s.skill_id}>
                      <button
                        type="button"
                        aria-current={on ? "step" : undefined}
                        onClick={() => setPicked(s.skill_id)}
                        className={cn("flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60", on && "bg-secondary/50")}
                      >
                        <StepNumber n={i + 1} complete={complete} t={t} small />
                        <span className="min-w-0">
                          <span className={cn("block text-sm leading-snug text-ink", on && "font-semibold")}>{titleCase(s.name)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {t(`${fin}/${s.materials.length} materials`, `${fin}/${s.materials.length} materi`)}
                            {s.waiting_for.length ? t(", after a prerequisite", ", setelah prasyarat") : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
            {current ? (
              <div id={`step-${current.skill_id}`} className="scroll-mt-24 min-w-0">
                <StepBody s={current} n={steps.indexOf(current) + 1} t={t} names={names} done={done} why={whyNow(current)} onToggle={(m) => toggle(m, current.skill_id)} onOpen={open} courses={coursesFor(current.skill_id)} heading />
              </div>
            ) : null}
          </div>
        ) : (
          // phone: the active step open, the others as one-line rows that unfold
          <div className="space-y-3">
            <ol className="divide-y border-y">
              {steps.map((s, i) => {
                const fin = s.materials.filter((m) => done[m.id]).length;
                const complete = s.materials.length > 0 && fin === s.materials.length;
                const o = isOpen(s.skill_id);
                return (
                  <li key={s.skill_id} id={`step-${s.skill_id}`} className="scroll-mt-24">
                    <button
                      type="button"
                      onClick={() => setUnfolded((u) => ({ ...u, [s.skill_id]: !o }))}
                      aria-expanded={o}
                      aria-controls={`step-body-${s.skill_id}`}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <StepNumber n={i + 1} complete={complete} t={t} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug text-ink">{titleCase(s.name)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t(`${fin} of ${s.materials.length} materials`, `${fin} dari ${s.materials.length} materi`)}
                        </span>
                      </span>
                      <ChevronDown className={cn("size-5 shrink-0 text-ink/60 transition-transform", o && "rotate-180")} aria-hidden="true" />
                    </button>
                    {o ? (
                      <div id={`step-body-${s.skill_id}`} className="px-4 pb-4">
                        <StepBody s={s} n={i + 1} t={t} names={names} done={done} why={whyNow(s)} onToggle={(m) => toggle(m, s.skill_id)} onOpen={open} courses={coursesFor(s.skill_id)} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
          </div>
        )}
      </TabPanel>
      {sheet}
    </div>
  );
}

function StepNumber({ n, complete, t, small }: { n: number; complete: boolean; t: T; small?: boolean }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full font-bold text-white", small ? "size-6 text-xs" : "size-8 text-sm", complete ? "bg-mint" : "bg-indigo")}>
      {complete ? <Check className={small ? "size-3.5" : "size-4"} aria-label={t("Materials finished", "Materi selesai")} /> : n}
    </span>
  );
}

/** One route step: why now, what to focus on, the level against the target, the materials, and the way to prove it.
 * `heading` adds the skill name and tags (desktop detail); the phone accordion row already shows them. */
function StepBody({ s, n, t, names, done, why, onToggle, onOpen, heading, courses = [] }: {
  s: PathStep; n: number; t: T; names: Record<string, string>; done: Record<string, boolean>; why?: string | null;
  onToggle: (m: Material) => void; onOpen?: (skillId: string) => void; heading?: boolean; courses?: string[];
}) {
  const prereq = s.role_in_path !== "prioritas";
  const finished = s.materials.filter((m) => done[m.id]).length;
  const complete = s.materials.length > 0 && finished === s.materials.length;
  const lvl = (code: string) => (LEVEL[code] ? t(...LEVEL[code]) : code);
  const name = titleCase(s.name);
  return (
    <div className="max-w-3xl space-y-8">
      {/* three groups, tight inside and apart from each other: who (step + name), why (one sentence), facts (icons) */}
      <div>
        {heading ? (
          <>
            <p className="text-xs font-medium text-indigo">{t(`Step ${n}`, `Langkah ${n}`)}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold leading-tight text-ink">{name}</h2>
              <Tag tone={prereq ? "ember" : "indigo"}>{prereq ? t("Prerequisite", "Prasyarat") : `${t("Priority", "Prioritas")} #${s.rank}`}</Tag>
            </div>
          </>
        ) : null}
        {why ? (
          <p className={cn("text-ink/85", heading && "mt-3")}>
            {firstSentence(why)}{" "}
            {onOpen ? (
              <button type="button" onClick={() => onOpen(s.skill_id)} className="whitespace-nowrap text-sm font-medium text-indigo underline-offset-4 hover:underline">
                {t("Why?", "Kenapa?")}
              </button>
            ) : null}
          </p>
        ) : null}
        <ul className="mt-4 space-y-1.5 text-sm text-ink/70">
          <li className="flex gap-2">
            <Crosshair className="mt-0.5 size-4 shrink-0 text-ink/45" aria-hidden="true" />
            <span>{t("Focus", "Fokus")}: {s.learn_what}</span>
          </li>
          {courses.length ? (
            <li className="flex gap-2">
              <GraduationCap className="mt-0.5 size-4 shrink-0 text-ink/45" aria-hidden="true" />
              <span>{t("Built by your course", "Dibangun mata kuliahmu")}: {courses.join(", ")}</span>
            </li>
          ) : null}
          {s.waiting_for.length ? (
            <li className="flex gap-2 text-ember-ink">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t("Best after", "Sebaiknya setelah")} {s.waiting_for.map((w) => names[w] ?? w).join(", ")}</span>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="max-w-md">
        <p className="text-xs font-medium text-ink/60">{t("Skill level vs target", "Kemampuan vs target")}</p>
        <MasteryBar value={s.p} target={s.target} className="mt-1.5" label={t(`${name}: level vs target`, `${name}: level vs target`)} />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {lvl(s.level_now)} → {lvl(s.level_target)}, {t(`about ${hours(s.hours)} of study`, `sekitar ${hours(s.hours)} belajar`)}
        </p>
      </div>

      <section aria-label={t("Materials", "Materi")}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{t("Free materials", "Materi gratis")}</h3>
          <span className="tabular text-xs text-muted-foreground">{t(`${finished} of ${s.materials.length} finished`, `${finished} dari ${s.materials.length} selesai`)}</span>
        </div>
        {s.materials.length ? (
          <ul className="divide-y border-y">
            {s.materials.map((m) => (
              <li key={m.id} className="flex items-start gap-3 p-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!done[m.id]}
                  aria-label={t(`Mark "${m.title}" as finished`, `Tandai "${m.title}" selesai`)}
                  onClick={() => onToggle(m)}
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    done[m.id] ? "border-mint bg-mint text-white" : "border-input bg-card hover:border-indigo",
                  )}
                >
                  {done[m.id] ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("material_clicked", { skill: s.skill_id })}
                    className={cn("inline-flex items-start gap-1.5 text-sm font-medium hover:underline", done[m.id] ? "text-muted-foreground line-through" : "text-ink")}
                  >
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden="true" />
                    {m.title}
                    <ExternalLink className="mt-0.5 size-3 shrink-0 text-ink/40" aria-hidden="true" />
                  </a>
                  <p className="mt-0.5 pl-[22px] text-xs text-muted-foreground">
                    {m.provider}, {FORMAT[m.format] ? t(...FORMAT[m.format]) : m.format}, {DIFFICULTY[m.difficulty] ? t(...DIFFICULTY[m.difficulty]) : m.difficulty}, {t(`${m.hours} h long`, `durasi ${m.hours} jam`)}
                    {m.language === "id" ? t(", in Indonesian", ", berbahasa Indonesia") : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("No free material listed for this skill yet.", "Belum ada materi gratis untuk skill ini.")}</p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href={`/assessment/${s.skill_id}`} size="sm" variant={complete ? "default" : "outline"}>
          {t("Prove This Skill", "Buktikan Skill Ini")}
        </LinkButton>
      </div>
    </div>
  );
}
