import type { CSSProperties } from "react";

// Sync, the chameleon mascot, running in place while its colour shifts like a real chameleon: bands of green, teal, blue,
// sky, lime and yellow sweep along the body, so head and tail change at different moments. The product idea in one loop:
// keep adapting while you move.
// How: a 30-frame run strip with the body in light grey shading (sync-run-shade.webp), and above it a moving colour band
// multiplied onto the body only, cut out by a matching body mask strip (sync-run-mask.webp). Eyes and mouth stay untouched.
// Browsers without CSS masks, and prefers-reduced-motion, get the plain green strip (sync-run-green.webp). See globals.css.
export function MascotLoader({ size = 72, className = "" }: { size?: number; className?: string }) {
  const style = { "--sync-h": `${size}px`, "--sync-w": `${(size * 119) / 120}px` } as CSSProperties;
  return (
    <span className={`sync-run ${className}`} style={style} aria-hidden="true">
      <span className="sync-run-layer sync-run-base" />
      <span className="sync-run-layer sync-run-color" />
    </span>
  );
}
