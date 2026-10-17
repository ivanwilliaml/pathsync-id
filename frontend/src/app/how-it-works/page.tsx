"use client";

import { useState } from "react";
import { ArrowDown, CheckCircle2, Cpu, Scale, Tags, XCircle } from "lucide-react";
import { num, pct, titleCase } from "@/lib/format";
import type { Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { ErrorNote, Loading, PageHeader, Panel, SectionTitle, Tag } from "@/components/kit";

interface ModelCard {
  decision_model: { type: string; name: string; weights: Record<string, number> | null; why: string };
  extraction_llm: { runtime: string | null; runtime_provider: string; offline_run: string; active_for_market_map: string; gates: string };
  embedding_model: { name: string; use: string };
  knowledge_tracing: { type: string; slip: number; guess: number; learn: number };
  llm_is_never_used_for: string[];
  validation?: { real_experts: number; ranker_trained_on: string; status: string };
  planned?: string[];
}
interface Criterion {
  value: number | string;
  target?: number | string;
  pass: boolean;
  ungrounded?: string[];
}
interface Governance {
  role_name: string;
  version: string;
  sha256: string;
  n_skills: number;
  n_core: number;
  n_postings: number;
  n_mentions: number;
  final: boolean;
  criteria: Record<string, Criterion>;
  core_skills: string[];
  adjacent_skills: string[];
  new_skill_candidates: { label: string; examples: string[]; postings: number; share: number }[];
  skills: { skill_id: string; name: string; status: string; posting_share: number; grounds: string[] }[];
  changelog: { version: string; date: string; change: string }[];
}
interface WeightsReport {
  active_weights: Record<string, number>;
  implied_error_ratio_vs_assessment: Record<string, number>;
  sensitivity: { sensitivity: { results: Record<string, { top3_overlap: number; kendall_tau: number; mastery_mae: number }>; assumption: string }; calibration: { status?: string; message?: string } } | null;
}
interface EvalReport {
  n_scenarios: number;
  conditions: Record<string, { cv: { methods: Record<string, { ndcg5: { mean: number; ci95: [number, number] } }> } }>;
}

const CRITERIA: Record<string, string> = {
  C1_coverage: "Skill mentions in postings covered by the list",
  C2_no_frequent_candidate: "Largest uncovered skill cluster (share of postings)",
  C3_grounding: "Every skill grounded in ESCO or posting frequency",
};
const KIND: Record<string, string> = { academic: "Course grade", certificate: "Certificate", project: "Project artifact", assessment: "Skill check" };
const COND: Record<string, string> = { titik_hambat: "Experts judge by bottleneck", kesenjangan_permintaan: "Experts judge by gap × demand", campuran: "Mixed experts" };
const METHOD: Record<string, string> = {
  model: "PathSync model",
  formula5: "Formula (5)",
  kesenjangan_terbesar: "Largest gap",
  kesenjangan_x_permintaan: "Gap × demand",
  llm_umum: "Generic LLM",
};

export default function HowItWorksPage() {
  const card = useApi<ModelCard>("/model-card");
  const [govRole, setGovRole] = useState("business_analyst");
  const meta = useApi<Meta>("/meta");
  const gov = useApi<Governance>(`/taxonomy/report?role=${govRole}`);
  const weights = useApi<WeightsReport>("/evaluation/weights");
  const evals = useApi<EvalReport>("/evaluation");
  return (
    <div className="space-y-14">
      <PageHeader mascot="shift-route"
        title="How the AI Works"
        description="Which AI does what, how a recommendation is decided, why the skill list is final, and why evidence is weighted the way it is."
      />
      <Engine />
      <section aria-labelledby="models">
        <SectionTitle id="models">
          <span className="inline-flex items-center gap-2">
            <Cpu className="size-5 text-indigo" aria-hidden="true" /> Models We Use
          </span>
        </SectionTitle>
        {card.error ? <ErrorNote error={card.error} /> : !card.data ? <Loading /> : <Models c={card.data} />}
      </section>
      <section aria-labelledby="tax">
        <SectionTitle id="tax">
          <span className="inline-flex items-center gap-2">
            <Tags className="size-5 text-indigo" aria-hidden="true" /> Is the Skill List Final?
          </span>
        </SectionTitle>
        <label htmlFor="gov-role" className="mb-3 flex items-center gap-2 text-sm text-ink/70">
          Career
          <select id="gov-role" value={govRole} onChange={(e) => setGovRole(e.target.value)} className="rounded-lg border bg-card px-3 py-1.5 text-sm text-ink">
            {(meta.data?.roles ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {gov.error ? <ErrorNote error={gov.error} /> : !gov.data ? <Loading /> : <Taxonomy g={gov.data} />}
      </section>
      <section aria-labelledby="weights">
        <SectionTitle id="weights">
          <span className="inline-flex items-center gap-2">
            <Scale className="size-5 text-indigo" aria-hidden="true" /> Why Evidence Is Weighted This Way
          </span>
        </SectionTitle>
        {weights.error ? <ErrorNote error={weights.error} /> : !weights.data ? <Loading /> : <Weights w={weights.data} />}
      </section>
      <section aria-labelledby="eval">
        <SectionTitle id="eval">How Well the Ranking Agrees With Experts</SectionTitle>
        {evals.error ? <ErrorNote error={evals.error} /> : !evals.data ? <Loading /> : <Evaluation e={evals.data} />}
      </section>
    </div>
  );
}

function Engine() {
  const stages = [
    ["Evidence", "Course grades, certificates, project artifacts (rubric with quotes) and skill checks. CV claims and self-ratings never count as mastery."],
    ["Mastery p", "Weighted average of the evidence that exists (eq. 2), then updated by every new answer with Bayesian knowledge tracing (eq. 3)."],
    ["Seven features", "Gap, prerequisites ready, evidence confidence, market demand, demand trend, unlock value and downstream block (Table 3)."],
    ["Ranking model", "A linear learning-to-rank score f = Σ wᵢ log xᵢ (eq. 4), weights learned from expert rankings, every weight inspectable."],
    ["Route", "Top 3 skills plus unmastered prerequisites in prerequisite order, each with what, why (with job-posting quotes), why now and next."],
  ];
  return (
    <section aria-labelledby="engine">
      <SectionTitle id="engine">The Decision Engine, Step by Step</SectionTitle>
      <ol className="grid gap-2">
        {stages.map(([t, d], i) => (
          <li key={t}>
            <div className="flex gap-4 rounded-2xl border bg-card p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-route text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold text-ink">{t}</p>
                <p className="text-sm text-ink/75">{d}</p>
              </div>
            </div>
            {i < stages.length - 1 ? <ArrowDown className="mx-auto my-1 size-4 text-muted-foreground" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-ink/70">
        Every recommendation on your dashboard has a &ldquo;How was this decided?&rdquo; panel that shows these five steps with your actual numbers. New evidence, a
        market update or a role change re-runs the engine and the change is saved with its reason.
      </p>
    </section>
  );
}

function Models({ c }: { c: ModelCard }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Panel>
        <p className="text-sm text-muted-foreground">Decides priorities</p>
        <p className="mt-1 font-semibold text-ink">{c.decision_model.name}</p>
        <p className="text-sm text-ink/75">{c.decision_model.type}. Chosen because {c.decision_model.why}.</p>
        {c.validation ? (
          <p className="mt-2 inline-block rounded-md bg-ember/10 px-2 py-1 text-xs font-medium text-ember-ink">
            Beta: validated with {c.validation.real_experts} real experts so far; trained on {c.validation.ranker_trained_on}.
          </p>
        ) : null}
      </Panel>
      <Panel>
        <p className="text-sm text-muted-foreground">Reads job postings (language understanding only)</p>
        <p className="mt-1 font-semibold text-ink">
          {c.extraction_llm.active_for_market_map === "llm" ? c.extraction_llm.runtime : "Keyword and phrase matching (no LLM)"}
        </p>
        <p className="text-sm text-ink/75">
          {c.extraction_llm.active_for_market_map === "llm"
            ? `${c.extraction_llm.runtime_provider}. Gates: ${c.extraction_llm.gates}.`
            : `Today the market map is read by a transparent lexicon matcher. Gates: ${c.extraction_llm.gates}. LLM reading (Claude API) is planned, not active.`}
          {" "}Offline comparison run: {c.extraction_llm.offline_run}.
        </p>
      </Panel>
      <Panel>
        <p className="text-sm text-muted-foreground">Matches phrases and course names to skills</p>
        <p className="mt-1 break-all font-semibold text-ink">{c.embedding_model.name}</p>
        <p className="text-sm text-ink/75">{c.embedding_model.use}.</p>
      </Panel>
      <Panel>
        <p className="text-sm text-muted-foreground">Updates mastery after each answer</p>
        <p className="mt-1 font-semibold text-ink">{c.knowledge_tracing.type}</p>
        <p className="text-sm text-ink/75">
          Slip {c.knowledge_tracing.slip}, guess {c.knowledge_tracing.guess}, learning {c.knowledge_tracing.learn}.
        </p>
      </Panel>
      <Panel className="md:col-span-2">
        <p className="text-sm font-medium text-ink">An LLM is never used for</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {c.llm_is_never_used_for.map((x) => (
            <li key={x}>
              <Tag tone="mint">{x}</Tag>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Taxonomy({ g }: { g: Governance }) {
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          {g.final ? <CheckCircle2 className="size-6 text-mint" aria-hidden="true" /> : <XCircle className="size-6 text-ember-ink" aria-hidden="true" />}
          <p className="text-lg font-semibold text-ink">
            {g.final ? "Final" : "Not final yet"}: {g.n_core} core skills for {g.role_name}, plus {g.adjacent_skills.length} adjacent skills
          </p>
        </div>
        <p className="mt-1 text-sm text-ink/70">
          Version {g.version}, frozen by SHA-256 <code className="font-mono text-xs">{g.sha256.slice(0, 16)}…</code>, checked on {g.n_postings} postings and{" "}
          {g.n_mentions} extracted skill mentions.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {Object.entries(g.criteria).map(([k, c]) => (
            <li key={k} className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-medium text-ink">{CRITERIA[k] ?? k}</p>
              <p className="mt-1 tabular text-ink/80">
                {typeof c.value === "number" ? pct(c.value, 1) : c.value} {c.target != null ? `(target ${typeof c.target === "number" ? pct(c.target) : c.target})` : ""}
              </p>
              <Tag tone={c.pass ? "mint" : "ember"} className="mt-1">
                {c.pass ? "Pass" : "Fail"}
              </Tag>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <p className="mb-2 font-medium text-ink">Adjacent skills (core for related careers, rare in this one)</p>
        <ul className="flex flex-wrap gap-2">
          {g.skills
            .filter((s) => s.status === "adjacent")
            .map((s) => (
              <li key={s.skill_id}>
                <Tag>
                  {titleCase(s.name)} · {pct(s.posting_share)}
                </Tag>
              </li>
            ))}
        </ul>
        <p className="mb-2 mt-4 font-medium text-ink">Most frequent uncovered phrases (candidates for the next version)</p>
        <ul className="flex flex-wrap gap-2">
          {g.new_skill_candidates.slice(0, 8).map((c) => (
            <li key={c.label}>
              <Tag tone="neutral">
                {c.label} · {c.postings} postings
              </Tag>
            </li>
          ))}
        </ul>
        <p className="mb-1 mt-4 font-medium text-ink">Changelog</p>
        <ul className="space-y-1 text-sm text-ink/75">
          {g.changelog.map((c) => (
            <li key={c.version}>
              <span className="font-mono text-xs">{c.version}</span> {c.change}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Weights({ w }: { w: WeightsReport }) {
  const res = w.sensitivity?.sensitivity.results ?? {};
  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm text-ink/80">
          Combining independent noisy measurements of the same skill, the most accurate average weights each source by 1 / (its error)². The weights therefore
          state an explicit, testable assumption about how noisy each source is, relative to a direct skill check:
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/70">
                <th className="py-1.5 pr-3 font-medium">Evidence</th>
                <th className="py-1.5 pr-3 font-medium">Weight</th>
                <th className="py-1.5 font-medium">Assumed error vs skill check</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {Object.entries(w.active_weights).map(([k, v]) => (
                <tr key={k} className="border-t">
                  <td className="py-1.5 pr-3">{KIND[k] ?? k}</td>
                  <td className="py-1.5 pr-3">{num(v)}</td>
                  <td className="py-1.5">×{num(w.implied_error_ratio_vs_assessment[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink/70">
          The product checks the assumption itself: each later skill check is a direct measurement that earlier indirect evidence can be compared with. Once 30 such
          pairs exist, the weights are re-estimated and adopted only if they predict better.{" "}
          {w.sensitivity?.calibration?.message ?? ""}
        </p>
      </Panel>
      {Object.keys(res).length ? (
        <Panel>
          <p className="mb-2 font-medium text-ink">Do recommendations depend on the exact numbers?</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/70">
                  <th className="py-1.5 pr-3 font-medium">Weights tried</th>
                  <th className="py-1.5 pr-3 font-medium">Same top 3</th>
                  <th className="py-1.5 font-medium">Mastery error</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {Object.entries(res).map(([k, r]) => (
                  <tr key={k} className="border-t">
                    <td className="py-1.5 pr-3">{k}</td>
                    <td className="py-1.5 pr-3">{pct(r.top3_overlap)}</td>
                    <td className="py-1.5">{num(r.mastery_mae, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{w.sensitivity?.sensitivity.assumption}</p>
        </Panel>
      ) : null}
    </div>
  );
}

function Evaluation({ e }: { e: EvalReport }) {
  // hide a method with no data in any condition (the generic-LLM baseline is not available yet)
  const methods = Object.keys(METHOD).filter((m) => Object.values(e.conditions).some((c) => c.cv.methods[m]));
  return (
    <Panel>
      <p className="mb-3 text-sm text-ink/70">
        NDCG@5 against the expert reference order, grouped cross-validation over {e.n_scenarios} scenarios, 95% bootstrap intervals. Feasibility simulation with
        simulated experts until the real panel has ranked.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink/70">
              <th className="py-1.5 pr-3 font-medium">Condition</th>
              {methods.map((m) => (
                <th key={m} className="py-1.5 pr-3 font-medium">
                  {METHOD[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {Object.entries(e.conditions).map(([k, c]) => (
              <tr key={k} className="border-t">
                <td className="py-1.5 pr-3">{COND[k] ?? k}</td>
                {methods.map((m) => (
                  <td key={m} className="py-1.5 pr-3">
                    {c.cv.methods[m] ? num(c.cv.methods[m].ndcg5.mean, 3) : "–"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
