"use client";

import { useEffect, useState } from "react";
import { Copy, Download, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { accessKey, parseAccessKey, setStudent, useStudentId } from "@/lib/student";
import { track } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "./kit";
import { useT } from "@/lib/i18n";

export const KEY_PENDING = "pathsync.keypending";

/** Call right after sign-up: the next page load shows the mandatory "save your key" step. */
export function requireKeySave() {
  try {
    localStorage.setItem(KEY_PENDING, "1");
  } catch {}
}

function downloadKey(key: string) {
  const blob = new Blob(
    [`PathSync access key\n\n${key}\n\nKeep this file private: anyone with the key can open your profile.\nResume at: ${location.origin}\n`],
    { type: "text/plain" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pathsync-access-key.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * Two dialogs that stop students losing their profile (PM audit P0-4):
 *  1. right after sign-up, a "save your key" step that cannot be dismissed without confirming it was saved;
 *  2. when the server rejects the stored key, a prompt to paste it again instead of silently signing out.
 */
export function KeyGuard() {
  const { id } = useStudentId();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reauth, setReauth] = useState(false);
  const key = accessKey() ?? "";
  const t = useT();

  useEffect(() => {
    try {
      setPending(localStorage.getItem(KEY_PENDING) === "1");
    } catch {}
  }, [id]);
  useEffect(() => {
    const on = () => setReauth(true);
    window.addEventListener("pathsync-reauth", on);
    return () => window.removeEventListener("pathsync-reauth", on);
  }, []);

  function done() {
    try {
      localStorage.removeItem(KEY_PENDING);
    } catch {}
    track("key_saved");
    setPending(false);
  }

  return (
    <>
      <Dialog open={pending && !!id} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="size-5 text-indigo" aria-hidden="true" /> {t("Save Your Access Key", "Simpan Access Key-mu")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "PathSync has no password and no email. This key is the only way back into your profile if you change phone or browser, or clear your data. We cannot recover it for you.",
                "PathSync tidak memakai password atau email. Key ini satu-satunya jalan kembali ke profilmu kalau kamu ganti HP atau browser, atau menghapus data. Kami tidak bisa memulihkannya untukmu.",
              )}
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-lg bg-muted p-3 font-mono text-sm" translate="no">
            {key}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(key).then(() => toast.success(t("Key copied", "Key disalin")))}>
              <Copy /> {t("Copy", "Salin")}
            </Button>
            <Button variant="outline" onClick={() => downloadKey(key)}>
              <Download /> {t("Download .txt", "Unduh .txt")}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`mailto:?subject=${encodeURIComponent("My PathSync access key")}&body=${encodeURIComponent(`${key}\n\nOpen ${typeof window === "undefined" ? "" : window.location.origin} and choose Resume Profile.`)}`}
                />
              }
            >
              <Mail /> {t("Email It to Me", "Kirim ke Email-ku")}
            </Button>
          </div>
          <label className="flex cursor-pointer gap-3 text-sm text-ink/80">
            <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} className="mt-0.5" />
            <span>{t("I saved my key somewhere safe (notes app, password manager, or email).", "Key sudah kusimpan di tempat aman (aplikasi catatan, password manager, atau email).")}</span>
          </label>
          <Button size="lg" className="h-11 w-full" disabled={!saved} onClick={done}>
            {t("Continue", "Lanjut")}
          </Button>
        </DialogContent>
      </Dialog>
      <ReauthDialog open={reauth} onClose={() => setReauth(false)} />
    </>
  );
}

function ReauthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const auth = parseAccessKey(value);
    if (!auth) {
      setErr(new Error(t("That does not look like an access key.", "Itu sepertinya bukan access key.")));
      return;
    }
    setBusy(true);
    const previous = accessKey();
    setStudent(auth);
    try {
      await api.get(`/students/${auth.id}`);
      track("key_restored");
      setValue("");
      onClose();
      window.location.reload();
    } catch {
      const old = previous ? parseAccessKey(previous) : null;
      setStudent(old);
      setErr(new Error(t("That key was not accepted. Copy it again from the file or note where you saved it.", "Key itu tidak diterima. Salin lagi dari file atau catatan tempat kamu menyimpannya.")));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Enter Your Access Key", "Masukkan Access Key-mu")}</DialogTitle>
          <DialogDescription>
            {t(
              "PathSync could not confirm this device’s key. Your data is safe on the server: paste your access key to continue.",
              "PathSync tidak bisa mengonfirmasi key di perangkat ini. Datamu aman di server: tempel access key-mu untuk lanjut.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reauth-key">Access Key</Label>
            <Input id="reauth-key" type="password" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} className="h-10 font-mono" />
          </div>
          <ErrorNote error={err} />
          <div className="flex gap-2">
            <Button type="submit" size="lg" className="h-10 flex-1" disabled={!value.trim() || busy}>
              {busy ? t("Checking…", "Memeriksa…") : t("Continue", "Lanjut")}
            </Button>
            <Button type="button" variant="ghost" size="lg" className="h-10" onClick={() => { setStudent(null); window.location.href = "/"; }}>
              {t("Start Over", "Mulai Ulang")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
