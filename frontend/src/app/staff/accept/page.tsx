"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { STAFF_HOME, staffAccept, staffInvite, type StaffInvite, type StaffRole } from "@/lib/staff";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote, Loading, PageHeader, Panel } from "@/components/kit";

const MIN = 10;
const ROLE: Record<StaffRole, [string, string]> = { admin: ["admin", "admin"], expert: ["expert", "pakar"], advisor: ["lecturer", "dosen"] };

/** Set a password from an invite (or reset) link sent by the admin, then go to the role's page signed in. The token
 * is read from the URL once and sent only to the API; the page never stores it. */
export default function AcceptInvitePage() {
  const t = useT();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<StaffInvite | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    const tk = new URLSearchParams(window.location.search).get("token");
    setToken(tk);
    if (!tk) return setLoadError(new Error(t("This link has no invite code. Open the full link from the admin.", "Link ini tidak berisi kode undangan. Buka link lengkap dari admin.")));
    staffInvite(tk).then(setInvite, setLoadError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const short = pw.length > 0 && pw.length < MIN;
  const mismatch = again.length > 0 && again !== pw;
  const ok = pw.length >= MIN && pw === again;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title={t("Set Your Password", "Atur Password")} />
      <Panel>
        {loadError ? (
          <ErrorNote error={loadError} />
        ) : !invite ? (
          <Loading />
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ok || !token) return;
              setBusy(true);
              setErr(null);
              staffAccept(token, pw)
                .then((s) => router.push(STAFF_HOME[s.role]))
                .catch(setErr)
                .finally(() => setBusy(false));
            }}
          >
            <div>
              <p className="flex items-center gap-2 font-semibold text-ink">
                <KeyRound className="size-4 text-indigo" aria-hidden="true" /> {t(`Welcome, ${invite.name}`, `Selamat datang, ${invite.name}`)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`Your ${ROLE[invite.role][0]} account: ${invite.email}`, `Akun ${ROLE[invite.role][1]}-mu: ${invite.email}`)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">{t("New password", "Password baru")}</Label>
              <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-10" aria-invalid={short} />
              <p className={short ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{t(`At least ${MIN} characters.`, `Minimal ${MIN} karakter.`)}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">{t("Repeat password", "Ulangi password")}</Label>
              <Input id="pw2" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className="h-10" aria-invalid={mismatch} />
              {mismatch ? <p className="text-xs text-destructive">{t("The passwords do not match.", "Password tidak sama.")}</p> : null}
            </div>
            <ErrorNote error={err} />
            <Button type="submit" size="lg" className="w-full" disabled={!ok || busy}>
              {busy ? t("Saving…", "Menyimpan…") : t("Save and sign in", "Simpan dan masuk")}
            </Button>
          </form>
        )}
      </Panel>
    </div>
  );
}
