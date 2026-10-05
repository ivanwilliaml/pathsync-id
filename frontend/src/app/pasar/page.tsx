"use client";

import { useState } from "react";
import { ExternalLink, Quote } from "lucide-react";
import { num, pct } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Badge, Card, ErrorBox, PageHeader, Spinner, Stat, Tabs } from "@/components/ui";

interface MarketRow {
  skill_id: string;
  name: string;
  cluster: string;
  demand: number;
  share: number;
  count: number;
  ci_low: number;
  ci_high: number;
  trend: number;
  trend_factor: number;
  required: number | null;
}
interface Market {
  role: string;
  role_name: string;
  version: string;
  simulated: boolean;
  note: string;
  reference_date: string;
  n_postings: number;
  n_recent: number;
  n_previous: number;
  trend_status: string;
  sources: Record<string, number>;
  skills: MarketRow[];
  snapshots: { id: number; version: string; created_at: string; active: boolean; simulated: boolean; note: string }[];
}
interface SkillEvidence {
  skill_id: string;
  name: string;
  evidence: { posting_id: string; title: string; company: string; source: string; url: string; published_at: string | null; quote: string; level: string; method: string }[];
}
interface PostingRow {
  id: string;
  title: string;
  company: string;
  source: string;
  location: string;
  url: string;
  published_at: string | null;
  language: string;
  in_window: boolean;
  skills: string[];
}

const SOURCE_LABEL: Record<string, string> = { karirhub: "Karirhub Kemnaker", workable: "Workable", workday: "Workday", lever: "Lever", greenhouse: "Greenhouse", smartrecruiters: "SmartRecruiters", ashby: "Ashby", recruitee: "Recruitee" };

export default function PasarPage() {
  const [role, setRole] = useState("business_analyst");
  const [tab, setTab] = useState<"peta" | "lowongan">("peta");
  const m = useApi<Market>(`/market/${role}`);
  const [skill, setSkill] = useState<string | null>(null);
  const ev = useApi<SkillEvidence>(skill ? `/market/${role}/skill/${skill}` : null);
  const posts = useApi<PostingRow[]>(tab === "lowongan" ? `/postings?role=${role}&limit=200` : null);

  return (
    <div>
      <PageHeader
        title="Peta permintaan pasar"
        subtitle="Permintaan D = proporsi lowongan yang menuntut skill, dibobot kebaruan 0,5^(umur/6 bulan) (persamaan 1). Setiap angka dapat ditelusuri ke kutipan lowongan aslinya."
        action={
          <select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={role} onChange={(e) => { setRole(e.target.value); setSkill(null); }}>
            <option value="business_analyst">Business Analyst</option>
            <option value="data_analyst">Data Analyst</option>
          </select>
        }
      />
      {m.error ? <ErrorBox error={m.error} /> : null}
      {!m.data ? (
        !m.error && <Spinner />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Lowongan dalam jendela" value={m.data.n_postings} sub={`acuan ${m.data.reference_date} · 12 bulan`} />
            <Stat label="Versi peta" value={<span className="text-base">{m.data.version}</span>} sub={m.data.simulated ? "SIMULASI" : m.data.note} />
            <Stat
              label="Tren"
              value={m.data.trend_status === "ok" ? "aktif" : m.data.trend_status === "simulasi" ? "simulasi" : "belum cukup"}
              sub={`${m.data.n_recent} lowongan 6 bln terakhir · ${m.data.n_previous} sebelumnya`}
            />
            <Stat
              label="Sumber"
              value={Object.keys(m.data.sources).length}
              sub={Object.entries(m.data.sources)
                .map(([k, v]) => `${SOURCE_LABEL[k] ?? k} ${v}`)
                .join(" · ")}
            />
          </div>
          {m.data.simulated && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              Peta aktif adalah <b>simulasi</b> perubahan pasar ({m.data.note}). Kembalikan ke data nyata dari halaman Admin.
            </div>
          )}
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "peta", label: "Peta skill" },
              { id: "lowongan", label: "Daftar lowongan" },
            ]}
          />
          {tab === "peta" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
              <Card className="min-w-0">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-1 pr-2">Skill</th>
                      <th className="w-[40%] pr-2">Permintaan (interval Wilson 95%)</th>
                      <th className="pr-2 text-right">Lowongan</th>
                      <th className="text-right">Target r</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.data.skills.map((r) => (
                      <tr
                        key={r.skill_id}
                        onClick={() => setSkill(r.skill_id)}
                        className={`cursor-pointer border-t border-line hover:bg-subtle ${skill === r.skill_id ? "bg-brand-soft" : ""}`}
                      >
                        <td className="py-1.5 pr-2">{r.name}</td>
                        <td className="pr-2">
                          <div className="relative h-3 rounded bg-subtle">
                            <div className="absolute top-1 h-1 rounded bg-brand/25" style={{ left: `${r.ci_low * 100}%`, width: `${(r.ci_high - r.ci_low) * 100}%` }} />
                            <div className="absolute top-0 h-3 w-1 rounded bg-brand" style={{ left: `calc(${r.demand * 100}% - 2px)` }} />
                          </div>
                          <div className="text-[11px] text-muted">
                            {pct(r.demand)} [{pct(r.ci_low)}–{pct(r.ci_high)}]
                            {r.trend !== 0 && ` · tren ${r.trend > 0 ? "+" : ""}${num(r.trend)}`}
                          </div>
                        </td>
                        <td className="pr-2 text-right tabular-nums">{r.count}</td>
                        <td className="text-right tabular-nums">{r.required != null ? num(r.required) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </Card>
              <Card title={ev.data ? `Kutipan: ${ev.data.name}` : "Kutipan lowongan"} className="h-fit lg:sticky lg:top-20">
                {!skill ? (
                  <p className="text-sm text-muted">Klik skill untuk melihat kalimat lowongan yang menjadi buktinya.</p>
                ) : !ev.data || ev.loading ? (
                  <Spinner />
                ) : (
                  <ul className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                    {ev.data.evidence.map((e) => (
                      <li key={e.posting_id} className="rounded-lg bg-subtle p-3 text-sm">
                        <Quote className="mb-1 h-3 w-3 text-brand" />
                        <p className="italic">{e.quote.replace(/^[-•\s]+/, "")}</p>
                        <a href={e.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-brand">
                          {e.title} · {e.company} <ExternalLink className="h-3 w-3" />
                        </a>
                        <div className="mt-1 flex gap-1">
                          <Badge>{SOURCE_LABEL[e.source] ?? e.source}</Badge>
                          <Badge>{e.level}</Badge>
                          {e.published_at && <Badge>{e.published_at}</Badge>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          ) : (
            <Card>
              {!posts.data ? (
                <Spinner />
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-1 pr-2">Posisi</th>
                      <th className="pr-2">Perusahaan</th>
                      <th className="pr-2">Sumber</th>
                      <th className="pr-2">Terbit</th>
                      <th className="text-right">Skill</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.data.map((p) => (
                      <tr key={p.id} className="border-t border-line">
                        <td className="py-1.5 pr-2">
                          <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-brand hover:underline">
                            {p.title}
                          </a>
                          {!p.in_window && <span className="ml-1 text-xs text-muted">(di luar jendela)</span>}
                        </td>
                        <td className="pr-2 text-xs">{p.company}</td>
                        <td className="pr-2 text-xs">{SOURCE_LABEL[p.source] ?? p.source}</td>
                        <td className="pr-2 text-xs">{p.published_at ?? "–"}</td>
                        <td className="text-right tabular-nums">{p.skills.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
