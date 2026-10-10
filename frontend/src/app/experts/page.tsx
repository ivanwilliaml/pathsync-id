"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, GitBranch, ListOrdered, Plus, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Meta } from "@/lib/api";
import { num, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { setStaffToken, useStaffToken } from "@/lib/staff";
import { StaffLogin } from "@/components/staff-login";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote, Loading, MasteryBar, NativeSelect, Panel, Tag } from "@/components/kit";

interface Expert {
  id: string;
  name: string;
  affiliation?: string;
}
interface WhoAmI {
  role: "admin" | "expert";
  expert?: Expert;
  experts?: Expert[];
}
interface EdgeRow {
  id: number;
  from: string;
  to: string;
  from_name: string;
  to_name: string;
  rationale: string;
  my_vote: boolean | null;
}
interface ScenarioRow {
  id: string;
  title: string;
  variant: string;
  done: boolean;
}
interface ScenarioDetail {
  id: string;
  title: string;
  candidates: { skill_id: string; name: string; p: number; r: number; D: number; prereqs: { skill_id: string; name: string; p: number | null }[] }[];
}

const VARIANT: Record<string, string> = { base: "Base Profile", competency: "After Learning a Skill", market: "After a Market Change" };
const KIND: Record<string, string> = { dosen: "Lecturer", praktisi: "Practitioner", rekruter: "Recruiter" };

export default function ExpertsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Experts />
    </Suspense>
  );
}

function Experts() {
  const router = useRouter();
  const pathname = usePathname();
  const task = useSearchParams().get("task");
  const { token, ready } = useStaffToken("expert");
  const who = useApi<WhoAmI>(token ? "/expert/me" : null);
  const [actingFor, setActingFor] = useState("");
  const go = (t: string | null) => router.replace(t ? `${pathname}?task=${t}` : pathname, { scroll: false });
  const me: Expert | undefined =
    who.data?.role === "expert" ? who.data.expert : who.data?.experts?.find((e) => e.id === actingFor);

  if (!ready) return <Loading />;
  if (me && task === "edges") return <EdgeReview me={me} onBack={() => go(null)} />;
  if (me && task === "scenarios") return <ScenarioRanking me={me} onBack={() => go(null)} />;

  return (
    <div className="space-y-8">
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight text-ink sm:text-[38px]">Expert Panel</h1>
          <p className="mt-3 max-w-lg text-lg text-ink/75">
            Lecturers, practitioners, and recruiters check the prerequisite map and rank example students. Your judgement trains how PathSync orders skills.
          </p>
          <Panel className="mt-6">
            {!token || who.error ? (
              <StaffLogin role="expert" error={who.error} hint="Use the personal sign-in key the PathSync team sent you." />
            ) : who.data?.role === "admin" ? (
              <div className="space-y-1.5">
                <Label htmlFor="who">Facilitating for</Label>
                <NativeSelect id="who" value={actingFor} onChange={(e) => setActingFor(e.target.value)}>
                  <option value="">Select an expert…</option>
                  {who.data.experts?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">Add experts and send them their keys from Admin, Team.</p>
              </div>
            ) : me ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-ink/80">
                  Signed in as <span className="font-semibold text-ink">{me.name}</span>
                  {me.affiliation ? `, ${me.affiliation}` : ""}
                </p>
                <Button variant="outline" onClick={() => setStaffToken("expert", null)}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <Loading />
            )}
          </Panel>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/experts.webp" alt="Two people mapping ideas on a whiteboard" width={1600} height={1067} className="aspect-[16/10] w-full rounded-3xl object-cover" />
      </section>

      {me ? <Tasks me={me} onStart={go} /> : null}
    </div>
  );
}

function Tasks({ me, onStart }: { me: Expert; onStart: (t: string) => void }) {
  const edges = useApi<EdgeRow[]>(`/expert/edges?expert_id=${me.id}`);
  const scen = useApi<ScenarioRow[]>(`/expert/scenarios?expert_id=${me.id}`);
  const voted = edges.data?.filter((e) => e.my_vote !== null).length ?? 0;
  const ranked = scen.data?.filter((s) => s.done).length ?? 0;
  const card = (icon: React.ReactNode, title: string, body: string, done: number, total: number | undefined, time: string, onClick: () => void) => (
    <Panel className="flex flex-col">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-indigo">{icon}</span>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-ink/75">{body}</p>
      <div className="mt-5">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-ink/70">{time}</span>
          <span className="tabular font-medium text-ink">
            {done} of {total ?? "…"}
          </span>
        </div>
        <MasteryBar value={total ? done / total : 0} />
      </div>
      <Button size="lg" className="mt-5 h-11 self-start px-6" onClick={onClick}>
        {done === 0 ? "Start" : total && done >= total ? "Review Again" : "Continue"}
      </Button>
    </Panel>
  );
  return (
    <section aria-label="Your tasks">
      <h2 className="mb-4 text-lg font-semibold text-ink">Your Tasks, {me.name.split(" ")[0]}</h2>
      <div className="grid gap-5 md:grid-cols-2">
        {card(<GitBranch className="size-5" aria-hidden="true" />, "Review Prerequisites", "For each pair of skills, say whether one should be learned before the other. A link is kept when 2 of 3 experts agree.", voted, edges.data?.length, "About 15 minutes", () => onStart("edges"))}
        {card(<ListOrdered className="size-5" aria-hidden="true" />, "Rank Example Students", "For each student profile, order the skills by what they should learn first. You won't see the system's answer.", ranked, scen.data?.length, "About 2 hours in total", () => onStart("scenarios"))}
      </div>
    </section>
  );
}

function TaskHeader({ title, onBack, done, total }: { title: string; onBack: () => void; done: number; total: number }) {
  return (
    <div className="mb-6">
      <Button variant="ghost" onClick={onBack} className="-ml-2 mb-3">
        <ArrowLeft /> All Tasks
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] font-extrabold text-ink">{title}</h1>
        <span className="tabular text-sm text-ink/70">
          {done} of {total} done
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-2 rounded-full bg-route transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ prerequisite review
function EdgeReview({ me, onBack }: { me: Expert; onBack: () => void }) {
  const edges = useApi<EdgeRow[]>(`/expert/edges?expert_id=${me.id}`);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [suggest, setSuggest] = useState(false);
  const mine = useCallback((e: EdgeRow) => (e.my_vote === null ? undefined : { approve: e.my_vote }), []);
  const queue = useMemo(() => (edges.data ?? []).filter((e) => !mine(e) && !skipped.includes(e.id)), [edges.data, mine, skipped]);
  const current = queue[0];
  const done = (edges.data ?? []).filter((e) => mine(e)).length;

  const vote = useCallback(
    async (approve: boolean) => {
      if (!current) return;
      await api.post(`/expert/edges/${current.id}/vote`, { expert_id: me.id, approve });
      edges.reload();
    },
    [current, edges, me.id],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[role=dialog]") || !current) return;
      const k = e.key.toLowerCase();
      if (k === "y") vote(true);
      else if (k === "n") vote(false);
      else if (k === "s") setSkipped((s) => [...s, current.id]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, vote]);

  if (!edges.data) return <Loading />;
  return (
    <div className="mx-auto max-w-2xl">
      <TaskHeader title="Review Prerequisites" onBack={onBack} done={done} total={edges.data.length} />
      {current ? (
        <Panel className="p-6 sm:p-8">
          <p className="text-sm font-medium text-indigo">Should someone learn</p>
          <p className="mt-1 text-2xl font-bold leading-snug text-ink">{titleCase(current.from_name)}</p>
          <p className="mt-2 text-sm font-medium text-indigo">before</p>
          <p className="mt-1 text-2xl font-bold leading-snug text-ink">{titleCase(current.to_name)}?</p>
          <div className="mt-5 rounded-xl bg-muted/70 p-4 text-sm text-ink/80">
            <span className="font-medium text-ink">Current reasoning: </span>
            {current.rationale}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <Button size="lg" className="h-12" onClick={() => vote(true)}>
              Yes
            </Button>
            <Button size="lg" variant="outline" className="h-12" onClick={() => vote(false)}>
              No
            </Button>
            <Button size="lg" variant="ghost" className="h-12" onClick={() => setSkipped((s) => [...s, current.id])}>
              Not Sure
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">Shortcuts: Y for yes, N for no, S to skip</p>
        </Panel>
      ) : (
        <Panel className="text-center">
          <Check className="mx-auto size-10 rounded-full bg-mint p-2 text-white" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-ink">{skipped.length ? "You've Seen Every Link" : "All Links Reviewed"}</h2>
          <p className="mt-1 text-sm text-ink/70">
            {skipped.length ? `${skipped.length} skipped. You can come back to them anytime.` : "Thank you. Your votes are saved."}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {skipped.length ? (
              <Button variant="outline" onClick={() => setSkipped([])}>
                <RotateCcw /> Review Skipped
              </Button>
            ) : null}
            <Button onClick={onBack}>Back to Tasks</Button>
          </div>
        </Panel>
      )}
      <div className="mt-6 text-center">
        <Button variant="ghost" onClick={() => setSuggest(true)}>
          <Plus /> Suggest a Missing Link
        </Button>
      </div>
      <SuggestDialog open={suggest} onOpenChange={setSuggest} onAdded={edges.reload} />
    </div>
  );
}

function SuggestDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void }) {
  const meta = useApi<Meta>(open ? "/meta" : null);
  const [src, setSrc] = useState("");
  const [dst, setDst] = useState("");
  const [why, setWhy] = useState("");
  const [err, setErr] = useState<unknown>(null);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post("/expert/edges", { src, dst, rationale: why });
      toast.success("Link suggested", { description: "Other experts will review it." });
      setSrc("");
      setDst("");
      setWhy("");
      onAdded();
      onOpenChange(false);
    } catch (x) {
      setErr(x);
    }
  }
  const options = (meta.data?.skills ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suggest a Missing Link</DialogTitle>
          <DialogDescription>Links that would create a loop are rejected automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={add} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="src">Learn This First</Label>
            <NativeSelect id="src" value={src} onChange={(e) => setSrc(e.target.value)} required>
              <option value="">Choose a skill…</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {titleCase(s.name)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dst">Before This</Label>
            <NativeSelect id="dst" value={dst} onChange={(e) => setDst(e.target.value)} required>
              <option value="">Choose a skill…</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {titleCase(s.name)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="why">Why?</Label>
            <Textarea id="why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="One sentence is enough…" />
          </div>
          <ErrorNote error={err} />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={!src || !dst}>
            Suggest Link
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ scenario ranking
function ScenarioRanking({ me, onBack }: { me: Expert; onBack: () => void }) {
  const list = useApi<ScenarioRow[]>(`/expert/scenarios?expert_id=${me.id}`);
  const [sel, setSel] = useState<string | null>(null);
  const detail = useApi<ScenarioDetail>(sel ? `/expert/scenarios/${sel}` : null);
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    if (!list.data || sel) return;
    setSel((list.data.find((s) => !s.done) ?? list.data[0])?.id ?? null);
  }, [list.data, sel]);
  useEffect(() => setOrder([]), [sel]);

  if (!list.data) return <Loading />;
  const done = list.data.filter((s) => s.done).length;
  const cands = detail.data?.candidates ?? [];
  const complete = cands.length > 0 && order.length === cands.length;

  async function save() {
    if (!sel) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/expert/scenarios/${sel}/rank`, { expert_id: me.id, order });
      toast.success("Ranking saved");
      list.reload();
      const next = list.data?.find((s) => !s.done && s.id !== sel);
      setSel(next?.id ?? null);
    } catch (x) {
      setErr(x);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <TaskHeader title="Rank Example Students" onBack={onBack} done={done} total={list.data.length} />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Scenarios" className="max-h-[70vh] overflow-y-auto rounded-2xl border bg-card p-2">
          <ul className="space-y-0.5">
            {list.data.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSel(s.id)}
                  aria-current={s.id === sel ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    s.id === sel ? "bg-secondary font-semibold text-secondary-foreground" : "text-ink/80 hover:bg-muted",
                  )}
                >
                  <span>Student {i + 1}</span>
                  {s.done ? <Check className="size-4 text-mint" aria-label="Ranked" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {!detail.data ? (
          <Loading />
        ) : (
          <Panel>
            <p className="text-sm font-medium text-indigo">Student Profile</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{detail.data.title}</h2>
            <p className="mt-2 text-sm text-ink/70">Click the skills in the order this student should learn them. Click a numbered skill to undo back to it.</p>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {cands.map((c) => {
                const pos = order.indexOf(c.skill_id);
                return (
                  <li key={c.skill_id}>
                    <button
                      type="button"
                      onClick={() => setOrder(pos >= 0 ? order.slice(0, pos) : [...order, c.skill_id])}
                      aria-pressed={pos >= 0}
                      className={cn(
                        "flex h-full w-full gap-3 rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        pos >= 0 ? "border-indigo bg-secondary/50" : "border-border bg-card hover:border-indigo/30",
                      )}
                    >
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", pos >= 0 ? "bg-indigo text-white" : "bg-muted text-ink/60")}>
                        {pos >= 0 ? pos + 1 : "–"}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">{titleCase(c.name)}</span>
                        <span className="mt-1 block text-xs text-ink/70">
                          Level {num(c.p)}, role needs {num(c.r)}, in {pct(c.D)} of postings
                        </span>
                        {c.prereqs.length ? (
                          <span className="mt-1 block text-xs text-ink/60">
                            Builds on {c.prereqs.map((q) => `${titleCase(q.name)} (${q.p != null ? num(q.p) : "–"})`).join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button size="lg" className="h-11 px-6" onClick={save} disabled={!complete || busy}>
                {busy ? "Saving…" : complete ? "Save and Next" : `Rank ${cands.length - order.length} More`}
              </Button>
              <Button variant="ghost" size="lg" className="h-11" onClick={() => setOrder(order.slice(0, -1))} disabled={!order.length}>
                <Undo2 /> Undo
              </Button>
              <Tag tone="neutral">{VARIANT[list.data.find((s) => s.id === sel)?.variant ?? "base"] ?? "Base Profile"}</Tag>
            </div>
            <div className="mt-4">
              <ErrorNote error={err} />
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
