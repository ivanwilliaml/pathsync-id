"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { api, FEATURE_LABELS, num, type Features, type Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Badge, Button, Card, Empty, ErrorBox, Field, inputCls, PageHeader, Spinner, Stat, Tabs } from "@/components/ui";

interface Expert {
  id: string;
  name: string;
  affiliation: string;
  kind: string;
  validates_graph: boolean;
}
interface EdgeRow {
  id: number;
  from: string;
  to: string;
  from_name: string;
  to_name: string;
  source: string;
  rationale: string;
  status: string;
  approve: number;
  reject: number;
  votes: { expert_id: string; approve: boolean; comment: string }[];
}
interface ScenarioRow {
  id: string;
  base_id: string;
  variant: string;
  title: string;
  done: boolean;
  n_rankings: number;
}
interface ScenarioDetail {
  id: string;
  title: string;
  variant: string;
  changed: Record<string, unknown>;
  candidates: { skill_id: string; name: string; p: number; r: number; K: number; D: number; T: number; prereqs: { skill_id: string; name: string; p: number | null }[] }[];
}
type Stat95 = { mean: number; ci95: [number, number]; n: number };
interface ModelRow {
  id: number;
  name: string;
  source: string;
  weights: Features;
  metrics: Record<string, unknown>;
  active: boolean;
  created_at: string;
}

const EXPERT_KEY = "pathsync.expert";
type Tab = "graf" | "skenario" | "model";

export default function PakarPage() {
  const [tab, setTab] = useState<Tab>("graf");
  const experts = useApi<Expert[]>("/experts");
  const [eid, setEid] = useState<string>("");
  useEffect(() => {
    try {
      setEid(localStorage.getItem(EXPERT_KEY) ?? "");
    } catch {}
  }, []);
  const pick = (id: string) => {
    setEid(id);
    try {
      localStorage.setItem(EXPERT_KEY, id);
    } catch {}
  };
  const me = experts.data?.find((e) => e.id === eid);

  return (
    <div>
      <PageHeader
        title="Panel Pakar"
        subtitle="Validasi graf prasyarat (sisi dipertahankan bila disetujui ≥2 dari 3 pakar), peringkat skenario mahasiswa tanpa melihat keluaran sistem, lalu latih model peringkat dari peringkat pakar."
      />
      <ExpertPicker experts={experts.data ?? []} eid={eid} pick={pick} reload={experts.reload} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "graf", label: "Validasi graf" },
          { id: "skenario", label: "Peringkat skenario" },
          { id: "model", label: "Kesepakatan & model" },
        ]}
      />
      {tab === "graf" && <EdgeValidation me={me} />}
      {tab === "skenario" && <ScenarioRanking me={me} />}
      {tab === "model" && <Models />}
    </div>
  );
}

function ExpertPicker({ experts, eid, pick, reload }: { experts: Expert[]; eid: string; pick: (id: string) => void; reload: () => void }) {
  const [name, setName] = useState("");
  const [aff, setAff] = useState("");
  const [kind, setKind] = useState("dosen");
  const [graph, setGraph] = useState(true);
  const [err, setErr] = useState<unknown>(null);
  async function add() {
    setErr(null);
    try {
      const r = await api.post<{ id: string }>("/experts", { name, affiliation: aff, kind, validates_graph: graph });
      pick(r.id);
      setName("");
      setAff("");
      reload();
    } catch (e) {
      setErr(e);
    }
  }
  return (
    <Card className="mb-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Field label="Masuk sebagai pakar">
          <select className={inputCls} value={eid} onChange={(e) => pick(e.target.value)}>
            <option value="">— pilih —</option>
            {experts.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.kind}
                {e.affiliation ? `, ${e.affiliation}` : ""})
              </option>
            ))}
          </select>
        </Field>
        <div>
          <span className="mb-1 block text-sm font-medium">Daftarkan pakar baru</span>
          <div className="flex flex-wrap gap-2">
            <input className={`${inputCls} flex-1`} placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={`${inputCls} flex-1`} placeholder="Afiliasi" value={aff} onChange={(e) => setAff(e.target.value)} />
            <select className={`${inputCls} w-36`} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="dosen">Dosen</option>
              <option value="praktisi">Praktisi</option>
              <option value="rekruter">Rekruter</option>
            </select>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={graph} onChange={(e) => setGraph(e.target.checked)} /> validator graf
            </label>
            <Button variant="secondary" onClick={add} disabled={!name.trim()}>
              Daftar
            </Button>
          </div>
          <ErrorBox error={err} />
        </div>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ edges
function EdgeValidation({ me }: { me?: Expert }) {
  const edges = useApi<EdgeRow[]>("/expert/edges");
  const meta = useApi<Meta>("/meta");
  const [filter, setFilter] = useState("semua");
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [src, setSrc] = useState("");
  const [dst, setDst] = useState("");
  const [why, setWhy] = useState("");

  async function vote(id: number, approve: boolean) {
    if (!me) return;
    await api.post(`/expert/edges/${id}/vote`, { expert_id: me.id, approve });
    edges.reload();
  }
  async function finalize() {
    setErr(null);
    try {
      setSummary(await api.post("/expert/edges/finalize"));
      edges.reload();
    } catch (e) {
      setErr(e);
    }
  }
  async function propose() {
    setErr(null);
    try {
      await api.post("/expert/edges", { src, dst, rationale: why });
      setSrc("");
      setDst("");
      setWhy("");
      edges.reload();
    } catch (e) {
      setErr(e);
    }
  }

  if (!edges.data) return <Spinner />;
  const rows = edges.data.filter((e) => filter === "semua" || (filter === "belum" ? me && !e.votes.some((v) => v.expert_id === me.id) : e.status === filter));
  const voted = me ? edges.data.filter((e) => e.votes.some((v) => v.expert_id === me.id)).length : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Sisi" value={edges.data.length} />
        <Stat label="Disetujui" value={edges.data.filter((e) => e.status === "approved").length} />
        <Stat label="Ditolak" value={edges.data.filter((e) => e.status === "rejected").length} />
        <Stat label="Suara saya" value={me ? `${voted}/${edges.data.length}` : "–"} />
      </div>
      <Card
        title="Sisi prasyarat"
        action={
          <div className="flex gap-2">
            <select className="rounded border border-line px-2 py-1 text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="semua">Semua</option>
              <option value="belum">Belum saya nilai</option>
              <option value="draft">Draf</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
            <Button variant="secondary" onClick={finalize}>
              Finalisasi (2 dari 3)
            </Button>
          </div>
        }
      >
        {!me && <p className="mb-3 text-sm text-amber-800">Pilih atau daftarkan pakar di atas untuk memberi suara.</p>}
        {summary && (
          <p className="mb-3 text-sm text-emerald-800">
            Finalisasi: {summary.approved} disetujui, {summary.rejected} ditolak, {summary.draft} masih draf.
          </p>
        )}
        <ErrorBox error={err} />
        <ul className="divide-y divide-line">
          {rows.map((e) => {
            const mine = me ? e.votes.find((v) => v.expert_id === me.id) : undefined;
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <b>{e.from_name}</b> <span className="text-muted">→ prasyarat untuk →</span> <b>{e.to_name}</b>
                  </div>
                  <div className="text-xs text-muted">
                    {e.rationale} <span className="italic">(sumber: {e.source})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={e.status === "approved" ? "good" : e.status === "rejected" ? "bad" : "neutral"}>{e.status}</Badge>
                  <span className="text-xs text-muted">
                    {e.approve}✓ {e.reject}✗
                  </span>
                  <button
                    disabled={!me}
                    onClick={() => vote(e.id, true)}
                    className={`rounded p-1.5 ${mine?.approve === true ? "bg-emerald-100 text-emerald-700" : "text-muted hover:bg-subtle"}`}
                    title="Setuju"
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </button>
                  <button
                    disabled={!me}
                    onClick={() => vote(e.id, false)}
                    className={`rounded p-1.5 ${mine?.approve === false ? "bg-red-100 text-red-700" : "text-muted hover:bg-subtle"}`}
                    title="Tolak"
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title="Usulkan sisi baru">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
          <select className={inputCls} value={src} onChange={(e) => setSrc(e.target.value)}>
            <option value="">Prasyarat…</option>
            {meta.data?.skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select className={inputCls} value={dst} onChange={(e) => setDst(e.target.value)}>
            <option value="">Skill lanjutan…</option>
            {meta.data?.skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input className={inputCls} placeholder="Alasan" value={why} onChange={(e) => setWhy(e.target.value)} />
          <Button onClick={propose} disabled={!src || !dst}>
            Usulkan
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">Usulan yang membuat siklus pada graf ditolak otomatis.</p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ scenarios
function ScenarioRanking({ me }: { me?: Expert }) {
  const list = useApi<ScenarioRow[]>(me ? `/expert/scenarios?expert_id=${me.id}` : "/expert/scenarios");
  const [sel, setSel] = useState<string | null>(null);
  const detail = useApi<ScenarioDetail>(sel ? `/expert/scenarios/${sel}` : null);
  const [order, setOrder] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (detail.data) setOrder(detail.data.candidates.map((c) => c.skill_id));
    setSaved(false);
  }, [detail.data]);

  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
    setSaved(false);
  }
  async function submit() {
    if (!me || !sel) return;
    setErr(null);
    try {
      await api.post(`/expert/scenarios/${sel}/rank`, { expert_id: me.id, order });
      setSaved(true);
      list.reload();
      const rows = list.data ?? [];
      const next = rows.find((r) => !r.done && r.id !== sel);
      if (next) setTimeout(() => setSel(next.id), 600);
    } catch (e) {
      setErr(e);
    }
  }

  if (!list.data) return <Spinner />;
  const done = list.data.filter((r) => r.done).length;
  const cands = Object.fromEntries((detail.data?.candidates ?? []).map((c) => [c.skill_id, c]));
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card title={`Skenario (${done}/${list.data.length})`} className="h-fit">
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto text-sm">
          {list.data.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSel(r.id)}
                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left ${sel === r.id ? "bg-brand-soft" : "hover:bg-subtle"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{r.title}</span>
                  <span className="text-xs text-muted">
                    {r.base_id} · {r.variant} · {r.n_rankings} pakar
                  </span>
                </span>
                {r.done && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {!sel ? (
        <Empty>Pilih skenario. Urutkan kandidat skill dari yang paling perlu dipelajari lebih dahulu. Skor sistem sengaja tidak ditampilkan.</Empty>
      ) : !detail.data ? (
        <Spinner />
      ) : (
        <Card title={detail.data.title} action={<Badge>{detail.data.variant}</Badge>}>
          {Object.keys(detail.data.changed).length > 0 && (
            <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">Perubahan dari skenario dasar: {JSON.stringify(detail.data.changed)}</p>
          )}
          <p className="mb-3 text-xs text-muted">
            p = penguasaan saat ini · r = tingkat yang dituntut peran · K = keyakinan bukti · D = permintaan pasar · T = faktor tren
          </p>
          <ol className="space-y-2">
            {order.map((sid, i) => {
              const c = cands[sid];
              if (!c) return null;
              return (
                <li key={sid} className="flex items-start gap-3 rounded-lg border border-line p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted tabular-nums">
                      <span>p {num(c.p)}</span>
                      <span>r {num(c.r)}</span>
                      <span>K {num(c.K)}</span>
                      <span>D {num(c.D)}</span>
                      <span>T {num(c.T)}</span>
                    </div>
                    {c.prereqs.length > 0 && (
                      <div className="mt-1 text-xs text-muted">
                        Prasyarat: {c.prereqs.map((q) => `${q.name} (p ${q.p != null ? num(q.p) : "–"})`).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <button className="rounded p-1 text-muted hover:bg-subtle" onClick={() => move(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button className="rounded p-1 text-muted hover:bg-subtle" onClick={() => move(i, 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={submit} disabled={!me}>
              Simpan peringkat
            </Button>
            {!me && <span className="text-sm text-amber-800">Pilih pakar terlebih dahulu.</span>}
            {saved && <span className="text-sm text-emerald-700">Tersimpan.</span>}
          </div>
          <ErrorBox error={err} />
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ models & evaluation
function Models() {
  const [simulated, setSimulated] = useState(false);
  const agree = useApi<{ per_scenario: Record<string, number>; mean_w: number | null; n_scenarios_ranked: number; n_with_2plus: number }>(
    `/expert/agreement?simulated=${simulated}`,
  );
  const models = useApi<ModelRow[]>("/models");
  const evalr = useApi<{ note: string; n_scenarios: number; n_base: number; market_version: string; llm_baseline: string; conditions: Record<string, EvalCondition> }>("/evaluation");
  const [busy, setBusy] = useState(false);
  const [train, setTrain] = useState<{ active: boolean; passes_rule: boolean; weights: Features } | null>(null);
  const [err, setErr] = useState<unknown>(null);

  async function doTrain() {
    setBusy(true);
    setErr(null);
    try {
      setTrain(await api.post("/expert/train", { use_simulated: simulated, activate_if_passes: true }));
      models.reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  async function activate(id: number) {
    await api.post(`/models/${id}/activate`);
    models.reload();
  }

  return (
    <div className="space-y-4">
      <Card
        title="Kesepakatan antarpakar (Kendall W)"
        action={
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={simulated} onChange={(e) => setSimulated(e.target.checked)} /> pakai data pakar tersimulasi
          </label>
        }
      >
        {!agree.data ? (
          <Spinner />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="W rata-rata" value={agree.data.mean_w != null ? num(agree.data.mean_w) : "–"} sub="≥ 0,7 = kesepakatan kuat" />
            <Stat label="Skenario diperingkat" value={agree.data.n_scenarios_ranked} />
            <Stat label="Dengan ≥ 2 pakar" value={agree.data.n_with_2plus} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={doTrain} loading={busy}>
            Latih model dari peringkat {simulated ? "tersimulasi" : "pakar"}
          </Button>
          <span className="text-xs text-muted">LTR berpasangan, diregularisasi ke bobot formula (5); aktif otomatis bila NDCG@5 ≥ formula (5) − 0,01.</span>
        </div>
        <ErrorBox error={err} />
        {train && (
          <p className={`mt-3 text-sm ${train.active ? "text-emerald-700" : "text-amber-800"}`}>
            Model dilatih. {train.passes_rule ? "Lolos aturan non-inferioritas" : "Belum lolos aturan non-inferioritas"}; {train.active ? "kini aktif." : "tidak diaktifkan."}
          </p>
        )}
      </Card>

      <Card title="Model peringkat">
        {!models.data ? (
          <Spinner />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pr-2">Model</th>
                {(["G", "R", "K", "D", "T", "U", "B"] as const).map((f) => (
                  <th key={f} className="pr-2 text-right" title={FEATURE_LABELS[f]}>
                    {f}
                  </th>
                ))}
                <th className="pr-2 text-right">NDCG@5 (CV)</th>
                <th />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {models.data.map((m) => {
                const cv = m.metrics.cv_ndcg5 as Stat95 | undefined;
                const cvm = (m.metrics.cv as Record<string, { ndcg5: Stat95 }> | undefined)?.model?.ndcg5;
                const v = cv ?? cvm;
                return (
                  <tr key={m.id} className="border-t border-line">
                    <td className="py-1.5 pr-2">
                      {m.name} <Badge tone={m.source === "expert" ? "good" : "neutral"}>{m.source}</Badge>
                    </td>
                    {(["G", "R", "K", "D", "T", "U", "B"] as const).map((f) => (
                      <td key={f} className="pr-2 text-right text-xs">
                        {num(m.weights[f])}
                      </td>
                    ))}
                    <td className="pr-2 text-right text-xs">{v ? `${num(v.mean, 3)} [${num(v.ci95[0], 3)}–${num(v.ci95[1], 3)}]` : "–"}</td>
                    <td className="text-right">
                      {m.active ? (
                        <Badge tone="good">aktif</Badge>
                      ) : (
                        <button className="text-xs text-brand underline" onClick={() => activate(m.id)}>
                          aktifkan
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {evalr.data && <EvaluationReport r={evalr.data} />}
    </div>
  );
}

interface EvalCondition {
  kendall_w_mean: number;
  cv: { methods: Record<string, Record<string, Stat95>> };
  ablation: Record<string, Stat95>;
  adaptivity: Record<string, { n: number; share_expected: number; share_agree: number }>;
  ndcg5_by_n_base: Record<string, number>;
}

const METHOD_LABEL: Record<string, string> = {
  model: "Model LTR",
  formula5: "Formula (5)",
  kesenjangan_terbesar: "Kesenjangan terbesar",
  kesenjangan_x_permintaan: "Kesenjangan × permintaan",
  llm_umum: "LLM generik",
};
const COND_LABEL: Record<string, string> = { titik_hambat: "Pakar: titik hambat", kesenjangan_permintaan: "Pakar: kesenjangan × permintaan", campuran: "Pakar: campuran" };

function EvaluationReport({ r }: { r: { note: string; n_scenarios: number; n_base: number; market_version: string; llm_baseline: string; conditions: Record<string, EvalCondition> } }) {
  return (
    <Card title="Laporan evaluasi (simulasi kelayakan)">
      <p className="mb-4 text-sm text-muted">
        {r.note} {r.n_scenarios} skenario ({r.n_base} dasar × 3 varian), pasar {r.market_version}. Pembanding LLM: {r.llm_baseline}.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(r.conditions).map(([k, c]) => (
          <div key={k} className="rounded-lg border border-line p-3">
            <div className="mb-2 font-semibold">{COND_LABEL[k] ?? k}</div>
            <div className="mb-2 text-xs text-muted">Kendall W antarpakar {num(c.kendall_w_mean, 3)}</div>
            <table className="w-full text-xs tabular-nums">
              <thead className="text-muted">
                <tr>
                  <th className="text-left">Metode</th>
                  <th className="text-right">NDCG@5</th>
                  <th className="text-right">τ</th>
                  <th className="text-right">top-3</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(c.cv.methods).map(([m, v]) => (
                  <tr key={m} className={m === "model" ? "font-semibold" : ""}>
                    <td>{METHOD_LABEL[m] ?? m}</td>
                    <td className="text-right">{num(v.ndcg5?.mean, 3)}</td>
                    <td className="text-right">{num(v.kendall_tau?.mean, 2)}</td>
                    <td className="text-right">{num(v.top3?.mean, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-muted">
              Ablasi: tanpa fitur graf {num(c.ablation.tanpa_fitur_graf?.mean, 3)} · tanpa tren {num(c.ablation.tanpa_fitur_tren?.mean, 3)}
            </div>
            <div className="mt-1 text-xs text-muted">
              Adaptivitas: kompetensi {num(c.adaptivity.competency?.share_agree, 2)} · pasar {num(c.adaptivity.market?.share_agree, 2)} searah pakar
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
