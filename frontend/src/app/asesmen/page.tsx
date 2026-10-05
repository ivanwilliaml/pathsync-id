"use client";

import { useState } from "react";
import type { Item } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { RequireStudent } from "@/components/require-student";
import { Quiz } from "@/components/quiz";
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner } from "@/components/ui";

export default function AsesmenPage() {
  return <RequireStudent>{(sid) => <Diagnostic sid={sid} />}</RequireStudent>;
}

function Diagnostic({ sid }: { sid: string }) {
  const [started, setStarted] = useState(false);
  const plan = useApi<{ items: Item[] }>(started ? `/students/${sid}/assessment/diagnostic` : null);

  return (
    <div>
      <PageHeader
        title="Asesmen diagnostik"
        subtitle="20–30 soal pilihan ganda dipilih adaptif: skill yang paling dibutuhkan pasar dan paling tidak pasti bagi profilmu didahulukan. Soal yang sudah pernah dijawab tidak diulang."
      />
      {!started ? (
        <Card>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Perkiraan waktu 20–30 menit. Tidak ada batas waktu.</li>
            <li>Asesmen adalah bukti paling langsung (bobot 0,50), lebih kuat dari transkrip atau sertifikat.</li>
            <li>Kamu bisa mengulang asesmen per skill kapan saja dari dasbor (&ldquo;Buktikan kemajuan&rdquo;).</li>
          </ul>
          <Button onClick={() => setStarted(true)}>Mulai asesmen</Button>
        </Card>
      ) : plan.loading || !plan.data ? (
        plan.error ? <ErrorBox error={plan.error} /> : <Spinner label="Menyusun soal…" />
      ) : plan.data.items.length === 0 ? (
        <Empty>
          Semua butir diagnostik untuk skill prioritas sudah kamu jawab. Gunakan asesmen ulang per skill dari <a className="underline" href="/dasbor">dasbor</a>.
        </Empty>
      ) : (
        <Quiz sid={sid} items={plan.data.items} phase="diagnostic" />
      )}
    </div>
  );
}
