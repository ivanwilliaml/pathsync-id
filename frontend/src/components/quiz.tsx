"use client";

import { useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { api, num, type Item } from "@/lib/api";
import { Badge, Button, Card, ErrorBox, Meter } from "./ui";

interface SubmitResult {
  results: { item_id: string; skill_id: string; correct: boolean; choice: number | null; answer: number; explanation: string }[];
  skills: Record<string, { name: string; p_before: number; p_after: number; trace: number[] }>;
  correct: number;
  total: number;
}

export function Quiz({ sid, items, phase, onDone }: { sid: string; items: Item[]; phase: "diagnostic" | "reassessment"; onDone?: (r: SubmitResult) => void }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<SubmitResult>(`/students/${sid}/assessment/submit`, {
        phase,
        answers: items.map((i) => ({ item_id: i.id, choice: answers[i.id] ?? null })),
      });
      setResult(r);
      onDone?.(r);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  if (result) return <QuizResult items={items} result={result} />;

  const it = items[idx];
  const answered = Object.keys(answers).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span>
          Soal {idx + 1} dari {items.length}
        </span>
        <Meter value={answered / items.length} className="max-w-xs" />
        <span>{answered} terjawab</span>
      </div>
      <Card>
        <div className="mb-2 flex gap-2">
          <Badge tone="brand">{it.skill_name}</Badge>
          <Badge>tingkat {it.difficulty}</Badge>
        </div>
        <p className="mb-4 text-base font-medium leading-relaxed">{it.stem}</p>
        <div className="space-y-2">
          {it.options.map((o, k) => (
            <button
              key={k}
              onClick={() => setAnswers({ ...answers, [it.id]: k })}
              className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                answers[it.id] === k ? "border-brand bg-brand-soft" : "border-line hover:bg-subtle"
              }`}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${answers[it.id] === k ? "bg-brand text-white" : "bg-subtle"}`}>
                {"ABCD"[k]}
              </span>
              {o}
            </button>
          ))}
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {items.map((x, k) => (
            <button
              key={x.id}
              onClick={() => setIdx(k)}
              className={`h-7 w-7 rounded text-xs ${k === idx ? "ring-2 ring-brand" : ""} ${answers[x.id] != null ? "bg-brand text-white" : "bg-subtle text-muted"}`}
            >
              {k + 1}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            Sebelumnya
          </Button>
          {idx < items.length - 1 ? (
            <Button onClick={() => setIdx(idx + 1)}>
              Berikutnya <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} loading={busy}>
              Kirim jawaban ({answered}/{items.length})
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted">Soal yang tidak dijawab dihitung salah. Jawab jujur: hasil ini dipakai untuk menentukan apa yang perlu kamu pelajari.</p>
      <ErrorBox error={err} />
    </div>
  );
}

function QuizResult({ items, result }: { items: Item[]; result: SubmitResult }) {
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  return (
    <div className="space-y-4">
      <Card title={`Skor: ${result.correct} dari ${result.total} benar`} action={<Button href="/dasbor">Lihat jalur belajar</Button>}>
        <p className="mb-3 text-sm text-muted">Perubahan perkiraan penguasaan (diagnostik: akurasi terhaluskan; asesmen ulang: pembaruan BKT per jawaban):</p>
        <div className="space-y-3">
          {Object.entries(result.skills).map(([k, s]) => (
            <div key={k} className="grid grid-cols-[minmax(0,1fr)_120px_90px] items-center gap-3 text-sm">
              <span className="truncate">{s.name}</span>
              <Meter value={s.p_after} />
              <span className={`text-right text-xs ${s.p_after >= s.p_before ? "text-emerald-700" : "text-red-700"}`}>
                {num(s.p_before)} → {num(s.p_after)}
              </span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Pembahasan">
        <ul className="space-y-3">
          {result.results.map((r) => {
            const it = byId[r.item_id];
            return (
              <li key={r.item_id} className="flex gap-3 text-sm">
                {r.correct ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                <div>
                  <p className="font-medium">{it?.stem}</p>
                  <p className="text-xs text-muted">
                    Jawaban benar: <b>{it?.options[r.answer]}</b>. {r.explanation}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
