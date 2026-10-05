"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, ChevronDown, Clock, ExternalLink, Lock, Quote as QuoteIcon, Target } from "lucide-react";
import { FEATURE_LABELS, num, pct, type Competency, type Dashboard, type PathStep, type RankRow } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { RequireStudent } from "@/components/require-student";
import { Badge, Button, Card, Empty, ErrorBox, Meter, PageHeader, Spinner, Stat } from "@/components/ui";

export default function DasborPage() {
  return <RequireStudent>{(sid) => <Dasbor sid={sid} />}</RequireStudent>;
}

function Dasbor({ sid }: { sid: string }) {
  const { data: d, error } = useApi<Dashboard>(`/students/${sid}/dashboard`);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Spinner label="Menghitung prioritas…" />;
  const names = Object.fromEntries(d.competencies.map((c) => [c.skill_id, c.name]));
  const hasEvidence = d.diagnostic_done || Object.values(d.evidence_summary).some((v) => v > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Halo, ${d.student.display_name}`}
        subtitle={
          <>
            Peran target <b>{d.role.name}</b> · peta pasar {d.market_version} ({d.role.n_postings} lowongan, acuan {d.role.reference_date}) · model {d.model.name}
          </>
        }
        action={
          <div className="flex gap-2">
            <Button variant="secondary" href="/profil">
              Tambah bukti
            </Button>
            <Button variant="secondary" href="/riwayat">
              Riwayat jalur
            </Button>
          </div>
        }
      />

      {!hasEvidence && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-amber-900">
              Belum ada bukti kompetensi, jadi semua skill masih dianggap di titik awal. Kerjakan asesmen diagnostik atau unggah transkrip agar prioritas
              mencerminkan dirimu.
            </p>
            <div className="flex gap-2">
              <Button href="/asesmen">Asesmen diagnostik</Button>
              <Button variant="secondary" href="/profil">
                Unggah bukti
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cakupan kesiapan" value={pct(d.coverage)} sub="persamaan (6): kebutuhan pasar yang sudah kamu kuasai" />
        <Stat label="Jalur saat ini" value={`${d.path.length} langkah`} sub={`≈ ${num(d.path_hours, 1)} jam · ${num(d.path_weeks, 1)} minggu`} />
        <Stat
          label="Bukti terkumpul"
          value={Object.values(d.evidence_summary).reduce((a, b) => a + b, 0)}
          sub={Object.entries(d.evidence_summary)
            .filter(([, v]) => v)
            .map(([k, v]) => `${v} ${EV_LABEL[k] ?? k}`)
            .join(" · ") || "belum ada"}
        />
        <Stat
          label="Tren pasar"
          value={d.role.trend_status === "ok" ? "aktif" : d.role.trend_status === "simulasi" ? "simulasi" : "belum cukup"}
          sub={d.role.trend_status === "insufficient" ? "butuh ≥15 lowongan per jendela 6 bulan" : "6 bulan terakhir vs sebelumnya"}
        />
      </div>

      <Card title="Cakupan per rumpun">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(d.coverage_by_cluster).map(([k, c]) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{c.label}</span>
                <span className="font-semibold">{pct(c.coverage)}</span>
              </div>
              <Meter value={c.coverage} />
            </div>
          ))}
        </div>
      </Card>

      {d.confirmations.length > 0 && (
        <Card title="Perlu konfirmasi">
          <ul className="space-y-2 text-sm">
            {d.confirmations.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <b>{c.name}</b>: {c.message}{" "}
                  <Link className="text-brand underline" href={`/asesmen/${c.skill_id}`}>
                    Buktikan
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Prioritas belajar</h2>
        {d.ranking.length === 0 ? (
          <Empty>Tidak ada kesenjangan tersisa untuk peran ini. Pertimbangkan peran berdekatan di Kuesioner.</Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {d.ranking.slice(0, 3).map((r) => (
              <PriorityCard key={r.skill_id} r={r} names={names} comp={d.competencies.find((c) => c.skill_id === r.skill_id)} />
            ))}
          </div>
        )}
      </div>

      <LearningPath d={d} names={names} />
      <Counterfactual d={d} names={names} />
      <FullRanking ranking={d.ranking} />
      <Competencies comps={d.competencies} perception={d.perception} />
    </div>
  );
}

const EV_LABEL: Record<string, string> = { academic: "transkrip", certificate: "sertifikat", project: "proyek", cv: "CV", assessment_items: "butir asesmen" };

// ------------------------------------------------------------------ priority card
function PriorityCard({ r, names, comp }: { r: RankRow; names: Record<string, string>; comp?: Competency }) {
  const e = r.explanation;
  return (
    <Card className="flex flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{r.rank}</span>
        {e?.bottleneck && <Badge tone="warn">titik hambat</Badge>}
        <Badge tone={r.rec_type === "buktikan" ? "good" : "brand"}>{r.rec_type}</Badge>
      </div>
      <h3 className="text-lg font-semibold leading-snug">{r.name}</h3>
      {comp && (
        <div className="mt-2">
          <Meter value={comp.p} target={comp.required} />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>
              sekarang {num(comp.p)} ({comp.level})
            </span>
            <span>target {num(comp.required)}</span>
          </div>
        </div>
      )}
      {e && (
        <dl className="mt-4 space-y-3 text-sm">
          <QA q="Apa yang dipelajari?" a={e.what} />
          <QA q="Mengapa penting?" a={e.why} />
          <QA q="Mengapa sekarang?" a={e.why_now} />
          <QA q="Setelah ini?" a={e.next} />
        </dl>
      )}
      {e && e.quotes.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Bukti dari lowongan</div>
          {e.quotes.slice(0, 2).map((q) => (
            <a key={q.posting_id} href={q.url} target="_blank" rel="noreferrer" className="block rounded-lg bg-subtle p-2.5 text-xs hover:bg-brand-soft">
              <QuoteIcon className="mb-1 h-3 w-3 text-brand" />
              <span className="italic">{q.quote.replace(/^[-•\s]+/, "")}</span>
              <span className="mt-1 block text-muted">
                {q.title} · {q.company}
              </span>
            </a>
          ))}
        </div>
      )}
      <Contributions c={r.contributions} />
      <div className="mt-auto flex gap-2 pt-4">
        <Button href={`/asesmen/${r.skill_id}`} variant={r.rec_type === "buktikan" ? "primary" : "secondary"} className="flex-1">
          Buktikan kemajuan
        </Button>
      </div>
      {r.blocked_by.length > 0 && <p className="mt-2 text-xs text-muted">Menunggu: {r.blocked_by.map((b) => names[b] ?? b).join(", ")}</p>}
    </Card>
  );
}

function QA({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-brand-strong">{q}</dt>
      <dd className="text-ink/90">{a}</dd>
    </div>
  );
}

function Contributions({ c }: { c: Record<string, number> }) {
  const entries = Object.entries(c).filter(([, v]) => Math.abs(v) > 0.001);
  const max = Math.max(0.01, ...entries.map(([, v]) => Math.abs(v)));
  if (!entries.length) return null;
  return (
    <details className="mt-4 text-xs">
      <summary className="cursor-pointer text-muted">Kontribusi fitur ke skor model</summary>
      <div className="mt-2 space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr_44px] items-center gap-2">
            <span className="text-muted">{FEATURE_LABELS[k]}</span>
            <div className="relative h-2 rounded bg-subtle">
              <div className="absolute top-0 h-2 w-px bg-line" style={{ left: "50%" }} />
              <div
                className={`absolute top-0 h-2 rounded ${v >= 0 ? "bg-brand" : "bg-red-400"}`}
                style={v >= 0 ? { left: "50%", width: `${(v / max) * 50}%` } : { right: "50%", width: `${(-v / max) * 50}%` }}
              />
            </div>
            <span className="text-right tabular-nums">{v > 0 ? "+" : ""}{num(v)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-muted">Skor = Σ bobot × log(fitur). Kontribusi negatif menurunkan prioritas (mis. kesenjangan kecil).</p>
    </details>
  );
}

// ------------------------------------------------------------------ learning path
function LearningPath({ d, names }: { d: Dashboard; names: Record<string, string> }) {
  return (
    <Card
      title="Jalur belajar"
      action={
        <span className="flex items-center gap-1 text-xs text-muted">
          <Clock className="h-3.5 w-3.5" /> {num(d.path_hours, 1)} jam · {String(d.student.preferences.weekly_hours ?? 6)} jam/minggu
        </span>
      }
    >
      <p className="mb-4 text-sm text-muted">Tiga prioritas teratas ditambah prasyarat yang belum dikuasai, diurutkan topologis sehingga tidak ada langkah yang tertahan.</p>
      <ol className="relative space-y-4 border-l-2 border-line pl-6">
        {d.path.map((p, i) => (
          <PathItem key={p.skill_id} p={p} i={i} names={names} />
        ))}
      </ol>
    </Card>
  );
}

function PathItem({ p, i, names }: { p: PathStep; i: number; names: Record<string, string> }) {
  const [open, setOpen] = useState(i === 0);
  const prereq = p.role_in_path !== "prioritas";
  return (
    <li className="relative">
      <span className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${prereq ? "bg-amber-100 text-amber-800" : "bg-brand text-white"}`}>
        {i + 1}
      </span>
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(!open)}>
        <div>
          <div className="font-semibold">{p.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
            <Badge tone={prereq ? "warn" : "brand"}>{prereq ? "prasyarat" : `prioritas #${p.rank}`}</Badge>
            <span>
              {p.level_now} → {p.level_target}
            </span>
            <span>≈ {num(p.hours, 1)} jam</span>
            {p.waiting_for.length > 0 && (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" /> setelah {p.waiting_for.map((w) => names[w] ?? w).join(", ")}
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {p.why_prereq && <p className="text-sm text-amber-900">{p.why_prereq}</p>}
          <p className="text-sm">
            <span className="font-medium">Fokus:</span> {p.learn_what}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {p.materials.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="group rounded-lg border border-line p-3 text-sm hover:border-brand">
                <div className="flex items-start justify-between gap-2">
                  <BookOpen className="h-4 w-4 shrink-0 text-brand" />
                  <ExternalLink className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100" />
                </div>
                <div className="mt-1 font-medium leading-snug">{m.title}</div>
                <div className="mt-1 text-xs text-muted">
                  {m.provider} · {m.format} · {m.language.toUpperCase()} · {m.hours} jam
                </div>
              </a>
            ))}
          </div>
          <Button variant="ghost" href={`/asesmen/${p.skill_id}`}>
            Sudah belajar? Buktikan kemajuan <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

// ------------------------------------------------------------------ counterfactual
function Counterfactual({ d, names }: { d: Dashboard; names: Record<string, string> }) {
  const cf = d.counterfactual;
  return (
    <Card title="Bagaimana jika urutannya berbeda?">
      <p className="mb-3 text-sm text-muted">
        Perbandingan urutan PathSync dengan urutan naif. &ldquo;Langkah tertahan&rdquo; = skill yang dijadwalkan sebelum prasyaratnya terpenuhi.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-3">Strategi</th>
              <th className="pr-3">Urutan</th>
              <th className="text-right">Tertahan</th>
            </tr>
          </thead>
          <tbody>
            {cf.alternatives.map((a, i) => (
              <tr key={a.label} className="border-t border-line align-top">
                <td className="py-2 pr-3 font-medium">
                  {a.label} {i === 0 && <CheckCircle2 className="inline h-4 w-4 text-brand" />}
                </td>
                <td className="py-2 pr-3 text-xs">{a.order.map((s) => names[s] ?? s).join(" → ")}</td>
                <td className={`py-2 text-right font-semibold ${a.blocked ? "text-red-700" : "text-emerald-700"}`}>{a.blocked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cf.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {cf.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ full ranking
function FullRanking({ ranking }: { ranking: RankRow[] }) {
  const [all, setAll] = useState(false);
  const rows = all ? ranking : ranking.slice(0, 10);
  return (
    <Card title={`Peringkat lengkap (${ranking.length} skill dengan kesenjangan)`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-2">#</th>
              <th className="pr-2">Skill</th>
              {(["G", "R", "K", "D", "T", "U", "B"] as const).map((f) => (
                <th key={f} className="pr-2 text-right" title={FEATURE_LABELS[f]}>
                  {f}
                </th>
              ))}
              <th className="text-right">Prioritas</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.skill_id} className="border-t border-line">
                <td className="py-1.5 pr-2 text-muted">{r.rank}</td>
                <td className="pr-2">
                  {r.name} {r.explanation?.bottleneck && <Badge tone="warn">hambat</Badge>}
                </td>
                {(["G", "R", "K", "D", "T", "U", "B"] as const).map((f) => (
                  <td key={f} className="pr-2 text-right text-xs">
                    {num(r.features[f])}
                  </td>
                ))}
                <td className="text-right font-semibold">{num(r.priority, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        G kesenjangan · R kesiapan prasyarat · K keyakinan bukti · D permintaan · T tren · U membuka skill lain · B titik hambat.
      </p>
      {ranking.length > 10 && (
        <button className="mt-2 text-sm text-brand underline" onClick={() => setAll(!all)}>
          {all ? "Tampilkan 10 teratas" : `Tampilkan semua ${ranking.length}`}
        </button>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ competencies
function Competencies({ comps, perception }: { comps: Competency[]; perception: Dashboard["perception"] }) {
  const [filter, setFilter] = useState<"gap" | "all">("gap");
  const rows = useMemo(
    () => (filter === "gap" ? comps.filter((c) => c.gap > 0.01) : comps).slice().sort((a, b) => b.demand - a.demand),
    [comps, filter],
  );
  return (
    <Card
      title="Profil kompetensi"
      action={
        <select className="rounded border border-line px-2 py-1 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as "gap" | "all")}>
          <option value="gap">Hanya yang masih kurang</option>
          <option value="all">Semua skill</option>
        </select>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-2">Skill</th>
              <th className="w-40 pr-2">Penguasaan vs target</th>
              <th className="pr-2 text-right">Keyakinan</th>
              <th className="pr-2 text-right">Permintaan</th>
              <th>Sumber bukti</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.skill_id} className="border-t border-line align-top">
                <td className="py-2 pr-2">
                  {c.name}
                  {c.esco && <span className="ml-1 text-xs text-muted">({c.esco})</span>}
                </td>
                <td className="py-2 pr-2">
                  <Meter value={c.p} target={c.required} />
                  <div className="mt-1 text-xs text-muted">
                    {num(c.p)} / {num(c.required)}
                  </div>
                </td>
                <td className="py-2 pr-2 text-right text-xs">
                  {num(c.confidence)} {c.low_confidence && <Badge tone="warn">rendah</Badge>}
                </td>
                <td className="py-2 pr-2 text-right text-xs">{pct(c.demand)}</td>
                <td className="py-2 text-xs text-muted">
                  {Object.values(c.sources).flat().join("; ") || "belum ada"}
                  {c.claimed && <Badge>klaim CV</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {perception.length > 0 && (
        <div className="mt-4 rounded-lg bg-subtle p-3 text-sm">
          <div className="mb-1 flex items-center gap-1 font-medium">
            <Target className="h-4 w-4" /> Persepsi vs bukti
          </div>
          <ul className="space-y-0.5 text-xs text-muted">
            {perception.map((p) => (
              <li key={p.skill_id}>
                {p.name}: penilaian diri {p.self_rating}/5, bukti {num(p.p)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
