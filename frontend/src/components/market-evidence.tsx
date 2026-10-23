"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronRight, Quote } from "lucide-react";
import { SOURCE, fmtDate, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { ErrorNote, Loading } from "./kit";
import { Card, GrowBar, Rise, Seg, Stat } from "./polish";
import { useLang, useT } from "@/lib/i18n";
import { idText } from "@/lib/id-overlay";
import { safeUrl } from "@/lib/safe-url";

interface MarketRow {
  skill_id: string;
  name: string;
  cluster: string;
  demand: number;
  share: number;
  count: number;
}
interface Market {
  role: string;
  role_name: string;
  simulated: boolean;
  note: string;
  reference_date: string;
  n_postings: number;
  sources: Record<string, number>;
  skills: MarketRow[];
}
interface SkillEvidence {
  name: string;
  evidence: { posting_id: string; title: string; company: string; source: string; url: string; published_at: string | null; quote: string }[];
}
interface PostingRow {
  id: string;
  title: string;
  company: string;
  source: string;
  location: string;
  url: string;
  published_at: string | null;
  skills: string[];
}

interface Bps {
  title: string;
  note: string;
  scope_note: string;
  figures: { id: string; label: string; value: string; detail: string; source: string; ref: number }[];
  fields: { field: string; share: number | null; roles: string[] }[];
}

/** Market evidence for one role in two tabs (most requested skills, postings). Used by the public explorer; Pilih
 * Karier embeds the two parts in the selected career's workspace instead. */
export function MarketEvidence({ role }: { role: string }) {
  const t = useT();
  const [tab, setTab] = useState<"skills" | "postings">("skills");
  return (
    <div>
      <Seg label={t("Market evidence", "Bukti pasar")} value={tab} onChange={setTab}
        options={[["skills", t("Most requested skills", "Skill paling diminta")], ["postings", t("Job postings", "Job posting")]]} />
      <div key={`${tab}-${role}`} className="smh-swap mt-6">
        {tab === "skills" ? <MarketSkills role={role} /> : <MarketPostings role={role} />}
      </div>
    </div>
  );
}

/** The skills a role's postings ask for, most requested first, with the exact posting sentences one click away.
 * Sources and the collection date sit in one line under the list. */
export function MarketSkills({ role }: { role: string }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const [skill, setSkill] = useState<string | null>(null);
  useEffect(() => setSkill(null), [role]);
  const m = useApi<Market>(`/market/${role}`);
  const ev = useApi<SkillEvidence>(skill ? `/market/${role}/skill/${skill}` : null);
  if (m.error) return <ErrorNote error={m.error} />;
  if (!m.data) return <Loading />;
  const rows = m.data.skills.filter((s) => s.count > 0).slice().sort((a, b) => b.share - a.share);
  const shown = all ? rows : rows.slice(0, 10);
  const max = Math.max(0.01, ...rows.map((r) => r.share));
  return (
    <div className="space-y-4">
      {m.data.simulated ? (
        <p role="note" className="rounded-xl border border-ember/30 bg-[#fff8e1] px-4 py-3 text-sm text-ember-ink">
          {t(`You’re viewing a simulated market (${m.data.note}). An admin can switch back to real data.`, `Kamu melihat pasar simulasi (${m.data.note}). Admin bisa mengembalikannya ke data nyata.`)}
        </p>
      ) : null}
      <Card className="p-2 sm:p-3">
        <div className="flex items-baseline justify-between gap-3 px-3 pb-2 pt-2 sm:px-4">
          <p className="text-[13px] font-medium text-muted-foreground">
            {t(`Share of ${m.data.n_postings} postings asking for each skill`, `Porsi dari ${m.data.n_postings} lowongan yang memintanya`)}
          </p>
          <p className="hidden text-[12px] text-muted-foreground/80 sm:block">{t("Click a skill to read the postings", "Klik skill untuk membaca lowongannya")}</p>
        </div>
        <ol>
          {shown.map((r, i) => {
            const top = i < 3;
            return (
              <li key={r.skill_id}>
                <button
                  type="button"
                  onClick={() => setSkill(r.skill_id)}
                  className="p-row group grid w-full grid-cols-[28px_minmax(0,1fr)_52px_14px] items-center gap-3 rounded-2xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[28px_minmax(0,1fr)_minmax(0,34%)_52px_14px] sm:px-4"
                >
                  <span className={cn("tabular flex size-6 items-center justify-center rounded-full text-[12px] font-bold",
                    top ? "text-white" : "text-ink/45")} style={top ? { background: ["var(--indigo)", "color-mix(in oklab, var(--indigo) 60%, var(--iris))", "var(--iris)"][i] } : undefined}>
                    {i + 1}
                  </span>
                  <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{titleCase(r.name)}</span>
                  <GrowBar className="hidden sm:block" value={r.share / max} delay={i * 45}
                    color={top ? "linear-gradient(90deg, var(--indigo), color-mix(in oklab, var(--indigo) 55%, var(--iris)))" : "color-mix(in oklab, var(--indigo) 55%, transparent)"} />
                  <span className="tabular text-right text-[15px] font-bold tracking-[-0.02em] text-ink">{pct(r.share)}</span>
                  <ChevronRight className="size-3.5 text-ink/25 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-indigo" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
        {rows.length > 10 ? (
          <div className="flex justify-center px-3 pb-2 pt-3">
            <button type="button" onClick={() => setAll(!all)} className="hero-ghost rounded-full px-5 py-2 text-[13.5px] font-semibold text-ink">
              {all ? t("Show top 10", "Tampilkan 10 teratas") : t(`Show all ${rows.length} skills`, `Tampilkan semua ${rows.length} skill`)}
            </button>
          </div>
        ) : null}
      </Card>

      <Sheet open={skill !== null} onOpenChange={(o) => !o && setSkill(null)}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b p-6">
            <SheetTitle className="text-[22px] font-bold tracking-[-0.025em] text-ink">{ev.data ? titleCase(ev.data.name) : t("Loading…", "Memuat…")}</SheetTitle>
            <SheetDescription>{ev.data ? t(`${ev.data.evidence.length} postings ask for this skill. Here is what they wrote.`, `${ev.data.evidence.length} posting meminta skill ini. Ini yang mereka tulis.`) : " "}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            {!ev.data || ev.loading ? (
              <div className="p-6">
                <Loading />
              </div>
            ) : (
              <ul className="space-y-3 p-6">
                {ev.data.evidence.map((e) => (
                  <li key={e.posting_id}>
                    <a
                      href={safeUrl(e.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-card group block rounded-[20px] p-5 transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Quote className="mb-2 size-4 text-iris" aria-hidden="true" />
                      <p className="text-[15px] leading-relaxed text-ink/85">{e.quote.replace(/^[-•\s]+/, "")}</p>
                      <p className="mt-3 flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground">
                        {e.title}, {e.company}
                        <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** The postings behind a role's numbers. */
export function MarketPostings({ role }: { role: string }) {
  const m = useApi<Market>(`/market/${role}`);
  const posts = useApi<PostingRow[]>(`/postings?role=${role}&limit=200`);
  if (posts.error) return <ErrorNote error={posts.error} />;
  if (!posts.data || !m.data) return <Loading />;
  return <PostingList posts={posts.data} total={m.data.n_postings} snapshot={m.data.reference_date} />;
}

const PAGE = 10;

/** The postings behind the numbers, newest first, ten at a time. Dates are when each posting was published; the
 * snapshot date is when the data set was collected. These are an archive, not a list of open vacancies. */
function PostingList({ posts, total, snapshot }: { posts: PostingRow[]; total: number; snapshot: string }) {
  const t = useT();
  const [n, setN] = useState(PAGE);
  const sorted = posts.slice().sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const shown = sorted.slice(0, n);
  return (
    <div className="space-y-4">
      <Card className="p-2 sm:p-3">
        <p className="px-3 pb-2 pt-2 text-[13px] font-medium text-muted-foreground sm:px-4">
          {t(`${shown.length} of ${sorted.length}, newest first, collected up to ${fmtDate(snapshot)}, some may be closed`, `${shown.length} dari ${sorted.length}, terbaru dulu, data sampai ${fmtDate(snapshot)}, sebagian mungkin sudah tutup`)}
        </p>
        <ul>
          {shown.map((p, i) => (
            <li key={p.id} className="p-rise" data-shown="true" style={{ transitionDelay: `${(i % PAGE) * 35}ms` }}>
              <a
                href={safeUrl(p.url)}
                target="_blank"
                rel="noreferrer"
                className="p-row group grid grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-x-3.5 rounded-2xl px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[40px_minmax(0,1fr)_auto_96px_16px] sm:px-4"
              >
                <span className="flex size-10 items-center justify-center rounded-[12px] bg-secondary text-[13px] font-bold text-secondary-foreground" aria-hidden="true">
                  {(p.company || p.title).trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{p.title}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {p.company}
                    <span className="md:hidden">, {SOURCE[p.source] ?? p.source}{p.published_at ? `, ${fmtDate(p.published_at)}` : ""}</span>
                  </span>
                </span>
                <span className="hidden rounded-full bg-muted/80 px-2.5 py-0.5 text-[12px] font-medium text-ink/70 md:block">{SOURCE[p.source] ?? p.source}</span>
                <span className="tabular hidden text-right text-[13px] text-muted-foreground md:block">{p.published_at ? fmtDate(p.published_at) : "–"}</span>
                <ArrowUpRight className="size-4 text-ink/25 transition-[color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-indigo" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </Card>
      {n < sorted.length ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => setN((x) => x + PAGE)} className="hero-ghost rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-ink">
            {t(`Load ${Math.min(PAGE, sorted.length - n)} more`, `Muat ${Math.min(PAGE, sorted.length - n)} lagi`)}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** National labour-market context from BPS (display only, never an input to the ranking). */
export function BpsContext() {
  const t = useT();
  const lang = useLang();
  const tx = (s: string) => idText(s, lang);
  const bps = useApi<Bps>("/context/bps");
  if (!bps.data) return null;
  return (
    <Card className="p-7 sm:p-9">
      <Rise>
        <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{t("National context", "Konteks nasional")}</p>
        <h3 className="mt-2 text-balance text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[28px]">
          {t("Graduate unemployment", "Pengangguran lulusan")} <span className="hero-grad">{t("in Indonesia", "di Indonesia")}</span>
        </h3>
      </Rise>
      {/* columns follow the card's own width: 4, else 2 x 2, else 1, so a figure never sits alone on a row */}
      <div className="@container mt-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-10 @md:grid-cols-2 @5xl:grid-cols-4">
        {bps.data.figures.map((f, i) => (
          <Stat key={f.id} delay={i * 110} value={tx(f.value)} label={tx(f.label)} fit={40}
            note={<>{tx(f.detail)}<span className="mt-1 block text-[11px] uppercase tracking-[0.05em] text-muted-foreground/80">{tx(f.source)} [{f.ref}]</span></>} />
        ))}
      </div>
      </div>
    </Card>
  );
}
