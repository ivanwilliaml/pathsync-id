"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BadgeCheck, Briefcase, Route as RouteIcon } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./ui/button";
import { Mascot, type MascotName } from "./mascot";

const HOT = "#e8613f";

/* ---------- small motion helpers: no library, and every one of them stands still with reduced motion ---------- */

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** true once the element has scrolled into view (and stays true) */
function useSeen<T extends Element>(margin = "0px 0px -15% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) return setSeen(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, seen] as const;
}

/** fades and lifts its children in when they scroll into view; `delay` staggers siblings */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("reveal", className)} data-shown={seen} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** a number that counts up once it is seen */
function CountUp({ to, decimals = 0, suffix = "", locale = "id-ID" }: { to: number; decimals?: number; suffix?: string; locale?: string }) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (reducedMotion()) return setV(to);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 1400);
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, to]);
  return (
    <span ref={ref} className="tabular">
      {new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)}
      {suffix}
    </span>
  );
}

/** 0 → 1 as the element travels from the bottom of the screen to the middle */
function useScrollProgress<T extends Element>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return setP(1);
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setP(Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.6 + r.height * 0.5))));
    };
    const on = () => (raf ||= requestAnimationFrame(read));
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => (window.removeEventListener("scroll", on), window.removeEventListener("resize", on), cancelAnimationFrame(raf));
  }, []);
  return [ref, p] as const;
}

/* ---------- 1. the problem ---------- */

/** One sentence that lights up word by word as you scroll, then the three numbers behind it (all from the paper). */
export function ProblemStory() {
  const t = useT();
  const [ref, p] = useScrollProgress<HTMLParagraphElement>();
  const words = t(
    "Learning materials are everywhere. What is missing is knowing what to learn, where from, and in which order.",
    "Materi belajar sudah ada di mana-mana. Yang belum ada: tahu harus belajar apa, dari mana, dan dalam urutan apa.",
  ).split(" ");
  const turn = words.findIndex((w) => /^(What|Yang)$/.test(w));
  const stats = [
    { n: 39, suffix: "%", text: t("of core job skills are expected to change by 2030", "keterampilan inti pekerjaan diperkirakan berubah hingga 2030"), src: "WEF, Future of Jobs 2025" },
    { n: 3, suffix: "%", text: t("of learners finish the online courses they start", "peserta menuntaskan kursus daring yang diikutinya"), src: "Reich & Ruipérez-Valiente, Science 2019" },
    { n: 1.03, decimals: 2, suffix: t(" million", " juta"), text: t("university graduates still not absorbed by the job market", "lulusan perguruan tinggi belum terserap pasar kerja"), src: "BPS, Sakernas Feb 2026" },
  ];
  // continuous, not word by word: each word sharpens, lifts and brightens over its own short stretch of the scroll
  const reach = p * 1.25 * words.length;
  const after = Math.max(1, words.length - turn - 1);
  return (
    <section className="blend overflow-hidden py-24 sm:py-32" style={{ ["--blend" as string]: "var(--route-soft)" }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex items-start gap-7">
          <Reveal className="reveal-soft hidden shrink-0 sm:block">
            <div className="problem-float">
              <Mascot name="thinking" size={120} />
            </div>
          </Reveal>
          <p ref={ref} className="text-[28px] font-bold leading-[1.18] tracking-[-0.028em] text-ink [word-spacing:0.08em] sm:text-[42px]">
            {words.map((w, i) => {
              const k = Math.max(0, Math.min(1, reach - i));
              const second = i >= turn && turn >= 0;
              return (
                <Fragment key={i}>
                {/* the answer always starts its own line */}
                {i === turn && turn > 0 ? <br /> : null}
                <span
                  className="inline-block will-change-[opacity,filter,transform]"
                  style={{
                    opacity: 0.14 + 0.86 * k,
                    filter: k < 1 ? `blur(${(1 - k) * 3}px)` : undefined,
                    transform: k < 1 ? `translateY(${(1 - k) * 0.12}em)` : undefined,
                    // the answer flows from the brand blue into the chameleon green, word by word
                    color: second ? `color-mix(in oklab, var(--indigo) ${100 - ((i - turn) / after) * 55}%, var(--iris))` : undefined,
                  }}
                >
                  {w}
                </span>{" "}
                </Fragment>
              );
            })}
          </p>
        </div>
        <div className="mt-20 grid gap-12 sm:grid-cols-3 sm:gap-10">
          {stats.map((s, i) => (
            <Reveal key={s.src} delay={i * 140} className="reveal-soft">
              {/* a hairline draws in above each number, the way spec sheets separate their figures */}
              <span className="stat-line" style={{ transitionDelay: `${i * 140 + 150}ms` }} aria-hidden="true" />
              <p className="stat-num mt-6 text-[56px] font-bold leading-none tracking-[-0.045em] sm:text-[64px]">
                <CountUp to={s.n} decimals={s.decimals ?? 0} />
                <span className={cn("stat-unit", s.suffix.trim().length > 1 ? "ml-1.5 text-[0.42em] tracking-[-0.02em]" : "ml-0.5 text-[0.55em]")}>{s.suffix.trim()}</span>
              </p>
              <p className="mt-4 max-w-[18rem] text-[15px] leading-relaxed text-ink/70">{s.text}</p>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground/90">
                <span className="size-1 rounded-full bg-indigo/40" aria-hidden="true" />
                {s.src}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. one cycle, with Sync walking it ---------- */

type Step = { pose: MascotName; tint: string; title: string; body: string; visual: ReactNode };

/** The five steps of one learning cycle. Sync stays beside them on wide screens, changes pose at every step, and the
 * route line fills as you go; on phones each step carries its own small Sync. The sample numbers match the worked
 * example in the paper (SQL 0.35 → 0.72). */
export function CycleStory() {
  const t = useT();
  const steps: Step[] = [
    {
      pose: "magnifier",
      tint: "var(--indigo)",
      title: t("See where you stand", "Lihat posisimu sekarang"),
      body: t("Your transcript, certificates, projects and a short skill check become one level per skill. Grades count least; claims never count.", "Transkrip, sertifikat, project, dan Cek Kemampuan singkat jadi satu level per skill. Nilai kuliah paling ringan; klaim tidak dihitung."),
      visual: <DiagnosisVisual />,
    },
    {
      pose: "compass",
      tint: HOT,
      title: t("Find the bottleneck", "Temukan titik hambatnya"),
      body: t("Not the weakest skill, but the one holding up the most skills employers ask for.", "Bukan skill terlemah, tapi skill yang menahan paling banyak skill lain yang diminta employer."),
      visual: <BottleneckVisual />,
    },
    {
      pose: "map-route",
      tint: "var(--iris)",
      title: t("Get your route", "Dapatkan rutemu"),
      body: t("Steps in the order that opens the way, each with the reason it comes now.", "Langkah dengan urutan yang membuka jalan, masing-masing dengan alasan kenapa sekarang."),
      visual: <RouteVisual />,
    },
    {
      pose: "stopwatch",
      tint: "var(--ember)",
      title: t("Learn from what already exists", "Belajar dari materi yang sudah ada"),
      body: t("Open courses and videos picked for each step, a weekly plan, and an estimate of when you'll be ready.", "Kursus dan video terbuka yang dipilih untuk tiap langkah, rencana mingguan, dan perkiraan kapan kamu siap."),
      visual: <LearnVisual />,
    },
    {
      pose: "shift-route",
      tint: "var(--mint)",
      title: t("Prove it, and the route moves", "Buktikan, rutenya ikut bergerak"),
      body: t("New evidence updates your level, and the next priority changes with it. The route follows you, not a fixed syllabus.", "Bukti baru memperbarui levelmu, dan prioritas berikutnya ikut berubah. Rute mengikuti kamu, bukan silabus yang kaku."),
      visual: <ProofVisual />,
    },
  ];

  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const s = steps[active];

  return (
    <section className="bg-background py-24 sm:py-32" id="how">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="reveal-soft">
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-indigo">{t("How it works", "Cara kerja")}</p>
          <h2 className="mt-2 max-w-2xl text-balance text-[32px] font-extrabold leading-[1.08] tracking-[-0.032em] text-ink sm:text-[44px]">
            {t("One cycle, repeated", "Satu siklus, diulang")} <span className="hero-grad">{t("until you're ready.", "sampai kamu siap.")}</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-10 lg:grid-cols-[300px_1fr]">
          {/* Sync, pinned beside the steps */}
          <div className="hidden lg:block">
            <div className="sticky top-28 flex flex-col items-center">
              <div className="relative flex size-60 items-center justify-center">
                <span className="absolute inset-6 rounded-full opacity-25 blur-2xl transition-colors duration-700" style={{ background: s.tint }} aria-hidden="true" />
                <Mascot key={s.pose} name={s.pose} size={190} className="mascot-pop relative" />
              </div>
              {/* five segments, one per step: done ones keep their colour, the current one stretches (iOS page indicator) */}
              <div className="mt-6 w-full">
                <div className="flex items-center gap-1.5" role="group" aria-label={t("Steps", "Langkah")}>
                  {steps.map((x, i) => (
                    <button
                      key={x.title}
                      type="button"
                      onClick={() => refs.current[i]?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" })}
                      aria-label={`${t("Step", "Langkah")} ${i + 1}: ${x.title}`}
                      aria-current={i === active ? "step" : undefined}
                      className="cycle-seg h-1.5 rounded-full"
                      style={{ flexGrow: i === active ? 3 : 1, background: i <= active ? x.tint : "color-mix(in oklab, var(--ink) 9%, transparent)" }}
                    />
                  ))}
                </div>
                <p key={active} className="smh-caption mt-3 text-[13px] font-semibold tracking-[-0.01em] text-ink">
                  <span className="tabular text-muted-foreground">{active + 1}/{steps.length}</span>
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  {s.title}
                </p>
              </div>
            </div>
          </div>

          <ol className="space-y-6 lg:space-y-[14vh] lg:pb-[12vh]">
            {steps.map((st, i) => (
              <li key={st.title} ref={(el) => void (refs.current[i] = el)} data-i={i}>
                <Reveal className="reveal-soft">
                  {/* the step being read is lit in its own colour; on wide screens the others step back a little */}
                  <article
                    data-active={active === i}
                    className="cycle-card grid items-center gap-7 rounded-[28px] bg-card p-6 sm:grid-cols-[1fr_1.05fr] sm:p-9"
                    style={{ ["--tint" as string]: st.tint }}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <Mascot name={st.pose} size={56} className="lg:hidden" />
                        <span className="cycle-num flex size-9 items-center justify-center rounded-full text-sm font-bold text-white tabular" style={{ background: st.tint }}>{i + 1}</span>
                      </div>
                      <h3 className="mt-5 text-[24px] font-bold leading-[1.2] tracking-[-0.022em] text-ink">{st.title}</h3>
                      <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink/65">{st.body}</p>
                    </div>
                    <div className="cycle-panel rounded-[20px] p-5">{st.visual}</div>
                  </article>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* the small pictures inside each step: sample values, the same shapes the app shows */

function Bar({ v, need, tone = "var(--indigo)" }: { v: number; need?: number; tone?: string }) {
  const [ref, seen] = useSeen<HTMLSpanElement>();
  return (
    <span ref={ref} className="relative block h-1.5 overflow-hidden rounded-full bg-muted">
      {need ? <span className="absolute inset-y-0 left-0 rounded-full bg-indigo/15" style={{ width: `${need * 100}%` }} /> : null}
      <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[1300ms] ease-[cubic-bezier(.32,.72,0,1)]" style={{ width: seen ? `${v * 100}%` : "0%", background: tone }} />
    </span>
  );
}

function DiagnosisVisual() {
  const t = useT();
  const rows: [string, number, string][] = [
    ["Microsoft Excel", 0.8, t("Certificate", "Sertifikat")],
    [t("Requirements elicitation", "Elisitasi Kebutuhan"), 0.6, t("Skill check", "Cek Kemampuan")],
    [t("SQL & queries", "SQL & Kueri Basis Data"), 0.35, t("Transcript", "Transkrip")],
  ];
  return (
    <ul className="space-y-3 text-sm">
      {rows.map(([name, v, src]) => (
        <li key={name}>
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-ink">{name}</span>
            <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-ink/65 ring-1 ring-black/[0.05]">{src}</span>
          </span>
          <span className="mt-1.5 block"><Bar v={v} need={0.8} /></span>
        </li>
      ))}
    </ul>
  );
}

function BottleneckVisual() {
  const t = useT();
  return (
    <div className="text-sm">
      <div className="rounded-2xl border-2 bg-card p-3.5" style={{ borderColor: HOT, boxShadow: `0 0 0 4px color-mix(in oklab, ${HOT} 15%, transparent), 0 10px 24px -14px ${HOT}` }}>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: HOT }}>{t("Bottleneck", "Titik hambat")}</span>
        <p className="mt-2 font-semibold text-ink">{t("SQL & queries", "SQL & Kueri Basis Data")}</p>
      </div>
      <div className="ml-6 mt-2 space-y-2 border-l-2 border-dashed pl-4" style={{ borderColor: HOT }}>
        {[t("Data analysis", "Analisis Data"), t("Data visualization", "Visualisasi Data")].map((x) => (
          <p key={x} className="rounded-xl bg-card px-3.5 py-2.5 text-ink/70 ring-1 ring-black/[0.05]">{x}, <span className="text-xs">{t("waiting", "tertahan")}</span></p>
        ))}
      </div>
    </div>
  );
}

function RouteVisual() {
  const t = useT();
  const stops = [
    [t("SQL & queries", "SQL & Kueri Basis Data"), t("ready now", "siap sekarang")],
    [t("Data analysis", "Analisis Data"), t("opens 2 skills", "membuka 2 skill")],
    [t("Data visualization", "Visualisasi Data"), t("asked in 41% of postings", "diminta di 41% lowongan")],
  ];
  return (
    <ol className="relative space-y-4 pl-7 text-sm">
      <span className="absolute bottom-2 left-[8px] top-2 w-[3px] rounded-full bg-route-v" aria-hidden="true" />
      {stops.map(([name, why], i) => (
        <li key={name} className="relative flex items-baseline justify-between gap-3">
          <span className="absolute -left-7 top-0.5 flex size-[19px] items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white" style={{ background: ["var(--indigo)", "var(--iris)", "var(--ember-ink)"][i] }}>{i + 1}</span>
          <span className="font-medium text-ink">{name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{why}</span>
        </li>
      ))}
    </ol>
  );
}

function LearnVisual() {
  const t = useT();
  return (
    <div className="space-y-2.5 text-sm">
      {[
        [t("Intro to SQL for data", "Pengantar SQL untuk data"), t("Open course, 12 h", "Kursus terbuka, 12 jam")],
        [t("SQL joins, step by step", "SQL join, langkah demi langkah"), t("Video, 2 h", "Video, 2 jam")],
      ].map(([a, b]) => (
        <p key={a} className="flex items-baseline justify-between gap-3 rounded-xl bg-card px-3.5 py-2.5 ring-1 ring-black/[0.05]">
          <span className="text-ink">{a}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{b}</span>
        </p>
      ))}
      <div className="flex items-baseline justify-between rounded-xl bg-secondary/70 px-3.5 py-2.5">
        <span className="text-ink/80">{t("Ready in", "Perkiraan siap")}</span>
        <span className="font-bold text-ink">{t("about 7 weeks", "± 7 minggu")}</span>
      </div>
    </div>
  );
}

function ProofVisual() {
  const t = useT();
  return (
    <div className="space-y-3 text-sm">
      <div>
        <span className="flex justify-between"><span className="text-ink">{t("SQL & queries", "SQL & Kueri Basis Data")}</span><span className="tabular text-ink/70">0,35 → <b className="text-ink">0,72</b></span></span>
        <span className="mt-1.5 block"><Bar v={0.72} need={0.8} tone="var(--mint)" /></span>
      </div>
      <p className="flex items-center gap-2 rounded-xl bg-card px-3.5 py-2.5 ring-1 ring-black/[0.05]">
        <span className="rounded-md bg-indigo px-1.5 py-0.5 text-[11px] font-bold text-white">#1</span>
        <span className="text-ink">{t("Data analysis moves up: its prerequisite is met", "Analisis Data naik: prasyaratnya terpenuhi")}</span>
      </p>
    </div>
  );
}

/* ---------- 4. what it stands on ---------- */

/** Numbers that can be checked, then the three rules the engine keeps. */
export function ProofStory({ postings, careers, skills, ndcg, onStart }: { postings?: number; careers?: number; skills?: number; ndcg?: number; onStart: () => void }) {
  const t = useT();
  const nums = [
    { v: postings, label: t("unique job postings read", "lowongan unik dibaca"), note: t("Karirhub (Kemnaker) and company career sites", "Karirhub (Kemnaker) dan situs karier perusahaan") },
    { v: careers, label: t("careers mapped", "karier dipetakan"), note: t("from tech to finance and HR", "dari teknologi sampai keuangan dan SDM") },
    { v: skills, label: t("skills in the taxonomy", "skill dalam taksonomi"), note: t("built on ESCO, validated by experts", "berbasis ESCO, divalidasi pakar") },
    { v: ndcg, decimals: 2, label: t("ranking check on simulated experts", "uji ranking dengan pakar simulasi"), note: t("NDCG@5, simulation, not human judgement", "NDCG@5, simulasi, bukan penilaian manusia") },
  ];
  const rules: [ReactNode, string, string][] = [
    [<Briefcase key="a" className="size-5" />, t("Real job postings.", "Lowongan nyata."), t("Every claim about demand links back to the posting it came from.", "Setiap klaim permintaan bisa ditelusuri ke lowongan asalnya.")],
    [<BadgeCheck key="b" className="size-5" />, t("Proof over claims.", "Bukti di atas klaim."), t("Skill checks and projects weigh more than grades; CV claims never count.", "Cek Kemampuan dan project lebih berat dari nilai; klaim di CV tidak dihitung.")],
    [<RouteIcon key="c" className="size-5" />, t("The right order.", "Urutan yang tepat."), t("Skills that unlock others come first, and every step says why.", "Skill yang membuka skill lain didahulukan, dan tiap langkah ada alasannya.")],
  ];
  const tints = ["var(--indigo)", "var(--mint)", "#6d5bd0"];
  return (
    <section className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
      <Reveal className="reveal-soft">
        <h2 className="max-w-3xl text-balance text-[32px] font-extrabold leading-[1.08] tracking-[-0.032em] text-ink sm:text-[44px]">
          {t("Built on data", "Dibangun dari data")} <span className="hero-grad">{t("you can check.", "yang bisa dicek.")}</span>
        </h2>
      </Reveal>
      {/* spec-sheet figures, the same way the numbers near the top of the page are shown */}
      <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {nums.map((x, i) => (
          <Reveal key={x.label} delay={i * 120} className="reveal-soft">
            <span className="stat-line" style={{ transitionDelay: `${i * 120 + 150}ms` }} aria-hidden="true" />
            <p className="stat-num mt-6 text-[52px] font-bold leading-none tracking-[-0.045em] sm:text-[58px]">
              {x.v != null ? <CountUp to={x.v} decimals={x.decimals ?? 0} /> : "–"}
            </p>
            <p className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-ink">{x.label}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{x.note}</p>
          </Reveal>
        ))}
      </div>
      {/* the three rules the engine keeps, as quiet cards */}
      <div className="mt-20 grid gap-5 sm:grid-cols-3">
        {rules.map(([icon, title, body], i) => (
          <Reveal key={title} delay={i * 110} className="reveal-soft h-full">
            <div className="p-card h-full rounded-[26px] p-7">
              <span className="proof-icon flex size-11 items-center justify-center rounded-[13px] text-white" style={{ ["--tint" as string]: tints[i] }}>{icon}</span>
              <p className="mt-6 text-[19px] font-bold tracking-[-0.02em] text-ink">{title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/65">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
      {/* closing: the page's promise once more, then the one action */}
      <Reveal className="reveal-soft mt-24">
        <div className="proof-cta relative overflow-hidden rounded-[36px] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div className="problem-float mx-auto w-fit">
            <Mascot name="celebrate" size={120} />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-[30px] font-extrabold leading-[1.08] tracking-[-0.032em] text-ink sm:text-[42px]">
            {t("Know exactly what to learn", "Tahu persis apa yang harus dipelajari")} <span className="hero-grad">{t("next", "berikutnya")}</span>
          </p>
          <p className="mt-4 text-[15px] font-medium text-ink/55">
            {t("Free to use", "Gratis dipakai")} <span className="mx-1.5 text-ink/25">·</span> {t("About 2 minutes to set up", "Sekitar 2 menit untuk mulai")}
          </p>
          <button type="button" onClick={onStart}
            className={cn(buttonVariants({ size: "lg" }), "hero-cta group mt-8 h-12 rounded-full px-7 text-[15px] font-semibold")}>
            {t("Start your path", "Mulai Path-mu")}
            <ArrowRight className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </div>
      </Reveal>
    </section>
  );
}
