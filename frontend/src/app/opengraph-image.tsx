import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "PathSync: know exactly what to learn next";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Preview card shown when the link is shared on WhatsApp, LINE, Instagram or LinkedIn.
export default async function OpengraphImage() {
  const png = (name: string) => readFile(join(process.cwd(), "src/app", name)).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  const [head, wave] = await Promise.all([png("icon.png"), png("og-sync.png")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0f2442", color: "white", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={head} width={64} height={64} alt="" />
          PathSync
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wave} width={330} height={392} alt="" style={{ position: "absolute", right: 56, bottom: 36 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 740 }}>
          <div style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>Tahu persis apa yang harus dipelajari berikutnya</div>
          <div style={{ fontSize: 30, color: "#c9daf2" }}>Rute belajar dari lowongan kerja nyata Indonesia dan bukti kemampuanmu. Gratis, tanpa email.</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 28 }}>
          {["14 careers", "Hard skills", "Real postings"].map((r) => (
            <div key={r} style={{ padding: "10px 24px", borderRadius: 999, background: "#1d6fd8" }}>
              {r}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
