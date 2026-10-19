"use client";

import { Eye } from "lucide-react";
import { staffSignOut, useStaffSession } from "@/lib/staff";
import { useT } from "@/lib/i18n";

/** True while a read-only demo staff account is signed in (the server refuses its writes; the page also says so). */
export function useIsDemo(): boolean {
  return !!useStaffSession().session?.demo;
}

/** A thin notice on staff pages while a demo account is signed in, with the way out. */
export function DemoBanner() {
  const t = useT();
  if (!useIsDemo()) return null;
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ember/40 bg-[#fff8e1] px-4 py-2.5 text-sm text-ember-ink">
      <span className="flex items-center gap-2">
        <Eye className="size-4" aria-hidden="true" />
        <span>
          <span className="font-semibold">{t("Demo mode · view only.", "Mode demo · hanya lihat.")}</span>{" "}
          {t("Buttons that would change data are turned off.", "Tombol yang mengubah data dinonaktifkan.")}
        </span>
      </span>
      <button type="button" onClick={() => void staffSignOut()} className="font-medium underline-offset-4 hover:underline">
        {t("Leave the demo", "Keluar dari demo")}
      </button>
    </div>
  );
}
