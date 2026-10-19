"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, Clock, Scale } from "lucide-react";
import { ApiError, type Item } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { RequireStudent } from "@/components/require-student";
import { Quiz } from "@/components/quiz";
import { EmptyState, ErrorNote, LinkButton, Loading } from "@/components/kit";
import { Mascot } from "@/components/mascot";
import { useT } from "@/lib/i18n";

export default function AssessmentPage() {
  return <RequireStudent>{(sid) => <Assessment sid={sid} />}</RequireStudent>;
}

function Assessment({ sid }: { sid: string }) {
  const [started, setStarted] = useState(false);
  const t = useT();
  const plan = useApi<{ session_id: string; items: Item[] }>(started ? `/students/${sid}/assessment/diagnostic` : null);

  if (!started) {
    return (
      // focus template: a way back to where the check belongs, the page's usual header scale, a calm illustration
      <div className="max-w-3xl">
        <Link href="/skills" className="text-sm font-medium text-indigo underline-offset-4 hover:underline">
          ← {t("Understand Your Skills", "Kenali Skill")}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight text-ink sm:text-[30px]">{t("Skill Check", "Cek Kemampuan")}</h1>
          <p className="mt-2 max-w-lg text-ink/75">
            {t("A short set of questions on the skills employers ask for most, picked where we know the least about you.", "Serangkaian soal singkat tentang skill yang paling banyak diminta employer, dipilih di bagian yang paling sedikit kami ketahui tentangmu.")}
          </p>
          <ul className="mt-6 space-y-3">
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-indigo" aria-hidden="true" />
              <span className="text-ink/80">{t("About 24 questions and 20 minutes. There is no time limit.", "Sekitar 24 soal dan 20 menit. Tidak ada batas waktu.")}</span>
            </li>
            <li className="flex gap-3">
              <Scale className="mt-0.5 size-5 shrink-0 text-indigo" aria-hidden="true" />
              <span className="text-ink/80">{t("Your answers count more than grades or certificates, so answer honestly.", "Jawabanmu dihitung lebih berat daripada nilai atau sertifikat, jadi jawab dengan jujur.")}</span>
            </li>
            <li className="flex gap-3">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-indigo" aria-hidden="true" />
              <span className="text-ink/80">{t("You\u2019ll see the right answers and an updated route as soon as you finish.", "Kamu langsung melihat jawaban yang benar dan rute terbaru begitu selesai.")}</span>
            </li>
          </ul>
          <Button size="lg" className="mt-6" onClick={() => setStarted(true)}>
            {t("Start the Check", "Mulai Cek Kemampuan")}
          </Button>
        </div>
        <Mascot name="stopwatch" size={120} priority className="hidden shrink-0 sm:block" />
        </div>
      </div>
    );
  }
  if (plan.error instanceof ApiError && plan.error.status === 409)
    return (
      <EmptyState title={t("You've Answered Every Question", "Kamu Sudah Menjawab Semua Soal")} mascot="celebrate" action={<LinkButton href="/skills">{t("Back to My Skills", "Kembali ke Kenali Skill")}</LinkButton>}>
        {t("To show progress on one skill, add a project from one of your courses: it is the next best proof.", "Untuk menunjukkan kemajuan di satu skill, tambahkan project dari salah satu mata kuliahmu: itu bukti terbaik berikutnya.")}
      </EmptyState>
    );
  if (plan.error) return <ErrorNote error={plan.error} />;
  if (!plan.data) return <Loading label={t("Picking your questions…", "Memilih soal untukmu…")} />;
  if (plan.data.items.length === 0)
    return (
      <EmptyState title={t("You've Answered Every Question", "Kamu Sudah Menjawab Semua Soal")} mascot="celebrate" action={<LinkButton href="/skills">{t("Back to My Skills", "Kembali ke Kenali Skill")}</LinkButton>}>
        {t("To show progress on one skill, open it from your dashboard and choose \u201cProve You Know It\u201d, or add a project.", "Untuk menunjukkan kemajuan di satu skill, buka dari dashboard-mu dan pilih \u201cBuktikan Kamu Bisa\u201d, atau tambahkan project.")}
      </EmptyState>
    );
  return <Quiz sid={sid} sessionId={plan.data.session_id} items={plan.data.items} />;
}
