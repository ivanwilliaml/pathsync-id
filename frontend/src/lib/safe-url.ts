/** Links that come from data (job postings, learning materials, quotes) may only open http(s) pages.
 * A `javascript:` or `data:` address from a bad record would otherwise run in the visitor's browser. */
export function safeUrl(url: string | null | undefined): string {
  if (!url || !/^https?:\/\//i.test(url)) return "#";
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "#";
  } catch {
    return "#";
  }
}
