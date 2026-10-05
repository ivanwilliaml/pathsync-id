"use client";

import { useEffect, useState } from "react";

const KEY = "pathsync.student";

export function getStudentId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStudentId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("pathsync-student"));
  } catch {}
}

/** Current student id from localStorage; `ready` is false until the first client render. */
export function useStudentId(): { id: string | null; ready: boolean } {
  const [state, setState] = useState<{ id: string | null; ready: boolean }>({ id: null, ready: false });
  useEffect(() => {
    const read = () => setState({ id: getStudentId(), ready: true });
    read();
    window.addEventListener("pathsync-student", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("pathsync-student", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return state;
}
