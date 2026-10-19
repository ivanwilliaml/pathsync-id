"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, LogIn } from "lucide-react";
import { ApiError } from "@/lib/api";
import { STAFF_HOME, staffDemo, staffLogin, staffSignIn, type StaffRole } from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "./kit";
import { useT } from "@/lib/i18n";

const TITLE: Record<StaffRole, [string, string]> = { admin: ["Admin Sign-In", "Masuk Admin"], expert: ["Expert Sign-In", "Masuk Pakar"], advisor: ["Lecturer Sign-In", "Masuk Dosen"] };

/** Staff sign-in: email + password for staff accounts, one-click read-only demos for visitors, and (folded away) the
 * admin key for the first sign-in on a new server. Every path ends in an HttpOnly session cookie; the page keeps no
 * password or key. */
export function StaffLogin({ role, hint }: { role: StaffRole; hint?: string; error?: unknown }) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");
  const [failed, setFailed] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const rejected = failed instanceof ApiError && (failed.status === 401 || failed.status === 403);

  const run = (what: string, job: () => Promise<{ role: StaffRole }>, go = false) => {
    setBusy(what);
    setFailed(null);
    job()
      .then((s) => {
        setPassword("");
        setKey("");
        if (go || s.role !== role) router.push(STAFF_HOME[s.role]);
      })
      .catch(setFailed)
      .finally(() => setBusy(null));
  };

  return (
    <div className="space-y-6">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim() && password) run("login", () => staffLogin(email.trim(), password));
        }}
      >
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          <LogIn className="size-4 text-indigo" aria-hidden="true" /> {t(...TITLE[role])}
        </h2>
        {hint ? <p className="text-sm text-ink/70">{hint}</p> : null}
        <div className="space-y-1.5">
          <Label htmlFor={`email-${role}`}>Email</Label>
          <Input id={`email-${role}`} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`pw-${role}`}>{t("Password", "Password")}</Label>
          <Input id={`pw-${role}`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
        </div>
        {rejected ? <ErrorNote error={new Error(t("Wrong email or password, or the key was not accepted.", "Email atau password salah, atau key tidak diterima."))} /> : null}
        {failed && !rejected ? <ErrorNote error={failed} /> : null}
        <Button type="submit" size="lg" className="w-full" disabled={!email.trim() || !password || busy !== null}>
          {busy === "login" ? t("Signing in…", "Masuk…") : t("Sign In", "Masuk")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("No account yet? Ask the PathSync admin for an invite link. Forgot your password? The admin can send a new link.",
             "Belum punya akun? Minta link undangan ke admin PathSync. Lupa password? Admin bisa mengirim link baru.")}
        </p>
      </form>

      {role !== "admin" ? (
        <section aria-labelledby="demo-staff" className="space-y-2 border-t pt-5">
          <h3 id="demo-staff" className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Eye className="size-4 text-indigo" aria-hidden="true" /> {t("Just looking?", "Sekadar melihat?")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("A read-only demo account: nothing you do changes real data.", "Akun demo hanya-lihat: apa pun yang kamu lakukan tidak mengubah data nyata.")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("advisor", () => staffDemo("advisor"), true)}>
              {busy === "advisor" ? t("Opening…", "Membuka…") : t("View as demo lecturer", "Lihat sebagai dosen demo")}
            </Button>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("expert", () => staffDemo("expert"), true)}>
              {busy === "expert" ? t("Opening…", "Membuka…") : t("View as demo expert", "Lihat sebagai pakar demo")}
            </Button>
          </div>
        </section>
      ) : null}

      {/* the first admin on a new server signs in with the generated admin key, then invites people (and themselves) */}
      <details className="border-t pt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-ink">{t("Sign in with an admin key", "Masuk dengan kunci admin")}</summary>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) run("key", () => staffSignIn(key.trim()));
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor={`key-${role}`}>{t("Key", "Kunci")}</Label>
            <Input id={`key-${role}`} type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} className="h-9 font-mono" />
          </div>
          <Button type="submit" variant="outline" disabled={!key.trim() || busy !== null}>
            {busy === "key" ? t("Signing in…", "Masuk…") : t("Sign In", "Masuk")}
          </Button>
        </form>
      </details>
    </div>
  );
}
