"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Database, GitBranch, Route, ShieldCheck } from "lucide-react";
import { api, type Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { setStudentId, useStudentId } from "@/lib/student";
import { Button, Card, ErrorBox, Field, inputCls } from "@/components/ui";

const PROGRAMS = ["Sistem Informasi", "Teknik Informatika", "Manajemen", "Akuntansi", "Statistika", "Lainnya"];

export default function Home() {
  const router = useRouter();
  const { id, ready } = useStudentId();
  const meta = useApi<Meta>("/meta");
  const [name, setName] = useState("");
  const [program, setProgram] = useState(PROGRAMS[0]);
  const [role, setRole] = useState("business_analyst");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [resume, setResume] = useState("");

  // returning visitors go straight to their dashboard (only on first load, not right after creating a profile)
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!ready || checked) return;
    setChecked(true);
    if (id) router.replace("/dasbor");
  }, [ready, id, checked, router]);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ id: string }>("/students", { display_name: name || "Mahasiswa", program, target_role: role, consent });
      setStudentId(r.id);
      router.push("/profil");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  async function doResume() {
    setErr(null);
    try {
      await api.get(`/students/${resume.trim()}`);
      setStudentId(resume.trim());
      router.push("/dasbor");
    } catch (e) {
      setErr(e);
    }
  }

  const m = meta.data;
  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Navigator belajar adaptif</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight text-ink">
          Tahu persis skill mana yang harus dipelajari <span className="text-brand">sekarang</span>, dan kenapa.
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          PathSync membaca lowongan kerja nyata, mengukur kompetensimu dari bukti (transkrip, sertifikat, proyek, asesmen), lalu
          menyusun jalur belajar yang mendahulukan <b>titik hambat</b>, yaitu skill yang menahan kemajuan skill lain.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            { icon: Database, t: "Data pasar nyata", d: m ? `${m.n_postings} lowongan unik dari Karirhub Kemnaker & ATS perusahaan` : "Lowongan Karirhub Kemnaker & ATS perusahaan" },
            { icon: BadgeCheck, t: "Berbasis bukti", d: "Klaim CV dan penilaian diri tidak dihitung sebagai penguasaan" },
            { icon: GitBranch, t: "Sadar prasyarat", d: "Graf prasyarat 42 skill menentukan apa yang siap dipelajari" },
            { icon: Route, t: "Bisa dijelaskan", d: "Setiap prioritas punya alasan, kutipan lowongan, dan kontrafaktual" },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <div className="text-sm font-semibold">{t}</div>
                <div className="text-xs text-muted">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Card title="Mulai profil baru">
          <div className="space-y-4">
            <Field label="Nama panggilan">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Rani" />
            </Field>
            <Field label="Program studi">
              <select className={inputCls} value={program} onChange={(e) => setProgram(e.target.value)}>
                {PROGRAMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Peran target">
              <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
                {(m?.roles ?? [{ id: "business_analyst", name: "Business Analyst" }]).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex gap-3 rounded-lg bg-subtle p-3 text-xs text-muted">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-brand" />
                Saya setuju data akademik, dokumen, dan jawaban asesmen saya diproses untuk menyusun rekomendasi belajar. Data tidak dibagikan ke
                pihak lain dan dapat dihapus kapan saja.
              </span>
            </label>
            <ErrorBox error={err} />
            <Button onClick={start} disabled={!consent} loading={busy} className="w-full">
              Buat profil
            </Button>
          </div>
        </Card>
        <Card title="Sudah punya profil?">
          <div className="flex gap-2">
            <input className={inputCls} value={resume} onChange={(e) => setResume(e.target.value)} placeholder="ID profil" />
            <Button variant="secondary" onClick={doResume} disabled={!resume.trim()}>
              Lanjutkan
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
