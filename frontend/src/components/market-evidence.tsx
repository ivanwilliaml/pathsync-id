"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Quote } from "lucide-react";
import { SOURCE, fmtDate, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ErrorNote, Loading, Panel } from "./kit";
import { useT } from "@/lib/i18n";
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
  return (
    <Tabs defaultValue="skills">
      <TabsList className="mb-4">
        <TabsTrigger value="skills">{t("Most Requested Skills", "Skill Paling Banyak Diminta")}</TabsTrigger>
        <TabsTrigger value="postings">{t("Postings", "Job Posting")}</TabsTrigger>
      </TabsList>
      <TabsContent value="skills">
        <MarketSkills role={role} />
      </TabsContent>
      <TabsContent value="postings">
        <MarketPostings role={role} />
      </TabsContent>
    </Tabs>
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
  const sources = Object.entries(m.data.sources).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-3">
      {m.data.simulated ? (
        <p role="note" className="rounded-xl border border-ember/30 bg-[#fff8e1] px-4 py-3 text-sm text-ember-ink">
          {t(`You’re viewing a simulated market (${m.data.note}). An admin can switch back to real data.`, `Kamu melihat pasar simulasi (${m.data.note}). Admin bisa mengembalikannya ke data nyata.`)}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{t(`Share of ${m.data.n_postings} postings asking for each skill`, `Porsi dari ${m.data.n_postings} posting yang memintanya`)}</p>
      <div className="rounded-xl border bg-card">
        <ol className="divide-y">
          {shown.map((r, i) => (
            <li key={r.skill_id}>
              <button
                type="button"
                onClick={() => setSkill(r.skill_id)}
                className="grid w-full grid-cols-[24px_minmax(0,1fr)_48px] items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[24px_minmax(0,1fr)_minmax(0,30%)_48px]"
              >
                <span className="tabular text-sm text-ink/60">{i + 1}</span>
                <span className="text-sm font-medium text-ink">{titleCase(r.name)}</span>
                <span className="hidden h-2 rounded-full bg-muted sm:block" aria-hidden="true">
                  <span className="block h-2 rounded-full bg-indigo" style={{ width: `${(r.share / max) * 100}%` }} />
                </span>
                <span className="tabular text-right text-sm font-semibold text-ink">{pct(r.share)}</span>
              </button>
            </li>
          ))}
        </ol>
        {rows.length > 10 ? (
          <div className="border-t p-2 text-center">
            <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
              {all ? t("Show Top 10", "Tampilkan 10 Teratas") : t(`Show All ${rows.length} Skills`, `Tampilkan Semua ${rows.length} Skill`)}
            </Button>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("Sources", "Sumber")}: {sources.map(([k, v]) => `${SOURCE[k] ?? k} ${v}`).join(" · ")} · {t("collected up to", "dikumpulkan sampai")} {fmtDate(m.data.reference_date)}
      </p>

      <Sheet open={skill !== null} onOpenChange={(o) => !o && setSkill(null)}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b p-6">
            <SheetTitle className="text-xl font-bold text-ink">{ev.data ? titleCase(ev.data.name) : t("Loading…", "Memuat…")}</SheetTitle>
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
                      className="block rounded-xl border bg-card p-4 transition-colors hover:border-indigo/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Quote className="mb-1.5 size-3.5 text-iris" aria-hidden="true" />
                      <p className="text-sm italic text-ink/85">{e.quote.replace(/^[-•\s]+/, "")}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {e.title}, {e.company}
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
    <div>
      <p className="mb-3 text-sm text-ink/70">
        {t(`${shown.length} of ${sorted.length}, newest first · collected up to ${fmtDate(snapshot)}, some may be closed`, `${shown.length} dari ${sorted.length}, terbaru dulu · data sampai ${fmtDate(snapshot)}, sebagian mungkin sudah tutup`)}
      </p>
      <div className="rounded-xl border bg-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_110px_16px] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-ink/60 md:grid" aria-hidden="true">
          <span>{t("Posting", "Lowongan")}</span>
          <span>{t("Source", "Sumber")}</span>
          <span>{t("Published", "Terbit")}</span>
          <span />
        </div>
        <ul className="divide-y">
          {shown.map((p) => (
            <li key={p.id}>
              <a
                href={safeUrl(p.url)}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-[minmax(0,1fr)_16px] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_120px_110px_16px]"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{p.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.company}
                    <span className="md:hidden"> · {SOURCE[p.source] ?? p.source}{p.published_at ? ` · ${fmtDate(p.published_at)}` : ""}</span>
                  </span>
                </span>
                <span className="hidden text-sm text-ink/75 md:block">{SOURCE[p.source] ?? p.source}</span>
                <span className="tabular hidden text-sm text-ink/75 md:block">{p.published_at ? fmtDate(p.published_at) : "–"}</span>
                <ExternalLink className="size-3.5 text-ink/40" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
      {n < sorted.length ? (
        <div className="mt-3 text-center">
          <Button variant="outline" onClick={() => setN((x) => x + PAGE)}>
            {t(`Load ${Math.min(PAGE, sorted.length - n)} more`, `Muat ${Math.min(PAGE, sorted.length - n)} lagi`)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** National labour-market context from BPS (display only, never an input to the ranking). */
export function BpsContext() {
  const bps = useApi<Bps>("/context/bps");
  return (
    <>
      {bps.data ? (
        <Panel>
          <h2 className="text-lg font-semibold text-ink">{bps.data.title}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bps.data.figures.map((f) => (
              <div key={f.id} className="rounded-xl bg-card p-4">
                <p className="text-xs font-medium text-ink/60">{f.label}</p>
                <p className="mt-1 text-[21px] font-bold text-ink">{f.value}</p>
                <p className="text-xs text-ink/65">{f.detail}</p>
                <p className="mt-1 text-xs text-ink/50">
                  {f.source} [{f.ref}]
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink/70">{bps.data.scope_note}</p>
          <p className="mt-1 text-xs text-ink/55">{bps.data.note}</p>
        </Panel>
      ) : null}
    </>
  );
}
