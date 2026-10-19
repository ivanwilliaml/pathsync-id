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
import { useT } from "@/lib/i18n";

function copy(text: string, done: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success(done));
}

/** Shown once after the server issues a key; the server keeps only its hash. */
function OneTimeSecret({ label, value }: { label: string; value: string }) {
  const t = useT();
  return (
    <div className="mt-3 rounded-xl border border-dashed border-indigo/40 bg-secondary p-3">
      <p className="text-xs font-medium text-indigo">{label}: {t("shown only once, share it privately", "hanya ditampilkan sekali, bagikan secara pribadi")}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm" translate="no">
          {value}
        </code>
        <Button size="sm" variant="outline" onClick={() => copy(value, t("Copied", "Disalin"))} aria-label={t(`Copy ${label}`, `Salin ${label}`)}>
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
  const t = useT();
  async function decide(row: ProjectRow, decision: "approve" | "reject") {
    await api.post(`/admin/project-reviews/${row.id}`, { decision, levels: levels[row.id] ?? null });
    toast.success(decision === "approve" ? t("Approved: counts at full weight", "Disetujui: dihitung bobot penuh") : t("Rejected: no longer counts", "Ditolak: tidak lagi dihitung"));
    q.reload();
    onChange();
  }
  if (q.error) return <ErrorNote error={q.error} />;
  if (!q.data) return <Loading />;
  if (!q.data.length)
    return <EmptyState title={t("Nothing to Review", "Tidak Ada yang Perlu Direview")}>{t("Flagged uploads and the random 20% quality sample appear here.", "Unggahan yang ditandai dan sampel kualitas acak 20% muncul di sini.")}</EmptyState>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/70">
        {t(
          "Pending projects count at half weight until a person checks the rubric (paper: human re-check of a 20% sample; suspicious uploads always come here).",
          "Project yang tertunda dihitung setengah bobot sampai seseorang memeriksa rubriknya (paper: pemeriksaan ulang manusia atas sampel 20%; unggahan mencurigakan selalu masuk ke sini).",
        )}
      </p>
      {q.data.map((row) => (
        <Panel key={row.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-ink">{row.title}</h3>
              <p className="text-xs text-muted-foreground">
                {fmtDateTime(row.created_at)} · {t("rated by", "dinilai oleh")} {row.method === "llm" ? "LLM" : t("heuristic rubric", "rubrik heuristik")} · {row.reason || t("sample", "sampel")}
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
                  aria-label={t(`Level for ${names[r.skill_id] ?? r.skill_id}`, `Level untuk ${names[r.skill_id] ?? r.skill_id}`)}
                  value={levels[row.id]?.[r.skill_id] ?? r.level}
                  onChange={(e) => setLevels((l) => ({ ...l, [row.id]: { ...Object.fromEntries(row.ratings.map((x) => [x.skill_id, x.level])), ...l[row.id], [r.skill_id]: Number(e.target.value) } }))}
                >
                  {[0, 1, 2, 3].map((v) => (
                    <option key={v} value={v}>
                      {t(...RUBRIC[v])}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => decide(row, "approve")}>{t("Approve", "Setujui")}</Button>
            <Button variant="outline" onClick={() => decide(row, "reject")}>
              {t("Reject", "Tolak")}
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

// ------------------------------------------------------------ staff accounts (email + password)
interface AccountRow {
  id: number;
  email: string;
  name: string;
  role: "admin" | "expert" | "advisor";
  subject_id: string;
  status: "invited" | "active" | "disabled";
  last_login_at: string | null;
}
const ROLE_LABEL: Record<AccountRow["role"], [string, string]> = { admin: ["Admin", "Admin"], expert: ["Expert", "Pakar"], advisor: ["Lecturer", "Dosen"] };
const STATUS: Record<AccountRow["status"], [string, string, "mint" | "ember" | "neutral"]> = {
  active: ["Active", "Aktif", "mint"],
  invited: ["Invited", "Diundang", "ember"],
  disabled: ["Disabled", "Nonaktif", "neutral"],
};

/** Invite people by email; each gets a link to set their own password. The link is shown once (only its hash is
 * stored), so the admin copies it into an email or chat. */
function StaffAccounts({ cohorts }: { cohorts: CohortRow[] | null | undefined }) {
  const t = useT();
  const list = useApi<AccountRow[]>("/admin/staff-accounts");
  const blank = { email: "", name: "", role: "expert" as AccountRow["role"], cohort_id: "", affiliation: "" };
  const [form, setForm] = useState(blank);
  const [link, setLink] = useState<{ who: string; url: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const showLink = (r: AccountRow & { invite_path: string }) =>
    setLink({ who: `${r.name} (${r.email})`, url: `${window.location.origin}${r.invite_path}` });

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api.post<AccountRow & { invite_path: string }>("/admin/staff-accounts", {
        email: form.email.trim(),
        name: form.name.trim(),
        role: form.role,
        cohort_id: form.role === "advisor" ? form.cohort_id : null,
        affiliation: form.role === "expert" ? form.affiliation : "",
      });
      showLink(r);
      setForm(blank);
      list.reload();
    } catch (x) {
      setErr(x);
    } finally {
      setBusy(false);
    }
  }
  async function newLink(a: AccountRow) {
    setErr(null);
    try {
      showLink(await api.post<AccountRow & { invite_path: string }>(`/admin/staff-accounts/${a.id}/invite`));
    } catch (x) {
      setErr(x);
    }
  }
  async function disable(a: AccountRow) {
    if (!window.confirm(t(`Disable ${a.name}? They can no longer sign in and their open sessions end now.`, `Nonaktifkan ${a.name}? Mereka tidak bisa masuk lagi dan sesi yang terbuka langsung berakhir.`))) return;
    setErr(null);
    try {
      await api.del(`/admin/staff-accounts/${a.id}`);
      list.reload();
    } catch (x) {
      setErr(x);
    }
  }
  const ready = form.email.includes("@") && form.name.trim().length >= 2 && (form.role !== "advisor" || form.cohort_id);

  return (
    <Panel>
      <SectionTitle>{t("Staff Accounts", "Akun Staf")}</SectionTitle>
      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <form onSubmit={invite} className="space-y-3">
          <p className="text-sm font-medium text-ink">{t("Invite someone", "Undang seseorang")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="acc-email">Email</Label>
            <Input id="acc-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">{t("Full name", "Nama lengkap")}</Label>
            <Input id="acc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-role">{t("Role", "Peran")}</Label>
            <NativeSelect id="acc-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AccountRow["role"] })}>
              <option value="expert">{t("Expert (validates the map, ranks students)", "Pakar (memvalidasi peta, meranking mahasiswa)")}</option>
              <option value="advisor">{t("Lecturer (sees one class)", "Dosen (melihat satu kelas)")}</option>
              <option value="admin">{t("Admin (everything)", "Admin (semuanya)")}</option>
            </NativeSelect>
          </div>
          {form.role === "advisor" ? (
            <div className="space-y-1.5">
              <Label htmlFor="acc-class">{t("Class", "Kelas")}</Label>
              <NativeSelect id="acc-class" value={form.cohort_id} onChange={(e) => setForm({ ...form, cohort_id: e.target.value })}>
                <option value="">{t("Pick a class…", "Pilih kelas…")}</option>
                {(cohorts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
              {cohorts && !cohorts.length ? <p className="text-xs text-muted-foreground">{t("Create a class below first.", "Buat kelas dulu di bawah.")}</p> : null}
            </div>
          ) : form.role === "expert" ? (
            <div className="space-y-1.5">
              <Label htmlFor="acc-aff">{t("Institution or company", "Institusi atau perusahaan")}</Label>
              <Input id="acc-aff" value={form.affiliation} onChange={(e) => setForm({ ...form, affiliation: e.target.value })} className="h-9" />
            </div>
          ) : null}
          <Button type="submit" disabled={!ready || busy}>{busy ? t("Inviting…", "Mengundang…") : t("Create Invite Link", "Buat Link Undangan")}</Button>
        </form>

        <div className="min-w-0 space-y-3">
          <ErrorNote error={err} />
          {link ? (
            <OneTimeSecret label={t(`Invite link for ${link.who}, valid 7 days`, `Link undangan untuk ${link.who}, berlaku 7 hari`)} value={link.url} />
          ) : null}
          {list.error ? (
            <ErrorNote error={list.error} />
          ) : !list.data ? (
            <Loading />
          ) : !list.data.length ? (
            <p className="text-sm text-muted-foreground">{t("No accounts yet. Invite your first lecturer or expert.", "Belum ada akun. Undang dosen atau pakar pertamamu.")}</p>
          ) : (
            <ul className="divide-y border-y text-sm">
              {list.data.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {a.name} <span className="font-normal text-muted-foreground">· {t(...ROLE_LABEL[a.role])}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.email}
                      {a.last_login_at ? t(` · last sign-in ${fmtDateTime(a.last_login_at)}`, ` · terakhir masuk ${fmtDateTime(a.last_login_at)}`) : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag tone={STATUS[a.status][2]}>{t(STATUS[a.status][0], STATUS[a.status][1])}</Tag>
                    {a.status !== "disabled" ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => newLink(a)}>
                          {a.status === "invited" ? t("New link", "Link baru") : t("Reset password", "Reset password")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => disable(a)}>{t("Disable", "Nonaktifkan")}</Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function TeamAndClasses() {
  const tokens = useApi<TokenRow[]>("/admin/tokens");
  const cohorts = useApi<CohortRow[]>("/admin/cohorts");
  const [expert, setExpert] = useState({ name: "", affiliation: "", kind: "dosen" });
  const [cohort, setCohort] = useState({ name: "", institution: "" });
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const t = useT();

  async function addExpert(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.post<{ token: string }>("/admin/experts", { ...expert, validates_graph: true });
      setSecret({ label: t(`Sign-in key for ${expert.name}`, `Key masuk untuk ${expert.name}`), value: r.token });
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
      setSecret({ label: t(`Lecturer key for ${cohort.name} (students join with code ${r.join_code})`, `Key dosen untuk ${cohort.name} (mahasiswa bergabung dengan kode ${r.join_code})`), value: r.advisor_token });
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
      <StaffAccounts cohorts={cohorts.data} />
      <ErrorNote error={err} />
      {secret ? <OneTimeSecret label={secret.label} value={secret.value} /> : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <details className="rounded-2xl border bg-card p-5 sm:p-6">
          <summary className="cursor-pointer text-[20px] font-semibold text-ink">{t("Staff keys (for scripts)", "Key staf (untuk skrip)")}</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("People sign in with accounts above. Keys are for scripts and the first admin sign-in.", "Orang masuk dengan akun di atas. Key untuk skrip dan masuk admin pertama kali.")}
          </p>
          <p className="mt-4 text-sm font-medium text-ink">{t("Expert key", "Key pakar")}</p>
          <form onSubmit={addExpert} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-name">{t("Full name", "Nama lengkap")}</Label>
              <Input id="ex-name" value={expert.name} onChange={(e) => setExpert({ ...expert, name: e.target.value })} required className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-aff">{t("Institution or company", "Institusi atau perusahaan")}</Label>
              <Input id="ex-aff" value={expert.affiliation} onChange={(e) => setExpert({ ...expert, affiliation: e.target.value })} className="h-10" />
            </div>
            <NativeSelect aria-label={t("Expert role", "Peran pakar")} value={expert.kind} onChange={(e) => setExpert({ ...expert, kind: e.target.value })}>
              <option value="dosen">{t("Lecturer", "Dosen")}</option>
              <option value="praktisi">{t("Practitioner", "Praktisi")}</option>
              <option value="rekruter">{t("Recruiter", "Rekruter")}</option>
            </NativeSelect>
            <Button type="submit" disabled={expert.name.trim().length < 2}>
              {t("Create Expert Key", "Buat Key Pakar")}
            </Button>
          </form>
          <p className="mt-6 text-sm font-medium text-ink">{t("All keys", "Semua key")}</p>
          {tokens.data ? (
            <ul className="mt-2 divide-y text-sm">
              {tokens.data.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <Tag tone={k.role === "admin" ? "indigo" : "neutral"}>{k.role}</Tag> {k.label}
                  </span>
                  {k.revoked ? (
                    <span className="text-xs text-muted-foreground">{t("revoked", "dicabut")}</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => revoke(k.id)}>
                      {t("Revoke", "Cabut")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Loading />
          )}
        </details>
        <Panel>
          <SectionTitle>{t("Create a Class", "Buat Kelas")}</SectionTitle>
          <form onSubmit={addCohort} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-name">{t("Class or advising group", "Kelas atau kelompok bimbingan")}</Label>
              <Input id="co-name" value={cohort.name} onChange={(e) => setCohort({ ...cohort, name: e.target.value })} required className="h-10" placeholder={t("e.g. Sistem Informasi 2023 - Kelas A…", "mis. Sistem Informasi 2023 - Kelas A…")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-inst">{t("Institution", "Institusi")}</Label>
              <Input id="co-inst" value={cohort.institution} onChange={(e) => setCohort({ ...cohort, institution: e.target.value })} className="h-10" />
            </div>
            <Button type="submit" disabled={cohort.name.trim().length < 2}>
              {t("Create Class and Lecturer Key", "Buat Kelas dan Key Dosen")}
            </Button>
          </form>
          {cohorts.data?.length ? (
            <ul className="mt-4 divide-y text-sm">
              {cohorts.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span>
                    {c.name} <span className="text-muted-foreground">· {c.n_students} {t("students", "mahasiswa")}</span>
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
  const t = useT();
  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/admin/studies", { name });
    setName("");
    list.reload();
  }
  return (
    <div className="space-y-5">
      <Panel>
        <SectionTitle>{t("Controlled User Study (Four Arms)", "User Study Terkontrol (Empat Lengan)")}</SectionTitle>
        <p className="mb-3 text-sm text-ink/70">
          {t(
            "A: skill list from postings · B: generic AI-style plan · C: PathSync without adaptivity · D: full PathSync. Students join with the study code in Settings and are assigned by stratified minimisation. Protocol: docs/ops/STUDY_PROTOCOL.md.",
            "A: daftar skill dari posting · B: rencana gaya AI umum · C: PathSync tanpa adaptivitas · D: PathSync penuh. Mahasiswa bergabung dengan kode studi di Pengaturan dan ditempatkan dengan stratified minimisation. Protokol: docs/ops/STUDY_PROTOCOL.md.",
          )}
        </p>
        <form onSubmit={create} className="flex flex-wrap gap-2">
          <Input aria-label={t("Study name", "Nama studi")} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Pilot BA Oktober 2026…", "mis. Pilot BA Oktober 2026…")} className="h-10 min-w-0 flex-1" />
          <Button type="submit" disabled={name.trim().length < 2}>
            {t("Create Study", "Buat Studi")}
          </Button>
        </form>
      </Panel>
      {list.data?.map((st) => (
        <Panel key={st.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-ink">{st.name}</h3>
            <span className="text-sm">
              {t("Join code", "Kode gabung")}{" "}
              <code className="font-mono text-indigo" translate="no">
                {st.join_code}
              </code>
            </span>
          </div>
          <p className="mt-1 text-sm text-ink/70">
            {st.arms.map((a) => `${a.id} ${st.participants[a.id] ?? 0}`).join(" · ")} {t("participants", "peserta")}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => setSel(sel === st.id ? null : st.id)}>
            {sel === st.id ? t("Hide Results", "Sembunyikan Hasil") : t("Show Results", "Tampilkan Hasil")}
          </Button>
          {sel === st.id && res.data ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(
                [
                  [t("H1 Direction clarity (1-5)", "H1 Kejelasan arah (1-5)"), res.data.H1_clarity],
                  [t("H2 Plan quality, blind (1-5)", "H2 Kualitas rencana, blind (1-5)"), res.data.H2_plan_quality],
                  [t("H3 Minutes to plan", "H3 Menit untuk merencanakan"), res.data.H3_minutes_to_plan],
                ] as const
              ).map(([label, a]) => (
                <div key={label} className="rounded-xl bg-muted p-3 text-sm">
                  <p className="font-medium text-ink">{label}</p>
                  <p className="mt-1 text-ink/70">
                    {t("Medians", "Median")}: {Object.entries(a.median).map(([k, v]) => `${k} ${v == null ? "–" : num(v, 1)}`).join(", ")}
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
  const t = useT();
  if (m.error) return <ErrorNote error={m.error} />;
  if (!m.data) return <Loading />;
  const d = m.data;
  return (
    <div className="space-y-8">
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle>North Star</SectionTitle>
          <NativeSelect value={String(days)} onChange={(e) => setDays(Number(e.target.value))} aria-label={t("Window", "Rentang")}>
            {[7, 14, 30, 90].map((n) => (
              <option key={n} value={n}>
                {t(`Last ${n} days`, `${n} hari terakhir`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <p className="text-[32px] font-extrabold leading-none text-ink tabular">{Math.round(d.north_star.value * 100)}%</p>
        <p className="mt-1 text-sm text-ink/70">{d.north_star.definition}. {t(`${d.new_students} new students in this window`, `${d.new_students} mahasiswa baru di rentang ini`)} · {t("D7 return", "Kembali di D7")} {Math.round(d.d7_retention * 100)}%.</p>
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
          <SectionTitle>{t("Project Review SLA", "SLA Review Project")}</SectionTitle>
          <p className="text-sm text-ink/80">
            {t(`${d.review_queue.pending} waiting`, `${d.review_queue.pending} menunggu`)},{" "}
            <span className={d.review_queue.over_72h ? "font-semibold text-ember-ink" : ""}>
              {t(`${d.review_queue.over_72h} over ${d.review_queue.sla_hours} h`, `${d.review_queue.over_72h} lewat ${d.review_queue.sla_hours} jam`)}
            </span>
            .
          </p>
        </Panel>
        <Panel>
          <SectionTitle>{t("Role Waitlist", "Waitlist Role")}</SectionTitle>
          <p className="text-sm text-ink/80">{wl.data ? t(`${wl.data.total} sign-ups`, `${wl.data.total} pendaftar`) : "…"}</p>
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
  const t = useT();
  return (
    <div className="space-y-8">
      <Panel>
        <SectionTitle>{t("Problem Reports", "Laporan Masalah")}</SectionTitle>
        {!fb.data ? <Loading /> : fb.data.length === 0 ? <EmptyState title={t("No Reports Yet", "Belum Ada Laporan")}>{t("Reports from the in-app button show up here.", "Laporan dari tombol di aplikasi muncul di sini.")}</EmptyState> : (
          <ul className="divide-y">
            {fb.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-ink">{r.message}</p>
                  <p className="mt-0.5 text-xs text-ink/60">{fmtDateTime(r.at)} · {r.page}{r.request_id ? ` · ref ${r.request_id}` : ""}{r.contact ? ` · ${r.contact}` : ""}</p>
                </div>
                {r.resolved ? <Tag tone="mint">{t("Resolved", "Selesai")}</Tag> : (
                  <Button size="sm" variant="outline" onClick={() => api.post(`/admin/feedback/${r.id}/resolve`).then(fb.reload)}>{t("Mark Resolved", "Tandai Selesai")}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel>
        <SectionTitle>{t("Staff Activity", "Aktivitas Staf")}</SectionTitle>
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
