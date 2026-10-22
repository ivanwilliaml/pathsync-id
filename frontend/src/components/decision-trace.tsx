"use client";

import { useState } from "react";
import { ChevronDown, Calculator } from "lucide-react";
import { FEATURE_LABELS } from "@/lib/api";
import { num } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useStudentId } from "@/lib/student";
import { ErrorNote, Loading } from "./kit";
import { useT } from "@/lib/i18n";

interface Stage {
  stage: string;
  formula?: string;
  inputs?: unknown;
  result: unknown;
  note?: string;
}
interface Trace {
  name: string;
  market_version: string;
  stages: Stage[];
}
type Row = Record<string, unknown>;

/** Collapsible "How was this decided?" panel: the engine's five stages with this student's actual numbers. */
export function DecisionTrace({ skillId }: { skillId: string }) {
  const { id } = useStudentId();
  const [open, setOpen] = useState(false);
  const tr = useT();
  const t = useApi<Trace>(open && id ? `/students/${id}/trace/${skillId}` : null);
  return (
    <div className="rounded-xl border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-3.5 text-left text-sm font-semibold text-ink"
      >
        <span className="inline-flex items-center gap-2">
          <Calculator className="size-4 text-indigo" aria-hidden="true" /> {tr("How was this decided?", "Bagaimana ini diputuskan?")}
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div className="space-y-4 border-t p-3.5 text-sm">
          {t.error ? <ErrorNote error={t.error} /> : !t.data ? <Loading /> : t.data.stages.map((s) => <StageView key={s.stage} s={s} />)}
          {t.data ? <p className="text-xs text-muted-foreground">{tr("Market map", "Peta pasar")} {t.data.market_version}. {tr("Same inputs always give the same result.", "Input yang sama selalu memberi hasil yang sama.")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function StageView({ s }: { s: Stage }) {
  const rows = Array.isArray(s.inputs) ? (s.inputs as Row[]) : null;
  const tr = useT();
  return (
    <div>
      <p className="font-medium text-ink">{s.stage}</p>
      {s.formula ? <p className="mt-0.5 text-xs italic text-ink/70">{s.formula}</p> : null}
      {rows?.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <tbody className="tabular">
              {rows.map((r, i) => (
                <tr key={i} className="border-t first:border-0">
                  {Object.entries(r)
                    .filter(([k]) => k !== "definition" && k !== "sources")
                    .map(([k, v]) => (
                      <td key={k} className="py-1 pr-2 align-top" title={k === "feature" ? String(r.definition ?? "") : k}>
                        {k === "feature" ? FEATURE_LABELS[String(v)] ?? String(v) : typeof v === "number" ? num(v, 3) : String(v)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : s.inputs && typeof s.inputs === "object" ? (
        <p className="mt-1 text-xs text-ink/75">
          {Object.entries(s.inputs as Row)
            .map(([k, v]) => `${k.replaceAll("_", " ")}: ${Array.isArray(v) ? v.map((x) => num(Number(x), 2)).join(" → ") : String(v)}`)
            .join(", ")}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-ink">
        {tr("Result", "Hasil")}:{" "}
        <span className="font-semibold">
          {typeof s.result === "number"
            ? num(s.result, 3)
            : typeof s.result === "object" && s.result
              ? Object.entries(s.result as Row)
                  .filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))
                  .map(([k, v]) => `${k.replaceAll("_", " ")} ${typeof v === "number" ? num(v, 3) : Array.isArray(v) ? v.join(", ") : String(v)}`)
                  .join(", ")
              : String(s.result)}
        </span>
      </p>
      {s.note ? <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p> : null}
    </div>
  );
}
