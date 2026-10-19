"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { SOURCE, fmtDate } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { Tag } from "./kit";

// Sync, the in-app assistant (backend: pathsync/sync_agent.py). The reply is the model's words; the cards below it
// (a job posting word for word, a skill-match table) come straight from PathSync data, never from the model.

type Msg = { role: "user" | "assistant"; content: string; cards?: Card[] };
type PostingCard = { type: "posting"; id: string; title: string; company: string; location: string; source: string; url: string; published_at: string | null; description: string };
type MatchRow = { skill_id: string; skill: string; level_now: string | null; needed: string | null; status: "met" | "close" | "gap" | "unproven" };
type MatchCard = { type: "match"; posting_id: string; title: string; company: string; rows: MatchRow[]; summary: Record<string, number> };
type Card = PostingCard | MatchCard;

const KEY = (sid: string) => `pathsync.sync.${sid}`;

/** The Sync button (bottom right, above the phone's bottom bar) and its chat panel. Shown only when the server has
 * Sync switched on. The conversation is kept for this browser tab only. */
export function SyncAgent({ sid }: { sid: string }) {
  const t = useT();
  const status = useApi<{ enabled: boolean }>("/sync/status");
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY(sid));
      if (raw) setMsgs(JSON.parse(raw));
    } catch {}
  }, [sid]);
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY(sid), JSON.stringify(msgs.slice(-20)));
    } catch {}
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, sid, busy]);

  if (!status.data?.enabled) return null;

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const next = [...msgs, { role: "user" as const, content: question }];
    setMsgs(next);
    setText("");
    setErr(null);
    setBusy(true);
    try {
      const r = await api.post<{ reply: string; cards: Card[] }>(`/students/${sid}/sync`, {
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      setMsgs([...next, { role: "assistant", content: r.reply, cards: r.cards }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Sync could not answer just now.", "Sync belum bisa menjawab sekarang."));
    } finally {
      setBusy(false);
    }
  };
  const starters = [
    t("How well do I fit the newest Business Analyst posting?", "Seberapa cocok aku dengan lowongan Business Analyst terbaru?"),
    t("Which skill should I learn first, and why?", "Skill apa yang harus kupelajari dulu, dan kenapa?"),
    t("Which careers am I closest to?", "Karier apa yang paling dekat denganku?"),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 rounded-full border bg-card py-1.5 pl-1.5 pr-4 text-sm font-semibold text-ink shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:right-6 lg:bottom-6"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot/logo.webp" alt="" width={32} height={32} className="size-8" />
        <span>
          {t("Ask", "Tanya")} <span className="sync-word">Sync</span>
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot/logo.webp" alt="" width={40} height={40} className="size-10" />
            <div className="min-w-0">
              <SheetTitle className="text-base font-bold"><span className="sync-word">Sync</span></SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {t("Answers from your PathSync data and real job postings.", "Menjawab dari data PathSync-mu dan lowongan nyata.")}
              </SheetDescription>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
            {msgs.length === 0 ? (
              <div className="space-y-3">
                <SyncSays>
                  <p className="rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2.5 text-sm text-ink/90">
                    {t("Hi! Ask me about your skills, your route, careers, or how well you fit a job posting.",
                       "Hai! Tanya aku soal skill-mu, rute belajarmu, karier, atau seberapa cocok kamu dengan sebuah lowongan.")}
                  </p>
                </SyncSays>
                <ul className="space-y-2 pl-10">
                  {starters.map((q) => (
                    <li key={q}>
                      <button type="button" onClick={() => ask(q)} className="w-full rounded-lg border px-3 py-2 text-left text-sm text-ink hover:bg-muted">
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-indigo px-3.5 py-2 text-sm leading-relaxed text-white">{m.content}</p>
                </div>
              ) : (
                <SyncSays key={i}>
                  <div className="rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2.5">
                    <Reply text={m.content} />
                  </div>
                  {m.cards?.map((c, j) => (c.type === "posting" ? <Posting key={j} c={c} /> : <Match key={j} c={c} />))}
                </SyncSays>
              ),
            )}
            {busy ? (
              <SyncSays>
                <p className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <span className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((d) => (
                      <span key={d} className="size-1.5 animate-bounce rounded-full bg-indigo/60" style={{ animationDelay: `${d * 150}ms` }} />
                    ))}
                  </span>
                  {t("Sync is looking it up…", "Sync sedang mencari…")}
                </p>
              </SyncSays>
            ) : null}
            {err ? <p role="alert" className="text-sm text-destructive">{err}</p> : null}
            <div ref={end} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(text);
            }}
            className="border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(text);
                  }
                }}
                rows={1}
                maxLength={1000}
                aria-label={t("Your question", "Pertanyaanmu")}
                placeholder={t("Ask Sync…", "Tanya Sync…")}
                className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border bg-card px-3 py-2 text-base sm:text-sm"
              />
              <button type="submit" disabled={busy || !text.trim()} aria-label={t("Send", "Kirim")}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo text-white disabled:opacity-40">
                <ArrowUp className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              {t("Sync uses an open model hosted by Groq. Only skills and postings are sent, never your name or ID. It can be wrong; the cards show the real data.",
                 "Sync memakai model terbuka yang dijalankan Groq. Yang dikirim hanya data skill dan lowongan, tanpa nama atau ID. Sync bisa keliru; kartu menampilkan data aslinya.")}
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** One turn from Sync: the mascot on the left, like a chat, with the reply and its cards beside it. */
function SyncSays({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mascot/logo.webp" alt="" width={32} height={32} className="size-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  );
}

/** **bold** inside a line; *single* emphasis and stray markers are shown as plain words. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
        ) : (
          p.replace(/\*/g, "")
        ),
      )}
    </>
  );
}

/** "1. … 2. … 3. …" written on one line, split into its steps (a single step stays as it is). */
function steps(text: string): string[] {
  const parts = text.split(/(?:^|\s)\d+[.)]\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

const BULLET = /^\s*(?:[-•*·]|\d+[.)])\s+/;

/** Sync's reply: short paragraphs, '- ' bullets as a real list, and the "next step" line set apart. */
function Reply({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-ink/90">
      {blocks.map((lines, i) => {
        if (lines.every((l) => BULLET.test(l)))
          return (
            <ul key={i} className="space-y-1.5">
              {lines.map((l, j) => {
                // "Skill – detail": the name reads first, the detail sits quieter beneath it
                const [head, ...rest] = l.replace(BULLET, "").replace(/\*/g, "").split(/\s+[–—-]\s+|:\s+/);
                return (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo/60" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className={rest.length ? "block font-medium text-ink" : ""}>{head}</span>
                      {rest.length > 0 && <span className="block text-xs text-muted-foreground">{rest.join(" – ")}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        const joined = lines.join(" ");
        const next = joined.match(/^(langkah (?:berikutnya|selanjutnya)|next step)[^:]*:\s*(.*)$/i);
        if (next) {
          const list = steps(next[2]);
          return (
            <div key={i} className="rounded-lg bg-card px-3 py-2 shadow-xs">
              <p className="text-xs font-medium text-indigo">{/^next/i.test(next[1]) ? "Next step" : "Langkah berikutnya"}</p>
              {list.length === 1 ? (
                <p className="text-ink"><Inline text={list[0]} /></p>
              ) : (
                <ol className="mt-1 space-y-1.5 text-ink">
                  {list.map((s, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="w-4 shrink-0 tabular-nums text-xs leading-[inherit] text-indigo">{j + 1}.</span>
                      <span className="min-w-0"><Inline text={s} /></span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        }
        return (
          <p key={i}>
            <Inline text={joined} />
          </p>
        );
      })}
    </div>
  );
}

/** A posting's original words, laid out for reading: empty lines collapsed, bullet lines as a list, short lines ending
 * in ":" as section labels. Nothing is reworded. */
function PostingText({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      out.push(
        <ul key={`l${out.length}`} className="list-disc space-y-1 pl-4 marker:text-ink/40">
          {list.map((l, i) => <li key={i}>{l}</li>)}
        </ul>,
      );
    list = [];
  };
  for (const l of lines) {
    if (BULLET.test(l)) {
      list.push(l.replace(BULLET, ""));
      continue;
    }
    flush();
    if (l.endsWith(":") && l.length <= 60) out.push(<p key={`h${out.length}`} className="pt-1 font-semibold text-ink">{l}</p>);
    else out.push(<p key={`p${out.length}`}>{l}</p>);
  }
  flush();
  return <div className="space-y-2 text-[13px] leading-relaxed text-ink/85">{out}</div>;
}

/** A job posting as it was published: the full original text, folded after a few lines. */
function Posting({ c }: { c: PostingCard }) {
  const t = useT();
  const [full, setFull] = useState(false);
  return (
    <article className="rounded-xl border bg-card">
      <div className="border-b px-3.5 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">{t("Job posting, original text", "Lowongan, teks asli")}</p>
        <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
        <p className="text-xs text-muted-foreground">
          {[c.company, c.location, SOURCE[c.source] ?? c.source, c.published_at ? fmtDate(c.published_at) : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className={cn("relative px-3.5 py-2.5", !full && "max-h-48 overflow-hidden")}>
        <PostingText text={c.description} />
        {!full ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card" aria-hidden="true" /> : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-3.5 py-2">
        <button type="button" onClick={() => setFull(!full)} className="inline-flex items-center gap-1 text-sm font-medium text-indigo">
          {full ? t("Show less", "Ringkas") : t("Show the full posting", "Tampilkan lowongan lengkap")}
          <ChevronDown className={cn("size-4 transition-transform", full && "rotate-180")} aria-hidden="true" />
        </button>
        {c.url ? (
          <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
            {t("Source", "Sumber")} <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

const STATUS: Record<MatchRow["status"], { label: [string, string]; tone: "mint" | "indigo" | "ember" | "neutral" }> = {
  met: { label: ["Met", "Terpenuhi"], tone: "mint" },
  close: { label: ["Close", "Hampir"], tone: "indigo" },
  gap: { label: ["To learn", "Perlu dipelajari"], tone: "ember" },
  unproven: { label: ["No evidence", "Belum ada bukti"], tone: "neutral" },
};

/** The posting's skills against the student's levels, computed by PathSync (not by the model). */
function Match({ c }: { c: MatchCard }) {
  const t = useT();
  return (
    <article className="rounded-xl border bg-card">
      <div className="border-b px-3.5 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">{t("Your fit, computed by PathSync", "Kecocokanmu, dihitung PathSync")}</p>
        <p className="text-sm text-ink">
          <span className="font-semibold">{c.summary.met ?? 0}</span> {t("met", "terpenuhi")} ·{" "}
          <span className="font-semibold">{(c.summary.close ?? 0) + (c.summary.gap ?? 0)}</span> {t("to work on", "perlu ditingkatkan")} ·{" "}
          <span className="font-semibold">{c.summary.unproven ?? 0}</span> {t("no evidence yet", "belum ada bukti")}
        </p>
      </div>
      <ul className="divide-y">
        {c.rows.map((r) => (
          <li key={r.skill_id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
            <span className="min-w-0">
              <span className="block text-ink">{r.skill}</span>
              <span className="block text-xs text-muted-foreground">
                {r.level_now ?? "–"}
                {r.needed ? ` → ${r.needed}` : ""}
              </span>
            </span>
            <Tag tone={STATUS[r.status].tone}>{t(...STATUS[r.status].label)}</Tag>
          </li>
        ))}
      </ul>
    </article>
  );
}
