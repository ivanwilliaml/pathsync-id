"use client";

import { useEffect, useState } from "react";

/** Desktop (lg and up, 1024px) or not; null until mounted, so the server render and the first client render agree.
 * For layouts that change structure between phone and desktop (master-detail vs accordion), not just spacing. */
export function useDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}
