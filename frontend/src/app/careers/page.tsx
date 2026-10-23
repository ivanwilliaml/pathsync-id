"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { useStudentId } from "@/lib/student";
import { CareerMap } from "@/components/career-map";
import { LinkButton, Loading } from "@/components/kit";
import { Card, PageHero, PillSelect } from "@/components/polish";
import { fmtDate } from "@/lib/format";
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
  const market = useApi<{ n_postings: number; reference_date: string; skills: { count: number }[] }>(`/market/${role}`);
  const picked = meta.data?.roles.find((r) => r.id === role);
  return (
    <div>
      <PageHero
        eyebrow="Job Market"
        title={t("What employers ask for,", "Apa yang diminta employer,")}
        accent={t("career by career.", "karier demi karier.")}
        description={t(
          `What Indonesian employers ask for in ${meta.data?.n_postings ?? "real"} job postings, career by career. Create a free profile to see which careers your own skills are close to.`,
          `Apa yang diminta employer Indonesia di ${meta.data?.n_postings ?? ""} job posting nyata, per karier. Buat profil gratis untuk melihat karier mana yang dekat dengan skill-mu sendiri.`,
        )}
        actions={<LinkButton href="/" size="lg" className="hero-cta h-12 rounded-full px-6 text-[15px] font-semibold">{t("Create a free profile", "Buat profil gratis")}</LinkButton>}
      />
      {/* the career in focus and what its map stands on */}
      <Card className="hero-rise flex flex-wrap items-center justify-between gap-x-10 gap-y-6" style={{ ["--d" as string]: "300ms" }}>
        <div className="w-full max-w-sm">
          <label htmlFor="career-pick" className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            {t("Career", "Karier")}
            {picked?.limited_data ? <span className="rounded-full bg-[#fff6d9] px-2 py-0.5 text-[10.5px] tracking-normal text-ember-ink">Beta</span> : null}
          </label>
          <PillSelect id="career-pick" className="w-full" value={role} onChange={(e) => pick(e.target.value)}>
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
          </PillSelect>
        </div>
        <dl key={role} className="smh-swap grid grid-cols-3 gap-x-8 gap-y-2 sm:gap-x-12">
          {([
            [market.data?.n_postings, t("postings read", "lowongan dibaca")],
            [market.data?.skills.filter((x) => x.count > 0).length, t("skills asked for", "skill diminta")],
            [market.data ? fmtDate(market.data.reference_date) : undefined, t("data up to", "data sampai")],
          ] as [ReactNode, string][]).map(([v, label]) => (
            <div key={label} className="min-w-0">
              <dd className="tabular text-[26px] font-bold leading-none tracking-[-0.035em] text-ink sm:text-[30px]">{v ?? "–"}</dd>
              <dt className="mt-2 text-[12.5px] font-medium text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      </Card>
      <div className="mt-12">
        <MarketEvidence role={role} />
      </div>
      <div className="mt-20">
        <BpsContext />
      </div>
    </div>
  );
}
