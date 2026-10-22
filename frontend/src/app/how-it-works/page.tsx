"use client";

import { useState } from "react";
import { CheckCircle2, Cpu, Scale, Tags, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { num, pct, titleCase } from "@/lib/format";
import type { Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { BpsContext } from "@/components/market-evidence";
import { ErrorNote, Loading, PageHeader, Panel, SectionTitle, Tag, Toc } from "@/components/kit";
import { useT } from "@/lib/i18n";

interface ModelCard {
  decision_model: { type: string; name: string; weights: Record<string, number> | null; why: string };
  extraction_llm: { runtime: string | null; runtime_provider: string; offline_run: string; active_for_market_map: string; gates: string };
  embedding_model: { name: string; use: string };
  knowledge_tracing: { type: string; slip: number; guess: number; learn: number };
  llm_is_never_used_for: string[];
  validation?: {
    real_experts: number; ranker_trained_on: string | null; status: string; graph_experts?: number;
    decision_study?: { experts: number; diagnosis_ratings: number; diagnosis_spearman: number; ranking_scenarios: number;
                       ndcg5: Record<string, number>; ndcg5_diff_ci95: [number, number] | null } | null;
  };
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

// [English, Indonesian]
const CRITERIA: Record<string, [string, string]> = {
  C1_coverage: ["Skill mentions in postings covered by the list", "Penyebutan skill di posting yang tercakup daftar"],
  C2_no_frequent_candidate: ["Largest uncovered skill cluster (share of postings)", "Klaster skill terbesar yang belum tercakup (porsi posting)"],
  C3_grounding: ["Every skill grounded in ESCO or posting frequency", "Setiap skill berdasar pada ESCO atau frekuensi posting"],
};
const KIND: Record<string, [string, string]> = {
  academic: ["Course grade", "Nilai mata kuliah"],
  certificate: ["Certificate", "Sertifikat"],
  project: ["Project artifact", "Artefak project"],
  assessment: ["Skill check", "Skill check"],
};
const COND: Record<string, [string, string]> = {
  titik_hambat: ["Experts judge by bottleneck", "Pakar menilai dari bottleneck"],
  kesenjangan_permintaan: ["Experts judge by gap × demand", "Pakar menilai dari gap × demand"],
  campuran: ["Mixed experts", "Pakar campuran"],
};
const METHOD: Record<string, [string, string]> = {
  model: ["PathSync model", "Model PathSync"],
  formula5: ["Formula (5)", "Formula (5)"],
  kesenjangan_terbesar: ["Largest gap", "Gap terbesar"],
  kesenjangan_x_permintaan: ["Gap × demand", "Gap × demand"],
  llm_umum: ["Generic LLM", "LLM umum"],
};

export default function HowItWorksPage() {
  const card = useApi<ModelCard>("/model-card");
  const [govRole, setGovRole] = useState("business_analyst");
  const meta = useApi<Meta>("/meta");
  const gov = useApi<Governance>(`/taxonomy/report?role=${govRole}`);
  const weights = useApi<WeightsReport>("/evaluation/weights");
  const evals = useApi<EvalReport>("/evaluation");
  const t = useT();
  const toc: [string, string][] = [
    ["engine", t("How a recommendation is made", "Cara rekomendasi dibuat")],
    ["models", t("Models", "Model")],
    ["tax", t("Skill list", "Daftar skill")],
    ["weights", t("Evidence weights", "Bobot bukti")],
    ["eval", t("Agreement with experts", "Kecocokan dengan pakar")],
    ["data-sources", t("Data sources", "Sumber data")],
  ];
  return (
    <div>
      <PageHeader
        className="mb-6"
        title={t("Methodology & Data", "Metode & Data")}
        description={t(
          "Which AI does what, how a recommendation is decided, why the skill list is final, and why evidence is weighted the way it is.",
          "AI mana mengerjakan apa, bagaimana rekomendasi diputuskan, kenapa daftar skill sudah final, dan kenapa bukti dibobot seperti ini.",
        )}
      />
      {/* a local table of contents beside the article; every detail stays reachable, the long lists open on request */}
      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        <Toc label={t("On this page", "Di halaman ini")} items={toc} />
      <div className="min-w-0 divide-y [&>section]:scroll-mt-24 [&>section]:py-12 [&>section:first-child]:pt-0">
      <Engine />
      <section aria-labelledby="models">
        <SectionTitle id="models">
          <span className="inline-flex items-center gap-2">
            <Cpu className="size-5 text-indigo" aria-hidden="true" /> {t("Models We Use", "Model yang Kami Pakai")}
          </span>
        </SectionTitle>
        {card.error ? <ErrorNote error={card.error} /> : !card.data ? <Loading /> : <Models c={card.data} />}
      </section>
      <section aria-labelledby="tax">
        <SectionTitle id="tax">
          <span className="inline-flex items-center gap-2">
            <Tags className="size-5 text-indigo" aria-hidden="true" /> {t("Is the Skill List Final?", "Apakah Daftar Skill Sudah Final?")}
          </span>
        </SectionTitle>
        <label htmlFor="gov-role" className="mb-3 flex items-center gap-2 text-sm text-ink/70">
          {t("Career", "Karier")}
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
            <Scale className="size-5 text-indigo" aria-hidden="true" /> {t("Why Evidence Is Weighted This Way", "Kenapa Evidence Dibobot Seperti Ini")}
          </span>
        </SectionTitle>
        {weights.error ? <ErrorNote error={weights.error} /> : !weights.data ? <Loading /> : <Weights w={weights.data} />}
      </section>
      <section aria-labelledby="eval">
        <SectionTitle id="eval">{t("Ranking Feasibility Check (Simulation)", "Uji Kelayakan Ranking (Simulasi)")}</SectionTitle>
        {evals.error ? <ErrorNote error={evals.error} /> : !evals.data ? <Loading /> : <Evaluation e={evals.data} />}
      </section>
      <section aria-labelledby="data-sources">
        <SectionTitle id="data-sources">{t("Data Sources and Coverage", "Sumber & Cakupan Data")}</SectionTitle>
        <p className="mb-4 max-w-3xl text-sm text-ink/75">
          {t(
            "Job postings come from Karirhub (Kemnaker) and public company career sites, refreshed monthly; per-career sources and dates are shown with each career's market evidence in Choose a Career. The national context below is display only and never enters the ranking.",
            "Job posting berasal dari Karirhub (Kemnaker) dan situs karier perusahaan publik, diperbarui tiap bulan; sumber dan tanggal per karier ditampilkan bersama bukti pasar tiap karier di Pilih Karier. Konteks nasional di bawah hanya untuk tampilan dan tidak pernah masuk ke ranking.",
          )}
        </p>
        <BpsContext />
      </section>
      </div>
      </div>
    </div>
  );
}

function Engine() {
  const t = useT();
  const [stage, setStage] = useState(0);
  const stages = [
    ["Evidence", t("Course grades, certificates, project artifacts (rubric with quotes) and skill checks. CV claims and self-ratings never count as mastery.", "Nilai mata kuliah, sertifikat, artefak project (rubrik dengan kutipan) dan Cek Kemampuan. Klaim CV dan penilaian diri tidak pernah dihitung sebagai mastery.")],
    ["Mastery p", t("Weighted average of the evidence that exists, then updated by every new answer with Bayesian knowledge tracing.", "Rata-rata berbobot dari evidence yang ada, lalu diperbarui setiap jawaban baru dengan Bayesian knowledge tracing.")],
    [t("Seven features", "Tujuh fitur"), t("Gap, prerequisites ready, evidence confidence, market demand, demand trend, unlock value and downstream block. The active formula uses five of them (G, R, D, T, U); confidence and downstream block are shown but weigh 0.", "Gap, kesiapan prasyarat, keyakinan evidence, market demand, tren demand, nilai unlock, dan downstream block. Formula aktif memakai lima (G, R, D, T, U); keyakinan dan downstream block ditampilkan tetapi berbobot 0.")],
    ["Ranking model", t("Formula (5) is active: score = G × D × T × U × R, every factor inspectable. A learning-to-rank model (eq. 4) exists in code but has not been trained on real expert rankings, so it is not used.", "Formula (5) aktif: skor = G × D × T × U × R, setiap faktor bisa diperiksa. Model learning-to-rank (pers. 4) sudah ada di kode tetapi belum dilatih dengan urutan pakar sungguhan, sehingga belum dipakai.")],
    [t("Route", "Rute"), t("Top 3 skills plus unmastered prerequisites in prerequisite order, each with what, why (with job-posting quotes), why now and next.", "3 skill teratas plus prasyarat yang belum dikuasai sesuai urutan prasyarat, masing-masing dengan apa, kenapa (dengan kutipan job posting), kenapa sekarang, dan selanjutnya.")],
  ];
  return (
    <section aria-labelledby="engine">
      <SectionTitle id="engine">{t("The Decision Engine, Step by Step", "Decision Engine, Langkah demi Langkah")}</SectionTitle>
      {/* the five stages as one strip; the chosen stage is explained below it */}
      <ol className="grid gap-1.5 sm:grid-cols-5">
        {stages.map(([title], i) => (
          <li key={title}>
            <button
              type="button"
              aria-pressed={stage === i}
              onClick={() => setStage(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                stage === i ? "border-indigo bg-secondary text-secondary-foreground" : "bg-card text-ink/80 hover:bg-muted",
              )}
            >
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", stage === i ? "bg-indigo text-white" : "bg-muted text-ink/70")}>{i + 1}</span>
              {title}
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 max-w-3xl rounded-xl bg-muted/60 px-4 py-3 text-sm text-ink/85" aria-live="polite">{stages[stage][1]}</p>
      <p className="mt-3 max-w-3xl text-sm text-ink/70">
        {t(
          "Every recommendation on your dashboard has a \u201cHow was this decided?\u201d panel that shows these five steps with your actual numbers. New evidence, a market update or a role change re-runs the engine and the change is saved with its reason.",
          "Setiap rekomendasi di dashboard-mu punya panel \u201cBagaimana ini diputuskan?\u201d yang menunjukkan lima langkah ini dengan angka milikmu. Evidence baru, update pasar, atau pergantian role menjalankan ulang engine dan perubahannya disimpan beserta alasannya.",
        )}
      </p>
    </section>
  );
}

function Models({ c }: { c: ModelCard }) {
  const t = useT();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Panel>
        <p className="text-sm text-muted-foreground">{t("Decides priorities", "Memutuskan prioritas")}</p>
        <p className="mt-1 font-semibold text-ink">{c.decision_model.name}</p>
        <p className="text-sm text-ink/75">{c.decision_model.type}. {t("Chosen because", "Dipilih karena")} {c.decision_model.why}.</p>
        {c.validation ? (
          <p className="mt-2 inline-block rounded-md bg-ember/10 px-2 py-1 text-xs font-medium text-ember-ink">
            {t(
              `Beta: ${c.validation.graph_experts ?? c.validation.real_experts} experts reviewed the Business Analyst prerequisite graph; ${c.validation.decision_study?.experts ?? 0} expert judged the priority order on ${c.validation.decision_study?.ranking_scenarios ?? 0} scenarios. ${c.validation.ranker_trained_on ? `Trained on ${c.validation.ranker_trained_on}.` : "No trained model is active."}`,
              `Beta: ${c.validation.graph_experts ?? c.validation.real_experts} pakar menilai graf prasyarat Business Analyst; ${c.validation.decision_study?.experts ?? 0} pakar menilai urutan prioritas pada ${c.validation.decision_study?.ranking_scenarios ?? 0} skenario. ${c.validation.ranker_trained_on ? `Dilatih dengan ${c.validation.ranker_trained_on}.` : "Belum ada model terlatih yang aktif."}`,
            )}
          </p>
        ) : null}
        {c.validation?.decision_study?.ndcg5 ? (
          <p className="mt-2 text-xs text-ink/70">
            {t(
              `Human check (1 Business Analyst expert, ${c.validation.decision_study.ranking_scenarios} scenarios, PathSync's answers hidden): NDCG@5 ${num(c.validation.decision_study.ndcg5.pathsync_formula5, 3)} for the formula, ${num(c.validation.decision_study.ndcg5.gap_x_demand, 3)} for gap × demand and ${num(c.validation.decision_study.ndcg5.biggest_gap, 3)} for biggest gap. Early agreement with one judge, not a general proof.`,
              `Uji manusia (1 pakar Business Analyst, ${c.validation.decision_study.ranking_scenarios} skenario, jawaban PathSync disembunyikan): NDCG@5 ${num(c.validation.decision_study.ndcg5.pathsync_formula5, 3)} untuk formula, ${num(c.validation.decision_study.ndcg5.gap_x_demand, 3)} untuk gap × demand, dan ${num(c.validation.decision_study.ndcg5.biggest_gap, 3)} untuk gap terbesar. Ini kesesuaian awal dengan satu penilai, bukan bukti umum.`,
            )}
          </p>
        ) : null}
      </Panel>
      <Panel>
        <p className="text-sm text-muted-foreground">{t("Reads job postings (language understanding only)", "Membaca job posting (hanya pemahaman bahasa)")}</p>
        <p className="mt-1 font-semibold text-ink">
          {c.extraction_llm.active_for_market_map === "llm" ? c.extraction_llm.runtime : t("Keyword and phrase matching (no LLM)", "Pencocokan kata kunci dan frasa (tanpa LLM)")}
        </p>
        <p className="text-sm text-ink/75">
          {c.extraction_llm.active_for_market_map === "llm"
            ? `${c.extraction_llm.runtime_provider}. Gates: ${c.extraction_llm.gates}.`
            : t(
                `The market map is read by a transparent lexicon matcher, which beat the LLM on the test postings. Gates: ${c.extraction_llm.gates}.`,
                `Peta pasar dibaca oleh lexicon matcher yang transparan, yang lebih akurat daripada LLM pada lowongan uji. Gates: ${c.extraction_llm.gates}.`,
              )}
          {" "}{c.extraction_llm.runtime
            ? t(`CVs and project rubrics are read by ${c.extraction_llm.runtime} (${c.extraction_llm.runtime_provider}); every rating needs a verbatim quote and 20% are sampled for human review.`,
                `CV dan rubrik proyek dibaca oleh ${c.extraction_llm.runtime} (${c.extraction_llm.runtime_provider}); setiap nilai wajib berkutipan dan 20% diambil acak untuk ditinjau manusia.`)
            : t("CVs and project rubrics are read by keyword rules with verbatim quotes (no LLM active).",
                "CV dan rubrik proyek dibaca dengan aturan kata kunci berkutipan (LLM tidak aktif).")}
          {" "}{t("Offline comparison run", "Uji perbandingan offline")}: {c.extraction_llm.offline_run}.
        </p>
      </Panel>
      <Panel>
        <p className="text-sm text-muted-foreground">{t("Matches phrases and course names to skills", "Mencocokkan frasa dan nama mata kuliah ke skill")}</p>
        <p className="mt-1 break-all font-semibold text-ink">{c.embedding_model.name}</p>
        <p className="text-sm text-ink/75">{c.embedding_model.use}.</p>
      </Panel>
      <Panel>
        <p className="text-sm text-muted-foreground">{t("Updates mastery after each answer", "Memperbarui mastery setiap jawaban")}</p>
        <p className="mt-1 font-semibold text-ink">{c.knowledge_tracing.type}</p>
        <p className="text-sm text-ink/75">
          Slip {c.knowledge_tracing.slip}, guess {c.knowledge_tracing.guess}, learning {c.knowledge_tracing.learn}.
        </p>
      </Panel>
      <Panel className="md:col-span-2">
        <p className="text-sm font-medium text-ink">{t("An LLM is never used for", "LLM tidak pernah dipakai untuk")}</p>
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
  const t = useT();
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          {g.final ? <CheckCircle2 className="size-6 text-mint" aria-hidden="true" /> : <XCircle className="size-6 text-ember-ink" aria-hidden="true" />}
          <p className="text-lg font-semibold text-ink">
            {g.final ? "Final" : t("Not final yet", "Belum final")}:{" "}
            {t(`${g.n_core} core skills for ${g.role_name}, plus ${g.adjacent_skills.length} adjacent skills`, `${g.n_core} core skill untuk ${g.role_name}, plus ${g.adjacent_skills.length} adjacent skill`)}
          </p>
        </div>
        <p className="mt-1 text-sm text-ink/70">
          {t("Version", "Versi")} {g.version}, {t("frozen by", "dibekukan dengan")} SHA-256 <code className="font-mono text-xs">{g.sha256.slice(0, 16)}…</code>,{" "}
          {t(`checked on ${g.n_postings} postings and ${g.n_mentions} extracted skill mentions.`, `diperiksa pada ${g.n_postings} posting dan ${g.n_mentions} penyebutan skill hasil ekstraksi.`)}
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {Object.entries(g.criteria).map(([k, c]) => (
            <li key={k} className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-medium text-ink">{CRITERIA[k] ? t(...CRITERIA[k]) : k}</p>
              <p className="mt-1 tabular text-ink/80">
                {typeof c.value === "number" ? pct(c.value, 1) : c.value} {c.target != null ? `(target ${typeof c.target === "number" ? pct(c.target) : c.target})` : ""}
              </p>
              <Tag tone={c.pass ? "mint" : "ember"} className="mt-1">
                {c.pass ? t("Pass", "Lulus") : t("Fail", "Gagal")}
              </Tag>
            </li>
          ))}
        </ul>
      </Panel>
      <details className="rounded-2xl border bg-card px-5 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          {t(
            `Catalog details: ${g.skills.filter((s) => s.status === "adjacent").length} adjacent skills, candidates for the next version, changelog`,
            `Detail katalog: ${g.skills.filter((s) => s.status === "adjacent").length} adjacent skill, kandidat versi berikutnya, changelog`,
          )}
        </summary>
        <div className="mt-3">
        <p className="mb-2 font-medium text-ink">{t("Adjacent skills (core for related careers, rare in this one)", "Adjacent skill (inti di karier terkait, jarang di karier ini)")}</p>
        <ul className="flex flex-wrap gap-2">
          {g.skills
            .filter((s) => s.status === "adjacent")
            .map((s) => (
              <li key={s.skill_id}>
                <Tag>
                  {titleCase(s.name)}, {pct(s.posting_share)}
                </Tag>
              </li>
            ))}
        </ul>
        <p className="mb-2 mt-4 font-medium text-ink">{t("Most frequent uncovered phrases (candidates for the next version)", "Frasa tak tercakup yang paling sering (kandidat versi berikutnya)")}</p>
        <ul className="flex flex-wrap gap-2">
          {g.new_skill_candidates.slice(0, 8).map((c) => (
            <li key={c.label}>
              <Tag tone="neutral">
                {c.label}, {c.postings} {t("postings", "posting")}
              </Tag>
            </li>
          ))}
        </ul>
        <p className="mb-1 mt-4 font-medium text-ink">Changelog</p>
        <ul className="space-y-1 text-sm text-ink/75">
          {g.changelog.map((c) => (
            <li key={c.version}>
              <span className="text-xs font-medium tabular-nums">{c.version}</span> {c.change}
            </li>
          ))}
        </ul>
        </div>
      </details>
    </div>
  );
}

function Weights({ w }: { w: WeightsReport }) {
  const res = w.sensitivity?.sensitivity.results ?? {};
  const t = useT();
  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm text-ink/80">
          {t(
            "Combining independent noisy measurements of the same skill, the most accurate average weights each source by 1 / (its error)². The weights therefore state an explicit, testable assumption about how noisy each source is, relative to a direct skill check:",
            "Saat menggabungkan pengukuran independen yang ber-noise untuk skill yang sama, rata-rata paling akurat membobot tiap sumber dengan 1 / (error-nya)². Jadi bobot ini menyatakan asumsi eksplisit yang bisa diuji tentang seberapa ber-noise tiap sumber, dibandingkan Cek Kemampuan langsung:",
          )}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/70">
                <th className="py-1.5 pr-3 font-medium">Evidence</th>
                <th className="py-1.5 pr-3 font-medium">{t("Weight", "Bobot")}</th>
                <th className="py-1.5 font-medium">{t("Assumed error vs skill check", "Asumsi error vs Cek Kemampuan")}</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {Object.entries(w.active_weights).map(([k, v]) => (
                <tr key={k} className="border-t">
                  <td className="py-1.5 pr-3">{KIND[k] ? t(...KIND[k]) : k}</td>
                  <td className="py-1.5 pr-3">{num(v)}</td>
                  <td className="py-1.5">×{num(w.implied_error_ratio_vs_assessment[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink/70">
          {t(
            "The product checks the assumption itself: each later skill check is a direct measurement that earlier indirect evidence can be compared with. Once 30 such pairs exist, the weights are re-estimated and adopted only if they predict better.",
            "Produk ini menguji asumsinya sendiri: setiap Cek Kemampuan berikutnya adalah pengukuran langsung yang bisa dibandingkan dengan evidence tidak langsung sebelumnya. Begitu ada 30 pasangan seperti itu, bobot diestimasi ulang dan baru dipakai kalau prediksinya lebih baik.",
          )}{" "}
          {w.sensitivity?.calibration?.message ?? ""}
        </p>
      </Panel>
      {Object.keys(res).length ? (
        <Panel>
          <p className="mb-2 font-medium text-ink">{t("Do recommendations depend on the exact numbers?", "Apakah rekomendasi bergantung pada angka persisnya?")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink/70">
                  <th className="py-1.5 pr-3 font-medium">{t("Weights tried", "Bobot yang dicoba")}</th>
                  <th className="py-1.5 pr-3 font-medium">{t("Same top 3", "Top 3 sama")}</th>
                  <th className="py-1.5 font-medium">{t("Mastery error", "Error mastery")}</th>
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
  const t = useT();
  const methods = Object.keys(METHOD).filter((m) => Object.values(e.conditions).some((c) => c.cv.methods[m]));
  return (
    <Panel>
      <p className="mb-3 text-sm text-ink/70">
        {t(
          `Simulation, not human judgement: NDCG@5 against rankings from simulated experts, grouped cross-validation over ${e.n_scenarios} synthetic scenarios, 95% bootstrap intervals. It checks that the training code works; it says nothing about real experts. The human result is in the Models section above.`,
          `Simulasi, bukan penilaian manusia: NDCG@5 terhadap urutan dari pakar simulasi, grouped cross-validation atas ${e.n_scenarios} skenario sintetis, interval bootstrap 95%. Ini memeriksa bahwa kode pelatihan berjalan, bukan kinerja terhadap pakar sungguhan. Hasil penilaian manusia ada di bagian Model di atas.`,
        )}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink/70">
              <th className="py-1.5 pr-3 font-medium">{t("Condition", "Kondisi")}</th>
              {methods.map((m) => (
                <th key={m} className="py-1.5 pr-3 font-medium">
                  {t(...METHOD[m])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {Object.entries(e.conditions).map(([k, c]) => (
              <tr key={k} className="border-t">
                <td className="py-1.5 pr-3">{COND[k] ? t(...COND[k]) : k}</td>
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
