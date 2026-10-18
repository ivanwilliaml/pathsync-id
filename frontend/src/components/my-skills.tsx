"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Flame, ShieldCheck, Sparkles, Target } from "lucide-react";
import { api, type Competency, type Dashboard, type SoftSkill } from "@/lib/api";
import { LEVEL, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErrorNote, LinkButton, Loading, MasteryBar, Panel, Tag } from "./kit";
import { useT } from "@/lib/i18n";

/** Only skills that a meaningful share of postings ask for (or that the route already ranks) appear on the map. */
const RELEVANT_DEMAND = 0.15;

type Status = "fix" | "strong" | "close" | "unproven";

interface Row {
  c: Competency;
  status: Status;
  rank: number | null;
  why: string | null;
}

/** Plain-language status of one skill from the role requirement, the student's level and whether there is any evidence. */
function classify(c: Competency, rank: number | null): Status {
  const hasEvidence = Object.keys(c.components ?? {}).length > 0 || c.n_items > 0;
  if (c.required != null && c.p >= c.required) return "strong";
  if (rank != null && rank <= 5) return "fix";
  if (!hasEvidence) return "unproven";
  if (c.gap <= 0.2) return "close";
  return "fix";
}

const SECTIONS: { id: Status; title: [string, string]; blurb: [string, string]; icon: typeof Flame; tone: "ember" | "mint" | "indigo" | "neutral" }[] = [
  { id: "fix", title: ["Fix First", "Perbaiki Dulu"], blurb: ["Employers ask for these a lot and you are below the level they need. Start here.", "Sering diminta employer dan level kamu masih di bawah yang dibutuhkan. Mulai dari sini."], icon: Flame, tone: "ember" },
  { id: "close", title: ["Almost There", "Hampir Sampai"], blurb: ["A little more proof gets you to the level the role needs.", "Sedikit bukti lagi dan kamu sampai di level yang dibutuhkan role ini."], icon: Target, tone: "indigo" },
  { id: "strong", title: ["Your Strengths", "Kekuatanmu"], blurb: ["You already meet the level employers ask for. Keep the proof ready.", "Kamu sudah memenuhi level yang diminta employer. Simpan buktinya."], icon: ShieldCheck, tone: "mint" },
  { id: "unproven", title: ["Not Proven Yet", "Belum Terbukti"], blurb: ["In demand, but we have no evidence from you. Take a quick check or add a project.", "Banyak dicari, tapi belum ada evidence darimu. Ikuti Quick Check atau tambahkan project."], icon: Sparkles, tone: "neutral" },
];

export function MySkills({ sid }: { sid: string }) {
  const { data: d, error } = useApi<Dashboard>(`/students/${sid}/dashboard`);
  const t = useT();
  const [open, setOpen] = useState<Record<string, boolean>>({ fix: true, close: true, strong: true, unproven: true });
  const rows = useMemo<Row[]>(() => {
    if (!d) return [];
    const rank = Object.fromEntries(d.ranking.map((r) => [r.skill_id, r]));
    return d.competencies.filter((c) => c.demand >= RELEVANT_DEMAND || (rank[c.skill_id]?.rank ?? 99) <= 5).map((c) => {
      const r = rank[c.skill_id];
      return { c, rank: r?.rank ?? null, why: r?.explanation ? r.explanation.why_now : null, status: classify(c, r?.rank ?? null) };
    });
  }, [d]);
  if (error) return <ErrorNote error={error} />;
  if (!d) return <Loading label={t("Reading your skills…", "Membaca skill-mu…")} />;

  const by = (s: Status) =>
    rows
      .filter((r) => r.status === s)
      .sort((a, b) => (s === "fix" ? (a.rank ?? 99) - (b.rank ?? 99) : b.c.demand - a.c.demand));
  const strongest = by("strong").slice(0, 3);
  const fixFirst = by("fix").slice(0, 3);

  return (
    <div className="space-y-6">
      <Panel className="bg-route-soft">
        <h2 className="text-lg font-semibold text-ink">{t("Where You Stand for", "Posisimu untuk")} {d.role.name}</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <Summary label={t("Role readiness", "Readiness role")} value={pct(d.coverage)} note={t("of what employers ask for, weighted by how often", "dari yang diminta employer, dibobot seberapa sering")} />
          <Summary label={t("Strongest", "Terkuat")} value={strongest.length ? strongest.map((r) => titleCase(r.c.name)).join(", ") : t("Nothing proven yet", "Belum ada yang terbukti")} note={t("skills at or above the required level", "skill di atas atau sama dengan level yang dibutuhkan")} small />
          <Summary label={t("Fix first", "Perbaiki dulu")} value={fixFirst.length ? fixFirst.map((r) => titleCase(r.c.name)).join(", ") : t("Nothing urgent", "Tidak ada yang mendesak")} note={t("biggest gap that employers care about", "gap terbesar yang dipedulikan employer")} small />
        </div>
        <p className="mt-4 text-xs text-ink/65">
          {t(
            `How to read each bar: the solid part is your level now, the light part runs to the level employers ask for, and the bar turns green once you reach it. Only skills asked for in at least 15% of the ${d.role.n_postings} real postings, or in your top five priorities, are shown.`,
            `Cara membaca bar: bagian pekat adalah level kamu sekarang, bagian muda sampai ke level yang diminta employer, dan bar berubah hijau begitu kamu mencapainya. Yang ditampilkan hanya skill yang diminta di minimal 15% dari ${d.role.n_postings} job posting nyata, atau yang masuk lima prioritas teratasmu.`,
          )}
        </p>
      </Panel>

      {SECTIONS.map((sec) => {
        const list = by(sec.id);
        if (!list.length) return null;
        const Icon = sec.icon;
        return (
          <section key={sec.id} aria-labelledby={`sec-${sec.id}`}>
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [sec.id]: !o[sec.id] }))}
              aria-expanded={open[sec.id]}
              className="mb-3 flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-5 text-indigo" aria-hidden="true" />
                <span id={`sec-${sec.id}`} className="text-lg font-semibold text-ink">
                  {t(...sec.title)}
                </span>
                <Tag tone={sec.tone}>{list.length}</Tag>
              </span>
              <ChevronDown className={cn("size-4 transition-transform", open[sec.id] && "rotate-180")} aria-hidden="true" />
            </button>
            <p className="-mt-1 mb-3 text-sm text-ink/70">{t(...sec.blurb)}</p>
            {open[sec.id] ? (
              <ul className="grid gap-4 md:grid-cols-2">
                {list.map((r) => (
                  <SkillRow key={r.c.skill_id} r={r} />
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}

      <SoftSection sid={sid} items={(d.soft_skills ?? []).filter((x) => x.demand >= RELEVANT_DEMAND)} />
    </div>
  );
}

const EXPERIENCE = [
  [0, "No experience yet", "Belum ada pengalaman"],
  [1, "Tried it (class, club, event)", "Pernah mencoba (kelas, organisasi, acara)"],
  [2, "Regular (project, internship, job)", "Rutin (project, magang, kerja)"],
  [3, "Led or taught others", "Memimpin atau mengajari orang lain"],
] as const;

/** Soft skills are shown beside the hard skills but are never quizzed or ranked: the student records real experience. */
function SoftSection({ sid, items }: { sid: string; items: SoftSkill[] }) {
  const [local, setLocal] = useState<Record<string, { level: number; note: string }>>({});
  const t = useT();
  if (!items.length) return null;
  const save = (id: string, level: number, note: string) => {
    setLocal((l) => ({ ...l, [id]: { level, note } }));
    api.put(`/students/${sid}/soft-experience`, { skill_id: id, level, note }).catch(() => toast.error(t("Could not save. Try again.", "Gagal menyimpan. Coba lagi.")));
  };
  return (
    <section aria-labelledby="sec-soft">
      <h2 id="sec-soft" className="text-lg font-semibold text-ink">{t("Soft Skills From Experience", "Soft Skill dari Pengalaman")}</h2>
      <p className="mb-3 text-sm text-ink/70">
        {t(
          "Employers ask for these too, but they are built through real experience, so there is no quiz and they never change your route. Record what you have actually done.",
          "Employer juga meminta ini, tapi soft skill dibangun lewat pengalaman nyata, jadi tidak ada kuis dan tidak mengubah rutemu. Catat apa yang benar-benar sudah kamu lakukan.",
        )}
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((x) => {
          const cur = local[x.skill_id] ?? { level: x.level, note: x.note };
          return (
            <li key={x.skill_id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold leading-snug text-ink">{x.name}</p>
                <Tag tone="neutral">{t(`Asked in ${pct(x.demand)} of postings`, `Diminta di ${pct(x.demand)} posting`)}</Tag>
              </div>
              <label className="mt-3 block text-xs font-medium text-ink/70" htmlFor={`exp-${x.skill_id}`}>{t("Your experience", "Pengalamanmu")}</label>
              <select
                id={`exp-${x.skill_id}`}
                value={cur.level}
                onChange={(e) => save(x.skill_id, Number(e.target.value), cur.note)}
                className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm"
              >
                {EXPERIENCE.map(([v, en, id]) => (
                  <option key={v} value={v}>{t(en, id)}</option>
                ))}
              </select>
              {cur.level > 0 ? (
                <input
                  aria-label={t(`Example for ${x.name}`, `Contoh untuk ${x.name}`)}
                  defaultValue={cur.note}
                  maxLength={240}
                  placeholder={t("One example, e.g. capstone team of 4", "Satu contoh, mis. tim capstone 4 orang")}
                  onBlur={(e) => e.target.value !== cur.note && save(x.skill_id, cur.level, e.target.value)}
                  className="mt-2 w-full rounded-lg border bg-card px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-ink/65">{x.how_to_build}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Summary({ label, value, note, small }: { label: string; value: string; note: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-card p-4">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      <p className={cn("mt-1 font-bold leading-snug text-ink", small ? "text-[15px]" : "text-[28px]")}>{value}</p>
      <p className="mt-1 text-xs text-ink/60">{note}</p>
    </div>
  );
}

function SkillRow({ r }: { r: Row }) {
  const { c } = r;
  const t = useT();
  const tone = r.status === "strong" ? "mint" : "indigo";
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-ink">{titleCase(c.name)}</p>
          <p className="mt-0.5 text-xs text-ink/65">
            {LEVEL[c.level] ? t(...LEVEL[c.level]) : c.level} {t("now", "sekarang")}{c.required != null ? t(`, role needs ${t(...levelFor(c.required))}`, `, role butuh ${t(...levelFor(c.required))}`) : ""} · {t(`asked in ${pct(c.demand)} of postings`, `diminta di ${pct(c.demand)} posting`)}
          </p>
        </div>
        {r.rank ? <Tag tone="indigo">{t("Priority", "Prioritas")} #{r.rank}</Tag> : null}
      </div>
      <MasteryBar value={c.p} target={c.required} tone={tone} className="mt-3" />
      {r.why ? <p className="mt-2 text-xs leading-relaxed text-ink/70">{r.why}</p> : null}
      {r.status !== "strong" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton href={`/assessment/${c.skill_id}`} size="sm" variant="outline">
            {Object.keys(c.components ?? {}).length || c.n_items ? t("Prove It", "Buktikan") : t("Take a Quick Check", "Ikuti Quick Check")}
          </LinkButton>
          <LinkButton href="/dashboard" size="sm" variant="ghost">
            {t("See Route", "Lihat Rute")}
          </LinkButton>
        </div>
      ) : (
        <p className="mt-2 text-xs text-mint-ink">{c.n_items ? t(`${c.n_correct}/${c.n_items} check answers correct`, `${c.n_correct}/${c.n_items} jawaban check benar`) : t("Shown by your evidence", "Ditunjukkan oleh evidence-mu")}</p>
      )}
    </li>
  );
}

function levelFor(x: number): [string, string] {
  return x >= 0.8 ? LEVEL.mahir : x >= 0.6 ? LEVEL.mandiri : x >= 0.35 ? LEVEL.dasar : LEVEL.awal;
}
