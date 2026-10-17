// Display helpers: English labels for the backend's internal codes, title case, Intl formatting.

const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "the", "to", "vs", "via", "with"]);

/** Chicago-style title case that keeps acronyms (SQL, UAT, BI) and product names (Power BI, draw.io) intact. */
export function titleCase(s: string): string {
  const words = s.split(/(\s+|\/|-|\()/);
  const real = words.filter((w) => w.trim() && !/^(\s+|\/|-|\()$/.test(w));
  let seen = 0;
  return words
    .map((w) => {
      if (!w.trim() || /^(\s+|\/|-|\()$/.test(w)) return w;
      seen += 1;
      const first = seen === 1;
      const last = seen === real.length;
      if (/[A-Z].*[A-Z]|\d|\./.test(w)) return w; // SQL, KPIs, draw.io, R2
      const lower = w.toLowerCase();
      if (!first && !last && SMALL.has(lower)) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}

export const LEVEL: Record<string, string> = { awal: "Beginner", dasar: "Basic", mandiri: "Proficient", mahir: "Advanced" };
export const REC: Record<string, string> = { pelajari: "Learn", buktikan: "Prove It" };
export const PATH_ROLE: Record<string, string> = { prioritas: "Priority", prasyarat: "Prerequisite" };
export const RUBRIC: Record<number, string> = { 0: "Not Shown", 1: "Basic", 2: "Proficient", 3: "Advanced" };
export const DIFFICULTY: Record<string, string> = { dasar: "Beginner", menengah: "Intermediate", lanjut: "Advanced" };
export const FORMAT: Record<string, string> = { teks: "Article", kursus: "Course", video: "Video", latihan: "Practice" };
export const EDGE_STATUS: Record<string, string> = { draft: "Draft", approved: "Approved", rejected: "Rejected" };
export const SOURCE: Record<string, string> = {
  karirhub: "Karirhub (Kemnaker)", workable: "Workable", workday: "Workday", lever: "Lever", greenhouse: "Greenhouse",
  smartrecruiters: "SmartRecruiters", ashby: "Ashby", recruitee: "Recruitee",
};
// every taxonomy cluster must be listed here, or its skills never show under "Skills by Area" or on the Skill Map
// (backend test test_frontend_cluster_order_covers_taxonomy keeps the two in sync)
export const CLUSTER_ORDER = [
  "data_analytics", "bi_tools", "business_analysis", "data_ml", "data_eng", "web_frontend", "backend", "mobile",
  "testing", "devops", "security", "design", "marketing", "finance", "corp_finance", "tax", "audit_risk", "hr",
  "supply_chain", "product_project",
];

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const pct = (x: number | null | undefined, digits = 0) =>
  x == null ? "–" : new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: digits }).format(x);
export const num = (x: number | null | undefined, digits = 2) =>
  x == null ? "–" : new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
export const int = (x: number | null | undefined) => (x == null ? "–" : nf0.format(x));
export const hours = (h: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(h)} h`;

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** Backend timestamps are naive UTC. */
export const fmtDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso.length > 10 && !iso.endsWith("Z") ? iso + "Z" : iso)) : "–");
export const fmtDateTime = (iso: string) => dateTimeFmt.format(new Date(iso.endsWith("Z") ? iso : iso + "Z"));

/** First sentence of a backend explanation, for compact rows. */
export const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
