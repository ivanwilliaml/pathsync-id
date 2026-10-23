"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardCheck, ShieldCheck } from "lucide-react";
import { track, trackOnce } from "@/lib/track";
import { toast } from "sonner";
import { api, type Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { setStudent, useStudentId } from "@/lib/student";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/mascot";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote, LinkButton, NativeSelect } from "@/components/kit";
import { SkillMapHero } from "@/components/skill-map-hero";
import { PublicHeader } from "@/components/public-shell";
import { CycleStory, ProblemStory, ProofStory } from "@/components/landing-story";
import { RoleWheel } from "@/components/role-wheel";
import { useT } from "@/lib/i18n";

// value sent to the API stays English; the label follows the interface language
const PROGRAMS: [string, string][] = [
  ["Information Systems", "Sistem Informasi"],
  ["Computer Science", "Ilmu Komputer / Informatika"],
  ["Design / Visual Communication", "Desain / DKV"],
  ["Management / Marketing", "Manajemen / Pemasaran"],
  ["Accounting", "Akuntansi"],
  ["Statistics", "Statistika"],
  ["Other", "Lainnya"],
];

export default function Landing() {
  const router = useRouter();
  const { id, ready } = useStudentId();
  const meta = useApi<Meta>("/meta");
  const [startRole, setStartRole] = useState<string | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const t = useT();

  // returning visitors go straight to their dashboard (only on first load, not right after creating a profile)
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!ready || checked) return;
    setChecked(true);
    if (id) router.replace("/dashboard");
  }, [ready, id, checked, router]);

  // one-click demo: a sample Information Systems student with a transcript already in (deleted after 2 days)
  const [demoBusy, setDemoBusy] = useState(false);
  const startDemo = async () => {
    setDemoBusy(true);
    try {
      const r = await api.post<{ id: string; token: string }>("/demo/profile");
      setStudent({ id: r.id, token: r.token });
      track("demo_started");
      router.push("/dashboard");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Couldn't open the sample. Try again in a moment.", "Contoh belum bisa dibuka. Coba lagi sebentar."));
      setDemoBusy(false);
    }
  };

  const n = meta.data?.n_postings;
  // agreement of the ranking model with (simulated) expert rankings, straight from the evaluation report
  const evaluation = useApi<{ conditions?: { titik_hambat?: { cv?: { methods?: { model?: { ndcg5?: { mean: number } } } } } } }>("/evaluation");
  const ndcg = evaluation.data?.conditions?.titik_hambat?.cv?.methods?.model?.ndcg5?.mean;
  // three careers far apart, so the map visibly changes: analysis, data, and a non-technical one
  const heroRoles = ["business_analyst", "data_analyst", "digital_marketing"].map((id) => ({
    id,
    label: meta.data?.roles.find((r) => r.id === id)?.name ?? id.replace(/_/g, " "),
  }));
  const demoLabel = t("Or look around first as a sample student", "Atau lihat-lihat dulu sebagai contoh mahasiswa");
  useEffect(() => trackOnce("page_view", "landing"), []);
  // public pages link here with ?resume=1 (Resume Profile) or ?start=1 (Start)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("resume")) setResumeOpen(true);
    else if (q.get("start")) setStartRole("business_analyst");
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader onSignIn={() => setResumeOpen(true)} onStart={() => setStartRole("business_analyst")} />

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:pb-24 lg:pt-10">
        {/* the copy rises in one line after another, as the map beside it starts */}
        <div>
          <h1 className="hero-rise text-balance text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[56px]" style={{ ["--d" as string]: "0ms" }}>
            {t("Know Exactly What to Learn", "Tahu Persis Apa yang Harus Dipelajari")}{" "}
            <span className="hero-grad">{t("Next", "Berikutnya")}</span>
          </h1>
          <p className="hero-rise mt-6 max-w-[34rem] text-pretty text-[17px] leading-[1.65] tracking-[-0.005em] text-ink/65 sm:text-lg" style={{ ["--d" as string]: "90ms" }}>
            {t(
              "PathSync reads real Indonesian job postings, checks what you can already prove, and builds a learning route in the order that actually unblocks you.",
              "PathSync membaca job posting nyata di Indonesia, mengecek apa yang sudah bisa kamu buktikan, lalu menyusun rute belajar dengan urutan yang benar-benar membuka jalanmu.",
            )}
          </p>
          <div className="hero-rise mt-9 flex flex-wrap gap-3" style={{ ["--d" as string]: "180ms" }}>
            <Button size="lg" className="hero-cta group h-12 rounded-full px-6 text-[15px] font-semibold" onClick={() => setStartRole("business_analyst")}>
              {t("Start Your Path", "Mulai Path-mu")}
              <ArrowRight className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
            </Button>
            <LinkButton href="/careers" variant="outline" size="lg" className="hero-ghost h-12 rounded-full px-6 text-[15px] font-semibold">
              {t("Explore the Job Market", "Jelajahi Job Market")}
            </LinkButton>
          </div>
          <button
            type="button"
            onClick={startDemo}
            disabled={demoBusy}
            className="hero-rise group mt-5 block text-left text-sm font-medium text-indigo transition-colors hover:text-indigo/80 disabled:opacity-60"
            style={{ ["--d" as string]: "260ms" }}
          >
            {demoBusy ? t("Opening a sample student…", "Membuka contoh mahasiswa…") : (
              // the last word and the arrow never break apart, so the arrow is never left alone on a line
              <>
                {demoLabel.slice(0, demoLabel.lastIndexOf(" ") + 1)}
                <span className="whitespace-nowrap">
                  {demoLabel.slice(demoLabel.lastIndexOf(" ") + 1)}
                  <ArrowRight className="ml-1 inline-block size-3.5 align-[-2px] transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </>
            )}
          </button>
          <ul className="hero-rise mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-medium text-ink/55" style={{ ["--d" as string]: "340ms" }}>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-mint" aria-hidden="true" /> {t("Free to use", "Gratis dipakai")}
            </li>
            <li className="flex items-center gap-1.5">
              <ClipboardCheck className="size-4 text-mint" aria-hidden="true" /> {t("About 2 minutes to set up", "Sekitar 2 menit untuk mulai")}
            </li>
          </ul>
        </div>

        <div className="relative min-w-0">
          <Mascot name="wave" size={96} priority className="absolute -bottom-6 -left-10 z-10 hidden drop-shadow-md sm:block" />
          <SkillMapHero roles={heroRoles} />
        </div>
      </section>

      <ProblemStory />
      <CycleStory />

      {/* Roles */}
      <section className="blend" id="roles" style={{ ["--blend" as string]: "var(--card)" }}>
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div>
            <RoleWheel
              roles={(meta.data?.roles ?? []).slice().sort((a, b) => Number(a.limited_data) - Number(b.limited_data) || (b.n_postings ?? 0) - (a.n_postings ?? 0))}
              families={meta.data?.families}
              onStart={setStartRole}
            />
          </div>
        </div>
      </section>

      <ProofStory postings={n} careers={meta.data?.roles.length} skills={meta.data?.skills.length} ndcg={ndcg} onStart={() => setStartRole("business_analyst")} />

      <Waitlist />
      <footer className="site-foot">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-5 py-8 text-[12.5px] text-muted-foreground sm:px-8">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>&copy; 2026 PathSync, {t("closed beta", "beta tertutup")}</span>
            <Link href="/about" className="hover:text-ink">{t("About & Contact", "Tentang & Kontak")}</Link>
            <Link href="/privacy" className="hover:text-ink">{t("Privacy Policy", "Kebijakan Privasi")}</Link>
          </span>
          <span>
            {t("Photos from", "Foto dari")}{" "}
            <a className="underline hover:text-ink" href="https://unsplash.com" target="_blank" rel="noreferrer">
              Unsplash
            </a>
          </span>
        </div>
      </footer>

      <StartDialog role={startRole} onClose={() => setStartRole(null)} roles={meta.data?.roles} families={meta.data?.families} />
      <ResumeDialog open={resumeOpen} onOpenChange={setResumeOpen} />
    </div>
  );
}

function Waitlist() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const t = useT();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post("/waitlist", { email, role });
      setDone(true);
    } catch (e) {
      setErr(e);
    }
  }
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
      <div className="p-card mx-auto max-w-3xl rounded-[30px] px-6 py-10 text-center sm:px-12 sm:py-12">
        <h2 className="text-balance text-[26px] font-extrabold tracking-[-0.03em] text-ink sm:text-[30px]">{t("Your role isn\u2019t here", "Role-mu")} <span className="hero-grad">{t("yet?", "belum ada?")}</span></h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-ink/65">{t("We add roles as soon as there are enough real job postings. Leave your email and the role you need. We only write when it launches.", "Kami menambah role begitu job posting nyatanya cukup. Tinggalkan email dan role yang kamu butuhkan. Kami hanya mengirim kabar saat role itu rilis.")}</p>
        {done ? (
          <p className="wheel-detail mx-auto mt-7 max-w-lg rounded-full bg-[#e3f5ea] px-5 py-3 text-[14px] font-semibold text-mint-ink">{t("Thanks! We will email you when your role is ready.", "Terima kasih! Kami akan mengirim email saat role-mu siap.")}</p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-7 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("Email address…", "Alamat email…")} aria-label={t("Email address", "Alamat email")} autoComplete="email" className="p-field h-12 min-w-0 rounded-full px-5 text-[15px] text-ink placeholder:text-muted-foreground sm:flex-1" />
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("Role you need, e.g. UI/UX Designer…", "Role yang kamu butuhkan, mis. UI/UX Designer…")} aria-label={t("Role you need", "Role yang kamu butuhkan")} className="p-field h-12 min-w-0 rounded-full px-5 text-[15px] text-ink placeholder:text-muted-foreground sm:flex-1" maxLength={120} />
            <Button type="submit" size="lg" className="hero-cta h-12 rounded-full px-6 text-[15px] font-semibold">{t("Notify Me", "Kabari Aku")}</Button>
          </form>
        )}
        <div className="mt-3"><ErrorNote error={err} /></div>
      </div>
    </section>
  );
}

function StartDialog({ role, onClose, roles, families }: { role: string | null; onClose: () => void; roles?: Meta["roles"]; families?: Record<string, string> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [program, setProgram] = useState(PROGRAMS[0][0]);
  const [target, setTarget] = useState("business_analyst");
  const [consent, setConsent] = useState(false);
  const [research, setResearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const t = useT();

  useEffect(() => {
    if (role) setTarget(role);
  }, [role]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setErr(new Error(t("Please accept the data consent to continue.", "Setujui persetujuan data untuk melanjutkan.")));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ id: string; token: string }>("/students", { display_name: name.trim() || "Student", email: email.trim(), password, program, target_role: target, consent });
      setStudent({ id: r.id, token: r.token });
      track("signup", { role: target });
      if (research) await api.put(`/students/${r.id}/research-consent`, { consent: true }).catch(() => {});
      router.push("/evidence");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={role !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("Create Your Profile", "Buat Profilmu")}</DialogTitle>
          <DialogDescription>{t("Use your email and a password to sign in again later, from any device.", "Pakai email dan password untuk masuk lagi nanti, dari perangkat mana pun.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t("What should we call you?", "Kami panggil kamu siapa?")}</Label>
            <Input id="name" name="nickname" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Rani…", "mis. Rani…")} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("you@example.com", "kamu@contoh.com")} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("At least 8 characters", "Minimal 8 karakter")} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program">{t("Study Program", "Program Studi")}</Label>
            <NativeSelect id="program" name="program" value={program} onChange={(e) => setProgram(e.target.value)}>
              {PROGRAMS.map(([en, id]) => (
                <option key={en} value={en}>
                  {t(en, id)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">{t("Target Career", "Target Karier")}</Label>
            <NativeSelect id="role" name="role" value={target} onChange={(e) => setTarget(e.target.value)}>
              {Object.entries(families ?? {}).map(([fam, label]) => (
                <optgroup key={fam} label={label}>
                  {(roles ?? []).filter((r) => r.family === fam).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.limited_data ? " (Beta)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          </div>
          <label className="flex cursor-pointer gap-3 rounded-lg bg-muted p-4 text-sm leading-relaxed text-ink/80">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-describedby="consent-text" />
            <span id="consent-text">
              {t(
                "I agree that my grades, documents, and answers are used to build my learning path. A sample of uploaded projects is read by a PathSync reviewer to keep scoring fair, and lecturers only see class totals if I join a class. I can download or delete everything anytime.",
                "Aku setuju nilai, dokumen, dan jawabanku dipakai untuk menyusun learning path-ku. Sebagian project yang diunggah dibaca reviewer PathSync agar penilaian tetap adil, dan dosen hanya melihat total kelas kalau aku bergabung ke kelas. Aku bisa mengunduh atau menghapus semuanya kapan saja.",
              )}{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-indigo underline">{t("Privacy Policy", "Kebijakan Privasi")}</Link>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border p-4 text-sm leading-relaxed text-ink/80">
            <Checkbox checked={research} onCheckedChange={(v) => setResearch(v === true)} className="mt-0.5" />
            <span>
              <span className="font-medium text-ink">{t("Optional:", "Opsional:")}</span>{" "}
              {t(
                "I also allow anonymised use of my data for PathSync research (user studies and model calibration). I can withdraw at any time in Settings.",
                "Aku juga mengizinkan dataku dipakai secara anonim untuk riset PathSync (user study dan kalibrasi model). Aku bisa menariknya kapan saja di Pengaturan.",
              )}
            </span>
          </label>
          <ErrorNote error={err} />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
            {busy ? t("Creating…", "Membuat…") : t("Create My Profile", "Buat Profilku")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResumeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const t = useT();
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api.post<{ id: string; token: string }>("/students/login", { email: email.trim(), password });
      setStudent({ id: r.id, token: r.token });
      track("login");
      router.push("/dashboard");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Sign In to Your Profile", "Masuk ke Profilmu")}</DialogTitle>
          <DialogDescription>{t("Use the email and password you signed up with.", "Pakai email dan password yang kamu daftarkan.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={signIn} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input id="login-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10" />
          </div>
          <ErrorNote error={err} />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={!email.trim() || !password || busy}>
            {busy ? t("Signing in…", "Masuk…") : t("Sign in", "Masuk")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
