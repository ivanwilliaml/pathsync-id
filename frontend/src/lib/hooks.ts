"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useLang } from "./i18n";

// Rarely-changing reference data is fetched once and shared (PM audit UX-10: /meta was requested four times per load).
const SHARED_PATHS = new Set(["/meta", "/catalog", "/model-card"]);
const SHARED_TTL_MS = 5 * 60_000;
const shared = new Map<string, { at: number; promise: Promise<unknown> }>();

function fetchShared<T>(path: string, force: boolean, lang: string): Promise<T> {
  const key = `${lang}:${path}`;     // display texts differ per language
  const hit = shared.get(key);
  if (!force && hit && Date.now() - hit.at < SHARED_TTL_MS) return hit.promise as Promise<T>;
  const promise = api.get<T>(path).catch((e) => {
    shared.delete(key);
    throw e;
  });
  shared.set(key, { at: Date.now(), promise });
  return promise;
}

/** GET `path` (skipped while path is null); `reload()` refetches, and so does switching the interface language. */
export function useApi<T>(path: string | null) {
  const lang = useLang();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (SHARED_PATHS.has(path) ? fetchShared<T>(path, tick > 0, lang) : api.get<T>(path))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, tick, lang]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
