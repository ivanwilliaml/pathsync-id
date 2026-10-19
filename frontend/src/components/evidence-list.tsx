"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Student } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Loading } from "./kit";

// ------------------------------------------------------------------ saved evidence
const KIND: Record<string, [string, string]> = { academic: ["Transcript", "Transkrip"], certificate: ["Certificate", "Sertifikat"], cv: ["CV", "CV"], project: ["Project", "Project"] };

/** Saved evidence with removal, one row per item (its kind named once). `embedded`: inside a page section that has
 * its own heading (Kenali Skill). */
export function EvidenceList({ sid, student, onChange, embedded = false }: { sid: string; student: Student | null; onChange: () => void; embedded?: boolean }) {
  const [pending, setPending] = useState<{ id: number; title: string } | null>(null);
  const t = useT();
  const kind = (k: string) => (KIND[k] ? t(...KIND[k]) : k);
  async function remove() {
    if (!pending) return;
    await api.del(`/students/${sid}/evidence/${pending.id}`);
    toast.success(t("Evidence removed", "Bukti dihapus"));
    setPending(null);
    onChange();
  }
  return (
    <aside aria-labelledby={embedded ? undefined : "saved"} aria-label={embedded ? t("Saved evidence", "Bukti tersimpan") : undefined}
      className={embedded ? "rounded-xl border bg-card px-4 py-1" : "h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-8"}>
      {embedded ? null : (
        <h2 id="saved" className="font-semibold text-ink">
          {t("Saved Evidence", "Bukti Tersimpan")}
        </h2>
      )}
      {!student ? (
        <Loading />
      ) : student.evidence.length === 0 && student.n_responses === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{t("Nothing yet. What you save shows up here.", "Belum ada. Yang kamu simpan muncul di sini.")}</p>
      ) : (
        <ul className={embedded ? "divide-y" : "mt-2 divide-y"}>
          {student.evidence.map((e) => {
            const found =
              e.kind === "cv"
                ? t(`${((e.details.claim_ids as string[]) ?? []).length} skills mentioned`, `${((e.details.claim_ids as string[]) ?? []).length} skill disebut`)
                : t(`${Object.keys(e.scores).length} skills found`, `${Object.keys(e.scores).length} skill ditemukan`);
            return (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink" title={e.title}>
                    {e.kind === "academic" ? kind(e.kind) : e.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{e.kind === "academic" ? found : `${kind(e.kind)} · ${found}`}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label={t(`Remove ${kind(e.kind)}`, `Hapus ${kind(e.kind)}`)} onClick={() => setPending({ id: e.id, title: KIND[e.kind] ? kind(e.kind) : e.title })}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
          {student.n_responses > 0 ? (
            <li className="py-2">
              <p className="text-sm font-medium text-ink">{t("Skill Check", "Cek Kemampuan")}</p>
              <p className="text-xs text-muted-foreground">{t(`${student.n_responses} questions answered`, `${student.n_responses} soal terjawab`)}</p>
            </li>
          ) : null}
        </ul>
      )}
      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`Remove This ${pending?.title}?`, `Hapus ${pending?.title} Ini?`)}</AlertDialogTitle>
            <AlertDialogDescription>{t("Your route will be recalculated without it. You can add it again later.", "Rutemu akan dihitung ulang tanpanya. Kamu bisa menambahkannya lagi nanti.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep It", "Simpan Saja")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              {t("Remove", "Hapus")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
