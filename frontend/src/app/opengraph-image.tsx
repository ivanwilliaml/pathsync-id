import { ImageResponse } from "next/og";

export const alt = "PathSync: know exactly what to learn next";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Preview card shown when the link is shared on WhatsApp, LINE, Instagram or LinkedIn.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0f2442", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#1b3a66", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 12, background: "#1d6fd8" }} />
            <div style={{ width: 12, height: 12, borderRadius: 12, background: "#4aa548" }} />
            <div style={{ width: 12, height: 12, borderRadius: 12, background: "#f5c542" }} />
          </div>
          PathSync
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>Tahu persis apa yang harus dipelajari berikutnya</div>
          <div style={{ fontSize: 34, color: "#c9daf2" }}>Rute belajar dari lowongan kerja nyata Indonesia dan bukti kemampuanmu. Gratis, tanpa email.</div>
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
