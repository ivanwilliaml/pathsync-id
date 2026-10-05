"use client";

import { useParams } from "next/navigation";
import { num, type Item } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { RequireStudent } from "@/components/require-student";
import { Quiz } from "@/components/quiz";
import { Empty, ErrorBox, PageHeader, Spinner } from "@/components/ui";

export default function ReassessPage() {
  const { skill } = useParams<{ skill: string }>();
  return <RequireStudent>{(sid) => <Reassess sid={sid} skill={skill} />}</RequireStudent>;
}

function Reassess({ sid, skill }: { sid: string; skill: string }) {
  const r = useApi<{ skill_id: string; skill_name: string; p: number; items: Item[] }>(`/students/${sid}/assessment/reassess/${skill}`);
  if (r.error) return <ErrorBox error={r.error} />;
  if (!r.data) return <Spinner />;
  return (
    <div>
      <PageHeader
        title={`Buktikan kemajuan: ${r.data.skill_name}`}
        subtitle={`Perkiraan penguasaan saat ini ${num(r.data.p)}. Soal dipilih sesuai tingkatmu; hasilnya langsung memperbarui jalur belajar dan tercatat di riwayat.`}
      />
      {r.data.items.length === 0 ? (
        <Empty>Semua butir untuk skill ini sudah dijawab. Tambahkan bukti proyek di halaman Profil untuk menunjukkan kemajuan.</Empty>
      ) : (
        <Quiz sid={sid} items={r.data.items} phase="reassessment" />
      )}
    </div>
  );
}
