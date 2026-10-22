"use client";

import { useEffect, useState } from "react";

// The student's profile id and bearer token (from sign-up or email + password sign-in); the server keeps only its hash.
const KEY = "pathsync.student";
const EVENT = "pathsync-student";

export interface StudentAuth {
  id: string;
  token: string;
}

function read(): StudentAuth | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.id === "string" && typeof v.token === "string" ? v : null;
  } catch {
    return null; // older builds stored a bare id with no token: treat as signed out
  }
}

export function getStudentId(): string | null {
  return read()?.id ?? null;
}

export function getStudentToken(): string | null {
  return read()?.token ?? null;
}

export function setStudent(auth: StudentAuth | null) {
  try {
    if (auth) localStorage.setItem(KEY, JSON.stringify(auth));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

/** Current student id; `ready` is false until the first client render. */
export function useStudentId(): { id: string | null; ready: boolean } {
  const [state, setState] = useState<{ id: string | null; ready: boolean }>({ id: null, ready: false });
  useEffect(() => {
    const update = () => setState({ id: getStudentId(), ready: true });
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return state;
}
