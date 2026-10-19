"use client";

import { useEffect, useState } from "react";
import type { Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useStudentId } from "@/lib/student";
import { CareerMap } from "@/components/career-map";
import { LinkButton, Loading, NativeSelect, PageHeader, Panel } from "@/components/kit";
import { BpsContext, MarketEvidence } from "@/components/market-evidence";

/** Stage 2, Choose a Career. With a profile: the career matrix scored on the student's evidence, and the market
 * evidence of the selected career right below it. Without one: the market explorer only, no personal matching. */
export default function CareersPage() {
  const { id, ready } = useStudentId();
  if (!ready) return <Loading />;
  return id ? <PersonalCareers sid={id} /> : <PublicCareers />;
}

function PersonalCareers({ sid }: { sid: string }) {
  const t = useT();
  return (
    <CareerMap sid={sid} />
  );
}

function PublicCareers() {
  const t = useT();
  const meta = useApi<Meta>("/meta");
  const [role, setRole] = useState("business_analyst");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("role");
    if (q) setRole(q);
  }, []);
  const pick = (r: string) => {
    setRole(r);
    const u = new URL(window.location.href);
    u.searchParams.set("role", r);
    window.history.replaceState(window.history.state, "", u);
  };
  return (
    <div className="space-y-8">
      <PageHeader
        mascot="job-board"
        title={t("Choose a Career", "Pilih Karier")}
        description={t(
          `What Indonesian employers ask for in ${meta.data?.n_postings ?? "real"} job postings, career by career. Create a free profile to see which careers your own skills are close to.`,
          `Apa yang diminta employer Indonesia di ${meta.data?.n_postings ?? ""} job posting nyata, per karier. Buat profil gratis untuk melihat karier mana yang dekat dengan skill-mu sendiri.`,
        )}
        actions={<LinkButton href="/">{t("Create a free profile", "Buat profil gratis")}</LinkButton>}
      />
      <Panel className="flex flex-wrap items-end gap-4 p-5 sm:p-6">
        <div className="w-full max-w-sm space-y-1.5">
          <label htmlFor="career-pick" className="text-sm font-medium text-ink">{t("Career", "Karier")}</label>
          <NativeSelect id="career-pick" value={role} onChange={(e) => pick(e.target.value)}>
            {Object.entries(meta.data?.families ?? {}).map(([fid, fname]) => (
              <optgroup key={fid} label={fname}>
                {(meta.data?.roles ?? []).filter((r) => r.family === fid).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.limited_data ? " (Beta)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </div>
      </Panel>
      <MarketEvidence role={role} />
      <BpsContext />
    </div>
  );
}
