import { cn } from "@/lib/utils";

// Sync, the PathSync chameleon. Poses live in public/mascot/<name>.webp (trimmed, max 360 px, transparent).
// Source art and prompts: the team's mascot folder; open-mouth smiles are the default for positive moments.
export const MASCOTS = [
  "wave", "signpost", "compass", "trophy", "scale", "magnifier", "transcript", "certificate", "portfolio",
  "upload", "stopwatch", "checklist", "celebrate", "sad", "thinking", "nodes", "map-route", "job-board",
  "board", "calendar", "journal", "advisor", "group", "key", "export", "delete", "shield", "empty-box",
  "oops", "offline", "shift-route",
] as const;
export type MascotName = (typeof MASCOTS)[number];

/** Decorative by default (alt=""); pass `alt` only when the picture itself carries meaning. */
export function Mascot({ name, size = 120, alt = "", className, priority = false }: {
  name: MascotName;
  size?: number;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/mascot/${name}.webp`}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("pointer-events-none shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
