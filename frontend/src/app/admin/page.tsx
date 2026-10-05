"use client";

import { useEffect, useMemo, useState } from "react";
import { api, num, type Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Badge, Button, Card, Empty, ErrorBox, Field, inputCls, PageHeader, Spinner, Stat, Tabs } from "@/components/ui";

interface Stats {
  postings_total: number;
  duplicates: number;
  by_source: Record<string, number>;
  in_window_by_role: Record<string, number>;
  mentions_by_status: Record<string, number>;
  students: number;
  experts: number;
  scenarios: number;
  annotations: number;
  extractor: string;
  last_build: string | null;
}
interface Job {
  running: boolean;
  log: string[];
  started: string | null;
  finished: string | null;
  ok: boolean | null;
}
interface ReviewRow {
  id: number;
  posting_id: string;
  title: string;
  surface: string;
  quote: string;
  skill_id: string | null;
  similarity: number;
}

type Tab = "pasar" | "tinjauan" | "anotasi";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("pasar");
  const stats = useApi<Stats>("/admin/stats");
  const meta = useApi<Meta>("/meta");
  const names = useMemo(() => Object.fromEntries((meta.data?.skills ?? []).map((s) => [s.id, s.name])), [meta.data]);
  const s = stats.data;
  return (
    <div>
      <PageHeader title="Admin" subtitle="Pembaruan pasar bulanan, simulasi perubahan pasar (uji pemicu adaptif #2), antrean tinjauan normalisasi, dan anotasi emas untuk F1 ekstraksi." />
      {!s ? (
        <Spinner />
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Lowongan" value={s.postings_total} sub={`${s.duplicates} duplikat · BA ${s.in_window_by_role.business_analyst ?? 0} · DA ${s.in_window_by_role.data_analyst ?? 0} dalam jendela`} />
          <Stat
            label="Sebutan skill"
            value={Object.values(s.mentions_by_status).reduce((a, b) => a + b, 0)}
            sub={Object.entries(s.mentions_by_status)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
          />
          <Stat label="Ekstraktor" value={s.extractor} sub={`build terakhir ${s.last_build ?? "–"}`} />
          <Stat label="Pengguna" value={`${s.students} mhs`} sub={`${s.experts} pakar · ${s.annotations} anotasi · ${s.scenarios} skenario`} />
        </div>
      )}
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "pasar", label: "Pasar" },
          { id: "tinjauan", label: "Antrean tinjauan" },
          { id: "anotasi", label: "Anotasi & F1" },
        ]}
      />
      {tab === "pasar" && <MarketAdmin meta={meta.data} onChange={stats.reload} />}
      {tab === "tinjauan" && <ReviewQueue names={names} meta={meta.data} />}
      {tab === "anotasi" && <Annotation meta={meta.data} onChange={stats.reload} />}
    </div>
  );
}

// ------------------------------------------------------------------ market
function MarketAdmin({ meta, onChange }: { meta: Meta | null; onChange: () => void }) {
  const job = useApi<Job>("/admin/market/refresh");
  const [role, setRole] = useState("business_analyst");
  const [skill, setSkill] = useState("sql");
  const [delta, setDelta] = useState("0.2");
  const [trend, setTrend] = useState("0.5");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (!job.data?.running) return;
    const t = setInterval(job.reload, 2000);
    return () => clearInterval(t);
  }, [job.data?.running, job.reload]);

  async function run<T>(fn: () => Promise<T>, ok: (r: T) => string) {
    setErr(null);
    setMsg(null);
    try {
      setMsg(ok(await fn()));
      onChange();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Pembaruan pasar bulanan">
        <p className="mb-3 text-sm text-muted">Scraping Karirhub + ATS, lalu ekstraksi, deduplikasi, dan snapshot peta permintaan baru. Mahasiswa yang jalurnya berubah mendapat entri riwayat &ldquo;Pembaruan pasar&rdquo;.</p>
        <Button onClick={() => run(() => api.post("/admin/market/refresh"), () => "Pembaruan dimulai.").then(job.reload)} loading={job.data?.running}>
          {job.data?.running ? "Sedang berjalan…" : "Jalankan sekarang"}
        </Button>
        {job.data?.started && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-muted">
              Mulai {job.data.started}
              {job.data.finished && ` · selesai ${job.data.finished}`} {job.data.ok === true && <Badge tone="good">berhasil</Badge>}
              {job.data.ok === false && <Badge tone="bad">gagal</Badge>}
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-ink p-3 text-[11px] leading-relaxed text-white">{job.data.log.join("\n")}</pre>
          </div>
        )}
      </Card>
      <Card title="Simulasi perubahan pasar">
        <p className="mb-3 text-sm text-muted">Membuat snapshot bertanda SIMULASI untuk menguji apakah jalur mahasiswa beradaptasi. Kembalikan ke data nyata setelah selesai.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Peran">
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
              {meta?.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Skill">
            <select className={inputCls} value={skill} onChange={(e) => setSkill(e.target.value)}>
              {meta?.skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Perubahan permintaan (−1…1)">
            <input className={inputCls} type="number" step="0.05" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </Field>
          <Field label="Tren g (−0,5…0,5)">
            <input className={inputCls} type="number" step="0.1" value={trend} onChange={(e) => setTrend(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            onClick={() =>
              run(
                () => api.post<{ version: string }>("/admin/market/simulate", { role, skill_id: skill, demand_delta: Number(delta), trend: Number(trend) }),
                (r) => `Snapshot simulasi ${r.version} aktif.`,
              )
            }
          >
            Terapkan simulasi
          </Button>
          <Button variant="secondary" onClick={() => run(() => api.post<{ version: string }>(`/admin/market/reset?role=${role}`), (r) => `Kembali ke data nyata ${r.version}.`)}>
            Kembalikan ke data nyata
          </Button>
        </div>
        {msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}
        <ErrorBox error={err} />
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ review queue
function ReviewQueue({ names, meta }: { names: Record<string, string>; meta: Meta | null }) {
  const [status, setStatus] = useState("review");
  const q = useApi<ReviewRow[]>(`/admin/review-queue?status=${status}&limit=100`);
  async function decide(id: number, decision: string) {
    await api.post(`/admin/review-queue/${id}`, { decision });
    q.setData((q.data ?? []).filter((r) => r.id !== id));
  }
  return (
    <Card
      title="Normalisasi skill yang perlu ditinjau"
      action={
        <select className="rounded border border-line px-2 py-1 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="review">Kemiripan 0,70–0,85 (tinjau)</option>
          <option value="new">Kandidat skill baru (&lt; 0,70)</option>
        </select>
      }
    >
      {!q.data ? (
        <Spinner />
      ) : q.data.length === 0 ? (
        <Empty>Antrean kosong.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {q.data.map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <b>&ldquo;{r.surface}&rdquo;</b>
                {r.skill_id && (
                  <span className="text-muted">
                    → {names[r.skill_id] ?? r.skill_id} ({num(r.similarity)})
                  </span>
                )}
              </div>
              <blockquote className="mt-1 border-l-2 border-line pl-3 text-xs text-muted">{r.quote}</blockquote>
              <div className="mt-1 text-xs text-muted">{r.title}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.skill_id && (
                  <Button variant="secondary" onClick={() => decide(r.id, "accept")}>
                    Terima
                  </Button>
                )}
                <select className="rounded-lg border border-line px-2 text-xs" defaultValue="" onChange={(e) => e.target.value && decide(r.id, e.target.value)}>
                  <option value="">Petakan ke skill lain…</option>
                  {meta?.skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Button variant="danger" onClick={() => decide(r.id, "reject")}>
                  Tolak
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ annotation
interface NextPosting {
  posting_id: string | null;
  title?: string;
  company?: string;
  description?: string;
  remaining?: number;
}
interface F1 {
  n_postings: number;
  precision: number;
  recall: number;
  f1: number;
  target_f1: number;
  tp: number;
  fp: number;
  fn: number;
}

interface Comparison {
  n_postings: number;
  mean_jaccard: number;
  spearman_skill_frequency: number;
  mentions_per_posting: { lexicon: number; llm: number };
  top_only_lexicon: [string, number][];
  top_only_llm: [string, number][];
  top_agreed: [string, number][];
}

function ExtractorComparison({ c }: { c: Comparison }) {
  const list = (title: string, rows: [string, number][]) => (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <ul className="space-y-0.5 text-sm">
        {rows.slice(0, 6).map(([n, k]) => (
          <li key={n} className="flex justify-between gap-2">
            <span className="truncate">{n}</span>
            <span className="tabular-nums text-muted">{k}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <Card title="Leksikon vs LLM luring (tanpa anotasi emas)">
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Lowongan" value={c.n_postings} />
        <Stat label="Jaccard rata-rata" value={num(c.mean_jaccard)} sub="himpunan skill per lowongan" />
        <Stat label="Spearman" value={num(c.spearman_skill_frequency)} sub="frekuensi skill antar-ekstraktor" />
        <Stat label="Skill / lowongan" value={`${num(c.mentions_per_posting.lexicon, 1)} vs ${num(c.mentions_per_posting.llm, 1)}`} sub="leksikon vs LLM" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {list("Sepakat", c.top_agreed)}
        {list("Hanya leksikon", c.top_only_lexicon)}
        {list("Hanya LLM", c.top_only_llm)}
      </div>
      <p className="mt-3 text-xs text-muted">Mana yang lebih benar hanya bisa diputuskan dengan F1 terhadap anotasi emas di atas.</p>
    </Card>
  );
}

function Annotation({ meta, onChange }: { meta: Meta | null; onChange: () => void }) {
  const [annotator, setAnnotator] = useState("");
  const [active, setActive] = useState("");
  const next = useApi<NextPosting>(active ? `/annotation/next?annotator=${encodeURIComponent(active)}` : null);
  const f1 = useApi<F1>("/annotation/eval");
  const cmp = useApi<Comparison>("/evaluation/extractors");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    try {
      const a = localStorage.getItem("pathsync.annotator") ?? "";
      setAnnotator(a);
    } catch {}
  }, []);
  useEffect(() => setPicked(new Set()), [next.data?.posting_id]);

  async function submit() {
    if (!next.data?.posting_id) return;
    setErr(null);
    try {
      await api.post("/annotation", { posting_id: next.data.posting_id, annotator: active, skill_ids: [...picked] });
      next.reload();
      f1.reload();
      onChange();
    } catch (e) {
      setErr(e);
    }
  }

  const clusters = meta ? Object.entries(meta.clusters) : [];
  return (
    <div className="space-y-4">
      <Card title="Kinerja ekstraksi vs anotasi emas">
        {!f1.data ? (
          <Spinner />
        ) : (
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="F1" value={num(f1.data.f1, 3)} sub={`target ≥ ${num(f1.data.target_f1)}`} />
            <Stat label="Presisi" value={num(f1.data.precision, 3)} sub={`TP ${f1.data.tp} · FP ${f1.data.fp}`} />
            <Stat label="Recall" value={num(f1.data.recall, 3)} sub={`FN ${f1.data.fn}`} />
            <Stat label="Lowongan teranotasi" value={f1.data.n_postings} sub="target 150 (2 anotator)" />
          </div>
        )}
      </Card>
      {cmp.data && <ExtractorComparison c={cmp.data} />}
      <Card title="Anotasi lowongan">
        {!active ? (
          <div className="flex max-w-md gap-2">
            <input className={inputCls} placeholder="Nama anotator" value={annotator} onChange={(e) => setAnnotator(e.target.value)} />
            <Button
              disabled={!annotator.trim()}
              onClick={() => {
                setActive(annotator.trim());
                try {
                  localStorage.setItem("pathsync.annotator", annotator.trim());
                } catch {}
              }}
            >
              Mulai
            </Button>
          </div>
        ) : !next.data ? (
          <Spinner />
        ) : !next.data.posting_id ? (
          <Empty>Semua lowongan sudah kamu anotasi.</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-muted">
                Anotator {active} · sisa {next.data.remaining} lowongan
              </div>
              <h3 className="font-semibold">{next.data.title}</h3>
              <div className="mb-2 text-xs text-muted">{next.data.company}</div>
              <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-subtle p-3 text-xs leading-relaxed">{next.data.description}</div>
            </div>
            <div>
              <p className="mb-2 text-sm text-muted">Centang semua skill yang dituntut lowongan ini (tanpa melihat hasil ekstraktor).</p>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto">
                {clusters.map(([cid, label]) => (
                  <div key={cid}>
                    <div className="mb-1 text-xs font-semibold uppercase text-muted">{label}</div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {meta!.skills
                        .filter((s) => s.cluster === cid)
                        .map((s) => (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={picked.has(s.id)}
                              onChange={(e) => {
                                const n = new Set(picked);
                                if (e.target.checked) n.add(s.id);
                                else n.delete(s.id);
                                setPicked(n);
                              }}
                            />
                            {s.name}
                          </label>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={submit}>Simpan & berikutnya ({picked.size} skill)</Button>
                <ErrorBox error={err} />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
