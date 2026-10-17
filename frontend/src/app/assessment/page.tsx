"use client";

import { useState } from "react";
import { CircleCheck, Clock, Scale } from "lucide-react";
import { ApiError, type Item } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { RequireStudent } from "@/components/require-student";
import { Quiz } from "@/components/quiz";
import { EmptyState, ErrorNote, LinkButton, Loading } from "@/components/kit";
import { Mascot } from "@/components/mascot";

export default function AssessmentPage() {
  return <RequireStudent>{(sid) => <Assessment sid={sid} />}</RequireStudent>;
}

function Assessment({ sid }: { sid: string }) {
  const [started, setStarted] = useState(false);
  const plan = useApi<{ session_id: string; items: Item[] }>(started ? `/students/${sid}/assessment/diagnostic` : null);

  if (!started) {
    return (
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight text-ink sm:text-[40px]">Quick Skill Check</h1>
          <p className="mt-3 max-w-lg text-lg text-ink/75">
            A short set of questions on the skills employers ask for most, picked where we know the least about you.
          </p>
          <ul className="mt-8 space-y-4">
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-indigo" aria-hidden="true" />
              <span className="text-ink/80">About 24 questions and 20 minutes. There is no time limit.</span>
            </li>
            <li className="flex gap-3">
              <Scale className="mt-0.5 size-5 shrink-0 text-indigo" aria-hidden="true" />
              <span className="text-ink/80">Your answers count more than grades or certificates, so answer honestly.</span>
            </li>
            <li className="flex gap-3">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-indigo" aria-hidden="true" />
              <span className="text-ink/80">You&rsquo;ll see the right answers and an updated route as soon as you finish.</span>
            </li>
          </ul>
          <Button size="lg" className="mt-8 h-12 px-7 text-[15px]" onClick={() => setStarted(true)}>
            Start the Check
          </Button>
        </div>
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-3xl bg-route-soft">
          <Mascot name="stopwatch" size={280} priority />
        </div>
      </div>
    );
  }
  if (plan.error instanceof ApiError && plan.error.status === 409)
    return (
      <EmptyState title="You've Answered Every Question" mascot="celebrate" action={<LinkButton href="/dashboard">Back to Dashboard</LinkButton>}>
        To show progress on one skill, add a project from one of your courses: it is the next best proof.
      </EmptyState>
    );
  if (plan.error) return <ErrorNote error={plan.error} />;
  if (!plan.data) return <Loading label="Picking your questions…" />;
  if (plan.data.items.length === 0)
    return (
      <EmptyState title="You've Answered Every Question" mascot="celebrate" action={<LinkButton href="/dashboard">Back to Dashboard</LinkButton>}>
        To show progress on one skill, open it from your dashboard and choose &ldquo;Prove You Know It&rdquo;, or add a project.
      </EmptyState>
    );
  return <Quiz sid={sid} sessionId={plan.data.session_id} items={plan.data.items} />;
}
