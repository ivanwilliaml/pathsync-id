"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Competency, type Dashboard, type SoftSkill } from "@/lib/api";
import { LEVEL, num, pct, titleCase } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { MasteryBar, Segmented } from "./kit";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { AllSkills, Areas } from "./skill-insights";
import { useT } from "@/lib/i18n";

/** Only skills that a meaningful share of postings ask for (or that the route already ranks) appear in the status views. */
export const RELEVANT_DEMAND = 0.15;
/** Rows shown per status before "show all": the first view should fit about one screen. */
const FIRST = 3;

type Status = "fix" | "strong" | "close" | "unproven";
type Mode = "status" | "areas" | "all";

interface Row {
  c: Competency;
  status: Status;
  rank: number | null;
  inRoute: boolean;
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

const STATUS: { id: Status; title: [string, string]; blurb: [string, string]; empty: [string, string] }[] = [
  { id: "fix", title: ["Fix First", "Perbaiki Dulu"], blurb: ["Asked for a lot and you are below the level needed. Your route starts here.", "Sering diminta dan levelmu masih di bawah kebutuhan. Rutemu dimulai dari sini."], empty: ["Nothing urgent.", "Tidak ada yang mendesak."] },
  { id: "close", title: ["Almost There", "Hampir Sampai"], blurb: ["Same level band as the role, still under its threshold. A little more proof closes it.", "Masih di rentang level yang sama dengan role, tapi belum melewati ambangnya. Sedikit bukti lagi cukup."], empty: ["No skill is just under the threshold.", "Tidak ada skill yang tinggal sedikit lagi."] },
  { id: "strong", title: ["Your Strengths", "Kekuatanmu"], blurb: ["At or above what employers ask. Keep the proof ready.", "Sudah di atas atau sama dengan permintaan employer. Simpan buktinya."], empty: ["None yet. Evidence and the skill check bring them here.", "Belum ada. Bukti dan Cek Kemampuan akan membawanya ke sini."] },
  { id: "unproven", title: ["Not Proven Yet", "Belum Terbukti"], blurb: ["In demand, but no evidence from you yet. That is not the same as not able.", "Banyak dicari, tapi belum ada bukti darimu. Itu tidak sama dengan tidak mampu."], empty: ["Every in-demand skill has some evidence.", "Semua skill yang banyak dicari sudah punya bukti."] },
];

/** The skill collection: one view at a time (by status, by area, every skill). In the status view a filter picks the
 * status, Fix First by default with the top three priorities first. */
export function SkillCollection({ d, onOpen }: { d: Dashboard; onOpen?: (skillId: string) => void }) {
  const t = useT();
  // view and filter live in the URL, so coming back from a skill's step in Learn lands on the same list
  const [mode, setModeState] = useState<Mode>("status");
  const [status, setStatusState] = useState<Status>("fix");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("mode") as Mode | null;
    const s = q.get("status") as Status | null;
    if (m && ["status", "areas", "all"].includes(m)) setModeState(m);
    if (s && STATUS.some((x) => x.id === s)) setStatusState(s);
  }, []);
  const remember = (key: string, value: string, fallback: string) => {
    const u = new URL(window.location.href);
    if (value === fallback) u.searchParams.delete(key);
    else u.searchParams.set(key, value);
    window.history.replaceState(window.history.state, "", u);
  };
  const setMode = (m: Mode) => (setModeState(m), remember("mode", m, "status"));
  const setStatus = (s: Status) => (setStatusState(s), remember("status", s, "fix"));
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo<Row[]>(() => {
    const rank = Object.fromEntries(d.ranking.map((r) => [r.skill_id, r]));
    const route = new Set(d.path.map((p) => p.skill_id));
    return d.competencies.filter((c) => c.demand >= RELEVANT_DEMAND || (rank[c.skill_id]?.rank ?? 99) <= 5).map((c) => {
      const r = rank[c.skill_id];
      return { c, rank: r?.rank ?? null, inRoute: route.has(c.skill_id), status: classify(c, r?.rank ?? null) };
    });
  }, [d]);
  const by = (s: Status) =>
    rows.filter((r) => r.status === s).sort((a, b) => (s === "fix" ? (a.rank ?? 99) - (b.rank ?? 99) : b.c.demand - a.c.demand));
  const hasEvidence = d.diagnostic_done || Object.values(d.evidence_summary).some((v) => v > 0);
  const sec = STATUS.find((s) => s.id === status)!;
  const list = by(status);
  const shown = expanded ? list : list.slice(0, FIRST);

  return (
    <section aria-labelledby="skills-title" className="min-w-0 space-y-4">
      {/* one toolbar: the status filter on the left (status view only), the view switch on the right */}
      <h2 id="skills-title" className="sr-only">{t(`Your Skills for ${d.role.name}`, `Skill-mu untuk ${d.role.name}`)}</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {mode === "status" ? (
          <div role="group" aria-label={t("Show status", "Tampilkan status")} className="flex flex-wrap items-center gap-1">
            {STATUS.map((s) => (
              <Chip
                key={s.id}
                hint={t(...s.blurb)}
                on={status === s.id}
                onClick={() => {
                  setStatus(s.id);
                  setExpanded(false);
                }}
                count={by(s.id).length}
              >
                {t(...s.title)}
              </Chip>
            ))}
          </div>
        ) : <span />}
        <Segmented
          label={t("View", "Tampilan")}
          value={mode}
          onChange={setMode}
          options={[["status", t("Status", "Status")], ["areas", t("Area", "Area")], ["all", t("All", "Semua")]]}
        />
      </div>

      {mode === "status" ? (
        <>
          {list.length ? (
            <div className="rounded-xl border bg-card">
              <RowHeader />
              <ul className="divide-y">
                {shown.map((r) => (
                  <SkillRow key={r.c.skill_id} r={r} onOpen={onOpen} />
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border bg-card px-4 py-4 text-sm text-ink/70">{t(...sec.empty)}</p>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {list.length > FIRST ? (
              <button type="button" onClick={() => setExpanded(!expanded)} className="text-sm font-medium text-indigo underline-offset-4 hover:underline">
                {expanded ? t("Show fewer", "Tampilkan lebih sedikit") : t(`Show all ${list.length}`, `Lihat semua ${list.length}`)}
              </button>
            ) : <span />}
          </div>
        </>
      ) : mode === "areas" ? (
        <Areas d={d} measured={hasEvidence} onOpen={onOpen} />
      ) : (
        <AllSkills comps={d.competencies} onOpen={onOpen ?? (() => {})} />
      )}
    </section>
  );
}

function Chip({ on, onClick, count, hint, children }: { on: boolean; onClick: () => void; count?: number; hint?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={hint}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "bg-secondary font-semibold text-secondary-foreground" : "text-ink/70 hover:bg-muted hover:text-ink",
      )}
    >
      {children}
      {count != null ? <span className={cn("tabular text-xs", on ? "text-secondary-foreground/80" : "text-muted-foreground")}>{count}</span> : null}
    </button>
  );
}

// rank | skill | level now -> role | demand | next action
const COLS = "grid-cols-[28px_minmax(0,1fr)] md:grid-cols-[28px_minmax(0,1fr)_170px_64px_auto]";

function RowHeader() {
  const t = useT();
  return (
    <div className={cn("hidden gap-4 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-ink/60 md:grid", COLS)} aria-hidden="true">
      <span>#</span>
      <span>Skill</span>
      <span>{t("Now → role needs", "Sekarang → role butuh")}</span>
      <span className="text-right">{t("Asked in", "Diminta")}</span>
      <span />
    </div>
  );
}

/** One skill on one row: name, level now against the role's level, how often it is asked, and one next action.
 * On phones the name keeps the full line and the numbers move under it. The reasons live in the skill panel. */
function SkillRow({ r, onOpen }: { r: Row; onOpen?: (skillId: string) => void }) {
  const { c } = r;
  const t = useT();
  const name = titleCase(c.name);
  const now = LEVEL[c.level] ? t(...LEVEL[c.level]) : c.level;
  return (
    <li className={cn("grid gap-x-4 gap-y-2 px-4 py-3.5 md:items-center", COLS)}>
      <span className="tabular row-span-3 pt-0.5 text-sm font-semibold text-indigo md:row-span-1 md:pt-0" aria-label={r.rank ? t(`Priority ${r.rank}`, `Prioritas ${r.rank}`) : undefined}>
        {r.rank ?? ""}
      </span>
      <div className="min-w-0">
        {onOpen ? (
          <button type="button" onClick={() => onOpen(c.skill_id)} className="text-left font-semibold leading-snug text-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline">
            {name}
          </button>
        ) : (
          <p className="font-semibold leading-snug text-ink">{name}</p>
        )}
        {/* how sure the level is, kept apart from the level itself: a strong estimate can still rest on grades only */}
        {c.low_confidence && (r.status === "strong" || r.status === "close") ? <p className="mt-0.5 text-xs text-ember-ink">{t("estimate from grades; needs direct proof", "perkiraan dari nilai; perlu bukti langsung")}</p> : null}
      </div>
      <div className="col-start-2 min-w-0 md:col-start-auto">
        <MasteryBar value={c.p} target={c.required} tone={r.status === "strong" ? "mint" : "indigo"} label={name} />
        <p className="tabular mt-1 text-xs text-ink/65">
          {r.status === "unproven" ? t("no evidence yet", "belum ada bukti") : `${now} ${num(c.p)}${c.required != null ? ` → ${num(c.required)}` : ""}`}
          <span className="md:hidden"> · {t(`asked in ${pct(c.demand)}`, `diminta ${pct(c.demand)}`)}</span>
        </p>
      </div>
      <span className="tabular hidden text-right text-sm text-ink/80 md:block">{pct(c.demand)}</span>
      <div className="col-start-2 flex md:col-start-auto md:justify-end">
        {r.status === "strong" ? (
          <span className="text-sm font-medium text-mint-ink">
            {c.n_items ? t(`${c.n_correct}/${c.n_items} correct`, `${c.n_correct}/${c.n_items} benar`) : t("Shown by evidence", "Ditunjukkan bukti")}
          </span>
        ) : (
          <Link
            href={r.inRoute ? `/learn#step-${c.skill_id}` : `/assessment/${c.skill_id}`}
            className="whitespace-nowrap text-sm font-medium text-indigo underline-offset-4 hover:underline"
          >
            {r.inRoute ? t("Open in Learn →", "Buka di Belajar →") : t("Prove it →", "Buktikan →")}
          </Link>
        )}
      </div>
    </li>
  );
}

const EXPERIENCE = [
  [0, "No experience yet", "Belum ada pengalaman"],
  [1, "Tried it (class, club, event)", "Pernah mencoba (kelas, organisasi, acara)"],
  [2, "Regular (project, internship, job)", "Rutin (project, magang, kerja)"],
  [3, "Led or taught others", "Memimpin atau mengajari orang lain"],
] as const;

/** Soft skills are shown beside the hard skills but are never quizzed or ranked: the student records real experience.
 * The side column shows a summary; the full editor opens in a panel. */
export function SoftSkills({ sid, items: all }: { sid: string; items: SoftSkill[] }) {
  const [local, setLocal] = useState<Record<string, { level: number; note: string }>>({});
  const [editing, setEditing] = useState(false);
  const t = useT();
  const items = all.filter((x) => x.demand >= RELEVANT_DEMAND);
  if (!items.length) return null;
  const cur = (x: SoftSkill) => local[x.skill_id] ?? { level: x.level, note: x.note };
  const save = (id: string, level: number, note: string) => {
    setLocal((l) => ({ ...l, [id]: { level, note } }));
    api.put(`/students/${sid}/soft-experience`, { skill_id: id, level, note }).catch(() => toast.error(t("Could not save. Try again.", "Gagal menyimpan. Coba lagi.")));
  };
  const recorded = items.filter((x) => cur(x).level > 0).length;
  return (
    <section aria-labelledby="sec-soft">
      <h2 id="sec-soft" className="text-sm font-semibold text-ink">{t("Soft skills from experience", "Soft skill dari pengalaman")}</h2>
      <p className="mt-1 text-sm text-ink/80">
        <span className="tabular font-semibold text-ink">{recorded}</span> {t(`of ${items.length} recorded`, `dari ${items.length} tercatat`)}
      </p>
      <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-medium text-indigo underline-offset-4 hover:underline">
        {recorded ? t("Edit experience →", "Ubah pengalaman →") : t("Record experience →", "Catat pengalaman →")}
      </button>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b p-6">
            <SheetTitle className="text-xl font-bold text-ink">{t("Soft Skills From Experience", "Soft Skill dari Pengalaman")}</SheetTitle>
            <SheetDescription>{t("Built through real experience, so there is no quiz and they never change your route. Record what you have actually done; it saves as you go.", "Dibangun lewat pengalaman nyata, jadi tidak ada kuis dan tidak mengubah rutemu. Catat apa yang benar-benar sudah kamu lakukan; tersimpan otomatis.")}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <ul className="divide-y">
              {items.map((x) => {
                const v = cur(x);
                return (
                  <li key={x.skill_id} className="space-y-2 px-6 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{x.name}</p>
                      <span className="text-xs text-muted-foreground">{t(`asked in ${pct(x.demand)} of postings`, `diminta di ${pct(x.demand)} posting`)}</span>
                    </div>
                    <label className="block text-xs font-medium text-ink/70" htmlFor={`exp-${x.skill_id}`}>{t("Your experience", "Pengalamanmu")}</label>
                    <select
                      id={`exp-${x.skill_id}`}
                      value={v.level}
                      onChange={(e) => save(x.skill_id, Number(e.target.value), v.note)}
                      className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
                    >
                      {EXPERIENCE.map(([val, en, id]) => (
                        <option key={val} value={val}>{t(en, id)}</option>
                      ))}
                    </select>
                    {v.level > 0 ? (
                      <input
                        aria-label={t(`Example for ${x.name}`, `Contoh untuk ${x.name}`)}
                        defaultValue={v.note}
                        maxLength={240}
                        placeholder={t("One example, e.g. capstone team of 4", "Satu contoh, mis. tim capstone 4 orang")}
                        onBlur={(e) => e.target.value !== v.note && save(x.skill_id, v.level, e.target.value)}
                        className="w-full rounded-lg border bg-card px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="text-xs leading-relaxed text-ink/65">{x.how_to_build}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </section>
  );
}
