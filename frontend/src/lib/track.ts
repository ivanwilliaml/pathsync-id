"use client";

import { getStudentId, getStudentToken } from "./student";

type Props = Record<string, string | number | boolean>;

/** First-party product analytics: one small POST to our own server, never a third-party tracker. Fire and forget. */
export function track(name: string, props: Props = {}) {
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const token = getStudentToken();
    if (token) headers.authorization = `Bearer ${token}`;
    void fetch("/api/events", {
      method: "POST",
      headers,
      body: JSON.stringify({ name, student_id: getStudentId(), props }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics must never break the app
  }
}

/** Track an event once per browser session (page views, "next step viewed"). */
export function trackOnce(name: string, key = name, props: Props = {}) {
  try {
    const k = `pathsync.once.${key}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  } catch {
    // no sessionStorage: fall through and track anyway
  }
  track(name, props);
}
