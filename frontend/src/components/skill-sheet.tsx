"use client";

import { BookOpen, ExternalLink, Quote } from "lucide-react";
import { track } from "@/lib/track";
import type { Competency, Explanation, PathStep } from "@/lib/api";
import { DIFFICULTY, FORMAT, LEVEL, REC, hours, num, titleCase } from "@/lib/format";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DecisionTrace } from "./decision-trace";
import { LinkButton, MasteryBar, Tag } from "./kit";

export interface SkillDetail {
  skill_id: string;
  name: string;
  rank?: number | null;
  rec_type?: string;
  bottleneck?: boolean;
  explanation?: Explanation | null;
  step?: PathStep;
  competency?: Competency;
}

/** Side panel answering the four questions for one skill: what, why, why now, what next. */
export function SkillSheet({ detail, onOpenChange }: { detail: SkillDetail | null; onOpenChange: (open: boolean) => void }) {
  const d = detail;
  const e = d?.explanation;
  const comp = d?.competency;
  const step = d?.step;
  return (
    <Sheet open={d !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        {d ? (
          <>
            <SheetHeader className="border-b bg-route-soft p-6">
              <div className="flex flex-wrap gap-2">
                {d.rank ? <Tag tone="indigo">Priority #{d.rank}</Tag> : null}
                {step && step.role_in_path !== "prioritas" ? <Tag tone="ember">Prerequisite</Tag> : null}
                {d.bottleneck ? <Tag tone="ember">Bottleneck</Tag> : null}
                {d.rec_type ? <Tag tone={d.rec_type === "buktikan" ? "mint" : "neutral"}>{REC[d.rec_type]}</Tag> : null}
              </div>
              <SheetTitle className="mt-3 text-2xl font-bold text-ink">{titleCase(d.name)}</SheetTitle>
              <SheetDescription className="sr-only">Why this skill is on your route and how to learn it.</SheetDescription>
              {comp ? (
                <div className="mt-4">
                  <MasteryBar value={comp.p} target={comp.required} />
                  <div className="mt-2 flex justify-between text-xs text-ink/70">
                    <span>
                      You: {LEVEL[comp.level] ?? comp.level} ({num(comp.p)})
                    </span>
                    <span>Role needs: {num(comp.required)}</span>
                  </div>
                </div>
              ) : null}
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-7 p-6">
                {e ? (
                  <>
                    <Block title="What to Learn">{e.what}</Block>
                    <Block title="Why It Matters">{e.why}</Block>
                    {e.quotes.length ? (
                      <div className="space-y-2">
                        {e.quotes.slice(0, 3).map((q) => (
                          <a
                            key={q.posting_id}
                            href={q.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-xl border bg-card p-3.5 transition-colors hover:border-indigo/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Quote className="mb-1.5 size-3.5 text-iris" aria-hidden="true" />
                            <p className="text-sm italic text-ink/85">{q.quote.replace(/^[-•\s]+/, "")}</p>
                            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              {q.title}, {q.company} <ExternalLink className="size-3" aria-hidden="true" />
                            </p>
                          </a>
                        ))}
                      </div>
                    ) : null}
                    <Block title="Why Now">{e.why_now}</Block>
                    <Block title="What Comes Next">{e.next}</Block>
                  </>
                ) : step?.why_prereq ? (
                  <Block title="Why It's on Your Route">{step.why_prereq}</Block>
                ) : null}
                {step ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Free Materials</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Focus on {step.learn_what}. About {hours(step.hours)} to reach the target.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {step.materials.map((m) => (
                        <li key={m.id}>
                          <a
                            href={m.url}
                            onClick={() => track("material_clicked", { skill: step.skill_id })}
                            target="_blank"
                            rel="noreferrer"
                            className="flex gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-indigo/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <BookOpen className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-ink">{m.title}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {m.provider}, {FORMAT[m.format] ?? m.format}, {DIFFICULTY[m.difficulty] ?? m.difficulty}, {m.hours} h
                                {m.language === "id" ? ", in Indonesian" : ""}
                              </span>
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {d.rank ? <DecisionTrace skillId={d.skill_id} /> : null}
                {comp && Object.values(comp.sources).flat().length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Evidence So Far</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/80">
                      {Object.values(comp.sources)
                        .flat()
                        .map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
            <div className="border-t p-4">
              <LinkButton href={`/assessment/${d.skill_id}`} size="lg" className="h-11 w-full">
                Prove You Know It
              </LinkButton>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink/80">{children}</p>
    </div>
  );
}
