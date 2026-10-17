"use client";

import type { ReactNode } from "react";
import { useStudentId } from "@/lib/student";
import { EmptyState, LinkButton, Loading } from "./kit";
import { useT } from "@/lib/i18n";

/** Renders children with the current student id, or an invitation to create a profile first. */
export function RequireStudent({ children }: { children: (id: string) => ReactNode }) {
  const { id, ready } = useStudentId();
  const t = useT();
  if (!ready) return <Loading />;
  if (!id)
    return (
      <EmptyState
        title={t("Create Your Profile First", "Buat Profilmu Dulu")}
        mascot="wave"
        action={<LinkButton href="/" size="lg">{t("Start Your Path", "Mulai Path-mu")}</LinkButton>}
      >
        {t("This page shows your personal learning path. It takes about two minutes to set up.", "Halaman ini menampilkan learning path pribadimu. Menyiapkannya hanya sekitar dua menit.")}
      </EmptyState>
    );
  return <>{children(id)}</>;
}
