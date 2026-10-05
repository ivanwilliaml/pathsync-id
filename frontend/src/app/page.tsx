"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Briefcase, ClipboardCheck, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, type Meta } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { setStudentId, useStudentId } from "@/lib/student";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote, LinkButton, NativeSelect } from "@/components/kit";
import { Logo } from "@/components/logo";

const PROGRAMS = ["Information Systems", "Computer Science", "Management", "Accounting", "Statistics", "Other"];

const ROLES = [
  {
    id: "business_analyst",
    name: "Business Analyst",
    image: "/images/role-ba.webp",
    blurb: "Turns business problems into clear requirements, process maps, and decisions the team can build on.",
    skills: ["Requirements Elicitation", "Process Modeling", "Stakeholder Management"],
  },
  {
    id: "data_analyst",
    name: "Data Analyst",
    image: "/images/role-da.webp",
    blurb: "Pulls, cleans, and analyses data so the business can see what is happening and why.",
    skills: ["SQL", "Data Analysis", "Dashboards & Reporting"],
  },
];

export default function Landing() {
  const router = useRouter();
  const { id, ready } = useStudentId();
  const meta = useApi<Meta>("/meta");
  const [startRole, setStartRole] = useState<string | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);

  // returning visitors go straight to their dashboard (only on first load, not right after creating a profile)
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!ready || checked) return;
    setChecked(true);
    if (id) router.replace("/dashboard");
  }, [ready, id, checked, router]);

  const n = meta.data?.n_postings;
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
          <Link href="/market" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink/75 hover:text-ink sm:inline-block">
            Job Market
          </Link>
          <Link href="/experts" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink/75 hover:text-ink sm:inline-block">
            For Experts
          </Link>
          <Button variant="outline" size="lg" onClick={() => setResumeOpen(true)}>
            Resume Profile
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-10">
        <div>
          <h1 className="text-[40px] font-extrabold leading-[1.08] text-ink sm:text-[54px]">Know Exactly What to Learn Next</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/75">
            PathSync reads real Indonesian job postings, checks what you can already prove, and builds a learning route in the order
            that actually unblocks you.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="h-12 px-6 text-[15px]" onClick={() => setStartRole("business_analyst")}>
              Start Your Path
            </Button>
            <LinkButton href="/market" variant="outline" size="lg" className="h-12 px-6 text-[15px]">
              Explore the Job Market
            </LinkButton>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/70">
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-mint" aria-hidden="true" /> Free, no account needed
            </li>
            <li className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-mint" aria-hidden="true" /> About 2 minutes to set up
            </li>
          </ul>
        </div>

        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero.webp"
            alt="Students laughing together around a laptop in a library"
            width={1600}
            height={1067}
            fetchPriority="high"
            className="aspect-[4/3.6] w-full rounded-[28px] object-cover object-[45%_70%]"
          />
          <RoutePreview n={n} />
        </div>
      </section>

      {/* Roles */}
      <section className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-[28px] font-bold text-ink">Choose Your Target Role</h2>
          <p className="mt-2 max-w-2xl text-ink/70">
            PathSync currently covers two analyst roles, so every recommendation can be backed by enough real job postings.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {ROLES.map((r) => (
              <article key={r.id} className="group overflow-hidden rounded-2xl border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.image} alt="" width={1600} height={1067} loading="lazy" className="h-48 w-full object-cover sm:h-56" />
                <div className="p-6">
                  <div className="flex items-center gap-2">
                    <Briefcase className="size-5 text-indigo" aria-hidden="true" />
                    <h3 className="text-xl font-bold text-ink">{r.name}</h3>
                  </div>
                  <p className="mt-2 text-ink/75">{r.blurb}</p>
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Most requested skills">
                    {r.skills.map((s) => (
                      <li key={s} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                        {s}
                      </li>
                    ))}
                  </ul>
                  <Button size="lg" variant="outline" className="mt-6 h-11" onClick={() => setStartRole(r.id)}>
                    Start as {r.name}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works: a real sequence, so numbered */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-[28px] font-bold text-ink">How It Works</h2>
        <div className="relative mt-10">
          <div className="absolute left-5 right-5 top-5 hidden h-1 rounded-full bg-route md:block" aria-hidden="true" />
          <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          {[
            { title: "Add What You Have", body: "Paste your transcript and add certificates or a project. Skip anything you don't have." },
            { title: "Take a Quick Check", body: "Answer about 24 short questions so we can see what you can already do." },
            { title: "Follow Your Route", body: "Get your top three skills in the order that unblocks you, with free materials and the job ads that ask for them." },
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
          <img src="/images/study.webp" alt="A student working on a laptop in a library" width={1600} height={1067} loading="lazy" className="h-64 w-full object-cover md:h-full" />
          <div className="p-8 sm:p-10">
            <h2 className="text-[26px] font-bold">Built on Evidence, Not Guesses</h2>
            <ul className="mt-6 space-y-5">
              <li className="flex gap-3">
                <Briefcase className="mt-0.5 size-5 shrink-0 text-ember" aria-hidden="true" />
                <p className="text-white/80">
                  <span className="font-semibold text-white">Real job postings.</span> {n ? `${n} unique postings` : "Postings"} from Karirhub
                  (Kemnaker) and company career sites, refreshed monthly.
                </p>
              </li>
              <li className="flex gap-3">
                <BadgeCheck className="mt-0.5 size-5 shrink-0 text-ember" aria-hidden="true" />
                <p className="text-white/80">
                  <span className="font-semibold text-white">Proof over claims.</span> Assessments and projects count more than grades. CV
                  claims and self-ratings never count as mastery.
                </p>
              </li>
              <li className="flex gap-3">
                <RouteIcon className="mt-0.5 size-5 shrink-0 text-ember" aria-hidden="true" />
                <p className="text-white/80">
                  <span className="font-semibold text-white">The right order.</span> Skills that unlock others come first, so you never get stuck on
                  something you aren&rsquo;t ready for.
                </p>
              </li>
            </ul>
            <Button size="lg" className="mt-8 h-11 bg-white text-ink hover:bg-white/90" onClick={() => setStartRole("business_analyst")}>
              Start Your Path
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <span>PathSync is a research prototype by Team cupuu for ICC 2026.</span>
          <span>
            Photos from{" "}
            <a className="underline hover:text-ink" href="https://unsplash.com" target="_blank" rel="noreferrer">
              Unsplash
            </a>
          </span>
        </div>
      </footer>

      <StartDialog role={startRole} onClose={() => setStartRole(null)} roles={meta.data?.roles} />
      <ResumeDialog open={resumeOpen} onOpenChange={setResumeOpen} />
    </div>
  );
}

/** The signature element: a three-stop route with the brand gradient, laid over the hero photo. */
function RoutePreview({ n }: { n?: number }) {
  const stops = [
    { name: "Stakeholder Management", state: "Ready now" },
    { name: "Requirements Elicitation", state: "Unlocks 3 skills" },
    { name: "Requirements Documentation", state: "Asked in 72% of postings" },
  ];
  return (
    <div className="relative -mt-16 ml-4 mr-4 rounded-2xl border bg-white p-5 shadow-xl sm:ml-6 sm:mr-auto sm:max-w-[360px] lg:absolute lg:-bottom-10 lg:-left-10 lg:m-0 lg:w-[340px]">
      <p className="text-sm font-semibold text-ink">Sample Route to Business Analyst</p>
      <ol className="relative mt-4 space-y-3 pl-6">
        <span className="absolute bottom-2 left-[7px] top-2 w-[3px] rounded-full bg-route-v" aria-hidden="true" />
        {stops.map((s, i) => (
          <li key={s.name} className="relative flex items-baseline justify-between gap-3">
            <span
              className="absolute -left-6 top-1 size-[17px] rounded-full border-[3px] border-white"
              style={{ background: ["#4338ca", "#7c6cf6", "#f2711c"][i] }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-ink">{s.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{s.state}</span>
          </li>
        ))}
      </ol>
      {n ? <p className="mt-4 text-xs text-muted-foreground">Based on {n} real postings</p> : null}
    </div>
  );
}

function StartDialog({ role, onClose, roles }: { role: string | null; onClose: () => void; roles?: Meta["roles"] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [program, setProgram] = useState(PROGRAMS[0]);
  const [target, setTarget] = useState("business_analyst");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (role) setTarget(role);
  }, [role]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setErr(new Error("Please accept the data consent to continue."));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ id: string }>("/students", { display_name: name.trim() || "Student", program, target_role: target, consent });
      setStudentId(r.id);
      toast.success("Profile created", { description: "Next, add what you already have." });
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
          <DialogTitle className="text-xl">Create Your Profile</DialogTitle>
          <DialogDescription>No email or password. You&rsquo;ll get a profile ID to come back later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">What should we call you?</Label>
            <Input id="name" name="nickname" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rani…" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="program">Study Program</Label>
            <NativeSelect id="program" name="program" value={program} onChange={(e) => setProgram(e.target.value)}>
              {PROGRAMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </NativeSelect>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-sm font-medium">Target Role</legend>
            <div className="grid grid-cols-2 gap-2">
              {(roles ?? ROLES).map((r) => (
                <label
                  key={r.id}
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-sm font-medium transition-colors ${
                    target === r.id ? "border-indigo bg-secondary text-secondary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <input type="radio" name="role" value={r.id} checked={target === r.id} onChange={() => setTarget(r.id)} className="sr-only" />
                  {r.name}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex cursor-pointer gap-3 rounded-lg bg-muted p-3 text-sm text-ink/80">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" aria-describedby="consent-text" />
            <span id="consent-text">
              I agree that my grades, documents, and answers are used to build my learning path. They are not shared, and I can delete them anytime.
            </span>
          </label>
          <ErrorNote error={err} />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={busy}>
            {busy ? "Creating…" : "Create My Profile"}
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
  async function resume(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.get(`/students/${value.trim()}`);
      setStudentId(value.trim());
      router.push("/dashboard");
    } catch {
      setErr(new Error("We couldn't find that profile ID. Check for typos and try again."));
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Resume Your Profile</DialogTitle>
          <DialogDescription>Enter the profile ID shown in your sidebar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={resume} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pid">Profile ID</Label>
            <Input id="pid" name="profile-id" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. ef99fb3e22b5…" className="h-10 font-mono" />
          </div>
          <ErrorNote error={err} />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={!value.trim()}>
            Continue
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
