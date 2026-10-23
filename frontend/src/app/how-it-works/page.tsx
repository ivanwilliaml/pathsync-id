"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity, CheckCircle2, ChevronDown, Cpu, Database, FileSearch, FlaskConical, Link2, Scale, ShieldCheck, Tags, Workflow, XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { num, pct, titleCase } from "@/lib/format";
import type { Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { BpsContext } from "@/components/market-evidence";
import { ErrorNote, Loading } from "@/components/kit";
import { Card, GrowBar, PageHero, PillSelect, Rise, Section, Seg } from "@/components/polish";
import { useLang, useT } from "@/lib/i18n";
import { idText } from "@/lib/id-overlay";

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
  assessment: ["Skill check", "Cek Kemampuan"],
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
      <PageHero
        eyebrow={t("Methodology & Data", "Metode & Data")}
        title={t("How PathSync", "Cara PathSync")}
        accent={t("decides.", "memutuskan.")}
        description={t(
          "Which AI does what, how a recommendation is decided, why the skill list is final, and why evidence is weighted the way it is.",
          "AI mana mengerjakan apa, bagaimana rekomendasi diputuskan, kenapa daftar skill sudah final, dan kenapa bukti dibobot seperti ini.",
        )}
      />
      {/* a local table of contents beside the article; every detail stays reachable, the long lists open on request */}
      <div className="grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-16">
        <SideNav label={t("On this page", "Di halaman ini")} items={toc} />
        <div className="min-w-0 space-y-28">
          <Engine />
          <Section id="models" icon={Cpu} title={t("The models", "Model")} accent={t("we use.", "yang kami pakai.")}>
            {card.error ? <ErrorNote error={card.error} /> : !card.data ? <Loading /> : <Models c={card.data} />}
          </Section>
          <Section
            id="tax"
            icon={Tags}
            title={t("Is the skill list", "Apakah daftar skill")}
            accent={t("final?", "sudah final?")}
            action={
              <label className="flex items-center gap-3 text-[13px] font-medium text-muted-foreground">
                {t("Career", "Karier")}
                <PillSelect id="gov-role" className="w-64" value={govRole} onChange={(e) => setGovRole(e.target.value)}>
                  {(meta.data?.roles ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </PillSelect>
              </label>
            }
          >
            {gov.error ? <ErrorNote error={gov.error} /> : !gov.data ? <Loading /> : <div key={govRole} className="smh-swap"><Taxonomy g={gov.data} /></div>}
          </Section>
          <Section id="weights" icon={Scale} title={t("Why evidence is", "Kenapa bukti")} accent={t("weighted this way.", "dibobot seperti ini.")}>
            {weights.error ? <ErrorNote error={weights.error} /> : !weights.data ? <Loading /> : <Weights w={weights.data} />}
          </Section>
          <Section id="eval" icon={FlaskConical} title={t("Ranking feasibility check", "Uji kelayakan ranking")} accent={t("(simulation).", "(simulasi).")}>
            {evals.error ? <ErrorNote error={evals.error} /> : !evals.data ? <Loading /> : <Evaluation e={evals.data} />}
          </Section>
          <Section
            id="data-sources"
            icon={Database}
            title={t("Data sources", "Sumber")}
            accent={t("and coverage.", "& cakupan data.")}
            lead={t(
              "Job postings come from Karirhub (Kemnaker) and public company career sites, refreshed monthly; per-career sources and dates are shown with each career's market evidence in Choose a Career. The national context below is display only and never enters the ranking.",
              "Job posting berasal dari Karirhub (Kemnaker) dan situs karier perusahaan publik, diperbarui tiap bulan; sumber dan tanggal per karier ditampilkan bersama bukti pasar tiap karier di Pilih Karier. Konteks nasional di bawah hanya untuk tampilan dan tidak pernah masuk ke ranking.",
            )}
          >
            <BpsContext />
          </Section>
        </div>
      </div>
    </div>
  );
}

/** the page's contents beside the article; a bar glides to the section being read */
function SideNav({ label, items }: { label: string; items: [string, string][] }) {
  const [active, setActive] = useState(items[0]?.[0] ?? "");
  const list = useRef<HTMLOListElement>(null);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  // the section being read is the last heading above the upper third of the screen; read from the scroll position, so
  // a long jump (a link, the scrollbar) lands on the right item too
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const line = window.innerHeight * 0.33;
      let cur = items[0]?.[0] ?? "";
      for (const [id] of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      }
      // at the very bottom the last section is the one being read, however short it is
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = items[items.length - 1][0];
      setActive(cur);
    };
    const on = () => (raf ||= requestAnimationFrame(read));
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => (window.removeEventListener("scroll", on), window.removeEventListener("resize", on), cancelAnimationFrame(raf));
  }, [items]);
  useLayoutEffect(() => {
    const a = list.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (a) setBar({ top: a.offsetTop, height: a.offsetHeight });
  }, [active]);
  return (
    <nav aria-label={label} className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
      <p className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</p>
      <ol ref={list} className="relative border-l border-black/[0.07]">
        {bar ? <span className="side-bar absolute -left-px w-[2px] rounded-full bg-indigo" style={{ top: bar.top, height: bar.height }} aria-hidden="true" /> : null}
        {items.map(([id, text]) => (
          <li key={id} data-id={id}>
            <a
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              aria-current={active === id ? "location" : undefined}
              className={cn("block py-2 pl-4 text-[14px] tracking-[-0.01em] transition-colors duration-300",
                active === id ? "font-semibold text-ink" : "text-ink/55 hover:text-ink")}
            >
              {text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Engine() {
  const t = useT();
  const [stage, setStage] = useState(0);
  const stages = [
    [t("Evidence", "Bukti"), t("Course grades, certificates, project artifacts (rubric with quotes) and skill checks. CV claims and self-ratings never count as mastery.", "Nilai mata kuliah, sertifikat, artefak project (rubrik dengan kutipan) dan Cek Kemampuan. Klaim CV dan penilaian diri tidak pernah dihitung sebagai mastery.")],
    ["Mastery p", t("Weighted average of the evidence that exists, then updated by every new answer with Bayesian knowledge tracing.", "Rata-rata berbobot dari evidence yang ada, lalu diperbarui setiap jawaban baru dengan Bayesian knowledge tracing.")],
    [t("Seven features", "Tujuh fitur"), t("Gap, prerequisites ready, evidence confidence, market demand, demand trend, unlock value and downstream block. The active formula uses five of them (G, R, D, T, U); confidence and downstream block are shown but weigh 0.", "Gap, kesiapan prasyarat, keyakinan evidence, market demand, tren demand, nilai unlock, dan downstream block. Formula aktif memakai lima (G, R, D, T, U); keyakinan dan downstream block ditampilkan tetapi berbobot 0.")],
    [t("Ranking model", "Model ranking"), t("Formula (5) is active: score = G × D × T × U × R, every factor inspectable. A learning-to-rank model (eq. 4) exists in code but has not been trained on real expert rankings, so it is not used.", "Formula (5) aktif: skor = G × D × T × U × R, setiap faktor bisa diperiksa. Model learning-to-rank (pers. 4) sudah ada di kode tetapi belum dilatih dengan urutan pakar sungguhan, sehingga belum dipakai.")],
    [t("Route", "Rute"), t("Top 3 skills plus unmastered prerequisites in prerequisite order, each with what, why (with job-posting quotes), why now and next.", "3 skill teratas plus prasyarat yang belum dikuasai sesuai urutan prasyarat, masing-masing dengan apa, kenapa (dengan kutipan job posting), kenapa sekarang, dan selanjutnya.")],
  ];
  return (
    <Section
      id="engine"
      icon={Workflow}
      title={t("The decision engine,", "Decision engine,")}
      accent={t("step by step.", "langkah demi langkah.")}
    >
      {/* the five stages as one segmented control; the chosen stage is explained in the card below */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <Seg
          label={t("Engine stage", "Tahap engine")}
          value={String(stage)}
          onChange={(v) => setStage(Number(v))}
          options={stages.map(([title], i) => [String(i), <span key={i} className="inline-flex items-center gap-2"><span className="tabular text-ink/40">{i + 1}</span>{title}</span>])}
        />
      </div>
      <Card className="mt-5 overflow-hidden">
        <div key={stage} className="wheel-detail grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <span className="hero-grad tabular text-[64px] font-extrabold leading-[0.9] tracking-[-0.05em]">{String(stage + 1).padStart(2, "0")}</span>
          <div>
            <p className="text-[22px] font-bold tracking-[-0.025em] text-ink">{stages[stage][0]}</p>
            <p className="mt-2 max-w-2xl text-[16px] leading-[1.65] text-ink/70" aria-live="polite">{stages[stage][1]}</p>
          </div>
        </div>
      </Card>
      <p className="mt-5 max-w-3xl text-[14.5px] leading-relaxed text-ink/60">
        {t(
          "Every recommendation on your dashboard has a “How was this decided?” panel that shows these five steps with your actual numbers. New evidence, a market update or a role change re-runs the engine and the change is saved with its reason.",
          "Setiap rekomendasi di dashboard-mu punya panel “Bagaimana ini diputuskan?” yang menunjukkan lima langkah ini dengan angka milikmu. Evidence baru, update pasar, atau pergantian role menjalankan ulang engine dan perubahannya disimpan beserta alasannya.",
        )}
      </p>
    </Section>
  );
}

/** one model: what it is for, its name, how it is used */
function ModelCard({ icon: Icon, role, name, children, delay }: { icon: LucideIcon; role: string; name: ReactNode; children: ReactNode; delay: number }) {
  return (
    <Rise delay={delay} className="h-full">
      <Card className="h-full">
        <span className="p-icon flex size-10 items-center justify-center rounded-[12px] text-white">
          <Icon className="size-5" strokeWidth={2.1} aria-hidden="true" />
        </span>
        <p className="mt-5 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{role}</p>
        <p className="mt-1.5 break-words text-[19px] font-bold leading-snug tracking-[-0.02em] text-ink">{name}</p>
        <div className="mt-2.5 space-y-3 text-[14.5px] leading-relaxed text-ink/65">{children}</div>
      </Card>
    </Rise>
  );
}

function Models({ c }: { c: ModelCard }) {
  const t = useT();
  const lang = useLang();
  const tx = (s: string | null) => idText(s, lang);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <ModelCard icon={Scale} delay={0} role={t("Decides priorities", "Memutuskan prioritas")} name={c.decision_model.name}>
        <p>{c.decision_model.type}. {t("Chosen because", "Dipilih karena")} {c.decision_model.why}.</p>
        {c.validation ? (
          <p className="rounded-2xl bg-[#fff6d9] px-4 py-3 text-[13px] font-medium leading-relaxed text-ember-ink">
            {t(
              `Beta: ${c.validation.graph_experts ?? c.validation.real_experts} experts reviewed the Business Analyst prerequisite graph; ${c.validation.decision_study?.experts ?? 0} expert judged the priority order on ${c.validation.decision_study?.ranking_scenarios ?? 0} scenarios. ${c.validation.ranker_trained_on ? `Trained on ${c.validation.ranker_trained_on}.` : "No trained model is active."}`,
              `Beta: ${c.validation.graph_experts ?? c.validation.real_experts} pakar menilai graf prasyarat Business Analyst; ${c.validation.decision_study?.experts ?? 0} pakar menilai urutan prioritas pada ${c.validation.decision_study?.ranking_scenarios ?? 0} skenario. ${c.validation.ranker_trained_on ? `Dilatih dengan ${c.validation.ranker_trained_on}.` : "Belum ada model terlatih yang aktif."}`,
            )}
          </p>
        ) : null}
        {c.validation?.decision_study?.ndcg5 ? (
          <p className="text-[13px] text-ink/60">
            {t(
              `Human check (1 Business Analyst expert, ${c.validation.decision_study.ranking_scenarios} scenarios, PathSync's answers hidden): NDCG@5 ${num(c.validation.decision_study.ndcg5.pathsync_formula5, 3)} for the formula, ${num(c.validation.decision_study.ndcg5.gap_x_demand, 3)} for gap × demand and ${num(c.validation.decision_study.ndcg5.biggest_gap, 3)} for biggest gap. Early agreement with one judge, not a general proof.`,
              `Uji manusia (1 pakar Business Analyst, ${c.validation.decision_study.ranking_scenarios} skenario, jawaban PathSync disembunyikan): NDCG@5 ${num(c.validation.decision_study.ndcg5.pathsync_formula5, 3)} untuk formula, ${num(c.validation.decision_study.ndcg5.gap_x_demand, 3)} untuk gap × demand, dan ${num(c.validation.decision_study.ndcg5.biggest_gap, 3)} untuk gap terbesar. Ini kesesuaian awal dengan satu penilai, bukan bukti umum.`,
            )}
          </p>
        ) : null}
      </ModelCard>
      <ModelCard
        icon={FileSearch}
        delay={90}
        role={t("Reads job postings (language understanding only)", "Membaca job posting (hanya pemahaman bahasa)")}
        name={c.extraction_llm.active_for_market_map === "llm" ? c.extraction_llm.runtime : t("Keyword and phrase matching (no LLM)", "Pencocokan kata kunci dan frasa (tanpa LLM)")}
      >
        <p>
          {c.extraction_llm.active_for_market_map === "llm"
            ? `${tx(c.extraction_llm.runtime_provider)}. ${t("Gates", "Gerbang")}: ${tx(c.extraction_llm.gates)}.`
            : t(
                `The market map is read by a transparent lexicon matcher, which beat the LLM on the test postings. Gates: ${c.extraction_llm.gates}.`,
                `Peta pasar dibaca oleh lexicon matcher yang transparan, yang lebih akurat daripada LLM pada lowongan uji. Gerbang: ${tx(c.extraction_llm.gates)}.`,
              )}
        </p>
        <p>
          {c.extraction_llm.runtime
            ? t(`CVs and project rubrics are read by ${c.extraction_llm.runtime} (${c.extraction_llm.runtime_provider}); every rating needs a verbatim quote and 20% are sampled for human review.`,
                `CV dan rubrik proyek dibaca oleh ${c.extraction_llm.runtime} (${tx(c.extraction_llm.runtime_provider)}); setiap nilai wajib berkutipan dan 20% diambil acak untuk ditinjau manusia.`)
            : t("CVs and project rubrics are read by keyword rules with verbatim quotes (no LLM active).",
                "CV dan rubrik proyek dibaca dengan aturan kata kunci berkutipan (LLM tidak aktif).")}
        </p>
        <p className="text-[13px] text-ink/55">{t("Offline comparison run", "Uji perbandingan offline")}: {c.extraction_llm.offline_run}.</p>
      </ModelCard>
      <ModelCard icon={Link2} delay={0} role={t("Matches phrases and course names to skills", "Mencocokkan frasa dan nama mata kuliah ke skill")} name={c.embedding_model.name}>
        <p>{c.embedding_model.use}.</p>
      </ModelCard>
      <ModelCard icon={Activity} delay={90} role={t("Updates mastery after each answer", "Memperbarui mastery setiap jawaban")} name={tx(c.knowledge_tracing.type)}>
        <div className="flex flex-wrap gap-2">
          {([["Slip", c.knowledge_tracing.slip], [t("Guess", "Tebakan"), c.knowledge_tracing.guess], [t("Learning", "Laju belajar"), c.knowledge_tracing.learn]] as [string, number][]).map(([k, v]) => (
            <span key={k} className="rounded-full bg-muted/80 px-3 py-1 text-[13px] font-medium text-ink/75">{k} <b className="tabular text-ink">{v}</b></span>
          ))}
        </div>
      </ModelCard>
      <Rise className="md:col-span-2">
        <Card className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            <ShieldCheck className="size-5 text-mint" aria-hidden="true" />
            {t("An LLM is never used for", "LLM tidak pernah dipakai untuk")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {c.llm_is_never_used_for.map((x) => (
              <li key={x} className="rounded-full bg-[#e3f5ea] px-3 py-1 text-[13px] font-semibold text-mint-ink">{tx(x)}</li>
            ))}
          </ul>
        </Card>
      </Rise>
    </div>
  );
}

function Taxonomy({ g }: { g: Governance }) {
  const t = useT();
  const adjacent = g.skills.filter((s) => s.status === "adjacent");
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", g.final ? "bg-[#e3f5ea] text-mint" : "bg-[#fff6d9] text-ember-ink")}>
            {g.final ? <CheckCircle2 className="size-6" aria-hidden="true" /> : <XCircle className="size-6" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[22px] font-bold leading-snug tracking-[-0.025em] text-ink">
              {g.final ? "Final" : t("Not final yet", "Belum final")}:{" "}
              {t(`${g.n_core} core skills for ${g.role_name}, plus ${g.adjacent_skills.length} adjacent skills`, `${g.n_core} core skill untuk ${g.role_name}, plus ${g.adjacent_skills.length} adjacent skill`)}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink/60">
              {t("Version", "Versi")} {g.version}, {t("frozen by", "dibekukan dengan")} SHA-256{" "}
              <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-ink/75">{g.sha256.slice(0, 16)}…</code>,{" "}
              {t(`checked on ${g.n_postings} postings and ${g.n_mentions} extracted skill mentions.`, `diperiksa pada ${g.n_postings} posting dan ${g.n_mentions} penyebutan skill hasil ekstraksi.`)}
            </p>
          </div>
        </div>
        <ul className="mt-7 grid gap-3 sm:grid-cols-3">
          {Object.entries(g.criteria).map(([k, c]) => (
            <li key={k} className="rounded-[20px] bg-background/80 p-5 ring-1 ring-inset ring-black/[0.05]">
              <div className="flex items-center justify-between gap-2">
                <p className="tabular text-[28px] font-bold leading-none tracking-[-0.04em] text-ink">{typeof c.value === "number" ? pct(c.value, 1) : c.value}</p>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", c.pass ? "bg-[#e3f5ea] text-mint-ink" : "bg-[#fff6d9] text-ember-ink")}>
                  {c.pass ? t("Pass", "Lulus") : t("Fail", "Gagal")}
                </span>
              </div>
              <p className="mt-3 text-[13.5px] font-medium leading-snug text-ink/80">{CRITERIA[k] ? t(...CRITERIA[k]) : k}</p>
              {c.target != null ? <p className="mt-1 text-[12px] text-muted-foreground">target {typeof c.target === "number" ? pct(c.target) : c.target}</p> : null}
            </li>
          ))}
        </ul>
      </Card>
      <details className="p-card group rounded-[24px] px-6 py-4 sm:px-7">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-1 text-[15px] font-semibold tracking-[-0.01em] text-ink [&::-webkit-details-marker]:hidden">
          {t(
            `Catalog details: ${adjacent.length} adjacent skills, candidates for the next version, changelog`,
            `Detail katalog: ${adjacent.length} adjacent skill, kandidat versi berikutnya, changelog`,
          )}
          <ChevronDown className="size-4 shrink-0 text-ink/50 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="details-body space-y-6 pb-3 pt-5">
          <div>
            <p className="mb-2.5 text-[13px] font-semibold text-ink">{t("Adjacent skills (core for related careers, rare in this one)", "Adjacent skill (inti di karier terkait, jarang di karier ini)")}</p>
            <ul className="flex flex-wrap gap-2">
              {adjacent.map((s) => (
                <li key={s.skill_id} className="rounded-full bg-muted/80 px-3 py-1 text-[12.5px] font-medium text-ink/75">
                  {titleCase(s.name)} <span className="tabular text-ink/45">{pct(s.posting_share)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2.5 text-[13px] font-semibold text-ink">{t("Most frequent uncovered phrases (candidates for the next version)", "Frasa tak tercakup yang paling sering (kandidat versi berikutnya)")}</p>
            <ul className="flex flex-wrap gap-2">
              {g.new_skill_candidates.slice(0, 8).map((c) => (
                <li key={c.label} className="rounded-full bg-card px-3 py-1 text-[12.5px] font-medium text-ink/75 ring-1 ring-black/[0.06]">
                  {c.label} <span className="tabular text-ink/45">{c.postings} {t("postings", "posting")}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2.5 text-[13px] font-semibold text-ink">Changelog</p>
            <ol className="space-y-2">
              {g.changelog.map((c) => (
                <li key={c.version} className="flex gap-3 text-[13.5px] leading-relaxed text-ink/70">
                  <span className="tabular shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-semibold text-ink/70">{c.version}</span>
                  {c.change}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </div>
  );
}

function Weights({ w }: { w: WeightsReport }) {
  const res = w.sensitivity?.sensitivity.results ?? {};
  const t = useT();
  const lang = useLang();
  const tx = (s: string | null | undefined) => idText(s, lang);
  const maxW = Math.max(...Object.values(w.active_weights));
  return (
    <div className="space-y-5">
      <Rise>
        <Card>
          <p className="max-w-3xl text-[15px] leading-relaxed text-ink/70">
            {t(
              "Combining independent noisy measurements of the same skill, the most accurate average weights each source by 1 / (its error)². The weights therefore state an explicit, testable assumption about how noisy each source is, relative to a direct skill check:",
              "Saat menggabungkan pengukuran independen yang ber-noise untuk skill yang sama, rata-rata paling akurat membobot tiap sumber dengan 1 / (error-nya)². Jadi bobot ini menyatakan asumsi eksplisit yang bisa diuji tentang seberapa ber-noise tiap sumber, dibandingkan Cek Kemampuan langsung:",
            )}
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="p-table">
              <thead>
                <tr>
                  <th>{t("Evidence", "Bukti")}</th>
                  <th className="w-[38%]">{t("Weight", "Bobot")}</th>
                  <th>{t("Assumed error vs skill check", "Asumsi error vs Cek Kemampuan")}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(w.active_weights).map(([k, v], i) => (
                  <tr key={k}>
                    <td className="font-semibold">{KIND[k] ? t(...KIND[k]) : k}</td>
                    <td>
                      <span className="flex items-center gap-3">
                        <GrowBar className="flex-1" value={v / maxW} delay={i * 80} />
                        <b className="w-10 text-right">{num(v)}</b>
                      </span>
                    </td>
                    <td className="text-ink/70">×{num(w.implied_error_ratio_vs_assessment[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 max-w-3xl text-[14px] leading-relaxed text-ink/60">
            {t(
              "The product checks the assumption itself: each later skill check is a direct measurement that earlier indirect evidence can be compared with. Once 30 such pairs exist, the weights are re-estimated and adopted only if they predict better.",
              "Produk ini menguji asumsinya sendiri: setiap Cek Kemampuan berikutnya adalah pengukuran langsung yang bisa dibandingkan dengan evidence tidak langsung sebelumnya. Begitu ada 30 pasangan seperti itu, bobot diestimasi ulang dan baru dipakai kalau prediksinya lebih baik.",
            )}{" "}
            {tx(w.sensitivity?.calibration?.message)}
          </p>
        </Card>
      </Rise>
      {Object.keys(res).length ? (
        <Rise>
          <Card>
            <p className="text-[19px] font-bold tracking-[-0.02em] text-ink">{t("Do recommendations depend on the exact numbers?", "Apakah rekomendasi bergantung pada angka persisnya?")}</p>
            <div className="mt-5 overflow-x-auto">
              <table className="p-table">
                <thead>
                  <tr>
                    <th>{t("Weights tried", "Bobot yang dicoba")}</th>
                    <th className="w-[34%]">{t("Same top 3", "Top 3 sama")}</th>
                    <th>{t("Mastery error", "Error mastery")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(res).map(([k, r], i) => (
                    <tr key={k}>
                      <td className="text-ink/80">{tx(k)}</td>
                      <td>
                        <span className="flex items-center gap-3">
                          <GrowBar className="flex-1" value={r.top3_overlap} delay={i * 70} color={r.top3_overlap >= 0.95 ? "var(--mint)" : "var(--indigo)"} />
                          <b className="w-11 text-right">{pct(r.top3_overlap)}</b>
                        </span>
                      </td>
                      <td className="text-ink/70">{num(r.mastery_mae, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[12.5px] text-muted-foreground">{tx(w.sensitivity?.sensitivity.assumption)}</p>
          </Card>
        </Rise>
      ) : null}
    </div>
  );
}

function Evaluation({ e }: { e: EvalReport }) {
  // hide a method with no data in any condition (the generic-LLM baseline is not available yet)
  const t = useT();
  const methods = Object.keys(METHOD).filter((m) => Object.values(e.conditions).some((c) => c.cv.methods[m]));
  return (
    <Rise>
      <Card>
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink/70">
          {t(
            `Simulation, not human judgement: NDCG@5 against rankings from simulated experts, grouped cross-validation over ${e.n_scenarios} synthetic scenarios, 95% bootstrap intervals. It checks that the training code works; it says nothing about real experts. The human result is in the Models section above.`,
            `Simulasi, bukan penilaian manusia: NDCG@5 terhadap urutan dari pakar simulasi, grouped cross-validation atas ${e.n_scenarios} skenario sintetis, interval bootstrap 95%. Ini memeriksa bahwa kode pelatihan berjalan, bukan kinerja terhadap pakar sungguhan. Hasil penilaian manusia ada di bagian Model di atas.`,
          )}
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="p-table">
            <thead>
              <tr>
                <th>{t("Condition", "Kondisi")}</th>
                {methods.map((m) => <th key={m}>{t(...METHOD[m])}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(e.conditions).map(([k, c]) => {
                const best = Math.max(...methods.map((m) => c.cv.methods[m]?.ndcg5.mean ?? 0));
                return (
                  <tr key={k}>
                    <td className="font-semibold">{COND[k] ? t(...COND[k]) : k}</td>
                    {methods.map((m) => {
                      const v = c.cv.methods[m]?.ndcg5.mean;
                      return (
                        <td key={m} className={v === best ? "font-bold text-indigo" : "text-ink/70"}>
                          {v != null ? num(v, 3) : "–"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[12.5px] text-muted-foreground">{t("Highest value in each row in blue.", "Nilai tertinggi di tiap baris berwarna biru.")}</p>
      </Card>
    </Rise>
  );
}
