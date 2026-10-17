"use client";

import { useState } from "react";
import { GraduationCap, Lock } from "lucide-react";
import { pct, titleCase } from "@/lib/format";
import type { Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { setStaffToken, useStaffToken } from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { StaffLogin } from "@/components/staff-login";
import { EmptyState, ErrorNote, Loading, MasteryBar, NativeSelect, PageHeader, Panel, SectionTitle, Tag } from "@/components/kit";
import { useT } from "@/lib/i18n";

interface CohortRow {
  id: string;
  name: string;
  institution: string;
  join_code: string;
  n_students: number;
}
interface SkillRow {
  skill_id: string;
  name: string;
  cluster: string;
  mean_mastery: number;
  required: number;
  share_below_required: number;
  demand: number;
}
interface Report {
  n_students: number;
  hidden: boolean;
  message?: string;
  skills?: SkillRow[];
  top_gaps?: SkillRow[];
  courses?: { course: string; students: number }[];
  clarity_mean?: number | null;
  clarity_n?: number;
  weekly_goal_completion?: number | null;
}

export default function AdvisorPage() {
  const { token, ready } = useStaffToken("advisor");
  const cohorts = useApi<CohortRow[]>(token ? "/advisor/cohorts" : null);
  const [sel, setSel] = useState<string>("");
  const meta = useApi<Meta>("/meta");
  const [role, setRole] = useState("business_analyst");
  const t = useT();
  const current = sel || cohorts.data?.[0]?.id || "";
  const report = useApi<Report>(current ? `/advisor/cohorts/${current}/report?role=${role}` : null);

  if (!ready) return <Loading />;
  if (!token || cohorts.error)
    return (
      <div className="mx-auto max-w-md">
        <PageHeader mascot="advisor" title={t("Lecturer View", "Tampilan Dosen")} description={t("Class-level insight: where your students stand against what employers ask for.", "Wawasan tingkat kelas: posisi mahasiswamu dibandingkan yang diminta employer.")} />
        <Panel>
          <StaffLogin role="advisor" error={cohorts.error} hint={t("Use the lecturer key you received when your class was created.", "Gunakan key dosen yang kamu terima saat kelasmu dibuat.")} />
        </Panel>
      </div>
    );
  if (!cohorts.data) return <Loading />;
  if (!cohorts.data.length) return <EmptyState title={t("No Classes Yet", "Belum Ada Kelas")} mascot="group">{t("Ask the PathSync team to create a class for you.", "Minta tim PathSync membuatkan kelas untukmu.")}</EmptyState>;
  const co = cohorts.data.find((c) => c.id === current)!;
  return (
    <div className="space-y-12">
      <PageHeader mascot="advisor"
        title={t("Lecturer View", "Tampilan Dosen")}
        description={t("Anonymous, class-level gaps against the job market. Use it to plan class sessions, assignments and electives.", "Gap anonim tingkat kelas dibandingkan pasar kerja. Gunakan untuk merencanakan sesi kelas, tugas, dan mata kuliah pilihan.")}
        actions={
          <Button variant="outline" onClick={() => setStaffToken("advisor", null)}>
            {t("Sign Out", "Keluar")}
          </Button>
        }
      />
      <Panel className="flex flex-wrap items-center gap-4">
        <GraduationCap className="size-6 text-indigo" aria-hidden="true" />
        <NativeSelect aria-label={t("Class", "Kelas")} value={current} onChange={(e) => setSel(e.target.value)} className="min-w-0 flex-1">
          {cohorts.data.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.n_students} {t("students", "mahasiswa")})
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={t("Target role", "Target role")} value={role} onChange={(e) => setRole(e.target.value)}>
          {(meta.data?.roles ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </NativeSelect>
        <span className="text-sm">
          {t("Students join with code", "Mahasiswa bergabung dengan kode")}{" "}
          <code className="font-mono font-semibold text-indigo" translate="no">
            {co.join_code}
          </code>
        </span>
      </Panel>
      {report.error ? <ErrorNote error={report.error} /> : !report.data ? <Loading /> : report.data.hidden ? (
        <EmptyState mascot="group" title={t(`${report.data.n_students} Student${report.data.n_students === 1 ? "" : "s"} So Far`, `Baru ${report.data.n_students} Mahasiswa`)}>
          <span className="inline-flex items-center gap-1">
            <Lock className="size-4" aria-hidden="true" /> {report.data.message}
          </span>
        </EmptyState>
      ) : (
        <CohortReport r={report.data} />
      )}
    </div>
  );
}

function CohortReport({ r }: { r: Report }) {
  const t = useT();
  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-ink/70">{t("Students in this view", "Mahasiswa di tampilan ini")}</dt>
          <dd className="tabular mt-1 text-2xl font-bold">{r.n_students}</dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-ink/70">{t("Direction clarity (1-5)", "Kejelasan arah (1-5)")}</dt>
          <dd className="tabular mt-1 text-2xl font-bold">{r.clarity_mean ?? "–"}</dd>
          <dd className="text-xs text-muted-foreground">{t(`${r.clarity_n ?? 0} answers from weekly reflections`, `${r.clarity_n ?? 0} jawaban dari refleksi mingguan`)}</dd>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <dt className="text-sm text-ink/70">{t("Weekly goals completed", "Target mingguan selesai")}</dt>
          <dd className="tabular mt-1 text-2xl font-bold">{r.weekly_goal_completion != null ? pct(r.weekly_goal_completion) : "–"}</dd>
        </div>
      </dl>
      <section>
        <SectionTitle>{t("Biggest Gaps Against the Market", "Gap Terbesar Dibandingkan Pasar")}</SectionTitle>
        <p className="mb-3 text-sm text-ink/70">{t("Ordered by demand × (required level − class average mastery).", "Diurutkan dari demand × (level yang dibutuhkan − rata-rata mastery kelas).")}</p>
        <ul className="space-y-3">
          {r.top_gaps?.map((s) => (
            <li key={s.skill_id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{titleCase(s.name)}</span>
                <span className="flex gap-2">
                  <Tag tone="ember">{t(`${pct(s.share_below_required)} below required`, `${pct(s.share_below_required)} di bawah syarat`)}</Tag>
                  <Tag>{t(`in ${pct(s.demand)} of postings`, `di ${pct(s.demand)} posting`)}</Tag>
                </span>
              </div>
              <MasteryBar value={s.mean_mastery} target={s.required} className="mt-2" />
            </li>
          ))}
        </ul>
      </section>
      {r.courses?.length ? (
        <section>
          <SectionTitle>{t("Courses Your Students Link to Their Route", "Mata Kuliah yang Dihubungkan Mahasiswa ke Rutenya")}</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {r.courses.map((c) => (
              <li key={c.course}>
                <Tag>
                  {c.course} · {c.students}
                </Tag>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
