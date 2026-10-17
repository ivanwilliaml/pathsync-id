"use client";

import { useParams } from "next/navigation";
import { ApiError, type Item } from "@/lib/api";
import { LEVEL, num, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { RequireStudent } from "@/components/require-student";
import { Quiz } from "@/components/quiz";
import { EmptyState, ErrorNote, LinkButton, Loading } from "@/components/kit";

export default function SkillCheckPage() {
  const { skill } = useParams<{ skill: string }>();
  return <RequireStudent>{(sid) => <SkillCheck sid={sid} skill={skill} />}</RequireStudent>;
}

function level(p: number) {
  return p >= 0.8 ? LEVEL.mahir : p >= 0.6 ? LEVEL.mandiri : p >= 0.35 ? LEVEL.dasar : LEVEL.awal;
}

function SkillCheck({ sid, skill }: { sid: string; skill: string }) {
  const r = useApi<{ session_id: string; skill_id: string; skill_name: string; p: number; items: Item[] }>(`/students/${sid}/assessment/reassess/${skill}`);
  if (r.error instanceof ApiError && r.error.status === 409)
    return (
      <EmptyState title="No Questions Left for This Skill" mascot="portfolio" action={<LinkButton href="/evidence?step=projects">Add a Project</LinkButton>}>
        {r.error.message}
      </EmptyState>
    );
  if (r.error) return <ErrorNote error={r.error} />;
  if (!r.data) return <Loading />;
  const name = titleCase(r.data.skill_name);
  return (
    <div>
      <header className="mx-auto mb-8 max-w-3xl">
        <h1 className="text-[28px] font-extrabold leading-tight text-ink sm:text-[32px]">Prove Your {name}</h1>
        <p className="mt-2 text-ink/70">
          You&rsquo;re currently at {level(r.data.p)} level ({num(r.data.p)}). Each right answer moves your level up right away.
        </p>
      </header>
      {r.data.items.length === 0 ? (
        <EmptyState title="No Questions Left for This Skill" mascot="portfolio" action={<LinkButton href="/evidence?step=projects">Add a Project</LinkButton>}>
          You&rsquo;ve answered every question we have for {name}. A project that shows this skill is the next best proof.
        </EmptyState>
      ) : (
        <Quiz sid={sid} sessionId={r.data.session_id} items={r.data.items} />
      )}
    </div>
  );
}
