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
}

export async function staffSignIn(token: string): Promise<StaffSession> {
  const s = await api.post<StaffSession>("/staff/session", { token });
  window.dispatchEvent(new Event(EVENT));
  return s;
}

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
