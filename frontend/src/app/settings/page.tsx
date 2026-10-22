"use client";

import { useState } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Student } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { useApi } from "@/lib/hooks";
import { setStudent } from "@/lib/student";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RequireStudent } from "@/components/require-student";
import { ErrorNote, Loading, NativeSelect, PageHeader, SectionTitle, Tag, Toc } from "@/components/kit";
import { Mascot } from "@/components/mascot";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  return <RequireStudent>{(sid) => <Settings sid={sid} />}</RequireStudent>;
}

const SECTIONS: [string, [string, string]][] = [
  ["profile", ["Profile", "Profil"]],
  ["account", ["Account", "Akun"]],
  ["research", ["Research", "Riset"]],
  ["class", ["Class and study", "Kelas dan studi"]],
  ["privacy", ["Your data", "Data pribadimu"]],
];

function Settings({ sid }: { sid: string }) {
  const st = useApi<Student & { semester: number | null; cohort_id: string | null; study_arm: string | null; consent_at: string | null; consent_version: string }>(
    `/students/${sid}`,
  );
  const t = useT();
  if (st.error) return <ErrorNote error={st.error} />;
  if (!st.data) return <Loading />;
  const s = st.data;
  return (
    <div>
      <PageHeader className="mb-6" title={t("Settings & Data", "Pengaturan & Data")} description={t("Your profile, your sign-in, classes and studies you join, and control over your personal data.", "Profilmu, akun untuk masuk, kelas dan studi yang kamu ikuti, dan kendali atas data pribadimu.")} />
      {/* categories beside one form column; groups are split by dividers, not five cards of different heights */}
      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,720px)] lg:gap-12">
        <Toc label={t("Settings sections", "Bagian pengaturan")} items={SECTIONS.map(([id, label]) => [id, t(...label)] as [string, string])} />
        <div className="min-w-0 divide-y [&>section]:scroll-mt-24 [&>section]:py-10 [&>section:first-child]:pt-0">
          <Profile sid={sid} s={s} onSaved={st.reload} />
          <Account sid={sid} email={(s as { email?: string | null }).email ?? null} onSaved={st.reload} />
          <Research sid={sid} on={!!(s as { research_consent_at?: string | null }).research_consent_at} onChange={st.reload} />
          <Joins sid={sid} cohort={s.cohort_id} arm={s.study_arm} onChange={st.reload} />
          <Privacy sid={sid} consentAt={s.consent_at} version={s.consent_version} />
        </div>
      </div>
    </div>
  );
}

function Profile({ sid, s, onSaved }: { sid: string; s: Student & { semester: number | null }; onSaved: () => void }) {
  const [name, setName] = useState(s.display_name);
  const [semester, setSemester] = useState(s.semester ?? 0);
  const [hours, setHours] = useState(Number(s.preferences.weekly_hours ?? 6));
  const [format, setFormat] = useState(String(s.preferences.format ?? ""));
  const [language, setLanguage] = useState(String(s.preferences.language ?? "id"));
  const t = useT();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api.patch(`/students/${sid}`, {
      display_name: name,
      semester: semester || null,
      preferences: { weekly_hours: hours, format: format || null, language },
    });
    toast.success(t("Saved", "Tersimpan"));
    onSaved();
  }
  return (
    <section id="profile" aria-labelledby="profile-title">
      <SectionTitle id="profile-title">{t("Profile", "Profil")}</SectionTitle>
      <form onSubmit={save} className="grid max-w-2xl gap-x-6 gap-y-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nm">{t("Name", "Nama")}</Label>
          <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sem">Semester</Label>
          <NativeSelect id="sem" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
            <option value={0}>{t("Not set", "Belum diisi")}</option>
            {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hrs">{t("Hours per week for your route", "Jam per minggu untuk rutemu")}</Label>
          <Input id="hrs" type="number" min={1} max={40} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fmt">{t("Preferred material format", "Format materi favorit")}</Label>
          <NativeSelect id="fmt" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">{t("No preference", "Tidak ada preferensi")}</option>
            <option value="video">Video</option>
            <option value="teks">{t("Article", "Artikel")}</option>
            <option value="kursus">{t("Course", "Kursus")}</option>
            <option value="latihan">{t("Practice", "Latihan")}</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mlang">{t("Language of learning materials", "Bahasa materi belajar")}</Label>
          <NativeSelect id="mlang" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="id">{t("Prefer Indonesian", "Utamakan Bahasa Indonesia")}</option>
            <option value="en">{t("English is fine", "Bahasa Inggris tidak masalah")}</option>
          </NativeSelect>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">{t("Save Profile", "Simpan Profil")}</Button>
        </div>
      </form>
    </section>
  );
}

function Account({ sid, email, onSaved }: { sid: string; email: string | null; onSaved: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.put(`/students/${sid}/account`, email ? { password, current_password: current } : { email: newEmail.trim(), password });
      toast.success(email ? t("Password changed", "Password diganti") : t("Account saved", "Akun disimpan"));
      setCurrent("");
      setPassword("");
      onSaved();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="account" aria-labelledby="account-title">
      <SectionTitle id="account-title">{t("Account", "Akun")}</SectionTitle>
      <p className="mb-4 text-sm text-ink/70">
        {email
          ? t(`You sign in with ${email}.`, `Kamu masuk dengan ${email}.`)
          : t("Add an email and password so you can sign in again from any device.", "Tambahkan email dan password agar kamu bisa masuk lagi dari perangkat mana pun.")}
      </p>
      <form onSubmit={save} className="grid max-w-md gap-4">
        {email ? (
          <div className="space-y-2">
            <Label htmlFor="current-password">{t("Current password", "Password lama")}</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-10" />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-10" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="account-password">{email ? t("New password", "Password baru") : "Password"}</Label>
          <Input id="account-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("At least 8 characters", "Minimal 8 karakter")} className="h-10" />
        </div>
        <ErrorNote error={err} />
        <div>
          <Button type="submit" disabled={busy || password.length < 8 || (email ? !current : !newEmail.trim())}>
            {email ? t("Change Password", "Ganti Password") : t("Save Account", "Simpan Akun")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Research({ sid, on, onChange }: { sid: string; on: boolean; onChange: () => void }) {
  const t = useT();
  return (
    <section id="research" aria-labelledby="research-title">
      <SectionTitle id="research-title">{t("Research Participation", "Partisipasi Riset")}</SectionTitle>
      <label className="flex cursor-pointer gap-3 text-sm text-ink/80">
        <Checkbox
          checked={on}
          onCheckedChange={async (v) => {
            await api.put(`/students/${sid}/research-consent`, { consent: v === true });
            toast.success(v === true ? t("Thanks for helping the research", "Terima kasih sudah membantu riset") : t("Research participation withdrawn", "Partisipasi riset ditarik"));
            onChange();
          }}
          className="mt-0.5"
        />
        <span>
          {t(
            "I allow anonymised use of my data for PathSync research (user studies and model calibration). Optional: it never changes the features you get. Withdrawing also removes you from any running study.",
            "Aku mengizinkan dataku dipakai secara anonim untuk riset PathSync (user study dan kalibrasi model). Opsional: tidak pernah mengubah fitur yang kamu dapat. Menarik izin juga mengeluarkanmu dari studi yang sedang berjalan.",
          )}
        </span>
      </label>
    </section>
  );
}

function Joins({ sid, cohort, arm, onChange }: { sid: string; cohort: string | null; arm: string | null; onChange: () => void }) {
  const [classCode, setClassCode] = useState("");
  const [studyCode, setStudyCode] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const t = useT();
  async function join(kind: "cohort" | "study", code: string) {
    setErr(null);
    try {
      const r = await api.post<{ privacy?: string; arm?: string }>(`/students/${sid}/${kind}`, { join_code: code });
      toast.success(kind === "cohort" ? t("Joined your class", "Berhasil masuk kelas") : t("Joined the study", "Berhasil ikut studi"), { description: r.privacy });
      onChange();
    } catch (x) {
      setErr(x);
    }
  }
  return (
    <section id="class" aria-labelledby="class-title">
      <SectionTitle id="class-title">{t("Class and Study", "Kelas dan Studi")}</SectionTitle>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cls">{t("Class code from your lecturer", "Kode kelas dari dosenmu")}</Label>
          {cohort ? (
            <div className="flex items-center gap-2">
              <Tag tone="mint">{t("Joined", "Sudah bergabung")}</Tag>
              <Button variant="outline" size="sm" onClick={async () => { await api.del(`/students/${sid}/cohort`); onChange(); }}>
                {t("Leave Class", "Keluar Kelas")}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input id="cls" value={classCode} onChange={(e) => setClassCode(e.target.value.toUpperCase())} className="h-10 font-mono" />
              <Button onClick={() => join("cohort", classCode)} disabled={classCode.length < 4}>
                {t("Join", "Gabung")}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("Your lecturer sees class-level summaries only, and only once at least 5 students have joined.", "Dosenmu hanya melihat ringkasan tingkat kelas, dan baru setelah minimal 5 mahasiswa bergabung.")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="std">{t("Study code (research participants)", "Kode studi (peserta riset)")}</Label>
          {arm ? (
            <Tag tone="indigo">{t("Enrolled", "Terdaftar")}</Tag>
          ) : (
            <div className="flex gap-2">
              <Input id="std" value={studyCode} onChange={(e) => setStudyCode(e.target.value.toUpperCase())} className="h-10 font-mono" />
              <Button onClick={() => join("study", studyCode)} disabled={studyCode.length < 4}>
                {t("Join", "Gabung")}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("Participants are assigned to one version of PathSync at random. You can withdraw any time by deleting your data.", "Peserta ditempatkan secara acak ke salah satu versi PathSync. Kamu bisa mundur kapan saja dengan menghapus datamu.")}</p>
        </div>
      </div>
      <ErrorNote error={err} />
    </section>
  );
}

function Privacy({ sid, consentAt, version }: { sid: string; consentAt: string | null; version: string }) {
  const [confirm, setConfirm] = useState(false);
  const t = useT();
  async function exportData() {
    const data = await api.get(`/students/${sid}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pathsync-data-${sid}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function erase() {
    await api.del(`/students/${sid}`);
    setStudent(null);
    toast.success(t("Your profile and all its data were deleted.", "Profilmu dan semua datanya sudah dihapus."));
    window.location.href = "/";
  }
  return (
    <section id="privacy" aria-labelledby="privacy-title">
      <SectionTitle id="privacy-title">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-5 text-indigo" aria-hidden="true" /> {t("Your Personal Data", "Data Pribadimu")}
        </span>
      </SectionTitle>
      <div className="flex items-start gap-4">
      <Mascot name="export" size={84} className="hidden sm:block" />
      <p className="text-sm text-ink/75">
        {t(
          "Under Indonesia\u2019s Personal Data Protection Law (UU No. 27/2022) you can see everything we store and delete it. We use your data to build your own route; a sample of uploaded projects is read by a PathSync reviewer for quality, and lecturers see class totals only if you join a class.",
          "Berdasarkan UU Pelindungan Data Pribadi (UU No. 27/2022) kamu bisa melihat semua yang kami simpan dan menghapusnya. Kami memakai datamu untuk menyusun rutemu sendiri; sebagian project yang diunggah dibaca reviewer PathSync untuk kontrol kualitas, dan dosen hanya melihat total kelas kalau kamu bergabung ke kelas.",
        )}{" "}
        <a href="/privacy" className="font-medium text-indigo underline">{t("Read the privacy policy", "Baca kebijakan privasi")}</a>. {t("Consent given", "Persetujuan diberikan")}{" "}
        {consentAt ? new Date(consentAt + "Z").toLocaleDateString() : "–"} ({t("policy version", "versi kebijakan")} {version || "–"}).
      </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportData}>
          <Download /> {t("Download My Data", "Unduh Data-ku")}
        </Button>
        <Button variant="destructive" onClick={() => setConfirm(true)}>
          <Trash2 /> {t("Delete My Profile", "Hapus Profilku")}
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <Mascot name="delete" size={96} />
            <AlertDialogTitle>{t("Delete your profile?", "Hapus profilmu?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Your evidence, answers, plans, reflections and route history are deleted permanently. This cannot be undone.", "Evidence, jawaban, rencana, refleksi, dan riwayat rutemu dihapus permanen. Ini tidak bisa dibatalkan.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep My Profile", "Simpan Profilku")}</AlertDialogCancel>
            <AlertDialogAction onClick={erase}>{t("Delete Everything", "Hapus Semuanya")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
