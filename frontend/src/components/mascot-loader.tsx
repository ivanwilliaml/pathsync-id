import type { CSSProperties } from "react";

// Sync, the chameleon mascot, running in place while it changes colour (green → blue → yellow → green):
// the product idea in one loop, keep adapting while you move. Three 30-frame sprite strips (public/mascot/sync-run-*.webp,
// 119 × 120 px per frame) are stacked; CSS steps through the frames and cross-fades the colour layers (globals.css).
// With prefers-reduced-motion the mascot stands still in green.
export function MascotLoader({ size = 72, className = "" }: { size?: number; className?: string }) {
  const style = { "--sync-h": `${size}px`, "--sync-w": `${(size * 119) / 120}px` } as CSSProperties;
  return (
    <span className={`sync-run ${className}`} style={style} aria-hidden="true">
      <span className="sync-run-layer" style={{ backgroundImage: "url(/mascot/sync-run-green.webp)" }} />
      <span className="sync-run-layer sync-run-blue" style={{ backgroundImage: "url(/mascot/sync-run-blue.webp)" }} />
      <span className="sync-run-layer sync-run-yellow" style={{ backgroundImage: "url(/mascot/sync-run-yellow.webp)" }} />
    </span>
  );
}
