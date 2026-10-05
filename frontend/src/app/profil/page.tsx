"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { api, num, type Meta, type Student } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { RequireStudent } from "@/components/require-student";
import { Badge, Button, Card, Empty, ErrorBox, Field, inputCls, PageHeader, Spinner, Tabs } from "@/components/ui";

type Tab = "transkrip" | "sertifikat" | "cv" | "proyek" | "kuesioner";

interface Catalog {
  courses: { name: string; programs: string[] }[];
  certificates: { name: string; level: string; score_scale: string | null }[];
  grades: string[];
}

export default function ProfilPage() {
  return <RequireStudent>{(sid) => <Profil sid={sid} />}</RequireStudent>;
}

function Profil({ sid }: { sid: string }) {
  const [tab, setTab] = useState<Tab>("transkrip");
  const student = useApi<Student>(`/students/${sid}`);
  const meta = useApi<Meta>("/meta");
  const catalog = useApi<Catalog>("/catalog");
  const names = useMemo(() => Object.fromEntries((meta.data?.skills ?? []).map((s) => [s.id, s.name])), [meta.data]);

  return (
    <div>
      <PageHeader
        title="Profil & Bukti Kompetensi"
        subtitle="Tambahkan bukti sebanyak yang kamu punya. Bobot bukti berbeda: asesmen 0,50 · proyek 0,30 · sertifikat 0,25 · transkrip 0,20. Klaim CV hanya dipakai untuk konfirmasi, penilaian diri tidak dihitung sebagai penguasaan."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" href="/asesmen">
              Asesmen diagnostik
            </Button>
            <Button href="/dasbor">Lihat dasbor</Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "transkrip", label: "Transkrip" },
              { id: "sertifikat", label: "Sertifikat" },
              { id: "cv", label: "CV" },
              { id: "proyek", label: "Proyek" },
              { id: "kuesioner", label: "Kuesioner" },
            ]}
          />
          {tab === "transkrip" && <Transcript sid={sid} names={names} catalog={catalog.data} onSaved={student.reload} />}
          {tab === "sertifikat" && <Certificates sid={sid} names={names} catalog={catalog.data} onSaved={student.reload} />}
          {tab === "cv" && <CV sid={sid} names={names} onSaved={student.reload} />}
          {tab === "proyek" && <Project sid={sid} names={names} onSaved={student.reload} />}
          {tab === "kuesioner" && student.data && meta.data && <Questionnaire student={student.data} meta={meta.data} onSaved={student.reload} />}
        </div>
        <EvidenceList sid={sid} student={student.data} onChange={student.reload} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ evidence list
const KIND_LABEL: Record<string, string> = { academic: "Transkrip", certificate: "Sertifikat", cv: "CV", project: "Proyek" };

function EvidenceList({ sid, student, onChange }: { sid: string; student: Student | null; onChange: () => void }) {
  if (!student) return <Spinner />;
  return (
    <Card title="Bukti tersimpan" className="h-fit">
      <p className="mb-3 text-xs text-muted">
        ID profil: <code className="rounded bg-subtle px-1">{sid}</code> (simpan untuk melanjutkan di perangkat lain)
      </p>
      {student.evidence.length === 0 && student.n_responses === 0 ? (
        <Empty>Belum ada bukti.</Empty>
      ) : (
        <ul className="space-y-2">
          {student.evidence.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-2 rounded-lg bg-subtle px-3 py-2 text-sm">
              <div className="min-w-0">
                <Badge tone="brand">{KIND_LABEL[e.kind] ?? e.kind}</Badge>
                <div className="mt-1 truncate font-medium" title={e.title}>
                  {e.title}
                </div>
                <div className="text-xs text-muted">
                  {e.kind === "cv"
                    ? `${((e.details.claim_ids as string[]) ?? []).length} klaim skill`
                    : `${Object.keys(e.scores).length} skill terpetakan`}
                </div>
              </div>
              <button
                className="text-muted hover:text-red-600"
                title="Hapus bukti"
                onClick={async () => {
                  if (!confirm("Hapus bukti ini?")) return;
                  await api.del(`/students/${sid}/evidence/${e.id}`);
                  onChange();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {student.n_responses > 0 && (
            <li className="rounded-lg bg-subtle px-3 py-2 text-sm">
              <Badge tone="good">Asesmen</Badge>
              <div className="mt-1 font-medium">{student.n_responses} butir terjawab</div>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

function ScoreTable({ scores, names }: { scores: Record<string, number>; names: Record<string, string> }) {
  const rows = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p className="text-sm text-muted">Tidak ada skill yang terpetakan.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {rows.map(([k, v]) => (
        <Badge key={k} tone="brand">
          {names[k] ?? k} · {num(v)}
        </Badge>
      ))}
    </div>
  );
}

function FileOrText({ text, setText, file, setFile, placeholder, accept }: {
  text: string;
  setText: (s: string) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  placeholder: string;
  accept: string;
}) {
  return (
    <div className="space-y-2">
      <textarea className={`${inputCls} h-48 font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} disabled={!!file} />
      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 hover:bg-subtle">
          <Upload className="h-4 w-4" /> Unggah berkas
          <input type="file" accept={accept} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && (
          <span className="flex items-center gap-2 text-muted">
            <FileText className="h-4 w-4" /> {file.name}
            <button className="text-xs underline" onClick={() => setFile(null)}>
              batal
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ transcript
interface CourseRow {
  name: string;
  grade: string;
}
interface CourseDetail {
  input: string;
  matched: string | null;
  similarity: number;
  method: string;
  grade: string;
  contribution: Record<string, number>;
}

function Transcript({ sid, names, catalog, onSaved }: { sid: string; names: Record<string, string>; catalog: Catalog | null; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [result, setResult] = useState<{ scores: Record<string, number>; courses: CourseDetail[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);

  async function parse() {
    setBusy("parse");
    setErr(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("text", text);
      const r = await api.post<{ courses: CourseRow[] }>(`/students/${sid}/transcript/parse`, fd);
      setRows(r.courses);
      if (!r.courses.length) setErr(new Error("Tidak ada baris 'mata kuliah + nilai' yang terbaca. Tambahkan manual di bawah."));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setErr(null);
    try {
      const r = await api.post<{ scores: Record<string, number>; courses: CourseDetail[] }>(`/students/${sid}/evidence/academic`, {
        courses: rows.filter((r) => r.name.trim() && r.grade),
      });
      setResult(r);
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  }

  const grades = catalog?.grades ?? ["A", "A-", "B+", "B", "B-", "C+", "C", "D", "E"];
  return (
    <div className="space-y-4">
      <Card title="1. Tempel atau unggah transkrip">
        <FileOrText
          text={text}
          setText={setText}
          file={file}
          setFile={setFile}
          accept=".pdf,.docx,.txt,.csv"
          placeholder={"Basis Data, A\nAnalisis dan Perancangan Sistem, B+\nStatistika Bisnis\tB\nSIF2201 Sistem Informasi Manajemen 3 A-"}
        />
        <div className="mt-3 flex gap-2">
          <Button onClick={parse} loading={busy === "parse"} disabled={!file && text.trim().length < 4}>
            Baca transkrip
          </Button>
          <Button variant="ghost" onClick={() => setRows([...rows, { name: "", grade: "A" }])}>
            <Plus className="h-4 w-4" /> Tambah manual
          </Button>
        </div>
      </Card>

      {rows.length > 0 && (
        <Card title={`2. Periksa ${rows.length} mata kuliah`}>
          <datalist id="courses">
            {catalog?.courses.map((c) => <option key={c.name} value={c.name} />)}
          </datalist>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  list="courses"
                  className={inputCls}
                  value={r.name}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <select
                  className={`${inputCls} w-24`}
                  value={r.grade}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))}
                >
                  {grades.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
                <button className="px-2 text-muted hover:text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button onClick={save} loading={busy === "save"}>
              Simpan sebagai bukti akademik
            </Button>
          </div>
        </Card>
      )}
      <ErrorBox error={err} />
      {result && (
        <Card title="Hasil pemetaan mata kuliah → skill">
          <ScoreTable scores={result.scores} names={names} />
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1">Mata kuliah</th>
                <th>Nilai</th>
                <th>Cocok dengan</th>
                <th>Kontribusi</th>
              </tr>
            </thead>
            <tbody>
              {result.courses.map((c, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-2 pr-2">{c.input}</td>
                  <td>{c.grade}</td>
                  <td className="pr-2 text-xs">
                    {c.matched ?? <span className="text-muted">—</span>}
                    <div className="text-muted">
                      {c.method} · {num(c.similarity)}
                    </div>
                  </td>
                  <td className="text-xs">
                    {Object.entries(c.contribution)
                      .map(([k, v]) => `${names[k] ?? k} ${num(v)}`)
                      .join(", ") || <span className="text-muted">tidak terpetakan</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ certificates
function Certificates({ sid, names, catalog, onSaved }: { sid: string; names: Record<string, string>; catalog: Catalog | null; onSaved: () => void }) {
  const [rows, setRows] = useState<{ name: string; score: string }[]>([{ name: "", score: "" }]);
  const [result, setResult] = useState<{ scores: Record<string, number>; certificates: { input: string; matched: string | null; level: string; method: string; contribution: Record<string, number> }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const scale = (n: string) => catalog?.certificates.find((c) => c.name === n)?.score_scale;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const certificates = rows
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name.trim(), ...(r.score ? { score: Number(r.score) } : {}) }));
      const r = await api.post<NonNullable<typeof result>>(`/students/${sid}/evidence/certificate`, { certificates });
      setResult(r);
      setRows([{ name: "", score: "" }]);
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Sertifikat & kursus">
        <p className="mb-3 text-sm text-muted">
          Pilih dari katalog ({catalog?.certificates.length ?? "…"} sertifikat) atau ketik nama lain; nama di luar katalog dipetakan dengan kemiripan
          makna dan dihitung setara kursus.
        </p>
        <datalist id="certs">
          {catalog?.certificates.map((c) => <option key={c.name} value={c.name} />)}
        </datalist>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input
                list="certs"
                className={inputCls}
                placeholder="mis. Google Data Analytics Professional Certificate"
                value={r.name}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              {scale(r.name) && (
                <input
                  className={`${inputCls} w-32`}
                  placeholder={`skor ${scale(r.name)?.toUpperCase()}`}
                  value={r.score}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, score: e.target.value } : x)))}
                />
              )}
              <button className="px-2 text-muted hover:text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" onClick={() => setRows([...rows, { name: "", score: "" }])}>
            <Plus className="h-4 w-4" /> Tambah baris
          </Button>
          <Button onClick={save} loading={busy} disabled={!rows.some((r) => r.name.trim())}>
            Simpan sertifikat
          </Button>
        </div>
      </Card>
      <ErrorBox error={err} />
      {result && (
        <Card title="Hasil pemetaan">
          <ScoreTable scores={result.scores} names={names} />
          <ul className="mt-3 space-y-1 text-sm">
            {result.certificates.map((c, i) => (
              <li key={i}>
                <b>{c.input}</b> → {c.matched ?? "di luar katalog"} <span className="text-muted">({c.level}, {c.method})</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ CV
function CV({ sid, names, onSaved }: { sid: string; names: Record<string, string>; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ extractor: string; claims: { skill_id: string; quote: string; level: string; surface: string }[]; new_candidates: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("text", text);
      setResult(await api.post(`/students/${sid}/evidence/cv`, fd));
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="CV">
        <p className="mb-3 text-sm text-muted">
          Skill yang disebut di CV dicatat sebagai <b>klaim</b>: tidak menaikkan penguasaan, tetapi membuat sistem menyarankan &ldquo;buktikan&rdquo;
          ketimbang &ldquo;pelajari&rdquo;.
        </p>
        <FileOrText text={text} setText={setText} file={file} setFile={setFile} accept=".pdf,.docx,.txt" placeholder="Tempel isi CV di sini…" />
        <div className="mt-3">
          <Button onClick={save} loading={busy} disabled={!file && text.trim().length < 20}>
            Ekstrak klaim
          </Button>
        </div>
      </Card>
      <ErrorBox error={err} />
      {result && (
        <Card title={`${result.claims.length} klaim ditemukan`} action={<Badge>ekstraktor: {result.extractor}</Badge>}>
          <ul className="space-y-2">
            {result.claims.map((c) => (
              <li key={c.skill_id} className="text-sm">
                <b>{names[c.skill_id] ?? c.skill_id}</b> <Badge>{c.level}</Badge>
                <blockquote className="mt-1 border-l-2 border-brand pl-3 text-xs text-muted">&ldquo;{c.quote}&rdquo;</blockquote>
              </li>
            ))}
          </ul>
          {result.new_candidates.length > 0 && <p className="mt-3 text-xs text-muted">Di luar taksonomi: {result.new_candidates.join(", ")}</p>}
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ project
interface Rating {
  skill_id: string;
  level: number;
  label: string;
  quote: string;
  rationale: string;
  score: number;
}

function Project({ sid, names, onSaved }: { sid: string; names: Record<string, string>; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ method: string; ratings: Rating[]; rejected: Rating[]; needs_human_review: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("title", title || file?.name || "Proyek");
      if (file) fd.append("file", file);
      else fd.append("text", text);
      setResult(await api.post(`/students/${sid}/evidence/project`, fd));
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Artefak proyek">
        <p className="mb-3 text-sm text-muted">
          Laporan analisis, notebook (.ipynb), kueri SQL, dokumen kebutuhan (BRD/user story). Setiap skill dinilai dengan rubrik 0–3 (tidak tampak,
          dasar, mandiri, mahir) dan <b>wajib</b> disertai kutipan dari artefakmu.
        </p>
        <div className="space-y-3">
          <Field label="Judul proyek">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Analisis churn pelanggan e-commerce" />
          </Field>
          <FileOrText text={text} setText={setText} file={file} setFile={setFile} accept=".pdf,.docx,.txt,.ipynb,.sql,.md,.py" placeholder="Tempel isi artefak…" />
        </div>
        <div className="mt-3">
          <Button onClick={save} loading={busy} disabled={!file && text.trim().length < 30}>
            Nilai artefak
          </Button>
        </div>
      </Card>
      <ErrorBox error={err} />
      {result && (
        <Card
          title={`${result.ratings.length} skill tampak di artefak`}
          action={
            <div className="flex gap-2">
              <Badge>metode: {result.method}</Badge>
              {result.needs_human_review && <Badge tone="warn">sampel cek manusia (20%)</Badge>}
            </div>
          }
        >
          <ul className="space-y-3">
            {result.ratings.map((r) => (
              <li key={r.skill_id} className="text-sm">
                <div className="flex items-center gap-2">
                  <b>{names[r.skill_id] ?? r.skill_id}</b>
                  <Badge tone="brand">
                    {r.level} · {r.label}
                  </Badge>
                </div>
                <blockquote className="mt-1 border-l-2 border-brand pl-3 font-mono text-xs text-muted">{r.quote}</blockquote>
                <p className="text-xs text-muted">{r.rationale}</p>
              </li>
            ))}
          </ul>
          {result.rejected.length > 0 && (
            <p className="mt-3 text-xs text-red-700">{result.rejected.length} penilaian ditolak karena kutipannya tidak ditemukan di artefak.</p>
          )}
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ questionnaire
function Questionnaire({ student, meta, onSaved }: { student: Student; meta: Meta; onSaved: () => void }) {
  const prefs = student.preferences as { weekly_hours?: number; format?: string; language?: string };
  const [hours, setHours] = useState(String(prefs.weekly_hours ?? 6));
  const [format, setFormat] = useState(prefs.format ?? "");
  const [language, setLanguage] = useState(prefs.language ?? "id");
  const [role, setRole] = useState(student.target_role);
  const [ratings, setRatings] = useState<Record<string, number>>(student.self_ratings ?? {});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => setSaved(false), [hours, format, language, role, ratings]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api.patch(`/students/${student.id}`, {
        target_role: role,
        preferences: { weekly_hours: Number(hours) || 6, format: format || null, language },
        self_ratings: ratings,
      });
      setSaved(true);
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  const byCluster = Object.entries(meta.clusters).map(([cid, label]) => ({ cid, label, skills: meta.skills.filter((s) => s.cluster === cid) }));
  return (
    <div className="space-y-4">
      <Card title="Preferensi belajar">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Peran target" hint="Mengganti peran memicu penyusunan ulang jalur (pemicu adaptif #3).">
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
              {meta.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Waktu belajar per minggu (jam)">
            <input type="number" min={1} max={40} className={inputCls} value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
          <Field label="Format materi yang disukai">
            <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Tidak ada preferensi</option>
              <option value="video">Video</option>
              <option value="teks">Teks / artikel</option>
              <option value="kursus">Kursus terstruktur</option>
              <option value="latihan">Latihan</option>
            </select>
          </Field>
          <Field label="Bahasa materi">
            <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="id">Utamakan bahasa Indonesia</option>
              <option value="en">Bahasa Inggris tidak masalah</option>
            </select>
          </Field>
        </div>
      </Card>
      <Card title="Penilaian diri (opsional)">
        <p className="mb-3 text-sm text-muted">
          Skala 1 (belum pernah) – 5 (sangat percaya diri). Tidak dihitung sebagai penguasaan; dipakai untuk menunjukkan selisih antara persepsi dan bukti.
        </p>
        <div className="space-y-5">
          {byCluster.map((c) => (
            <div key={c.cid}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{c.label}</div>
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {c.skills.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate" title={s.description}>
                      {s.name}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          onClick={() => setRatings({ ...ratings, [s.id]: v })}
                          className={`h-6 w-6 rounded text-xs ${ratings[s.id] === v ? "bg-brand text-white" : "bg-subtle text-muted hover:bg-brand-soft"}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <ErrorBox error={err} />
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={busy}>
          Simpan kuesioner
        </Button>
        {saved && <span className="text-sm text-emerald-700">Tersimpan.</span>}
      </div>
    </div>
  );
}
