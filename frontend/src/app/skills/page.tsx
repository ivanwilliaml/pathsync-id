"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Dashboard, Student } from "@/lib/api";
import { FORMAT, pct } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { EvidenceList } from "@/components/evidence-list";
import { ErrorNote, FolderTabs, LinkButton, Loading, PageHeader, TabPanel } from "@/components/kit";
import { SkillCollection, SoftSkills } from "@/components/my-skills";
import { RequireStudent } from "@/components/require-student";
import { Attention } from "@/components/skill-insights";
import { useSkillSheet } from "@/components/skill-sheet";

export default function SkillsPage() {
  return <RequireStudent>{(sid) => <UnderstandSkills sid={sid} />}</RequireStudent>;
}

const KIND: Record<string, [string, string]> = {
  academic: ["transcript", "transkrip"],
  certificate: ["certificates", "sertifikat"],
  project: ["projects", "project"],
  cv: ["CV", "CV"],
};

type View = "skills" | "evidence";

/** ?view=evidence opens the evidence view; back/forward follow the switch. */
function useView() {
  const [view, setView] = useState<View>("skills");
  useEffect(() => {
    const read = () => setView(new URLSearchParams(window.location.search).get("view") === "evidence" ? "evidence" : "skills");
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const go = useCallback((v: View) => {
    setView(v);
    const u = new URL(window.location.href);
    if (v === "evidence") u.searchParams.set("view", v);
    else u.searchParams.delete("view");
    window.history.pushState(window.history.state, "", u);
  }, []);
  return [view, go] as const;
}

/** Stage 1, Understand Your Skills. A one-line summary with the two ways to add proof, then two views of the same
 * profile: the skills (priorities first) and the evidence behind them with the learning preferences. The evidence
 * wizard (/evidence) and the skill check (/assessment) are reached from here. */
function UnderstandSkills({ sid }: { sid: string }) {
  const t = useT();
  const dash = useApi<Dashboard>(`/students/${sid}/dashboard`);
  const student = useApi<Student>(`/students/${sid}`);
  const [view, setView] = useView();
  const d = dash.data;
  const { open, sheet } = useSkillSheet(d);
  if (dash.error) return <ErrorNote error={dash.error} />;
  if (!d) return <Loading label={t("Reading your skills…", "Membaca skill-mu…")} />;
  const f = d.features ?? { evidence: true, graph: true, adaptive: true, explanations: true, path: true };
  const hasEvidence = d.diagnostic_done || Object.entries(d.evidence_summary).some(([, v]) => v > 0);
  const ev = Object.entries(d.evidence_summary).filter(([k, v]) => k in KIND && v > 0);
  const items = d.evidence_summary.assessment_items ?? 0;
  const nEvidence = ev.reduce((a, [, v]) => a + v, 0);

  return (
    <div>
      {/* one header: where you stand in a single line, the two ways to add proof, and the page's tabs as its edge */}
      <PageHeader
        title={t("Understand Your Skills", "Kenali Skill")}
        stats={[
          [t("Target", "Target"), <Link key="r" href="/careers" className="underline-offset-4 hover:underline">{d.role.name}</Link>],
          [t("Readiness", "Readiness"), hasEvidence ? pct(d.coverage) : "–"],
          [t("Evidence", "Bukti"), ev.length ? t(ev.map(([k, v]) => `${v} ${KIND[k][0]}`).join(", "), ev.map(([k, v]) => `${v} ${KIND[k][1]}`).join(", ")) : t("None yet", "Belum ada")],
          [t("Skill check", "Cek Kemampuan"), d.diagnostic_done ? t(`${items} answers`, `${items} jawaban`) : t("Not taken", "Belum diikuti")],
        ]}
        actions={
          <>
            <LinkButton href="/evidence" size="sm" variant={d.diagnostic_done ? "default" : "outline"}>{t("Add Evidence", "Tambah Bukti")}</LinkButton>
            <LinkButton href="/assessment" size="sm" variant={d.diagnostic_done ? "outline" : "default"}>
              {d.diagnostic_done ? t("Answer more questions", "Jawab soal lagi") : t("Take the Skill Check", "Ikuti Cek Kemampuan")}
            </LinkButton>
          </>
        }
        className="mb-5"
      />

      <FolderTabs
        label={t("Skills view", "Tampilan Kenali Skill")}
        value={view}
        onChange={setView}
        options={[["skills", t("Skills", "Kemampuan")], ["evidence", t(`Evidence & Preferences (${nEvidence})`, `Bukti & Preferensi (${nEvidence})`)]]}
        panelId="skills-panel"
      />
      <TabPanel id="skills-panel" value={view} first={view === "skills"}>
      {view === "skills" ? (
        // the collection is the work; proving-needed and soft skills are companions beside it (after it on phones)
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <SkillCollection d={d} onOpen={open} />
          <aside className="space-y-6 lg:border-l lg:pl-6">
            {f.evidence && d.confirmations.length > 0 ? <Attention items={d.confirmations} onOpen={open} /> : null}
            <SoftSkills sid={sid} items={d.soft_skills ?? []} />
          </aside>
        </div>
      ) : (
        <section aria-labelledby="proof" className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <h2 id="proof" className="mb-1 text-lg font-semibold text-ink">{t("Saved Evidence", "Bukti Tersimpan")}</h2>
            <EvidenceList embedded sid={sid} student={student.data} onChange={() => (student.reload(), dash.reload())} />
          </div>
          <Preferences d={d} />
        </section>
      )}
      </TabPanel>
      {sheet}
    </div>
  );
}

function Preferences({ d }: { d: Dashboard }) {
  const t = useT();
  const prefs = d.student.preferences as { weekly_hours?: number; format?: string | null; language?: string };
  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
  return (
    <section className="h-fit space-y-3 lg:border-l lg:pl-6">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <SlidersHorizontal className="size-4 text-indigo" aria-hidden="true" /> {t("Learning Preferences", "Preferensi Belajar")}
      </p>
      <dl className="space-y-2 text-sm">
        {row(t("Target role", "Target role"), d.role.name)}
        {row(t("Study time", "Waktu belajar"), t(`${prefs.weekly_hours ?? 6} h/week`, `${prefs.weekly_hours ?? 6} jam/minggu`))}
        {row(t("Material format", "Format materi"), prefs.format && FORMAT[prefs.format] ? t(...FORMAT[prefs.format]) : t("Any", "Apa saja"))}
        {row(t("Material language", "Bahasa materi"), prefs.language === "en" ? t("English is fine", "Inggris tidak masalah") : t("Prefer Indonesian", "Utamakan Indonesia"))}
      </dl>
      <LinkButton href="/evidence?step=preferences" variant="outline" size="sm">
        {t("Edit preferences", "Ubah preferensi")}
      </LinkButton>
    </section>
  );
}
