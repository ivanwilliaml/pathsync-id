"use client";

// Learning loop on a route step (backend pathsync.learning_loop): learn -> practice -> prove -> next step, with the
// decision and its reason from the server. Practice never changes mastery; only the check (and other evidence) does.
import { ArrowRight, BookOpen, Check, Dumbbell, Flag, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { LoopStatus } from "@/lib/api";
import { LEVEL, pct } from "@/lib/format";
import { useT, type T } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LinkButton, Tag } from "./kit";

type StageState = "done" | "current" | "todo";

const PRACTICE_CODES = new Set(["practice_basic", "review_basic", "practice_applied", "retry", "transfer"]);

export function stageStates(s: LoopStatus): Record<"learn" | "practice" | "prove" | "next", StageState> {
  const code = s.decision.code;
  const l = s.stages.learn;
  const pr = s.stages.practice;
  const practiceDone = !!pr.basic?.passed && !!pr.applied?.passed;
  return {
    learn: l.total > 0 && l.done >= l.total ? "done" : code === "prerequisite" ? "todo" : "current",
    practice: !s.supported ? "todo" : practiceDone && code !== "retry" ? "done" : PRACTICE_CODES.has(code) && code !== "transfer" ? "current" : "todo",
    prove: s.stages.prove.proven ? "done" : code === "prove" ? "current" : "todo",
    next: code === "mastered" ? "done" : code === "transfer" ? "current" : "todo",
  };
}

/** One-line summary for the step list ("Practice 2/3", "Proven", ...). */
export function loopSummary(s: LoopStatus | undefined, t: T): string | null {
  if (!s) return null;
  const c = s.decision.code;
  if (c === "mastered") return t("Mastered", "Dikuasai");
  if (c === "transfer") return t("Proven · one more case", "Terbukti · satu kasus lagi");
  if (c === "prove") return s.supported ? t("Ready to prove", "Siap dibuktikan") : null;
  if (c === "retry") return t("Check again after practice", "Latihan lalu cek lagi");
  if (c === "prerequisite") return t("After a prerequisite", "Setelah prasyarat");
  const tier = c === "practice_applied" ? s.stages.practice.applied : s.stages.practice.basic;
  return tier ? t(`Practice ${tier.correct}/${tier.total}`, `Latihan ${tier.correct}/${tier.total}`) : null;
}

function lvl(t: T, code: string) {
  return LEVEL[code] ? t(...LEVEL[code]) : code;
}

export function LoopStages({ status, className }: { status: LoopStatus; className?: string }) {
  const t = useT();
  const st = stageStates(status);
  const pr = status.stages.practice;
  const last = status.stages.prove.last;
  const tierText = status.supported
    ? [
        pr.basic ? t(`basic ${pr.basic.correct}/${pr.basic.total}`, `dasar ${pr.basic.correct}/${pr.basic.total}`) : null,
        pr.applied ? t(`applied ${pr.applied.correct}/${pr.applied.total}`, `terapan ${pr.applied.correct}/${pr.applied.total}`) : null,
      ].filter(Boolean).join(" · ")
    : t("No practice set for this skill yet", "Belum ada latihan untuk skill ini");
  const stages: { key: keyof typeof st; icon: ReactNode; title: string; detail: string }[] = [
    { key: "learn", icon: <BookOpen aria-hidden="true" />, title: t("Learn", "Pelajari"), detail: t(`${status.stages.learn.done}/${status.stages.learn.total} materials`, `${status.stages.learn.done}/${status.stages.learn.total} materi`) },
    { key: "practice", icon: <Dumbbell aria-hidden="true" />, title: t("Practise", "Latihan"), detail: tierText },
    {
      key: "prove",
      icon: <ShieldCheck aria-hidden="true" />,
      title: t("Prove", "Buktikan"),
      detail: status.stages.prove.proven
        ? t("Proven", "Terbukti")
        : last
          ? t(`last check ${last.correct}/${last.total}`, `cek terakhir ${last.correct}/${last.total}`)
          : t("not checked yet", "belum dicek"),
    },
    {
      key: "next",
      icon: <Flag aria-hidden="true" />,
      title: t("Apply", "Terapkan"),
      detail: status.decision.code === "mastered" ? t("different case done", "kasus berbeda selesai") : t("a different case", "kasus berbeda"),
    },
  ];
  return (
    <ol aria-label={t("Learning loop", "Siklus belajar")} className={cn("grid grid-cols-2 gap-2 xl:grid-cols-4", className)}>
      {stages.map((s, i) => (
        <li
          key={s.key}
          aria-current={st[s.key] === "current" ? "step" : undefined}
          className={cn(
            "flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2.5",
            st[s.key] === "done" && "border-mint/40 bg-[#e3f5ea]/50",
            st[s.key] === "current" && "border-indigo/50 bg-secondary/60 ring-1 ring-indigo/30",
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold [&_svg]:size-3.5",
              st[s.key] === "done" ? "bg-mint text-white" : st[s.key] === "current" ? "bg-indigo text-white" : "bg-muted text-ink/60",
            )}
          >
            {st[s.key] === "done" ? <Check aria-hidden="true" /> : s.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              {i + 1}. {s.title}
              {st[s.key] === "done" ? <span className="sr-only"> ({t("done", "selesai")})</span> : null}
            </span>
            <span className="block text-xs text-muted-foreground">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The adapt step: what to do next and why, from the server's decision rules. */
export function LoopDecision({ status, compact }: { status: LoopStatus; compact?: boolean }) {
  const t = useT();
  const d = status.decision;
  const tone = d.code === "mastered" ? "border-mint/40 bg-[#e3f5ea]/50" : d.code === "prerequisite" || d.code === "retry" || d.code === "review_basic" ? "border-ember/40 bg-[#fff6d9]/60" : "border-indigo/30 bg-secondary/40";
  return (
    <div className={cn("rounded-2xl border p-4 sm:p-5", tone)}>
      <p className="text-xs font-medium text-muted-foreground">{t("Next step", "Langkah berikutnya")}</p>
      <p className="mt-0.5 text-base font-semibold text-ink">{d.title}</p>
      <p className="mt-1 text-sm text-ink/80">{d.reason}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <LinkButton href={d.href} size={compact ? "sm" : "default"}>
          {d.cta}
          <ArrowRight aria-hidden="true" />
        </LinkButton>
        {d.code !== "prove" && status.supported && !status.stages.prove.proven ? (
          <LinkButton href={`/assessment/${status.skill_id}`} size={compact ? "sm" : "default"} variant="outline">
            {t("Check now anyway", "Langsung cek")}
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}

/** Target, proven level and how sure the estimate is: mastery and confidence shown apart (grades never count as proof). */
export function LoopTarget({ status }: { status: LoopStatus }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink/75">
      <span>
        {t("Target", "Target")}: <strong className="font-semibold text-ink">{lvl(t, status.level_target)}</strong> ({pct(status.target)})
      </span>
      <span>
        {t("Proven", "Terbukti")}:{" "}
        <strong className="font-semibold text-ink">{status.p_proven == null ? t("no direct evidence yet", "belum ada bukti langsung") : pct(status.p_proven)}</strong>
      </span>
      <Tag tone={status.low_confidence ? "ember" : "mint"}>{status.low_confidence ? t("Not sure yet", "Belum yakin") : t("Fairly sure", "Cukup yakin")}</Tag>
    </div>
  );
}
