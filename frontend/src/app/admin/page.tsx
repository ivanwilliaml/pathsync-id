"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleDashed, Loader2, Play, Square, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, FEATURE_LABELS, type Features, type Meta } from "@/lib/api";
import { fmtDateTime, int, num, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useStaffToken } from "@/lib/staff";
import { StaffLogin } from "@/components/staff-login";
import { Activity, LaunchMetrics, ProjectReviews, Studies, TeamAndClasses } from "./admin-extra";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { EmptyState, ErrorNote, Loading, NativeSelect, PageHeader, Panel, Tag } from "@/components/kit";

interface Stats {
  postings_total: number;
  duplicates: number;
  in_window_by_role: Record<string, number>;
  mentions_by_status: Record<string, number>;
  students: number;
  experts: number;
  annotations: number;
  cohorts?: number;
  pending_project_reviews?: number;
  extractor: string;
  last_build: string | null;
}
interface Job {
  running: boolean;
  log: string[];
  started: string | null;
  finished: string | null;
  ok: boolean | null;
  cancelled: boolean;
  step: string | null;
  step_index: number | null;
  n_steps: number;
}

const STEPS = ["Collecting Karirhub postings", "Collecting company career-site postings", "Rebuilding the market map"];

export default function AdminPage() {
  const { token, ready } = useStaffToken("admin");
  const who = useApi<{ role: string }>(token ? "/admin/whoami" : null);
  if (!ready) return <Loading />;
  if (!token || who.error)
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title="Admin" description="Team-only console for market data, reviews, models, experts, classes and studies." />
        <Panel>
          <StaffLogin role="admin" error={who.error} hint="Staff only. Enter your admin key." />
        </Panel>
      </div>
    );
  if (!who.data) return <Loading />;
  return <AdminConsole />;
}

function AdminConsole() {
  const stats = useApi<Stats>("/admin/stats");
  const meta = useApi<Meta>("/meta");
  const names = useMemo(() => Object.fromEntries((meta.data?.skills ?? []).map((s) => [s.id, titleCase(s.name)])), [meta.data]);
  const s = stats.data;
  return (
    <div>
      <PageHeader title="Admin" description="Keep the job market data fresh, review uncertain skill matches, and check how well the models perform." />
      {s ? (
        <dl className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Unique Postings" value={int(s.postings_total - s.duplicates)} note={`${Object.keys(s.in_window_by_role).length} careers; largest ${Math.max(0, ...Object.values(s.in_window_by_role) as number[])} postings`} />
          <Fact label="Skill Matches" value={int(s.mentions_by_status.auto ?? 0)} note={`${s.mentions_by_status.review ?? 0} waiting for review`} />
          <Fact label="Students" value={int(s.students)} note={`${s.experts} experts, ${s.cohorts ?? 0} classes, ${s.pending_project_reviews ?? 0} projects to review`} />
          <Fact label="Last Market Build" value={s.last_build ?? "–"} note={`Extractor: ${s.extractor === "llm" ? "LLM" : "lexicon"}`} small />
        </dl>
      ) : null}
      <Tabs defaultValue="launch">
        <TabsList className="mb-5 flex-wrap">
          <TabsTrigger value="launch">Launch Metrics</TabsTrigger>
          <TabsTrigger value="market">Market Data</TabsTrigger>
          <TabsTrigger value="review">Review Queue</TabsTrigger>
          <TabsTrigger value="annotate">Annotation</TabsTrigger>
          <TabsTrigger value="models">Models &amp; Evaluation</TabsTrigger>
          <TabsTrigger value="projects">Project Reviews</TabsTrigger>
          <TabsTrigger value="team">Team &amp; Classes</TabsTrigger>
          <TabsTrigger value="studies">User Studies</TabsTrigger>
          <TabsTrigger value="activity">Activity &amp; Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="launch">
          <LaunchMetrics />
        </TabsContent>
        <TabsContent value="market">
          <MarketData meta={meta.data} onChange={stats.reload} />
        </TabsContent>
        <TabsContent value="review">
          <ReviewQueue names={names} meta={meta.data} />
        </TabsContent>
        <TabsContent value="annotate">
          <Annotation meta={meta.data} onChange={stats.reload} />
        </TabsContent>
        <TabsContent value="models">
          <Models />
        </TabsContent>
        <TabsContent value="projects">
          <ProjectReviews names={names} onChange={stats.reload} />
        </TabsContent>
        <TabsContent value="team">
          <TeamAndClasses />
        </TabsContent>
        <TabsContent value="studies">
          <Studies />
        </TabsContent>
        <TabsContent value="activity">
          <Activity />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Fact({ label, value, note, small }: { label: string; value: string; note: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <dt className="text-sm text-ink/70">{label}</dt>
      <dd className={cn("mt-1 font-bold text-ink", small ? "text-base" : "tabular text-2xl")}>{value}</dd>
      <dd className="mt-0.5 text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ market data
function MarketData({ meta, onChange }: { meta: Meta | null; onChange: () => void }) {
  const job = useApi<Job>("/admin/market/refresh");
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [role, setRole] = useState("business_analyst");
  const [skill, setSkill] = useState("sql");
  const [delta, setDelta] = useState("0.2");

  useEffect(() => {
    if (!job.data?.running) return;
    const t = setInterval(job.reload, 2000);
    return () => clearInterval(t);
  }, [job.data?.running, job.reload]);
  const finished = job.data?.finished;
  useEffect(() => {
    if (finished) onChange();
  }, [finished, onChange]);

  async function start() {
    setConfirm(false);
    setErr(null);
    try {
      await api.post("/admin/market/refresh");
      job.reload();
    } catch (e) {
      setErr(e);
    }
  }
  async function stop() {
    try {
      await api.post("/admin/market/refresh/cancel");
      toast("Stopping the update…");
      job.reload();
    } catch (e) {
      setErr(e);
    }
  }
  async function simulate() {
    setErr(null);
    try {
      const r = await api.post<{ version: string }>("/admin/market/simulate", { role, skill_id: skill, demand_delta: Number(delta), trend: 0.5 });
      toast.success("Simulated market is now active", { description: r.version });
      onChange();
    } catch (e) {
      setErr(e);
    }
  }
  async function reset() {
    try {
      const r = await api.post<{ version: string }>(`/admin/market/reset?role=${role}`);
      toast.success("Back to real market data", { description: r.version });
      onChange();
    } catch (e) {
      setErr(e);
    }
  }

  const j = job.data;
  const stepState = (i: number) => {
    if (!j) return "todo";
    const at = j.step_index ?? 0;
    if (j.running) return i < at ? "done" : i === at ? "active" : "todo";
    if (j.ok) return "done";
    return i < at ? "done" : i === at ? "failed" : "todo";
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <h2 className="text-lg font-semibold text-ink">Monthly Market Update</h2>
        <p className="mt-1 text-sm text-ink/70">Collects new postings, finds the skills they ask for, and rebuilds the market map. Students whose route changes get a history entry.</p>
        {j && (j.running || j.finished) ? (
          <ol className="mt-5 space-y-2.5" aria-live="polite">
            {STEPS.map((label, i) => {
              const state = stepState(i);
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  {state === "done" ? (
                    <CircleCheck className="size-5 text-mint" aria-hidden="true" />
                  ) : state === "active" ? (
                    <Loader2 className="size-5 animate-spin text-indigo" aria-hidden="true" />
                  ) : state === "failed" ? (
                    <XCircle className="size-5 text-destructive" aria-hidden="true" />
                  ) : (
                    <CircleDashed className="size-5 text-ink/30" aria-hidden="true" />
                  )}
                  <span className={state === "todo" ? "text-ink/60" : "text-ink"}>{label}</span>
                </li>
              );
            })}
          </ol>
        ) : null}
        {j && !j.running && j.finished ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {j.ok ? <Tag tone="mint">Finished</Tag> : j.cancelled ? <Tag tone="ember">Stopped</Tag> : <Tag tone="red">Failed</Tag>}
            <span className="text-ink/70">{fmtDateTime(j.finished)}</span>
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {j?.running ? (
            <Button variant="destructive" size="lg" className="h-10" onClick={stop} disabled={j.cancelled}>
              <Square /> {j.cancelled ? "Stopping…" : "Stop Update"}
            </Button>
          ) : (
            <Button size="lg" className="h-10" onClick={() => setConfirm(true)}>
              <Play /> Run Update Now
            </Button>
          )}
        </div>
        {j?.log.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-ink/80">Technical Log</summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-ink p-3 text-[11px] leading-relaxed text-white/90">{j.log.join("\n")}</pre>
          </details>
        ) : null}
        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Run the Market Update?</AlertDialogTitle>
              <AlertDialogDescription>
                This collects new postings from the web and replaces the active market map. It usually takes 5 to 15 minutes, and you can stop it at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={start}>Run Update</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Panel>

      <Panel>
        <h2 className="text-lg font-semibold text-ink">Simulate a Market Change</h2>
        <p className="mt-1 text-sm text-ink/70">Test how student routes react when demand for a skill shifts. The simulated map stays labelled until you switch back.</p>
        <div className="mt-5 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="srole">Role</Label>
            <NativeSelect id="srole" value={role} onChange={(e) => setRole(e.target.value)}>
              {meta?.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sskill">Skill</Label>
            <NativeSelect id="sskill" value={skill} onChange={(e) => setSkill(e.target.value)}>
              {meta?.skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {titleCase(s.name)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sdelta">Demand Change</Label>
            <NativeSelect id="sdelta" value={delta} onChange={(e) => setDelta(e.target.value)}>
              {["0.4", "0.2", "0.1", "-0.1", "-0.2", "-0.4"].map((v) => (
                <option key={v} value={v}>
                  {Number(v) > 0 ? "+" : ""}
                  {Math.round(Number(v) * 100)} points
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" className="h-10" onClick={simulate}>
            Apply Simulation
          </Button>
          <Button variant="outline" size="lg" className="h-10" onClick={reset}>
            Switch Back to Real Data
          </Button>
        </div>
      </Panel>
      <div className="lg:col-span-2">
        <ErrorNote error={err} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ review queue
interface ReviewRow {
  id: number;
  title: string;
  surface: string;
  quote: string;
  skill_id: string | null;
  similarity: number;
}

function ReviewQueue({ names, meta }: { names: Record<string, string>; meta: Meta | null }) {
  const [status, setStatus] = useState("review");
  const q = useApi<ReviewRow[]>(`/admin/review-queue?status=${status}&limit=100`);
  async function decide(id: number, decision: string) {
    await api.post(`/admin/review-queue/${id}`, { decision });
    q.setData((q.data ?? []).filter((r) => r.id !== id));
  }
  return (
    <Panel className="p-0 sm:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Uncertain Skill Matches</h2>
          <p className="text-sm text-ink/70">Phrases from postings that look like a known skill, but not clearly enough to count automatically.</p>
        </div>
        <NativeSelect aria-label="Queue" value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="review">Close Matches</option>
          <option value="new">Possible New Skills</option>
        </NativeSelect>
      </div>
      {!q.data ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <div className="p-5">
          <EmptyState title="Queue Is Empty">Nothing needs a decision right now.</EmptyState>
        </div>
      ) : (
        <ul className="divide-y">
          {q.data.map((r) => (
            <li key={r.id} className="p-5">
              <p className="text-sm">
                <span className="font-semibold text-ink">&ldquo;{r.surface}&rdquo;</span>
                {r.skill_id ? (
                  <span className="text-ink/70">
                    {" "}
                    looks like <span className="font-medium text-ink">{names[r.skill_id] ?? r.skill_id}</span> ({num(r.similarity)})
                  </span>
                ) : null}
              </p>
              <p className="mt-1.5 border-l-2 border-iris pl-3 text-sm text-ink/70">{r.quote}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.title}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.skill_id ? (
                  <Button variant="outline" onClick={() => decide(r.id, "accept")}>
                    Accept Match
                  </Button>
                ) : null}
                <NativeSelect aria-label="Map to another skill" defaultValue="" onChange={(e) => e.target.value && decide(r.id, e.target.value)} className="h-8 w-auto text-xs">
                  <option value="">Map to another skill…</option>
                  {meta?.skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {titleCase(s.name)}
                    </option>
                  ))}
                </NativeSelect>
                <Button variant="ghost" onClick={() => decide(r.id, "reject")}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------------ annotation
interface NextPosting {
  posting_id: string | null;
  title?: string;
  company?: string;
  description?: string;
  remaining?: number;
}
interface F1 {
  n_postings: number;
  precision: number;
  recall: number;
  f1: number;
  target_f1: number;
}
interface Comparison {
  n_postings: number;
  mean_jaccard: number;
  spearman_skill_frequency: number;
  mentions_per_posting: { lexicon: number; llm: number };
  top_only_lexicon: [string, number][];
  top_only_llm: [string, number][];
}

function Annotation({ meta, onChange }: { meta: Meta | null; onChange: () => void }) {
  const [annotator, setAnnotator] = useState("");
  const [active, setActive] = useState("");
  const next = useApi<NextPosting>(active ? `/admin/annotation/next?annotator=${encodeURIComponent(active)}` : null);
  const f1 = useApi<F1>("/admin/annotation/eval");
  const cmp = useApi<Comparison>("/evaluation/extractors");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    try {
      setAnnotator(localStorage.getItem("pathsync.annotator") ?? "");
    } catch {}
  }, []);
  useEffect(() => setPicked(new Set()), [next.data?.posting_id]);

  async function submit() {
    if (!next.data?.posting_id) return;
    setErr(null);
    try {
      await api.post("/admin/annotation", { posting_id: next.data.posting_id, annotator: active, skill_ids: [...picked] });
      next.reload();
      f1.reload();
      onChange();
    } catch (e) {
      setErr(e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-semibold text-ink">Extraction Quality</h2>
          <p className="mt-1 text-sm text-ink/70">Compared with human annotations. The target is an F1 of {num(f1.data?.target_f1 ?? 0.75)} on 150 postings.</p>
          {f1.data ? (
            <dl className="mt-4 grid grid-cols-4 gap-3 text-center">
              {[
                ["F1", num(f1.data.f1)],
                ["Precision", num(f1.data.precision)],
                ["Recall", num(f1.data.recall)],
                ["Postings", int(f1.data.n_postings)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-muted/70 p-3">
                  <dt className="text-xs text-ink/60">{l}</dt>
                  <dd className="tabular mt-0.5 text-lg font-bold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Loading />
          )}
        </Panel>
        {cmp.data ? (
          <Panel>
            <h2 className="text-lg font-semibold text-ink">Lexicon vs LLM Extractor</h2>
            <p className="mt-1 text-sm text-ink/70">
              Agreement on {cmp.data.n_postings} postings: overlap {num(cmp.data.mean_jaccard)}, rank agreement {num(cmp.data.spearman_skill_frequency)}. The lexicon finds{" "}
              {num(cmp.data.mentions_per_posting.lexicon, 1)} skills per posting and the LLM {num(cmp.data.mentions_per_posting.llm, 1)}.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              {(
                [
                  ["Only the Lexicon Found", cmp.data.top_only_lexicon],
                  ["Only the LLM Found", cmp.data.top_only_llm],
                ] as const
              ).map(([title, rows]) => (
                <div key={title}>
                  <p className="font-medium text-ink">{title}</p>
                  <ul className="mt-1 space-y-0.5 text-ink/70">
                    {rows.slice(0, 4).map(([n, k]) => (
                      <li key={n}>
                        {titleCase(n)} <span className="tabular text-ink/60">{k}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>

      <Panel>
        <h2 className="text-lg font-semibold text-ink">Annotate Postings</h2>
        {!active ? (
          <form
            className="mt-4 flex max-w-md flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setActive(annotator.trim());
              try {
                localStorage.setItem("pathsync.annotator", annotator.trim());
              } catch {}
            }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="ann">Your Name</Label>
              <Input id="ann" autoComplete="name" value={annotator} onChange={(e) => setAnnotator(e.target.value)} className="h-10" />
            </div>
            <Button type="submit" size="lg" className="h-10" disabled={!annotator.trim()}>
              Start Annotating
            </Button>
          </form>
        ) : !next.data ? (
          <Loading />
        ) : !next.data.posting_id ? (
          <EmptyState title="All Done">You&rsquo;ve annotated every posting.</EmptyState>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{next.data.remaining} postings left</p>
              <h3 className="mt-1 font-semibold text-ink">{next.data.title}</h3>
              <p className="text-sm text-ink/70">{next.data.company}</p>
              <div className="mt-3 max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/70 p-4 text-sm leading-relaxed text-ink/85">{next.data.description}</div>
            </div>
            <div>
              <p className="text-sm text-ink/70">Tick every skill this posting asks for, without looking at the extractor&rsquo;s answer.</p>
              <div className="mt-3 max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {meta
                  ? Object.entries(meta.clusters).map(([cid, label]) => (
                      <fieldset key={cid}>
                        <legend className="mb-1.5 text-sm font-semibold text-ink">{label}</legend>
                        <div className="grid gap-1 sm:grid-cols-2">
                          {meta.skills
                            .filter((s) => s.cluster === cid)
                            .map((s) => (
                              <label key={s.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
                                <input
                                  type="checkbox"
                                  className="size-4 accent-[#4338ca]"
                                  checked={picked.has(s.id)}
                                  onChange={(e) => {
                                    const n = new Set(picked);
                                    if (e.target.checked) n.add(s.id);
                                    else n.delete(s.id);
                                    setPicked(n);
                                  }}
                                />
                                {titleCase(s.name)}
                              </label>
                            ))}
                        </div>
                      </fieldset>
                    ))
                  : null}
              </div>
              <Button size="lg" className="mt-4 h-10" onClick={submit}>
                Save and Next ({picked.size} skills)
              </Button>
              <div className="mt-3">
                <ErrorNote error={err} />
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ models & evaluation
type Stat95 = { mean: number; ci95: [number, number] };
interface ModelRow {
  id: number;
  name: string;
  weights: Features;
  active: boolean;
}
interface EvalCondition {
  cv: { methods: Record<string, { ndcg5: Stat95 }> };
  ablation: Record<string, Stat95>;
}
interface EvalReport {
  n_scenarios: number;
  conditions: Record<string, EvalCondition>;
}

const METHOD: Record<string, string> = {
  model: "PathSync Model",
  formula5: "Formula (5)",
  kesenjangan_terbesar: "Biggest Gap First",
  kesenjangan_x_permintaan: "Gap × Demand",
  llm_umum: "Generic LLM",
};
const CONDITION: Record<string, string> = {
  titik_hambat: "Experts Favour Bottlenecks",
  kesenjangan_permintaan: "Experts Favour Gap × Demand",
  campuran: "Mixed Expert Styles",
};

function Models() {
  const [simulated, setSimulated] = useState(false);
  const agree = useApi<{ mean_w: number | null; n_scenarios_ranked: number; n_with_2plus: number }>(`/admin/expert-agreement?simulated=${simulated}`);
  const models = useApi<ModelRow[]>("/admin/models");
  const report = useApi<EvalReport>("/evaluation");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  async function train() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ active: boolean; passes_rule: boolean }>("/admin/train", { use_simulated: simulated, activate_if_passes: true });
      toast.success(r.active ? "New model trained and activated" : "Model trained, not activated", {
        description: r.passes_rule ? "It matches or beats Formula (5)." : "It didn't beat Formula (5), so the current model stays.",
      });
      models.reload();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }
  async function finalize() {
    try {
      const r = await api.post<Record<string, number>>("/admin/edges/finalize");
      toast.success("Prerequisite map updated", { description: `${r.approved} approved, ${r.rejected} rejected, ${r.draft} still open` });
    } catch (e) {
      setErr(e);
    }
  }
  async function activate(id: number) {
    await api.post(`/admin/models/${id}/activate`);
    models.reload();
  }

  const conds = report.data ? Object.entries(report.data.conditions) : [];
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-semibold text-ink">Expert Agreement</h2>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink/80">
            <input type="checkbox" className="size-4 accent-[#4338ca]" checked={simulated} onChange={(e) => setSimulated(e.target.checked)} />
            Use simulated experts
          </label>
          {agree.data ? (
            <p className="mt-3 text-sm text-ink/75">
              Kendall&rsquo;s W is <span className="font-semibold text-ink">{agree.data.mean_w != null ? num(agree.data.mean_w) : "not available yet"}</span> across{" "}
              {agree.data.n_with_2plus} scenarios ranked by 2 or more experts. A value of 0.7 or higher means strong agreement.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="lg" className="h-10" onClick={train} disabled={busy}>
              {busy ? "Training…" : `Train From ${simulated ? "Simulated" : "Expert"} Rankings`}
            </Button>
            <Button variant="outline" size="lg" className="h-10" onClick={finalize}>
              Apply the 2-of-3 Rule to Links
            </Button>
          </div>
          <div className="mt-3">
            <ErrorNote error={err} />
          </div>
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold text-ink">Ranking Models</h2>
          {!models.data ? (
            <Loading />
          ) : (
            <ul className="mt-3 max-h-72 divide-y overflow-y-auto">
              {models.data.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                    <p className="text-xs text-ink/60">{(["G", "D", "U", "R"] as const).map((k) => `${FEATURE_LABELS[k]} ${num(m.weights[k])}`).join(", ")}</p>
                  </div>
                  {m.active ? (
                    <Tag tone="mint">Active</Tag>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => activate(m.id)}>
                      Activate
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {report.data ? (
        <Panel>
          <h2 className="text-lg font-semibold text-ink">Ranking Quality (Simulation)</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink/70">
            NDCG@5 against simulated expert rankings over {report.data.n_scenarios} scenarios, where 1.00 is a perfect match. These are feasibility results, not real expert performance.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-ink/60">
                <tr>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  {conds.map(([c]) => (
                    <th key={c} className="py-2 pr-3 text-right font-medium">
                      {CONDITION[c] ?? c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {Object.keys(METHOD)
                  .filter((m) => conds.some(([, c]) => c.cv.methods[m]))
                  .map((m) => (
                    <tr key={m} className={cn("border-t", m === "model" && "font-semibold")}>
                      <td className="py-2 pr-3 text-ink">{METHOD[m]}</td>
                      {conds.map(([k, c]) => (
                        <td key={k} className="py-2 pr-3 text-right text-ink/80">
                          {c.cv.methods[m] ? num(c.cv.methods[m].ndcg5.mean, 3) : "–"}
                        </td>
                      ))}
                    </tr>
                  ))}
                <tr className="border-t text-ink/60">
                  <td className="py-2 pr-3">Model Without Prerequisite Signals</td>
                  {conds.map(([k, c]) => (
                    <td key={k} className="py-2 pr-3 text-right">
                      {num(c.ablation.tanpa_fitur_graf?.mean, 3)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
