"use client";

import { useT } from "@/lib/i18n";
import { LinkButton } from "./kit";
import { Mascot } from "./mascot";

export function NotFoundView() {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <Mascot name="oops" size={180} priority />
      <h1 className="mt-4 text-[28px] font-bold text-ink">{t("This page took a wrong turn", "Halaman ini salah belok")}</h1>
      <p className="mt-2 text-muted-foreground">
        {t("The link may be old or mistyped. Your route is still where you left it.", "Tautannya mungkin lama atau salah ketik. Rutemu masih di tempat kamu meninggalkannya.")}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <LinkButton href="/dashboard" size="lg">{t("Go to My Dashboard", "Ke Dashboard-ku")}</LinkButton>
        <LinkButton href="/" variant="outline" size="lg">{t("Home", "Beranda")}</LinkButton>
      </div>
    </div>
  );
}
