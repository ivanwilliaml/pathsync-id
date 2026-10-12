"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { api, type Item } from "@/lib/api";
import { num, titleCase } from "@/lib/format";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { ErrorNote, LinkButton, MasteryBar, Panel, Tag } from "./kit";
import { ReadinessRing } from "./readiness-ring";

interface SubmitResult {
  results: { item_id: string; skill_id: string; correct: boolean; choice: number | null; answer: number; explanation: string }[];
  skills: Record<string, { name: string; p_before: number; p_after: number }>;
  correct: number;
  total: number;
}

const LETTERS = ["A", "B", "C", "D"];

export function Quiz({ sid, sessionId, items }: { sid: string; sessionId: string; items: Item[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => track("check_started", { items: items.length }), [items.length]);
  const it = items[idx];
  const answered = Object.keys(answers).length;
  const last = idx === items.length - 1;

  const submit = useCallback(async () => {
    setConfirm(false);
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<SubmitResult>(`/students/${sid}/assessment/submit`, {
        session_id: sessionId,
        answers: items.map((i) => ({ item_id: i.id, choice: answers[i.id] ?? null })),
      });
      setResult(r);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }, [answers, items, sessionId, sid]);

  const finish = useCallback(() => {
    if (answered < items.length) setConfirm(true);
    else submit();
  }, [answered, items.length, submit]);

  // keyboard: 1-4 or A-D to answer, Enter / right arrow for next, left arrow for back
  useEffect(() => {
    if (result) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const n = "1234".indexOf(k) >= 0 ? "1234".indexOf(k) : LETTERS.indexOf(k);
      if (n >= 0 && n < it.options.length) {
        setAnswers((a) => ({ ...a, [it.id]: n }));
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        if (last) finish();
        else setIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        setIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [it, last, finish, items.length, result]);

  if (result) return <Results items={items} result={result} />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-ink">
            Question {idx + 1} of {items.length}
          </span>
          <span className="text-ink/60">{answered} answered</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={idx + 1} aria-label="Progress">
          <div className="h-2 rounded-full bg-route transition-[width] duration-300" style={{ width: `${((idx + 1) / items.length) * 100}%` }} />
        </div>
      </div>

      <Panel className="p-6 sm:p-8">
        <Tag tone="indigo">{titleCase(it.skill_name)}</Tag>
        <h2 className="mt-4 text-[20px] font-semibold leading-snug text-ink sm:text-[22px]">{it.stem}</h2>
        <div role="radiogroup" aria-label="Answer options" className="mt-6 space-y-3">
          {it.options.map((o, k) => {
            const sel = answers[it.id] === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setAnswers({ ...answers, [it.id]: k })}
                className={cn(
                  "flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sel ? "border-indigo bg-secondary/60 text-ink" : "border-border bg-card text-ink/85 hover:border-indigo/30 hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    sel ? "bg-indigo text-white" : "bg-muted text-ink/70",
                  )}
                  aria-hidden="true"
                >
                  {LETTERS[k]}
                </span>
                <span className="pt-0.5">{o}</span>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" size="lg" className="h-11" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
          <ArrowLeft /> Back
        </Button>
        <p className="hidden text-xs text-muted-foreground sm:block">Press 1–4 to answer and Enter to continue</p>
        {last ? (
          <Button size="lg" className="h-11 px-6" onClick={finish} disabled={busy}>
            {busy ? "Submitting…" : "Submit Answers"}
          </Button>
        ) : (
          <Button size="lg" className="h-11 px-6" onClick={() => setIdx(idx + 1)}>
            Next <ArrowRight />
          </Button>
        )}
      </div>
      <div className="mt-4">
        <ErrorNote error={err} />
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {items.length - answered} Question{items.length - answered > 1 ? "s" : ""} Left Blank
            </AlertDialogTitle>
            <AlertDialogDescription>Blank answers count as wrong. You can go back and answer them, or submit now.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                const first = items.findIndex((i) => answers[i.id] == null);
                if (first >= 0) setIdx(first);
              }}
            >
              Answer Them
            </AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Submit Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Results({ items, result }: { items: Item[]; result: SubmitResult }) {
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const changes = Object.entries(result.skills).sort((a, b) => b[1].p_after - b[1].p_before - (a[1].p_after - a[1].p_before));
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="flex flex-col items-center gap-6 rounded-3xl bg-route-soft p-8 text-center sm:flex-row sm:text-left">
        <ReadinessRing value={result.total ? result.correct / result.total : 0} label="Correct" />
        <div>
          <h1 className="text-[28px] font-extrabold text-ink">
            {result.correct} of {result.total} Correct
          </h1>
          <p className="mt-1 text-ink/70">Your route has been updated with these results.</p>
          <LinkButton href="/dashboard" size="lg" className="mt-4 h-11 px-6">
            See My Updated Route
          </LinkButton>
        </div>
      </section>

      <Panel>
        <h2 className="text-lg font-semibold text-ink">What Changed</h2>
        <ul className="mt-4 space-y-4">
          {changes.map(([k, s]) => {
            const up = s.p_after >= s.p_before;
            return (
              <li key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,40%)_auto] items-center gap-4">
                <span className="truncate text-sm font-medium text-ink">{titleCase(s.name)}</span>
                <MasteryBar value={s.p_after} tone="indigo" />
                <span className={cn("tabular text-xs font-medium", up ? "text-mint-ink" : "text-destructive")}>
                  {num(s.p_before)} to {num(s.p_after)}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <details className="group rounded-2xl border bg-card">
        <summary className="cursor-pointer list-none p-5 font-semibold text-ink marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          Review Your Answers
        </summary>
        <ol className="space-y-4 border-t p-5">
          {result.results.map((r, i) => {
            const it = byId[r.item_id];
            return (
              <li key={r.item_id} className="flex gap-3">
                {r.correct ? (
                  <Check className="mt-0.5 size-5 shrink-0 text-mint" aria-label="Correct" />
                ) : (
                  <X className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="Incorrect" />
                )}
                <div className="text-sm">
                  <p className="font-medium text-ink">
                    {i + 1}. {it?.stem}
                  </p>
                  <p className="mt-1 text-ink/70">
                    Answer: <span className="font-medium text-ink">{it?.options[r.answer]}</span>. {r.explanation}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </details>
    </div>
  );
}
