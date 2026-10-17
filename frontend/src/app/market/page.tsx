"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Quote } from "lucide-react";
import { SOURCE, fmtDate, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Meta } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorNote, Loading, Panel, Tag } from "@/components/kit";
import { Mascot } from "@/components/mascot";
import { useT } from "@/lib/i18n";

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

export default function MarketPage() {
  const [role, setRole] = useState("business_analyst");
  const t = useT();
  // ?role=<id> opens a specific career (links from the Career Map)
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("role");
    if (r) setRole(r);
  }, []);
  const [all, setAll] = useState(false);
  const [skill, setSkill] = useState<string | null>(null);
  const meta = useApi<Meta>("/meta");
  const bps = useApi<Bps>("/context/bps");
  const ROLES = meta.data?.roles ?? [];
  const m = useApi<Market>(`/market/${role}`);
  const ev = useApi<SkillEvidence>(skill ? `/market/${role}/skill/${skill}` : null);
  const posts = useApi<PostingRow[]>(`/postings?role=${role}&limit=200`);

  const rows = (m.data?.skills.filter((s) => s.count > 0) ?? []).slice().sort((a, b) => b.share - a.share);
  const shown = all ? rows : rows.slice(0, 10);
  const max = Math.max(0.01, ...rows.map((r) => r.share));

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/market.webp" alt="" width={1600} height={1067} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" aria-hidden="true" />
        <Mascot name="job-board" size={190} priority className="absolute right-6 bottom-0 hidden md:block" />
        <div className="relative p-7 sm:p-10">
          <h1 className="text-[30px] font-extrabold text-white sm:text-[36px]">Job Market</h1>
          <p className="mt-2 max-w-lg text-white/80">
            {t(
              `What Indonesian employers ask for, read from ${m.data ? `${m.data.n_postings} real postings` : "real postings"} on Karirhub and company career sites.`,
              `Apa yang diminta employer Indonesia, dibaca dari ${m.data ? `${m.data.n_postings} job posting nyata` : "job posting nyata"} di Karirhub dan situs karier perusahaan.`,
            )}
          </p>
          <label htmlFor="market-role" className="mt-6 block text-xs font-medium text-white/70">{t("Career", "Karier")}</label>
          <select
            id="market-role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setSkill(null);
            }}
            className="mt-1 h-11 w-full max-w-sm rounded-xl bg-white px-4 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {Object.entries(meta.data?.families ?? {}).map(([fid, fname]) => (
              <optgroup key={fid} label={fname}>
                {ROLES.filter((r) => r.family === fid).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.limited_data ? " (Beta)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </section>

      {bps.data ? (
        <Panel>
          <h2 className="text-lg font-semibold text-ink">{bps.data.title}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bps.data.figures.map((f) => (
              <div key={f.id} className="rounded-xl bg-card p-4">
                <p className="text-xs font-medium text-ink/60">{f.label}</p>
                <p className="mt-1 text-[24px] font-bold text-ink">{f.value}</p>
                <p className="text-xs text-ink/65">{f.detail}</p>
                <p className="mt-1 text-[11px] text-ink/50">
                  {f.source} [{f.ref}]
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink/70">{bps.data.scope_note}</p>
          <p className="mt-1 text-xs text-ink/55">{bps.data.note}</p>
        </Panel>
      ) : null}

      {m.data?.simulated ? (
        <p role="note" className="rounded-xl border border-ember/30 bg-[#fff8e1] px-4 py-3 text-sm text-ember-ink">
          {t(`You\u2019re viewing a simulated market (${m.data.note}). An admin can switch back to real data.`, `Kamu melihat pasar simulasi (${m.data.note}). Admin bisa mengembalikannya ke data nyata.`)}
        </p>
      ) : null}

      {m.error ? <ErrorNote error={m.error} /> : null}
      {!m.data ? (
        !m.error && <Loading />
      ) : (
        <Tabs defaultValue="skills">
          <TabsList className="mb-4">
            <TabsTrigger value="skills">{t("Most Requested Skills", "Skill Paling Banyak Diminta")}</TabsTrigger>
            <TabsTrigger value="postings">{t("Postings", "Job Posting")}</TabsTrigger>
          </TabsList>
          <TabsContent value="skills">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <Panel className="p-0 sm:p-0">
                <ol className="divide-y">
                  {shown.map((r, i) => (
                    <li key={r.skill_id}>
                      <button
                        type="button"
                        onClick={() => setSkill(r.skill_id)}
                        className="grid w-full grid-cols-[28px_minmax(0,1fr)_56px] items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[28px_minmax(0,300px)_minmax(0,1fr)_56px]"
                      >
                        <span className="tabular text-sm text-ink/60">{i + 1}</span>
                        <span className="line-clamp-2 text-sm font-medium text-ink">{titleCase(r.name)}</span>
                        <span className="hidden h-2.5 rounded-full bg-muted sm:block" aria-hidden="true">
                          <span className="block h-2.5 rounded-full bg-indigo" style={{ width: `${(r.share / max) * 100}%` }} />
                        </span>
                        <span className="tabular text-right text-sm font-semibold text-ink">{pct(r.share)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                {rows.length > 10 ? (
                  <div className="border-t p-3 text-center">
                    <Button variant="ghost" onClick={() => setAll(!all)}>
                      {all ? t("Show Top 10", "Tampilkan 10 Teratas") : t(`Show All ${rows.length} Skills`, `Tampilkan Semua ${rows.length} Skill`)}
                    </Button>
                  </div>
                ) : null}
              </Panel>
              <aside className="space-y-4">
                <Panel>
                  <h2 className="font-semibold text-ink">{t("How to Read This", "Cara Membaca")}</h2>
                  <p className="mt-1.5 text-sm text-ink/70">
                    {t("The percentage is the share of postings that ask for the skill. Click a skill to read the exact sentences employers wrote.", "Persentasenya adalah porsi posting yang meminta skill tersebut. Klik skill untuk membaca kalimat persis yang ditulis employer.")}
                  </p>
                </Panel>
                <Panel>
                  <h2 className="font-semibold text-ink">{t("Sources", "Sumber")}</h2>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {Object.entries(m.data.sources)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between gap-2">
                          <span className="text-ink/80">{SOURCE[k] ?? k}</span>
                          <span className="tabular font-medium text-ink">{v}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">{t("Updated", "Diperbarui")} {fmtDate(m.data.reference_date)}</p>
                </Panel>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="postings">
            {!posts.data ? (
              <Loading />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {posts.data.map((p) => (
                  <li key={p.id}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-full flex-col rounded-2xl border bg-card p-4 transition-[border-color,box-shadow] hover:border-indigo/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-semibold leading-snug text-ink">{p.title}</span>
                        <ExternalLink className="mt-1 size-3.5 shrink-0 text-ink/40" aria-hidden="true" />
                      </span>
                      <span className="mt-1 text-sm text-ink/70">{p.company}</span>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        <Tag tone="neutral">{SOURCE[p.source] ?? p.source}</Tag>
                        {p.published_at ? <Tag tone="neutral">{fmtDate(p.published_at)}</Tag> : null}
                        <Tag tone="indigo">{p.skills.length} skill</Tag>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Sheet open={skill !== null} onOpenChange={(o) => !o && setSkill(null)}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b bg-route-soft p-6">
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
                      href={e.url}
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
