"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, Briefcase, Route as RouteIcon } from "lucide-react";
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
  return (
    <section className="relative overflow-hidden bg-route-soft py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex items-start gap-6">
          <Reveal className="hidden shrink-0 sm:block">
            <Mascot name="thinking" size={120} />
          </Reveal>
          <p ref={ref} className="text-[28px] font-bold leading-[1.25] text-ink sm:text-[40px]">
            {words.map((w, i) => (
              <span
                key={i}
                className="transition-opacity duration-300"
                style={{ opacity: i / words.length < p * 1.15 ? 1 : 0.15, color: i >= turn && turn >= 0 ? "var(--indigo)" : undefined }}
              >
                {w}{" "}
              </span>
            ))}
          </p>
        </div>
        <div className="mt-16 grid gap-10 sm:grid-cols-3">
          {stats.map((s, i) => (
            <Reveal key={s.src} delay={i * 120}>
              <p className="text-[44px] font-extrabold leading-none text-indigo">
                <CountUp to={s.n} decimals={s.decimals ?? 0} suffix={s.suffix} />
              </p>
              <p className="mt-3 text-ink/80">{s.text}</p>
              <p className="mt-2 text-xs text-muted-foreground">{s.src}</p>
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
        <Reveal>
          <p className="text-[15px] font-semibold text-indigo">{t("How it works", "Cara kerja")}</p>
          <h2 className="mt-2 max-w-2xl text-[32px] font-extrabold leading-tight text-ink sm:text-[40px]">
            {t("One cycle, repeated until you're ready.", "Satu siklus, diulang sampai kamu siap.")}
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
              <div className="mt-6 flex w-full items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground">{t("Step", "Langkah")} {active + 1}/5</span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-route transition-[width] duration-700" style={{ width: `${((active + 1) / steps.length) * 100}%` }} />
                </span>
              </div>
            </div>
          </div>

          <ol className="space-y-6 lg:space-y-[22vh] lg:pb-[18vh]">
            {steps.map((st, i) => (
              <li key={st.title} ref={(el) => void (refs.current[i] = el)} data-i={i}>
                <Reveal>
                  <article className={cn("grid gap-6 rounded-[24px] border bg-card p-6 transition-[box-shadow,border-color] duration-500 sm:grid-cols-[1fr_1.05fr] sm:p-8", active === i && "lg:border-indigo/30 lg:shadow-[0_24px_60px_-36px_rgb(29_111_216/0.5)]")}>
                    <div>
                      <div className="flex items-center gap-3">
                        <Mascot name={st.pose} size={56} className="lg:hidden" />
                        <span className="flex size-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: st.tint }}>{i + 1}</span>
                      </div>
                      <h3 className="mt-4 text-[22px] font-bold leading-snug text-ink">{st.title}</h3>
                      <p className="mt-2 text-ink/70">{st.body}</p>
                    </div>
                    <div className="rounded-2xl border bg-background p-4">{st.visual}</div>
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
      <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out" style={{ width: seen ? `${v * 100}%` : "0%", background: tone }} />
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
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-ink/70">{src}</span>
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
      <div className="rounded-xl border-2 bg-card p-3" style={{ borderColor: HOT, boxShadow: `0 0 0 4px color-mix(in oklab, ${HOT} 15%, transparent)` }}>
        <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: HOT }}>{t("Bottleneck", "Titik hambat")}</span>
        <p className="mt-2 font-semibold text-ink">{t("SQL & queries", "SQL & Kueri Basis Data")}</p>
      </div>
      <div className="ml-6 mt-2 space-y-2 border-l-2 border-dashed pl-4" style={{ borderColor: HOT }}>
        {[t("Data analysis", "Analisis Data"), t("Data visualization", "Visualisasi Data")].map((x) => (
          <p key={x} className="rounded-lg border bg-card px-3 py-2 text-ink/70">{x}, <span className="text-xs">{t("waiting", "tertahan")}</span></p>
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
        <p key={a} className="flex items-baseline justify-between gap-3 rounded-lg border bg-card px-3 py-2">
          <span className="text-ink">{a}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{b}</span>
        </p>
      ))}
      <div className="flex items-baseline justify-between rounded-lg bg-secondary/70 px-3 py-2">
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
      <p className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
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
    { v: ndcg, decimals: 2, label: t("agreement with expert rankings", "kesesuaian dengan peringkat pakar"), note: t("NDCG@5, feasibility simulation", "NDCG@5, simulasi kelayakan") },
  ];
  const rules: [ReactNode, string, string][] = [
    [<Briefcase key="a" className="size-5" />, t("Real job postings.", "Lowongan nyata."), t("Every claim about demand links back to the posting it came from.", "Setiap klaim permintaan bisa ditelusuri ke lowongan asalnya.")],
    [<BadgeCheck key="b" className="size-5" />, t("Proof over claims.", "Bukti di atas klaim."), t("Skill checks and projects weigh more than grades; CV claims never count.", "Cek Kemampuan dan project lebih berat dari nilai; klaim di CV tidak dihitung.")],
    [<RouteIcon key="c" className="size-5" />, t("The right order.", "Urutan yang tepat."), t("Skills that unlock others come first, and every step says why.", "Skill yang membuka skill lain didahulukan, dan tiap langkah ada alasannya.")],
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <Reveal>
        <h2 className="max-w-2xl text-[32px] font-extrabold leading-tight text-ink sm:text-[40px]">
          {t("Built on data you can check.", "Dibangun dari data yang bisa dicek.")}
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-8 border-y py-10 sm:grid-cols-2 lg:grid-cols-4">
        {nums.map((x, i) => (
          <Reveal key={x.label} delay={i * 100}>
            <p className="text-[44px] font-extrabold leading-none text-indigo">{x.v != null ? <CountUp to={x.v} decimals={x.decimals ?? 0} /> : "–"}</p>
            <p className="mt-3 font-semibold text-ink">{x.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{x.note}</p>
          </Reveal>
        ))}
      </div>
      <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1fr_auto]">
        <ul className="grid gap-6 sm:grid-cols-3">
          {rules.map(([icon, title, body], i) => (
            <Reveal key={title} delay={i * 100}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-indigo">{icon}</span>
              <p className="mt-3 font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink/70">{body}</p>
            </Reveal>
          ))}
        </ul>
        <Reveal className="flex flex-col items-center gap-3">
          <Mascot name="celebrate" size={130} />
          <button type="button" onClick={onStart} className={buttonVariants({ size: "lg" })}>
            {t("Start your path", "Mulai Path-mu")}
          </button>
        </Reveal>
      </div>
    </section>
  );
}
