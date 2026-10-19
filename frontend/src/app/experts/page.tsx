"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, GitBranch, ListOrdered, Plus, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { api, type Meta } from "@/lib/api";
import { num, pct, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { setStaffToken, useStaffToken } from "@/lib/staff";
import { DemoBanner, useIsDemo } from "@/components/staff-demo";
import { StaffLogin } from "@/components/staff-login";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote, Loading, MasteryBar, NativeSelect, Panel, Tag } from "@/components/kit";
import { useT } from "@/lib/i18n";

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

const VARIANT: Record<string, [string, string]> = {
  base: ["Base Profile", "Profil Dasar"],
  competency: ["After Learning a Skill", "Setelah Mempelajari Skill"],
  market: ["After a Market Change", "Setelah Perubahan Pasar"],
};

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
  const t = useT();
  const go = (k: string | null) => router.replace(k ? `${pathname}?task=${k}` : pathname, { scroll: false });
  const me: Expert | undefined =
    who.data?.role === "expert" ? who.data.expert : who.data?.experts?.find((e) => e.id === actingFor);

  if (!ready) return <Loading />;
  if (me && task === "edges") return <EdgeReview me={me} onBack={() => go(null)} />;
  if (me && task === "scenarios") return <ScenarioRanking me={me} onBack={() => go(null)} />;

  return (
    <div className="space-y-8">
      <DemoBanner />
      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight text-ink sm:text-[30px]">{t("Expert Panel", "Panel Pakar")}</h1>
          <p className="mt-3 max-w-lg text-lg text-ink/75">
            {t(
              "Lecturers, practitioners, and recruiters check the prerequisite map and rank example students. Your judgement trains how PathSync orders skills.",
              "Dosen, praktisi, dan rekruter memeriksa peta prasyarat dan meranking contoh mahasiswa. Penilaianmu melatih cara PathSync mengurutkan skill.",
            )}
          </p>
          <Panel className="mt-6">
            {!token || who.error ? (
              <StaffLogin role="expert" error={who.error} hint={t("Sign in with the account the PathSync team invited you to.", "Masuk dengan akun yang diundang tim PathSync.")} />
            ) : who.data?.role === "admin" ? (
              <div className="space-y-1.5">
                <Label htmlFor="who">{t("Facilitating for", "Memfasilitasi untuk")}</Label>
                <NativeSelect id="who" value={actingFor} onChange={(e) => setActingFor(e.target.value)}>
                  <option value="">{t("Select an expert…", "Pilih pakar…")}</option>
                  {who.data.experts?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{t("Invite experts from Admin, Team & Classes.", "Undang pakar dari Admin, Tim & Kelas.")}</p>
              </div>
            ) : me ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-ink/80">
                  {t("Signed in as", "Masuk sebagai")} <span className="font-semibold text-ink">{me.name}</span>
                  {me.affiliation ? `, ${me.affiliation}` : ""}
                </p>
                <Button variant="outline" onClick={() => setStaffToken("expert", null)}>
                  {t("Sign Out", "Keluar")}
                </Button>
              </div>
            ) : (
              <Loading />
            )}
          </Panel>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/experts.webp" alt={t("Two people mapping ideas on a whiteboard", "Dua orang memetakan ide di papan tulis")} width={1600} height={1067} className="aspect-[16/10] w-full rounded-3xl object-cover" />
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
  const t = useT();
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
            {t(`${done} of ${total ?? "…"}`, `${done} dari ${total ?? "…"}`)}
          </span>
        </div>
        <MasteryBar value={total ? done / total : 0} />
      </div>
      <Button size="lg" className="mt-5 h-11 self-start px-6" onClick={onClick}>
        {done === 0 ? t("Start", "Mulai") : total && done >= total ? t("Review Again", "Tinjau Lagi") : t("Continue", "Lanjut")}
      </Button>
    </Panel>
  );
  return (
    <section aria-label={t("Your tasks", "Tugasmu")}>
      <h2 className="mb-4 text-lg font-semibold text-ink">{t("Your Tasks", "Tugasmu")}, {me.name.split(" ")[0]}</h2>
      <div className="grid gap-5 md:grid-cols-2">
        {card(<GitBranch className="size-5" aria-hidden="true" />, t("Review Prerequisites", "Tinjau Prasyarat"), t("For each pair of skills, say whether one should be learned before the other. A link is kept when 2 of 3 experts agree.", "Untuk tiap pasangan skill, tentukan apakah satu perlu dipelajari sebelum yang lain. Sebuah tautan dipertahankan bila 2 dari 3 pakar setuju."), voted, edges.data?.length, t("About 15 minutes", "Sekitar 15 menit"), () => onStart("edges"))}
        {card(<ListOrdered className="size-5" aria-hidden="true" />, t("Rank Example Students", "Ranking Contoh Mahasiswa"), t("For each student profile, order the skills by what they should learn first. You won't see the system's answer.", "Untuk tiap profil mahasiswa, urutkan skill dari yang harus dipelajari lebih dulu. Kamu tidak akan melihat jawaban sistem."), ranked, scen.data?.length, t("About 2 hours in total", "Sekitar 2 jam total"), () => onStart("scenarios"))}
      </div>
    </section>
  );
}

function TaskHeader({ title, onBack, done, total }: { title: string; onBack: () => void; done: number; total: number }) {
  const t = useT();
  return (
    <div className="mb-6">
      <DemoBanner />
      <Button variant="ghost" onClick={onBack} className="-ml-2 mb-3">
        <ArrowLeft /> {t("All Tasks", "Semua Tugas")}
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[24px] font-extrabold text-ink">{title}</h1>
        <span className="tabular text-sm text-ink/70">
          {t(`${done} of ${total} done`, `${done} dari ${total} selesai`)}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-2 rounded-full bg-indigo transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ prerequisite review
function EdgeReview({ me, onBack }: { me: Expert; onBack: () => void }) {
  const demo = useIsDemo();
  const edges = useApi<EdgeRow[]>(`/expert/edges?expert_id=${me.id}`);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [suggest, setSuggest] = useState(false);
  const t = useT();
  const mine = useCallback((e: EdgeRow) => (e.my_vote === null ? undefined : { approve: e.my_vote }), []);
  const queue = useMemo(() => (edges.data ?? []).filter((e) => !mine(e) && !skipped.includes(e.id)), [edges.data, mine, skipped]);
  const current = queue[0];
  const done = (edges.data ?? []).filter((e) => mine(e)).length;

  const vote = useCallback(
    async (approve: boolean) => {
      if (!current || demo) return;
      await api.post(`/expert/edges/${current.id}/vote`, { expert_id: me.id, approve });
      edges.reload();
    },
    [current, edges, me.id, demo],
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
      <TaskHeader title={t("Review Prerequisites", "Tinjau Prasyarat")} onBack={onBack} done={done} total={edges.data.length} />
      {current ? (
        <Panel className="p-6 sm:p-8">
          <p className="text-sm font-medium text-indigo">{t("Should someone learn", "Apakah seseorang perlu mempelajari")}</p>
          <p className="mt-1 text-2xl font-bold leading-snug text-ink">{titleCase(current.from_name)}</p>
          <p className="mt-2 text-sm font-medium text-indigo">{t("before", "sebelum")}</p>
          <p className="mt-1 text-2xl font-bold leading-snug text-ink">{titleCase(current.to_name)}?</p>
          <div className="mt-5 rounded-xl bg-muted/70 p-4 text-sm text-ink/80">
            <span className="font-medium text-ink">{t("Current reasoning: ", "Alasan saat ini: ")}</span>
            {current.rationale}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <Button size="lg" className="h-12" onClick={() => vote(true)} disabled={demo}>
              {t("Yes", "Ya")}
            </Button>
            <Button size="lg" variant="outline" className="h-12" onClick={() => vote(false)} disabled={demo}>
              {t("No", "Tidak")}
            </Button>
            <Button size="lg" variant="ghost" className="h-12" onClick={() => setSkipped((s) => [...s, current.id])}>
              {t("Not Sure", "Tidak Yakin")}
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">{t("Shortcuts: Y for yes, N for no, S to skip", "Pintasan: Y untuk ya, N untuk tidak, S untuk lewati")}</p>
        </Panel>
      ) : (
        <Panel className="text-center">
          <Check className="mx-auto size-10 rounded-full bg-mint p-2 text-white" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold text-ink">{skipped.length ? t("You've Seen Every Link", "Semua Tautan Sudah Kamu Lihat") : t("All Links Reviewed", "Semua Tautan Sudah Ditinjau")}</h2>
          <p className="mt-1 text-sm text-ink/70">
            {skipped.length ? t(`${skipped.length} skipped. You can come back to them anytime.`, `${skipped.length} dilewati. Kamu bisa kembali kapan saja.`) : t("Thank you. Your votes are saved.", "Terima kasih. Suaramu tersimpan.")}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {skipped.length ? (
              <Button variant="outline" onClick={() => setSkipped([])}>
                <RotateCcw /> {t("Review Skipped", "Tinjau yang Dilewati")}
              </Button>
            ) : null}
            <Button onClick={onBack}>{t("Back to Tasks", "Kembali ke Tugas")}</Button>
          </div>
        </Panel>
      )}
      <div className="mt-6 text-center">
        <Button variant="ghost" onClick={() => setSuggest(true)} disabled={demo}>
          <Plus /> {t("Suggest a Missing Link", "Usulkan Tautan yang Hilang")}
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
  const t = useT();
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post("/expert/edges", { src, dst, rationale: why });
      toast.success(t("Link suggested", "Tautan diusulkan"), { description: t("Other experts will review it.", "Pakar lain akan meninjaunya.") });
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
          <DialogTitle>{t("Suggest a Missing Link", "Usulkan Tautan yang Hilang")}</DialogTitle>
          <DialogDescription>{t("Links that would create a loop are rejected automatically.", "Tautan yang membentuk loop otomatis ditolak.")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={add} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="src">{t("Learn This First", "Pelajari Ini Dulu")}</Label>
            <NativeSelect id="src" value={src} onChange={(e) => setSrc(e.target.value)} required>
              <option value="">{t("Choose a skill…", "Pilih skill…")}</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {titleCase(s.name)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dst">{t("Before This", "Sebelum Ini")}</Label>
            <NativeSelect id="dst" value={dst} onChange={(e) => setDst(e.target.value)} required>
              <option value="">{t("Choose a skill…", "Pilih skill…")}</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {titleCase(s.name)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="why">{t("Why?", "Kenapa?")}</Label>
            <Textarea id="why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder={t("One sentence is enough…", "Satu kalimat sudah cukup…")} />
          </div>
          <ErrorNote error={err} />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={!src || !dst}>
            {t("Suggest Link", "Usulkan Tautan")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------ scenario ranking
function ScenarioRanking({ me, onBack }: { me: Expert; onBack: () => void }) {
  const demo = useIsDemo();
  const list = useApi<ScenarioRow[]>(`/expert/scenarios?expert_id=${me.id}`);
  const [sel, setSel] = useState<string | null>(null);
  const detail = useApi<ScenarioDetail>(sel ? `/expert/scenarios/${sel}` : null);
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const t = useT();

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
      toast.success(t("Ranking saved", "Ranking tersimpan"));
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
      <TaskHeader title={t("Rank Example Students", "Ranking Contoh Mahasiswa")} onBack={onBack} done={done} total={list.data.length} />
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={t("Scenarios", "Skenario")} className="max-h-[70vh] overflow-y-auto rounded-2xl border bg-card p-2">
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
                  <span>{t("Student", "Mahasiswa")} {i + 1}</span>
                  {s.done ? <Check className="size-4 text-mint" aria-label={t("Ranked", "Sudah diranking")} /> : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {!detail.data ? (
          <Loading />
        ) : (
          <Panel>
            <p className="text-sm font-medium text-indigo">{t("Student Profile", "Profil Mahasiswa")}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{detail.data.title}</h2>
            <p className="mt-2 text-sm text-ink/70">{t("Click the skills in the order this student should learn them. Click a numbered skill to undo back to it.", "Klik skill sesuai urutan yang harus dipelajari mahasiswa ini. Klik skill bernomor untuk mundur ke sana.")}</p>
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
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
                          {t(`Level ${num(c.p)}, role needs ${num(c.r)}, in ${pct(c.D)} of postings`, `Level ${num(c.p)}, role butuh ${num(c.r)}, di ${pct(c.D)} posting`)}
                        </span>
                        {c.prereqs.length ? (
                          <span className="mt-1 block text-xs text-ink/60">
                            {t("Builds on", "Dibangun di atas")} {c.prereqs.map((q) => `${titleCase(q.name)} (${q.p != null ? num(q.p) : "–"})`).join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button size="lg" className="h-11 px-6" onClick={save} disabled={!complete || busy || demo}>
                {busy ? t("Saving…", "Menyimpan…") : complete ? t("Save and Next", "Simpan dan Lanjut") : t(`Rank ${cands.length - order.length} More`, `Ranking ${cands.length - order.length} Lagi`)}
              </Button>
              <Button variant="ghost" size="lg" className="h-11" onClick={() => setOrder(order.slice(0, -1))} disabled={!order.length}>
                <Undo2 /> {t("Undo", "Urungkan")}
              </Button>
              <Tag tone="neutral">{t(...(VARIANT[list.data.find((s) => s.id === sel)?.variant ?? "base"] ?? VARIANT.base))}</Tag>
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
