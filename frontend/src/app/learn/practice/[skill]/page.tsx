"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Lightbulb, X } from "lucide-react";
import { api, type LoopStatus, type LoopTask, type LoopTier, type PracticeGrade } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useT, type T } from "@/lib/i18n";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RequireStudent } from "@/components/require-student";
import { EmptyState, ErrorNote, LinkButton, Loading, Panel, Segmented } from "@/components/kit";
import { LoopDecision, LoopStages } from "@/components/learning-loop";

// Practice stage of the learning loop: short tasks in three tiers, graded on the server with feedback on the idea
// behind every option. Practice is for learning; it never changes mastery (only the check does).

type SkillLoop = LoopStatus & { tasks: LoopTask[] };
const TIERS: LoopTier[] = ["basic", "applied", "transfer"];

export default function PracticePage() {
  const { skill } = useParams<{ skill: string }>();
  return <RequireStudent>{(sid) => <Practice sid={sid} skill={skill} />}</RequireStudent>;
}

function tierLabel(t: T, tier: LoopTier) {
  return tier === "basic" ? t("Basic", "Dasar") : tier === "applied" ? t("Applied", "Terapan") : t("Different case", "Kasus berbeda");
}

function Practice({ sid, skill }: { sid: string; skill: string }) {
  const t = useT();
  const r = useApi<SkillLoop>(`/students/${sid}/loop/${skill}`);
  const [status, setStatus] = useState<LoopStatus | null>(null);
  const [tier, setTier] = useState<LoopTier>("basic");
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Record<string, PracticeGrade>>({});

  useEffect(() => {
    if (!r.data) return;
    setStatus(r.data);
    const q = new URLSearchParams(window.location.search).get("tier") as LoopTier | null;
    if (q && TIERS.includes(q)) setTier(q);
  }, [r.data]);

  const tasks = useMemo(() => (r.data?.tasks ?? []).filter((x) => x.tier === tier), [r.data, tier]);
  useEffect(() => setIdx(0), [tier]);

  if (r.error) return <ErrorNote error={r.error} />;
  if (!r.data || !status) return <Loading />;
  const name = titleCase(r.data.name);
  if (!r.data.supported)
    return (
      <EmptyState title={t("No practice set for this skill yet", "Belum ada latihan untuk skill ini")} mascot="thinking" action={<LinkButton href={`/assessment/${skill}`}>{t("Take the check", "Ikuti cek ulang")}</LinkButton>}>
        {t("Practice sets exist for the core Business Analyst skills. For this one, learn from the materials and prove it with the check.", "Latihan tersedia untuk skill inti Business Analyst. Untuk skill ini, pelajari materinya lalu buktikan lewat cek ulang.")}
      </EmptyState>
    );

  const task = tasks[idx];
  const tierDone = tasks.length > 0 && tasks.every((x) => results[x.id] || x.last);
  const counts = status.stages.practice;
  const pick = (v: LoopTier) => {
    setTier(v);
    const u = new URL(window.location.href);
    u.searchParams.set("tier", v);
    window.history.replaceState(window.history.state, "", u);
  };

  return (
    <div className="max-w-3xl">
      <Link href={`/learn#step-${skill}`} className="text-sm font-medium text-indigo underline-offset-4 hover:underline">
        ← {t("Learn", "Belajar")}
      </Link>
      <h1 className="mt-3 text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{t(`Practice: ${name}`, `Latihan: ${name}`)}</h1>
      {r.data.objective ? <p className="mt-2 text-ink/75">{r.data.objective}</p> : null}
      <LoopStages status={status} className="mt-5" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t("Practice level", "Tingkat latihan")}
          value={tier}
          onChange={pick}
          options={TIERS.map((x) => [x, `${tierLabel(t, x)} ${counts[x] ? `${counts[x]!.correct}/${counts[x]!.total}` : ""}`] as [LoopTier, string])}
          showLabel
        />
        {tasks.length ? (
          <span className="tabular text-sm text-muted-foreground">{t(`Task ${idx + 1} of ${tasks.length}`, `Soal ${idx + 1} dari ${tasks.length}`)}</span>
        ) : null}
      </div>
      {tier === "transfer" && !status.stages.prove.proven ? (
        <p className="mt-3 rounded-xl border border-dashed px-4 py-2.5 text-sm text-ink/75">
          {t("Different-case tasks check that the idea carries over. They count once the skill is proven, but you can try them now.",
             "Soal kasus berbeda memastikan konsepnya bisa diterapkan di situasi lain. Dihitung setelah skill terbukti, tapi boleh dicoba sekarang.")}
        </p>
      ) : null}

      {task ? (
        <TaskCard
          key={task.id}
          sid={sid}
          skill={skill}
          task={task}
          result={results[task.id]}
          onGraded={(g) => {
            setResults((x) => ({ ...x, [g.task_id]: g }));
            setStatus(g.status);
            track("practice_answered", { skill, tier: g.tier, correct: g.correct });
          }}
          onNext={idx < tasks.length - 1 ? () => setIdx(idx + 1) : undefined}
          t={t}
        />
      ) : null}

      {tierDone || (task && results[task.id] && idx === tasks.length - 1) ? (
        <div className="mt-8">
          <LoopDecision status={status} />
        </div>
      ) : null}

      {r.data.provenance ? <p className="mt-8 text-xs text-muted-foreground">{r.data.provenance}</p> : null}
    </div>
  );
}

function TaskCard({ sid, skill, task, result, onGraded, onNext, t }: {
  sid: string; skill: string; task: LoopTask; result?: PracticeGrade; onGraded: (g: PracticeGrade) => void; onNext?: () => void; t: T;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(() => (task.steps ?? []).map((s) => s.idx));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const stepText = Object.fromEntries((task.steps ?? []).map((s) => [s.idx, s.text]));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const g = await api.post<PracticeGrade>(`/students/${sid}/loop/${skill}/practice`, { task_id: task.id, answer: task.type === "choice" ? choice : order });
      onGraded(g);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const move = (pos: number, by: number) =>
    setOrder((o) => {
      const n = [...o];
      const j = pos + by;
      if (j < 0 || j >= n.length) return o;
      [n[pos], n[j]] = [n[j], n[pos]];
      return n;
    });

  return (
    <Panel className="mt-4 space-y-4">
      {task.last && !result ? (
        <p className="text-xs text-muted-foreground">
          {task.last.correct ? t("You got this one right before. Try it again if you like.", "Soal ini pernah kamu jawab benar. Boleh dicoba lagi.") : t("Last time this one was off. Try again.", "Terakhir kali soal ini belum tepat. Coba lagi.")}
        </p>
      ) : null}
      {task.context ? <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm leading-relaxed text-ink/85 [overflow-wrap:anywhere]">{task.context}</p> : null}
      <h2 className="text-[17px] font-semibold leading-snug text-ink">{task.stem}</h2>

      {task.type === "choice" ? (
        <div role="radiogroup" aria-label={task.stem} className="space-y-2">
          {task.options!.map((o) => {
            const graded = result?.options?.find((x) => x.idx === o.idx) ?? null;
            const chosen = result ? result.answer[0] === o.idx : choice === o.idx;
            return (
              <div key={o.idx}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={!!result}
                  onClick={() => setChoice(o.idx)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors [overflow-wrap:anywhere]",
                    !result && (chosen ? "border-indigo bg-secondary/60" : "hover:bg-muted/60"),
                    graded?.correct && "border-mint bg-[#e3f5ea]/60",
                    result && chosen && !graded?.correct && "border-destructive/50 bg-destructive/5",
                  )}
                >
                  <span className="mt-0.5 size-4 shrink-0">
                    {graded?.correct ? <Check className="size-4 text-mint" aria-label={t("Correct answer", "Jawaban benar")} /> : result && chosen ? <X className="size-4 text-destructive" aria-label={t("Your answer", "Jawabanmu")} /> : (
                      <span className={cn("block size-4 rounded-full border-2", chosen ? "border-indigo bg-indigo" : "border-input")} aria-hidden="true" />
                    )}
                  </span>
                  <span className="text-ink">{o.text}</span>
                </button>
                {graded && (chosen || graded.correct) ? (
                  <p className={cn("mt-1 pl-11 text-sm", graded.correct ? "text-mint-ink" : "text-ink/75")}>{graded.feedback}</p>
                ) : graded ? (
                  <details className="mt-1 pl-11 text-sm text-ink/60">
                    <summary className="cursor-pointer text-xs">{t("Why not this one?", "Kenapa bukan ini?")}</summary>
                    <p className="mt-1">{graded.feedback}</p>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <ol aria-label={t("Steps in your order", "Langkah sesuai urutanmu")} className="space-y-2">
          {(result ? result.answer : order).map((i, pos) => {
            const wrongHere = result && !result.correct && result.first_wrong != null && pos >= result.first_wrong && i !== pos;
            return (
              <li key={i} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", result && (wrongHere ? "border-destructive/50 bg-destructive/5" : "border-mint/50 bg-[#e3f5ea]/40"))}>
                <span className="tabular w-5 shrink-0 text-center font-semibold text-ink/60">{pos + 1}</span>
                <span className="min-w-0 flex-1 text-ink [overflow-wrap:anywhere]">{stepText[i]}</span>
                {!result ? (
                  <span className="flex shrink-0 gap-1">
                    <Button size="icon-sm" variant="outline" aria-label={t(`Move "${stepText[i]}" up`, `Naikkan "${stepText[i]}"`)} disabled={pos === 0} onClick={() => move(pos, -1)}>
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button size="icon-sm" variant="outline" aria-label={t(`Move "${stepText[i]}" down`, `Turunkan "${stepText[i]}"`)} disabled={pos === order.length - 1} onClick={() => move(pos, 1)}>
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {result ? (
        <div className="space-y-3" aria-live="polite">
          <p className={cn("flex items-center gap-2 text-sm font-semibold", result.correct ? "text-mint-ink" : "text-destructive")}>
            {result.correct ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
            {result.correct ? t("Correct", "Benar") : t("Not quite", "Belum tepat")}
          </p>
          {task.type === "order" ? (
            <div className="text-sm text-ink/80">
              {!result.correct && result.steps ? (
                <>
                  <p className="font-medium text-ink">{t("The right order:", "Urutan yang benar:")}</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                    {result.steps.map((x, i) => <li key={i}>{x}</li>)}
                  </ol>
                </>
              ) : null}
              <p className="mt-2">{result.feedback}</p>
            </div>
          ) : null}
          {result.takeaway ? (
            <p className="flex gap-2 rounded-xl bg-secondary/50 px-4 py-3 text-sm text-ink/85">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden="true" />
              <span><strong className="font-semibold">{t("Key idea", "Inti")}:</strong> {result.takeaway}</span>
            </p>
          ) : null}
          {onNext ? <Button onClick={onNext}>{t("Next task", "Soal berikutnya")}</Button> : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={busy || (task.type === "choice" && choice === null)}>
            {busy ? t("Checking…", "Memeriksa…") : t("Check my answer", "Periksa jawaban")}
          </Button>
          <ErrorNote error={error} />
        </div>
      )}
    </Panel>
  );
}
