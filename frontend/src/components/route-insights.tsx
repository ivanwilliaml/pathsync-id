"use client";

import { FEATURE_LABELS, type Dashboard, type RankRow } from "@/lib/api";
import { num, titleCase } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Tag } from "./kit";

// Why the route is ordered this way: the comparison with simpler orders, and the ranking signals per skill.

/** One sentence before the table: how your route compares with the simpler orders. */
function summary(alts: Dashboard["counterfactual"]["alternatives"], t: ReturnType<typeof useT>) {
  const [mine, ...rest] = alts;
  if (!mine) return "";
  const stuck = rest.filter((a) => a.blocked > 0).length;
  if (mine.blocked === 0 && stuck)
    return t(`Your route never gets stuck; ${stuck} of the ${rest.length} simpler orders do.`, `Rutemu tidak pernah macet; ${stuck} dari ${rest.length} urutan sederhana macet.`);
  if (mine.blocked === 0) return t("Your route never gets stuck, and neither do the simpler orders here.", "Rutemu tidak pernah macet, begitu juga urutan sederhana di sini.");
  return t(`Your route gets stuck ${mine.blocked}×; see where below.`, `Rutemu macet ${mine.blocked}×; lihat di mana di bawah.`);
}

/** Your route against simpler orders of the same skills, one row per strategy: its first steps and how often it gets
 * stuck (a step placed before something it depends on). */
export function WhyOrder({ d, names }: { d: Dashboard; names: Record<string, string> }) {
  const t = useT();
  const cf = d.counterfactual;
  return (
    <section aria-labelledby="why-order-title">
      <h2 id="why-order-title" className="text-[20px] font-semibold text-ink">{t("Your Route vs Simpler Orders", "Rutemu vs Urutan yang Lebih Sederhana")}</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink/80">
        {summary(cf.alternatives, t)}{" "}
        <span className="text-muted-foreground">{t("“Stuck” means a step comes before something it depends on.", "“Macet” berarti sebuah langkah datang sebelum hal yang dibutuhkannya.")}</span>
      </p>
      <div className="mt-3 overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="hidden bg-muted/50 text-xs text-ink/60 sm:table-header-group">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{t("Order", "Urutan")}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t("First steps", "Langkah awal")}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t("Gets stuck", "Macet")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cf.alternatives.map((a, i) => (
              <tr key={a.label} className={i === 0 ? "bg-secondary/40" : undefined}>
                <th scope="row" className="block px-3 pt-2.5 font-semibold text-ink sm:table-cell sm:py-2.5 sm:align-top">
                  {i === 0 ? t("Your Route", "Rutemu") : titleCase(a.label)}
                </th>
                <td className="block px-3 text-ink/75 sm:table-cell sm:py-2.5">
                  <ol className="list-decimal pl-4 text-sm">
                    {a.order.slice(0, 3).map((s) => (
                      <li key={s}>{names[s] ?? s}</li>
                    ))}
                  </ol>
                  {a.order.length > 3 ? <span className="text-xs text-muted-foreground">{t(`+${a.order.length - 3} more`, `+${a.order.length - 3} lagi`)}</span> : null}
                </td>
                <td className="block px-3 pb-2.5 sm:table-cell sm:py-2.5 sm:text-right sm:align-top">
                  <Tag tone={a.blocked ? "red" : "mint"}>{a.blocked ? t(`${a.blocked}×`, `${a.blocked}×`) : t("Never", "Tidak pernah")}</Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cf.notes.length ? <p className="mt-3 text-sm text-ink/70">{cf.notes[0]}</p> : null}
    </section>
  );
}

/** The ranking signals per skill, folded: most people need the comparison above, not the numbers. */
export function HowRanked({ ranking }: { ranking: RankRow[] }) {
  const f = ["G", "R", "D", "U", "K"] as const;
  const t = useT();
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-ink">
        {t("Signals behind each priority", "Sinyal di balik setiap prioritas")}
        <span className="block text-xs font-normal text-muted-foreground">
          {t("Bigger gaps, higher demand and skills that unlock others rank higher.", "Gap lebih besar, demand lebih tinggi, dan skill yang membuka skill lain berada lebih atas.")}
        </span>
      </summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-ink/60">
            <tr>
              <th className="px-3 py-2 font-medium">Skill</th>
              {f.map((k) => (
                <th key={k} className="px-3 py-2 text-right font-medium">
                  {FEATURE_LABELS[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {ranking.slice(0, 10).map((r) => (
              <tr key={r.skill_id} className="border-t">
                <td className="px-3 py-2 text-ink">
                  {r.rank}. {titleCase(r.name)}
                </td>
                {f.map((k) => (
                  <td key={k} className="px-3 py-2 text-right text-ink/75">
                    {num(r.features[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
