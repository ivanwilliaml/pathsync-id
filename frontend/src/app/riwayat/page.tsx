"use client";

import { pct } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { RequireStudent } from "@/components/require-student";
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner } from "@/components/ui";

interface HistoryRow {
  id: number;
  created_at: string;
  trigger: string;
  summary: string;
  reasons: string[];
  ranking: { skill_id: string; name?: string; rank: number; priority: number }[];
  path: { skill_id: string; name: string; role_in_path: string }[];
  coverage: number;
  market_version: string;
  model_name: string;
}

const TRIGGER: Record<string, { label: string; tone: "brand" | "good" | "warn" | "neutral" }> = {
  initial: { label: "Jalur awal", tone: "neutral" },
  evidence: { label: "Bukti baru", tone: "good" },
  market: { label: "Pembaruan pasar", tone: "warn" },
  role: { label: "Ganti peran", tone: "brand" },
};

export default function RiwayatPage() {
  return <RequireStudent>{(sid) => <Riwayat sid={sid} />}</RequireStudent>;
}

function Riwayat({ sid }: { sid: string }) {
  const h = useApi<HistoryRow[]>(`/students/${sid}/history`);
  if (h.error) return <ErrorBox error={h.error} />;
  if (!h.data) return <Spinner />;
  return (
    <div>
      <PageHeader
        title="Riwayat jalur belajar"
        subtitle="Setiap perubahan jalur disimpan bersama pemicunya (bukti baru, pembaruan pasar, ganti peran) dan alasan perubahannya."
      />
      {h.data.length === 0 ? (
        <Empty>Belum ada riwayat. Riwayat mulai tercatat setelah asesmen diagnostik atau bukti pertama.</Empty>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-line pl-6">
          {h.data.map((r) => {
            const t = TRIGGER[r.trigger] ?? { label: r.trigger, tone: "neutral" as const };
            return (
              <li key={r.id} className="relative">
                <span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full border-2 border-surface bg-brand" />
                <Card>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone={t.tone}>{t.label}</Badge>
                    <span>{new Date(r.created_at + "Z").toLocaleString("id-ID")}</span>
                    <span>· cakupan {pct(r.coverage)}</span>
                    <span>· pasar {r.market_version}</span>
                  </div>
                  <p className="font-medium">{r.summary}</p>
                  {r.reasons.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
                      {r.reasons.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1 text-xs">
                    <span className="text-muted">Jalur:</span>
                    {r.path.map((p, i) => (
                      <Badge key={p.skill_id} tone={p.role_in_path === "prioritas" ? "brand" : "warn"}>
                        {i + 1}. {p.name}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
