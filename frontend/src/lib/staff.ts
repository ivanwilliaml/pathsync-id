"use client";

import { useEffect, useState } from "react";

// Staff sign-in (admin, expert, advisor). Tokens are issued by an admin and shown once.
const KEY = "pathsync.staff";
const EVENT = "pathsync-staff";

export type StaffRole = "admin" | "expert" | "advisor";
export interface StaffAuth {
  role: StaffRole;
  token: string;
}

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function getStaffToken(role: StaffRole): string | null {
  return read()[role] ?? null;
}

/** Token for a staff route: the role's own token, falling back to an admin token (admins can do everything). */
export function staffTokenFor(path: string): string | null {
  const all = read();
  if (path.startsWith("/admin")) return all.admin ?? null;
  if (path.startsWith("/expert")) return all.expert ?? all.admin ?? null;
  if (path.startsWith("/advisor")) return all.advisor ?? all.admin ?? null;
  return null;
}

export function setStaffToken(role: StaffRole, token: string | null) {
  try {
    const all = read();
    if (token) all[role] = token;
    else delete all[role];
    localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function useStaffToken(role: StaffRole): { token: string | null; ready: boolean } {
  const [state, setState] = useState<{ token: string | null; ready: boolean }>({ token: null, ready: false });
  useEffect(() => {
    const update = () => setState({ token: getStaffToken(role) ?? (role !== "admin" ? getStaffToken("admin") : null), ready: true });
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [role]);
  return state;
}
