"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

// Staff sign-in (admin, expert, advisor). The key is exchanged once for an HttpOnly cookie, so no staff token is ever
// kept in localStorage where an XSS bug could read it (PM audit BE-2).
const EVENT = "pathsync-staff";

export type StaffRole = "admin" | "expert" | "advisor";
export interface StaffSession {
  role: StaffRole;
  subject_id: string;
  label: string;
  expires_at: string | null;
  /** the staff account behind the session (null for key sign-in) */
  name?: string | null;
  email?: string | null;
  /** a read-only demo account: the page can look, never change */
  demo?: boolean;
}

export async function staffSignIn(token: string): Promise<StaffSession> {
  const s = await api.post<StaffSession>("/staff/session", { token });
  window.dispatchEvent(new Event(EVENT));
  return s;
}

/** Email + password sign-in for a staff account. */
export async function staffLogin(email: string, password: string): Promise<StaffSession> {
  const s = await api.post<StaffSession>("/staff/login", { email, password });
  window.dispatchEvent(new Event(EVENT));
  return s;
}

/** One-click read-only demo: a lecturer with a demo class, or an expert who never counts as one. */
export async function staffDemo(role: "advisor" | "expert"): Promise<StaffSession> {
  const s = await api.post<StaffSession>("/staff/demo", { role });
  window.dispatchEvent(new Event(EVENT));
  return s;
}

export interface StaffInvite {
  email: string;
  name: string;
  role: StaffRole;
}

/** Who an invite (or password reset) link is for. */
export function staffInvite(token: string): Promise<StaffInvite> {
  return api.get<StaffInvite>(`/staff/invite?token=${encodeURIComponent(token)}`);
}

/** Set the password from an invite link, then the account is signed in. */
export async function staffAccept(token: string, password: string): Promise<StaffSession> {
  const s = await api.post<StaffSession>("/staff/accept", { token, password });
  window.dispatchEvent(new Event(EVENT));
  return s;
}

/** Where each role works. */
export const STAFF_HOME: Record<StaffRole, string> = { admin: "/admin", expert: "/experts", advisor: "/advisor" };

export async function staffSignOut() {
  try {
    await api.del("/staff/session");
  } finally {
    window.dispatchEvent(new Event(EVENT));
  }
}

/** The current staff session, or null. `ready` is false until the first check finishes. */
export function useStaffSession(): { session: StaffSession | null; ready: boolean } {
  const [state, setState] = useState<{ session: StaffSession | null; ready: boolean }>({ session: null, ready: false });
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get<StaffSession>("/staff/session")
        .then((session) => alive && setState({ session, ready: true }))
        .catch(() => alive && setState({ session: null, ready: true }));
    load();
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
    };
  }, []);
  return state;
}

/** `token` is a truthy marker when the signed-in staff role may use this page. */
export function useStaffToken(role: StaffRole): { token: string | null; ready: boolean } {
  const { session, ready } = useStaffSession();
  const ok = session && (session.role === role || session.role === "admin");
  return { token: ok ? "session" : null, ready };
}

/** Sign out of a role (kept for existing call sites). */
export function setStaffToken(_role: StaffRole, token: string | null) {
  if (token === null) void staffSignOut();
}
