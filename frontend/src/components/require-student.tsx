"use client";

import type { ReactNode } from "react";
import { useStudentId } from "@/lib/student";
import { EmptyState, LinkButton, Loading } from "./kit";

/** Renders children with the current student id, or an invitation to create a profile first. */
export function RequireStudent({ children }: { children: (id: string) => ReactNode }) {
  const { id, ready } = useStudentId();
  if (!ready) return <Loading />;
  if (!id)
    return (
      <EmptyState
        title="Create Your Profile First"
        image="/images/hero.webp"
        action={<LinkButton href="/" size="lg">Start Your Path</LinkButton>}
      >
        This page shows your personal learning path. It takes about two minutes to set up.
      </EmptyState>
    );
  return <>{children(id)}</>;
}
