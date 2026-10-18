"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Clock, ExternalLink, Lock } from "lucide-react";
import { toast } from "sonner";
import { api, type Dashboard, type Material, type PathStep } from "@/lib/api";
import { DIFFICULTY, FORMAT, LEVEL, hours, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useT, type T } from "@/lib/i18n";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import { RequireStudent } from "@/components/require-student";
import { EmptyState, ErrorNote, LinkButton, Loading, MasteryBar, PageHeader, Panel, Tag } from "@/components/kit";

export default function LearnPage() {
  return <RequireStudent>{(sid) => <Learn sid={sid} />}</RequireStudent>;
}

/** The learning side of the route: each step's free materials in order, with what the student has finished. */
function Learn({ sid }: { sid: string }) {
  const t = useT();
  const d = useApi<Dashboard>(`/students/${sid}/dashboard`);
  // optimistic ticks on top of what the server reported
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (d.data) setDone(Object.fromEntries(d.data.path.flatMap((s) => s.materials.map((m) => [m.id, !!m.done]))));
  }, [d.data]);

  if (d.error) return <ErrorNote error={d.error} />;
  if (!d.data) return <Loading label={t("Gathering your materials…", "Menyiapkan materimu…")} />;
  const steps = d.data.path;
  const names = Object.fromEntries(d.data.competencies.map((c) => [c.skill_id, titleCase(c.name)]));
  const all = steps.flatMap((s) => s.materials);
  const finished = all.filter((m) => done[m.id]).length;

  const toggle = async (m: Material, skill: string) => {
    const next = !done[m.id];
    setDone((x) => ({ ...x, [m.id]: next }));
    try {
      await api.put(`/students/${sid}/materials/${m.id}`, { done: next });
      if (next) track("material_done", { skill });
    } catch {
      setDone((x) => ({ ...x, [m.id]: !next }));
      toast.error(t("Could not save. Try again.", "Gagal menyimpan. Coba lagi."));
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        mascot="journal"
        title={t("Learn", "Belajar")}
        description={t(
          "Free materials for every step of your route, in the order that unblocks you. Tick what you finish, then prove it with a skill check.",
          "Materi gratis untuk setiap langkah rutemu, sesuai urutan yang membuka jalanmu. Centang yang sudah selesai, lalu buktikan lewat skill check.",
        )}
      />
      {steps.length === 0 ? (
        <EmptyState title={t("No Route Steps Yet", "Belum Ada Langkah Rute")} mascot="map-route" action={<LinkButton href="/assessment">{t("Take the Quick Check", "Ikuti Quick Check")}</LinkButton>}>
          {t("Add evidence or take the quick check so we can build your route.", "Tambahkan evidence atau ikuti Quick Check supaya kami bisa menyusun rutemu.")}
        </EmptyState>
      ) : (
        <>
          <Panel className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {t(`${finished} of ${all.length} materials finished`, `${finished} dari ${all.length} materi selesai`)}
              </p>
              <MasteryBar value={all.length ? finished / all.length : 0} className="mt-2 max-w-xl" />
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-4" aria-hidden="true" />
              {t("About", "Sekitar")} {hours(d.data.path_hours)} {t("for the whole route", "untuk seluruh rute")}
            </p>
            <p className="basis-full text-xs text-muted-foreground">
              {t(
                "Ticking a material tracks your study only. Your level rises when you prove the skill: a skill check or a project.",
                "Mencentang materi hanya mencatat belajarmu. Level-mu naik saat kamu membuktikan skill-nya: lewat skill check atau project.",
              )}
            </p>
          </Panel>
          <ol className="space-y-6">
            {steps.map((s, i) => (
              <StepCard key={s.skill_id} n={i + 1} s={s} t={t} names={names} done={done} onToggle={(m) => toggle(m, s.skill_id)} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function StepCard({ n, s, t, names, done, onToggle }: {
  n: number; s: PathStep; t: T; names: Record<string, string>; done: Record<string, boolean>; onToggle: (m: Material) => void;
}) {
  const prereq = s.role_in_path !== "prioritas";
  const finished = s.materials.filter((m) => done[m.id]).length;
  const complete = s.materials.length > 0 && finished === s.materials.length;
  const lvl = (code: string) => (LEVEL[code] ? t(...LEVEL[code]) : code);
  return (
    <li>
      <Panel className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-4">
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", complete ? "bg-mint" : "bg-indigo")}>
              {complete ? <Check className="size-4" aria-label={t("Materials finished", "Materi selesai")} /> : n}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-ink">{titleCase(s.name)}</h2>
                <Tag tone={prereq ? "ember" : "indigo"}>{prereq ? t("Prerequisite", "Prasyarat") : `${t("Priority", "Prioritas")} #${s.rank}`}</Tag>
              </div>
              <p className="mt-1 text-sm text-ink/75">
                {t("Focus on", "Fokus pada")} {s.learn_what}.
              </p>
              {s.waiting_for.length ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ember-ink">
                  <Lock className="size-3.5" aria-hidden="true" /> {t("Best after", "Sebaiknya setelah")} {s.waiting_for.map((w) => names[w] ?? w).join(", ")}
                </p>
              ) : null}
            </div>
          </div>
          <span className="tabular shrink-0 text-sm text-muted-foreground">
            {t(`${finished} of ${s.materials.length} done`, `${finished} dari ${s.materials.length} selesai`)}
          </span>
        </div>

        <div className="max-w-md">
          <MasteryBar value={s.p} target={s.target} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("Now", "Sekarang")} {lvl(s.level_now)} · {t("target", "target")} {lvl(s.level_target)} · {t("about", "sekitar")} {hours(s.hours)}
          </p>
        </div>

        {s.materials.length ? (
          <ul className="divide-y rounded-xl border">
            {s.materials.map((m) => (
              <li key={m.id} className="flex items-start gap-3 p-3.5">
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
                    {m.provider} · {FORMAT[m.format] ? t(...FORMAT[m.format]) : m.format} · {DIFFICULTY[m.difficulty] ? t(...DIFFICULTY[m.difficulty]) : m.difficulty} · {m.hours} {t("h", "jam")}
                    {m.language === "id" ? t(" · in Indonesian", " · berbahasa Indonesia") : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("No free material listed for this skill yet.", "Belum ada materi gratis untuk skill ini.")}</p>
        )}

        <div className={cn("flex flex-wrap items-center gap-3 rounded-xl p-3.5", complete ? "bg-[#e3f5ea]" : "bg-muted/60")}>
          <p className="min-w-0 flex-1 text-sm text-ink/80">
            {complete
              ? t("Materials done. Show what you learned so your route moves on.", "Materi selesai. Tunjukkan yang sudah kamu pelajari supaya rutemu bergerak.")
              : t("Already know this? You can prove it any time.", "Sudah bisa? Kamu bisa membuktikannya kapan saja.")}
          </p>
          <LinkButton href={`/assessment/${s.skill_id}`} size="sm" variant={complete ? "default" : "outline"}>
            {t("Take the Skill Check", "Ikuti Skill Check")}
          </LinkButton>
        </div>
      </Panel>
    </li>
  );
}
