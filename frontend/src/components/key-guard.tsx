"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getStudentId, setStudent } from "@/lib/student";
import { track } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "./kit";
import { useT } from "@/lib/i18n";

/**
 * When the server rejects the token stored on this device, ask the student to sign in again with email and password
 * instead of silently signing out (PM audit P0-4). Profiles made before accounts existed can start over from the
 * landing page; their data stays on the server until it is deleted.
 */
export function KeyGuard() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("pathsync-reauth", on);
    return () => window.removeEventListener("pathsync-reauth", on);
  }, []);
  return <ReauthDialog open={open} onClose={() => setOpen(false)} />;
}

function ReauthDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api.post<{ id: string; token: string }>("/students/login", { email: email.trim(), password });
      const before = getStudentId();
      setStudent({ id: r.id, token: r.token });
      track("relogin");
      onClose();
      if (before && before !== r.id) window.location.href = "/dashboard";
      else window.location.reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Sign In Again", "Masuk Lagi")}</DialogTitle>
          <DialogDescription>
            {t("Your session on this device has ended. Your data is safe: sign in with your email and password to continue.",
               "Sesi di perangkat ini sudah berakhir. Datamu aman: masuk dengan email dan password untuk lanjut.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="reauth-email">Email</Label>
            <Input id="reauth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reauth-password">Password</Label>
            <Input id="reauth-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
          </div>
          <ErrorNote error={err} />
          <div className="flex gap-2">
            <Button type="submit" size="lg" className="h-10 flex-1" disabled={!email.trim() || !password || busy}>
              {busy ? t("Signing in…", "Masuk…") : t("Sign in", "Masuk")}
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
