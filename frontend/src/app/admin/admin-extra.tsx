"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { fmtDateTime, num, RUBRIC } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorNote, Loading, NativeSelect, Panel, SectionTitle, Tag } from "@/components/kit";

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success("Copied"));
}

/** Shown once after the server issues a key; the server keeps only its hash. */
function OneTimeSecret({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-indigo/40 bg-secondary p-3">
      <p className="text-xs font-medium text-indigo">{label}: shown only once, share it privately</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm" translate="no">
          {value}
        </code>
        <Button size="sm" variant="outline" onClick={() => copy(value)} aria-label={`Copy ${label}`}>
          <Copy />
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ project reviews
interface ProjectRow {
  id: number;
  title: string;
  created_at: string;
  reason: string;
  method: string;
  ratings: { skill_id: string; level: number; quote: string; rationale: string }[];
  checks: { flags?: string[]; posting_similarity?: number; skill_term_density?: number };
}

export function ProjectReviews({ names, onChange }: { names: Record<string, string>; onChange: () => void }) {
  const q = useApi<ProjectRow[]>("/admin/project-reviews");
  const [levels, setLevels] = useState<Record<number, Record<string, number>>>({});
  async function decide(row: ProjectRow, decision: "approve" | "reject") {
    await api.post(`/admin/project-reviews/${row.id}`, { decision, levels: levels[row.id] ?? null });
    toast.success(decision === "approve" ? "Approved: counts at full weight" : "Rejected: no longer counts");
    q.reload();
    onChange();
  }
  if (q.error) return <ErrorNote error={q.error} />;
  if (!q.data) return <Loading />;
  if (!q.data.length)
    return <EmptyState title="Nothing to Review">Flagged uploads and the random 20% quality sample appear here.</EmptyState>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/70">
        Pending projects count at half weight until a person checks the rubric (paper: human re-check of a 20% sample; suspicious uploads always come here).
      </p>
      {q.data.map((row) => (
        <Panel key={row.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-ink">{row.title}</h3>
              <p className="text-xs text-muted-foreground">
                {fmtDateTime(row.created_at)} · rated by {row.method === "llm" ? "LLM" : "heuristic rubric"} · {row.reason || "sample"}
              </p>
            </div>
            <div className="flex gap-1">
              {(row.checks.flags ?? []).map((f) => (
                <Tag key={f} tone="ember">
                  {f.replaceAll("_", " ")}
                </Tag>
              ))}
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {row.ratings.map((r) => (
              <li key={r.skill_id} className="grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{names[r.skill_id] ?? r.skill_id}</p>
                  <p className="truncate text-xs text-ink/70">&ldquo;{r.quote}&rdquo;</p>
                </div>
                <NativeSelect
                  aria-label={`Level for ${names[r.skill_id] ?? r.skill_id}`}
                  value={levels[row.id]?.[r.skill_id] ?? r.level}
                  onChange={(e) => setLevels((l) => ({ ...l, [row.id]: { ...Object.fromEntries(row.ratings.map((x) => [x.skill_id, x.level])), ...l[row.id], [r.skill_id]: Number(e.target.value) } }))}
                >
                  {[0, 1, 2, 3].map((v) => (
                    <option key={v} value={v}>
                      {RUBRIC[v]}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => decide(row, "approve")}>Approve</Button>
            <Button variant="outline" onClick={() => decide(row, "reject")}>
              Reject
            </Button>
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ team and classes
interface TokenRow {
  id: number;
  role: string;
  label: string;
  created_at: string;
  revoked: boolean;
}
interface CohortRow {
  id: string;
  name: string;
  institution: string;
  join_code: string;
  n_students: number;
}

export function TeamAndClasses() {
  const tokens = useApi<TokenRow[]>("/admin/tokens");
  const cohorts = useApi<CohortRow[]>("/admin/cohorts");
  const [expert, setExpert] = useState({ name: "", affiliation: "", kind: "dosen" });
  const [cohort, setCohort] = useState({ name: "", institution: "" });
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);

  async function addExpert(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.post<{ token: string }>("/admin/experts", { ...expert, validates_graph: true });
      setSecret({ label: `Sign-in key for ${expert.name}`, value: r.token });
      setExpert({ name: "", affiliation: "", kind: "dosen" });
      tokens.reload();
    } catch (x) {
      setErr(x);
    }
  }
  async function addCohort(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.post<{ join_code: string; advisor_token: string }>("/admin/cohorts", cohort);
      setSecret({ label: `Lecturer key for ${cohort.name} (students join with code ${r.join_code})`, value: r.advisor_token });
      setCohort({ name: "", institution: "" });
      cohorts.reload();
      tokens.reload();
    } catch (x) {
      setErr(x);
    }
  }
  async function revoke(id: number) {
    await api.del(`/admin/tokens/${id}`);
    tokens.reload();
  }

  return (
    <div className="space-y-8">
      <ErrorNote error={err} />
      {secret ? <OneTimeSecret label={secret.label} value={secret.value} /> : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <SectionTitle>Invite an Expert</SectionTitle>
          <form onSubmit={addExpert} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-name">Full name</Label>
              <Input id="ex-name" value={expert.name} onChange={(e) => setExpert({ ...expert, name: e.target.value })} required className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-aff">Institution or company</Label>
              <Input id="ex-aff" value={expert.affiliation} onChange={(e) => setExpert({ ...expert, affiliation: e.target.value })} className="h-10" />
            </div>
            <NativeSelect aria-label="Expert role" value={expert.kind} onChange={(e) => setExpert({ ...expert, kind: e.target.value })}>
              <option value="dosen">Lecturer</option>
              <option value="praktisi">Practitioner</option>
              <option value="rekruter">Recruiter</option>
            </NativeSelect>
            <Button type="submit" disabled={expert.name.trim().length < 2}>
              Create Expert Key
            </Button>
          </form>
        </Panel>
        <Panel>
          <SectionTitle>Create a Class</SectionTitle>
          <form onSubmit={addCohort} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-name">Class or advising group</Label>
              <Input id="co-name" value={cohort.name} onChange={(e) => setCohort({ ...cohort, name: e.target.value })} required className="h-10" placeholder="e.g. Sistem Informasi 2023 - Kelas A…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-inst">Institution</Label>
              <Input id="co-inst" value={cohort.institution} onChange={(e) => setCohort({ ...cohort, institution: e.target.value })} className="h-10" />
            </div>
            <Button type="submit" disabled={cohort.name.trim().length < 2}>
              Create Class and Lecturer Key
            </Button>
          </form>
          {cohorts.data?.length ? (
            <ul className="mt-4 divide-y text-sm">
              {cohorts.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span>
                    {c.name} <span className="text-muted-foreground">· {c.n_students} students</span>
                  </span>
                  <code className="font-mono text-indigo" translate="no">
                    {c.join_code}
                  </code>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </div>
      <Panel>
        <SectionTitle>Staff Keys</SectionTitle>
        {tokens.data ? (
          <ul className="divide-y text-sm">
            {tokens.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  <Tag tone={t.role === "admin" ? "indigo" : "neutral"}>{t.role}</Tag> {t.label}
                </span>
                {t.revoked ? (
                  <span className="text-xs text-muted-foreground">revoked</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => revoke(t.id)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Loading />
        )}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------ studies
interface StudyRow {
  id: string;
  name: string;
  join_code: string;
  arms: { id: string; label: string }[];
  participants: Record<string, number>;
}
interface Analysis {
  n: Record<string, number>;
  median: Record<string, number | null>;
  kruskal_wallis?: { H: number; p: number };
  pairwise_p_holm?: Record<string, number>;
  rank_biserial?: Record<string, number>;
  note?: string;
}
interface StudyResults {
  study: string;
  participants: Record<string, number>;
  H1_clarity: Analysis;
  H2_plan_quality: Analysis;
  H3_minutes_to_plan: Analysis;
}

export function Studies() {
  const list = useApi<StudyRow[]>("/admin/studies");
  const [name, setName] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const res = useApi<StudyResults>(sel ? `/admin/studies/${sel}/results` : null);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/admin/studies", { name });
    setName("");
    list.reload();
  }
  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle>Controlled User Study (Four Arms)</SectionTitle>
        <p className="mb-3 text-sm text-ink/70">
          A: skill list from postings · B: generic AI-style plan · C: PathSync without adaptivity · D: full PathSync. Students join with the study code in
          Settings and are assigned by stratified minimisation. Protocol: docs/ops/STUDY_PROTOCOL.md.
        </p>
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <Input aria-label="Study name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pilot BA Oktober 2026…" className="h-10 min-w-0 flex-1" />
          <Button type="submit" disabled={name.trim().length < 2}>
            Create Study
          </Button>
        </form>
      </Panel>
      {list.data?.map((st) => (
        <Panel key={st.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-ink">{st.name}</h3>
            <span className="text-sm">
              Join code{" "}
              <code className="font-mono text-indigo" translate="no">
                {st.join_code}
              </code>
            </span>
          </div>
          <p className="mt-1 text-sm text-ink/70">
            {st.arms.map((a) => `${a.id} ${st.participants[a.id] ?? 0}`).join(" · ")} participants
          </p>
          <Button variant="outline" className="mt-3" onClick={() => setSel(sel === st.id ? null : st.id)}>
            {sel === st.id ? "Hide Results" : "Show Results"}
          </Button>
          {sel === st.id && res.data ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(
                [
                  ["H1 Direction clarity (1-5)", res.data.H1_clarity],
                  ["H2 Plan quality, blind (1-5)", res.data.H2_plan_quality],
                  ["H3 Minutes to plan", res.data.H3_minutes_to_plan],
                ] as const
              ).map(([label, a]) => (
                <div key={label} className="rounded-xl bg-muted p-3 text-sm">
                  <p className="font-medium text-ink">{label}</p>
                  <p className="mt-1 text-ink/70">
                    Medians: {Object.entries(a.median).map(([k, v]) => `${k} ${v == null ? "–" : num(v, 1)}`).join(", ")}
                  </p>
                  {a.kruskal_wallis ? (
                    <p className="text-ink/70">
                      Kruskal-Wallis H={num(a.kruskal_wallis.H)}, p={num(a.kruskal_wallis.p, 3)}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">{a.note}</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ launch operations
interface Metrics {
  window_days: number;
  new_students: number;
  funnel: { step: string; students: number; share: number }[];
  north_star: { definition: string; value: number };
  d7_retention: number;
  review_queue: { pending: number; over_72h: number; sla_hours: number };
}

/** Launch funnel, North Star and review-queue SLA (PM audit §6.5, §6.6, AI-9). */
export function LaunchMetrics() {
  const [days, setDays] = useState(14);
  const m = useApi<Metrics>(`/admin/metrics?days=${days}`);
  const wl = useApi<{ total: number; by_role: Record<string, number> }>("/admin/waitlist");
  if (m.error) return <ErrorNote error={m.error} />;
  if (!m.data) return <Loading />;
  const d = m.data;
  return (
    <div className="space-y-8">
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle>North Star</SectionTitle>
          <NativeSelect value={String(days)} onChange={(e) => setDays(Number(e.target.value))} aria-label="Window">
            {[7, 14, 30, 90].map((n) => (
              <option key={n} value={n}>
                Last {n} days
              </option>
            ))}
          </NativeSelect>
        </div>
        <p className="text-[40px] font-extrabold leading-none text-ink tabular">{Math.round(d.north_star.value * 100)}%</p>
        <p className="mt-1 text-sm text-ink/70">{d.north_star.definition}. {d.new_students} new students in this window · D7 return {Math.round(d.d7_retention * 100)}%.</p>
      </Panel>
      <Panel>
        <SectionTitle>Funnel</SectionTitle>
        <ol className="space-y-2">
          {d.funnel.map((f) => (
            <li key={f.step} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-ink">{f.step}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-indigo" style={{ width: `${Math.round(f.share * 100)}%` }} />
              </span>
              <span className="tabular text-ink/75">{f.students} · {Math.round(f.share * 100)}%</span>
            </li>
          ))}
        </ol>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <SectionTitle>Project Review SLA</SectionTitle>
          <p className="text-sm text-ink/80">
            {d.review_queue.pending} waiting, <span className={d.review_queue.over_72h ? "font-semibold text-ember-ink" : ""}>{d.review_queue.over_72h} over {d.review_queue.sla_hours} h</span>.
          </p>
        </Panel>
        <Panel>
          <SectionTitle>Role Waitlist</SectionTitle>
          <p className="text-sm text-ink/80">{wl.data ? `${wl.data.total} sign-ups` : "…"}</p>
          <ul className="mt-2 space-y-0.5 text-sm text-ink/75">
            {Object.entries(wl.data?.by_role ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r, n]) => (
              <li key={r}>{r}: {n}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

interface AuditRow { id: number; at: string; actor: string; action: string; target: string }
interface FeedbackRow { id: number; at: string; kind: string; message: string; page: string; request_id: string; contact: string; resolved: boolean }

/** Staff activity log and problem reports. */
export function Activity() {
  const log = useApi<AuditRow[]>("/admin/audit-log?limit=100");
  const fb = useApi<FeedbackRow[]>("/admin/feedback");
  return (
    <div className="space-y-8">
      <Panel>
        <SectionTitle>Problem Reports</SectionTitle>
        {!fb.data ? <Loading /> : fb.data.length === 0 ? <EmptyState title="No Reports Yet">Reports from the in-app button show up here.</EmptyState> : (
          <ul className="divide-y">
            {fb.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-ink">{r.message}</p>
                  <p className="mt-0.5 text-xs text-ink/60">{fmtDateTime(r.at)} · {r.page}{r.request_id ? ` · ref ${r.request_id}` : ""}{r.contact ? ` · ${r.contact}` : ""}</p>
                </div>
                {r.resolved ? <Tag tone="mint">Resolved</Tag> : (
                  <Button size="sm" variant="outline" onClick={() => api.post(`/admin/feedback/${r.id}/resolve`).then(fb.reload)}>Mark Resolved</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel>
        <SectionTitle>Staff Activity</SectionTitle>
        {!log.data ? <Loading /> : (
          <ul className="max-h-96 divide-y overflow-y-auto text-sm">
            {log.data.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-ink">{r.action}{r.target ? ` · ${r.target}` : ""}</span>
                <span className="text-xs text-ink/60">{r.actor} · {fmtDateTime(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
