"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// Rarely-changing reference data is fetched once and shared (PM audit UX-10: /meta was requested four times per load).
const SHARED_PATHS = new Set(["/meta", "/catalog", "/model-card"]);
const SHARED_TTL_MS = 5 * 60_000;
const shared = new Map<string, { at: number; promise: Promise<unknown> }>();

function fetchShared<T>(path: string, force: boolean): Promise<T> {
  const hit = shared.get(path);
  if (!force && hit && Date.now() - hit.at < SHARED_TTL_MS) return hit.promise as Promise<T>;
  const promise = api.get<T>(path).catch((e) => {
    shared.delete(path);
    throw e;
  });
  shared.set(path, { at: Date.now(), promise });
  return promise;
}

/** GET `path` (skipped while path is null); `reload()` refetches. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (SHARED_PATHS.has(path) ? fetchShared<T>(path, tick > 0) : api.get<T>(path))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
