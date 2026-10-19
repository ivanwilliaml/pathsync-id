"use client";

import { useEffect, useState } from "react";

// The clarity pulse asks "do you know what to learn next and why?", so it only appears once the student has opened the
// explanation or returned for a second visit (PM audit UX-8).
const PULSE_KEY = "pathsync.pulseReady";

const PULSE_EVENT = "pathsync-pulse";

export function markPulseReady() {
  try {
    localStorage.setItem(PULSE_KEY, "1");
    window.dispatchEvent(new Event(PULSE_EVENT));
  } catch {}
}

export function usePulseReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setReady(localStorage.getItem(PULSE_KEY) === "1");
      } catch {}
    };
    try {
      // count one visit per browser session, however many times the dashboard mounts
      if (!sessionStorage.getItem("pathsync.visitCounted")) {
        sessionStorage.setItem("pathsync.visitCounted", "1");
        const visits = Number(localStorage.getItem("pathsync.visits") ?? 0) + 1;
        localStorage.setItem("pathsync.visits", String(visits));
        if (visits >= 2) localStorage.setItem(PULSE_KEY, "1");
      }
    } catch {}
    read();
    window.addEventListener(PULSE_EVENT, read);
    return () => window.removeEventListener(PULSE_EVENT, read);
  }, []);
  return ready;
}
