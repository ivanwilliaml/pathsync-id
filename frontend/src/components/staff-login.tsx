"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { ApiError } from "@/lib/api";
import { setStaffToken, type StaffRole } from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "./kit";

const TITLE: Record<StaffRole, string> = { admin: "Admin Sign-In", expert: "Expert Sign-In", advisor: "Lecturer Sign-In" };

/** Paste-a-key sign-in for staff roles. The key is stored on this device only. */
export function StaffLogin({ role, hint, error }: { role: StaffRole; hint?: string; error?: unknown }) {
  const [value, setValue] = useState("");
  const rejected = error instanceof ApiError && (error.status === 401 || error.status === 403);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) setStaffToken(role, value.trim());
      }}
    >
      <div className="flex items-center gap-2 text-ink">
        <KeyRound className="size-4 text-indigo" aria-hidden="true" />
        <h2 className="font-semibold">{TITLE[role]}</h2>
      </div>
      {hint ? <p className="text-sm text-ink/70">{hint}</p> : null}
      <div className="space-y-1.5">
        <Label htmlFor={`key-${role}`}>Sign-in key</Label>
        <Input
          id={`key-${role}`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 font-mono"
        />
      </div>
      {rejected ? <ErrorNote error={new Error("That key was not accepted. Check it, or ask an admin for a new one.")} /> : null}
      {error && !rejected ? <ErrorNote error={error} /> : null}
      <Button type="submit" size="lg" className="h-10" disabled={!value.trim()}>
        Sign In
      </Button>
    </form>
  );
}
