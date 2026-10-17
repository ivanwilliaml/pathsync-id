/** Wordmark: Sync's head (the chameleon mascot) next to the name. The same head is the favicon (app/icon.png). */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mascot/logo.webp" alt="" width={34} height={34} className="size-[34px] shrink-0" draggable={false} />
      <span className={`text-[17px] font-bold tracking-tight ${light ? "text-white" : "text-ink"}`} translate="no">
        PathSync
      </span>
    </span>
  );
}
