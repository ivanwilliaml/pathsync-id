"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Briefcase, ClipboardCheck, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { requireKeySave } from "@/components/key-guard";
import { track, trackOnce } from "@/lib/track";
import { toast } from "sonner";
import { api, type Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { parseAccessKey, setStudent, useStudentId } from "@/lib/student";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/mascot";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote, LinkButton, NativeSelect, Tag } from "@/components/kit";
import { Logo } from "@/components/logo";
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
      toast.error(e instanceof Error ? e.message : t("Couldn't start the demo. Try again in a moment.", "Demo gagal dimulai. Coba lagi sebentar."));
      setDemoBusy(false);
    }
  };

  const n = meta.data?.n_postings;
  useEffect(() => trackOnce("page_view", "landing"), []);
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav aria-label={t("Site", "Situs")} className="flex items-center gap-1 sm:gap-2">
          <Link href="/careers" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink/75 hover:text-ink sm:inline-block">
            Job Market
          </Link>
          <Link href="/how-it-works" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink/75 hover:text-ink sm:inline-block">
            {t("How It Works", "Cara Kerja")}
          </Link>
          <Button variant="outline" size="lg" onClick={() => setResumeOpen(true)}>
            {t("Resume Profile", "Lanjutkan Profil")}
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-10">
        <div>
          <h1 className="text-[40px] font-extrabold leading-[1.08] text-ink sm:text-[54px]">{t("Know Exactly What to Learn Next", "Tahu Persis Apa yang Harus Dipelajari Berikutnya")}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/75">
            {t(
              "PathSync reads real Indonesian job postings, checks what you can already prove, and builds a learning route in the order that actually unblocks you.",
              "PathSync membaca job posting nyata di Indonesia, mengecek apa yang sudah bisa kamu buktikan, lalu menyusun rute belajar dengan urutan yang benar-benar membuka jalanmu.",
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="h-12 px-6 text-[15px]" onClick={() => setStartRole("business_analyst")}>
              {t("Start Your Path", "Mulai Path-mu")}
            </Button>
            <LinkButton href="/careers" variant="outline" size="lg" className="h-12 px-6 text-[15px]">
              {t("Explore the Job Market", "Jelajahi Job Market")}
            </LinkButton>
          </div>
          <button
            type="button"
            onClick={startDemo}
            disabled={demoBusy}
            className="mt-4 text-sm font-medium text-indigo underline-offset-4 hover:underline disabled:opacity-60"
          >
            {demoBusy ? t("Preparing a demo profile…", "Menyiapkan profil demo…") : t("Or look around first with a demo student profile →", "Atau lihat-lihat dulu dengan profil mahasiswa demo →")}
          </button>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/70">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-mint" aria-hidden="true" /> {t("Free, no email or password", "Gratis, tanpa email atau password")}
            </li>
            <li className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-mint" aria-hidden="true" /> {t("About 2 minutes to set up", "Sekitar 2 menit untuk mulai")}
            </li>
          </ul>
        </div>

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero.webp"
            alt={t("Students laughing together around a laptop in a library", "Mahasiswa tertawa bersama di depan laptop di perpustakaan")}
            width={1600}
            height={1067}
            fetchPriority="high"
            className="aspect-[4/3.6] w-full rounded-[28px] object-cover object-[45%_70%]"
          />
          <Mascot name="wave" size={150} priority className="absolute -top-10 -left-6 hidden drop-shadow-md sm:block" />
          <RoutePreview n={n} />
        </div>
      </section>

      {/* Roles */}
      <section className="border-y bg-card" id="roles">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex items-end gap-4">
            <Mascot name="signpost" size={96} className="hidden sm:block" />
            <h2 className="text-[28px] font-bold text-ink">{t("Choose Your Target Career", "Pilih Target Kariermu")}</h2>
          </div>
          <p className="mt-2 max-w-2xl text-ink/70">
            {t(
              `${meta.data ? `${meta.data.roles.length} careers` : "Careers"}, each built from real Indonesian job postings. PathSync teaches hard skills only: the tools and methods that courses can teach and a quick check can measure. Careers with fewer postings are marked Beta.`,
              `${meta.data ? `${meta.data.roles.length} karier` : "Karier"}, masing-masing disusun dari job posting nyata di Indonesia. PathSync hanya mengajarkan hard skill: tools dan metode yang bisa diajarkan di perkuliahan dan diukur lewat Quick Check. Karier dengan posting lebih sedikit ditandai Beta.`,
            )}
          </p>
          {(meta.data?.roles ?? []).length === 0 ? (
            <p className="mt-8 text-sm text-ink/60">{t("Loading careers…", "Memuat karier…")}</p>
          ) : (
            // one grid, best-supported careers first (fewest-data Beta roles last), family shown on each card:
            // grouping by family left rows with one card and two empty columns
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(meta.data?.roles ?? [])
                .slice()
                .sort((a, b) => Number(a.limited_data) - Number(b.limited_data) || (b.n_postings ?? 0) - (a.n_postings ?? 0))
                .map((r) => (
                  <article key={r.id} className="flex min-w-0 flex-col rounded-2xl border bg-background p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{meta.data?.families?.[r.family] ?? r.family}</p>
                    <div className="mt-1.5 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="size-5 shrink-0 text-indigo" aria-hidden="true" />
                        <h3 className="text-lg font-bold leading-snug text-ink">{r.name}</h3>
                      </div>
                      {r.limited_data ? <Tag tone="ember">Beta</Tag> : null}
                    </div>
                    <p className="mt-2 flex-1 text-sm text-ink/75">{r.blurb}</p>
                    <p className="mt-3 text-xs text-ink/60">{r.n_postings ? t(`Based on ${r.n_postings} real postings`, `Berdasarkan ${r.n_postings} posting nyata`) : t("Collecting postings", "Mengumpulkan posting")}</p>
                    <Button size="lg" variant="outline" className="mt-4 h-auto min-h-10 whitespace-normal py-2 text-center" onClick={() => setStartRole(r.id)}>
                      {t(`Start as ${r.name}`, `Mulai sebagai ${r.name}`)}
                    </Button>
                  </article>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works: a real sequence, so numbered */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-[28px] font-bold text-ink">{t("How It Works", "Cara Kerja")}</h2>
        <div className="relative mt-10">
          <div className="absolute left-5 right-5 top-5 hidden h-1 rounded-full bg-route md:block" aria-hidden="true" />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          {[
            {
              title: t("Add What You Have", "Tambahkan yang Kamu Punya"),
              body: t("Paste your transcript and add certificates or a project. Skip anything you don't have.", "Tempel transkripmu dan tambahkan sertifikat atau project. Lewati yang tidak kamu punya."),
            },
            {
              title: t("Take a Quick Check", "Ikuti Cek Kemampuan"),
              body: t("Answer about 24 short questions so we can see what you can already do.", "Jawab sekitar 24 soal singkat supaya kami tahu apa yang sudah bisa kamu lakukan."),
            },
            {
              title: t("Follow Your Route", "Ikuti Rutemu"),
              body: t(
                "Get your top three skills in the order that unblocks you, with free materials and the job ads that ask for them.",
                "Dapatkan tiga skill teratasmu dengan urutan yang membuka jalanmu, lengkap dengan materi gratis dan lowongan yang memintanya.",
              ),
            },
          ].map((s, i) => (
            <li key={s.title} className="relative">
              <span className="relative z-10 flex size-11 items-center justify-center rounded-full border-4 border-background bg-ink text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-ink/70">{s.body}</p>
            </li>
          ))}
          </ol>
        </div>
      </section>

      {/* Credibility */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid overflow-hidden rounded-[28px] bg-ink text-white md:grid-cols-[1fr_1.1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/study.webp" alt={t("A student working on a laptop in a library", "Seorang mahasiswa bekerja dengan laptop di perpustakaan")} width={1600} height={1067} loading="lazy" className="h-64 w-full object-cover md:h-full" />
          <div className="p-8 sm:p-10">
            <h2 className="text-[26px] font-bold">{t("Built on Evidence, Not Guesses", "Dibangun dari Evidence, Bukan Tebakan")}</h2>
            <ul className="mt-6 space-y-5">
              <li className="flex gap-3">
                <Briefcase className="mt-0.5 size-5 shrink-0 text-ember-ink" aria-hidden="true" />
                <p className="text-white/80">
                  <span className="font-semibold text-white">{t("Real job postings.", "Job posting nyata.")}</span>{" "}
                  {t(
                    `${n ? `${n} unique postings` : "Postings"} across the careers above, from Karirhub (Kemnaker) and company career sites, refreshed monthly.`,
                    `${n ? `${n} posting unik` : "Posting"} dari karier di atas, diambil dari Karirhub (Kemnaker) dan situs karier perusahaan, diperbarui tiap bulan.`,
                  )}
                </p>
              </li>
              <li className="flex gap-3">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-ember-ink" aria-hidden="true" />
                <p className="text-white/80">
                  <span className="font-semibold text-white">{t("Proof over claims.", "Bukti di atas klaim.")}</span>{" "}
                  {t(
                    "Assessments and projects count more than grades. CV claims and self-ratings never count as mastery.",
                    "Assessment dan project dihitung lebih berat daripada nilai. Klaim di CV dan penilaian diri tidak pernah dihitung sebagai mastery.",
                  )}
                </p>
              </li>
              <li className="flex gap-3">
                <RouteIcon className="mt-0.5 size-5 shrink-0 text-ember-ink" aria-hidden="true" />
                <p className="text-white/80">
                  <span className="font-semibold text-white">{t("The right order.", "Urutan yang tepat.")}</span>{" "}
                  {t(
                    "Skills that unlock others come first, so you never get stuck on something you aren\u2019t ready for.",
                    "Skill yang membuka skill lain didahulukan, jadi kamu tidak terjebak di hal yang belum siap kamu pelajari.",
                  )}
                </p>
              </li>
            </ul>
            <Button size="lg" className="mt-8 h-11 bg-white text-ink hover:bg-white/90" onClick={() => setStartRole("business_analyst")}>
              {t("Start Your Path", "Mulai Path-mu")}
            </Button>
          </div>
        </div>
      </section>

      <Waitlist />
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>&copy; 2026 PathSync · {t("closed beta", "beta tertutup")}</span>
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
    <section className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="text-[24px] font-bold text-ink">{t("Your Role Isn\u2019t Here Yet?", "Role-mu Belum Ada?")}</h2>
        <p className="mt-1 max-w-2xl text-ink/70">{t("We add roles as soon as there are enough real job postings. Leave your email and the role you need. We only write when it launches.", "Kami menambah role begitu job posting nyatanya cukup. Tinggalkan email dan role yang kamu butuhkan. Kami hanya mengirim kabar saat role itu rilis.")}</p>
        {done ? (
          <p className="mt-5 rounded-xl bg-secondary p-4 text-sm font-medium text-secondary-foreground">{t("Thanks! We will email you when your role is ready.", "Terima kasih! Kami akan mengirim email saat role-mu siap.")}</p>
        ) : (
          <form onSubmit={submit} className="mt-5 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("Email address…", "Alamat email…")} aria-label={t("Email address", "Alamat email")} autoComplete="email" className="h-11 sm:flex-1" />
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("Role you need, e.g. UI/UX Designer…", "Role yang kamu butuhkan, mis. UI/UX Designer…")} aria-label={t("Role you need", "Role yang kamu butuhkan")} className="h-11 sm:flex-1" maxLength={120} />
            <Button type="submit" size="lg" className="h-11">{t("Notify Me", "Kabari Aku")}</Button>
          </form>
        )}
        <div className="mt-3"><ErrorNote error={err} /></div>
      </div>
    </section>
  );
}

/** The signature element: a three-stop route with the brand gradient, laid over the hero photo. */
function RoutePreview({ n }: { n?: number }) {
  const t = useT();
  const stops = [
    { name: "SQL", state: t("Ready now", "Siap sekarang") },
    { name: "Data Cleaning", state: t("Unlocks 3 skills", "Membuka 3 skill") },
    { name: "Data Visualization", state: t("Asked in most postings", "Diminta di banyak posting") },
  ];
  return (
    <div className="relative -mt-16 ml-4 mr-4 rounded-2xl border bg-white p-5 shadow-xl sm:ml-6 sm:mr-auto sm:max-w-[360px] lg:absolute lg:-bottom-10 lg:-left-10 lg:m-0 lg:w-[340px]">
      <p className="text-sm font-semibold text-ink">{t("Sample Route to Data Analyst", "Contoh Rute ke Data Analyst")}</p>
      <ol className="relative mt-4 space-y-3 pl-6">
        <span className="absolute bottom-2 left-[7px] top-2 w-[3px] rounded-full bg-route-v" aria-hidden="true" />
        {stops.map((s, i) => (
          <li key={s.name} className="relative flex items-baseline justify-between gap-3">
            <span
              className="absolute -left-6 top-1 size-[17px] rounded-full border-[3px] border-white"
              style={{ background: ["var(--indigo)", "var(--iris)", "var(--ember)"][i] }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-ink">{s.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{s.state}</span>
          </li>
        ))}
      </ol>
      {n ? <p className="mt-4 text-xs text-muted-foreground">{t(`Built from ${n} real postings across all careers`, `Disusun dari ${n} posting nyata di semua karier`)}</p> : null}
    </div>
  );
}

function StartDialog({ role, onClose, roles, families }: { role: string | null; onClose: () => void; roles?: Meta["roles"]; families?: Record<string, string> }) {
  const router = useRouter();
  const [name, setName] = useState("");
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
      const r = await api.post<{ id: string; token: string }>("/students", { display_name: name.trim() || "Student", program, target_role: target, consent });
      setStudent({ id: r.id, token: r.token });
      requireKeySave();
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
          <DialogDescription>{t("No email or password. You\u2019ll get a private access key to come back later.", "Tanpa email atau password. Kamu akan mendapat access key pribadi untuk kembali nanti.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("What should we call you?", "Kami panggil kamu siapa?")}</Label>
            <Input id="name" name="nickname" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Rani…", "mis. Rani…")} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="program">{t("Study Program", "Program Studi")}</Label>
            <NativeSelect id="program" name="program" value={program} onChange={(e) => setProgram(e.target.value)}>
              {PROGRAMS.map(([en, id]) => (
                <option key={en} value={en}>
                  {t(en, id)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
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
          <label className="flex cursor-pointer gap-3 rounded-lg bg-muted p-3 text-sm text-ink/80">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-describedby="consent-text" />
            <span id="consent-text">
              {t(
                "I agree that my grades, documents, and answers are used to build my learning path. A sample of uploaded projects is read by a PathSync reviewer to keep scoring fair, and lecturers only see class totals if I join a class. I can download or delete everything anytime.",
                "Aku setuju nilai, dokumen, dan jawabanku dipakai untuk menyusun learning path-ku. Sebagian project yang diunggah dibaca reviewer PathSync agar penilaian tetap adil, dan dosen hanya melihat total kelas kalau aku bergabung ke kelas. Aku bisa mengunduh atau menghapus semuanya kapan saja.",
              )}{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-indigo underline">{t("Privacy Policy", "Kebijakan Privasi")}</Link>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm text-ink/80">
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
  const [value, setValue] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const t = useT();
  async function resume(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const auth = parseAccessKey(value);
      if (!auth) throw new Error("bad key");
      setStudent(auth);
      await api.get(`/students/${auth.id}`);
      router.push("/dashboard");
    } catch {
      setStudent(null);
      setErr(new Error(t("That access key doesn't match a profile. Copy it again from Settings on your other device.", "Access key itu tidak cocok dengan profil mana pun. Salin lagi dari Pengaturan di perangkatmu yang lain.")));
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Resume Your Profile", "Lanjutkan Profilmu")}</DialogTitle>
          <DialogDescription>{t("Paste the access key from Settings. It works like a password, so keep it private.", "Tempel access key dari Pengaturan. Fungsinya seperti password, jadi jaga kerahasiaannya.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={resume} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pid">Access Key</Label>
            <Input id="pid" name="access-key" type="password" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("e.g. ef99fb3e22b5.Xk3…", "mis. ef99fb3e22b5.Xk3…")} className="h-10 font-mono" />
          </div>
          <ErrorNote error={err} />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={!value.trim()}>
            {t("Continue", "Lanjut")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
