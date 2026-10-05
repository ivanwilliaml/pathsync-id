"use client";

import type { ReactNode } from "react";
import { useStudentId } from "@/lib/student";
import { Button, Empty, Spinner } from "./ui";

/** Renders children with the current student id, or a prompt to create a profile first. */
export function RequireStudent({ children }: { children: (id: string) => ReactNode }) {
  const { id, ready } = useStudentId();
  if (!ready) return <Spinner />;
  if (!id)
    return (
      <Empty>
        <p className="mb-3">Halaman ini membutuhkan profil mahasiswa.</p>
        <Button href="/">Buat profil</Button>
      </Empty>
    );
  return <>{children(id)}</>;
}
