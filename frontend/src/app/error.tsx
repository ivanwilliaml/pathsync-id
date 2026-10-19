"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/kit";
import { Mascot } from "@/components/mascot";
import { useT } from "@/lib/i18n";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <Mascot name="offline" size={180} priority />
      <h1 className="mt-4 text-[24px] font-bold text-ink">{t("Something got disconnected", "Ada yang terputus")}</h1>
      <p className="mt-2 text-muted-foreground">{t("This page couldn\u2019t load. Check your connection and try again; your saved progress is safe.", "Halaman ini gagal dimuat. Cek koneksimu dan coba lagi; progres yang tersimpan tetap aman.")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={reset}>{t("Try Again", "Coba Lagi")}</Button>
        <LinkButton href="/" variant="outline" size="lg">{t("Home", "Beranda")}</LinkButton>
      </div>
    </div>
  );
}
