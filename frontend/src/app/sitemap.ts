import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/market", "/how-it-works", "/privacy", "/about"].map((p) => ({ url: `${SITE}${p}`, changeFrequency: "monthly" }));
}
