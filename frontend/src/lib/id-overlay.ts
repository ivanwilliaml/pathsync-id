/* Indonesian for texts the API still sends in English only (the BPS context file and a few model-card and evaluation
 * strings). Matched exactly, or by pattern when a text carries numbers, so a changed sentence simply shows as sent
 * instead of being mistranslated. English stays the API's own text. */

const EXACT: Record<string, string> = {
  // BPS context
  "Open unemployment rate, Feb 2025": "Tingkat pengangguran terbuka, Feb 2025",
  "7.28 million people not working": "7,28 juta orang tidak bekerja",
  "University graduates unemployed, Feb 2025": "Lulusan universitas menganggur, Feb 2025",
  "highest in four years": "tertinggi dalam empat tahun",
  "Higher-education unemployed, May 2026": "Penganggur berpendidikan tinggi, Mei 2026",
  "the trend has not improved": "trennya belum membaik",
  "BPS, as cited in the proposal": "BPS, seperti dikutip dalam proposal",
  "Unemployment at ages 15-24": "Pengangguran usia 15–24 tahun",
  "more than three times the national rate": "lebih dari tiga kali angka nasional",
  "above 17%": "di atas 17%",
  "PathSync currently covers technology and business roles. Law and Education are outside the scope for now, and Economics, Management and Accounting are covered by the business roles listed.":
    "PathSync saat ini mencakup karier teknologi dan bisnis. Hukum dan Pendidikan belum termasuk cakupan, sedangkan Ekonomi, Manajemen, dan Akuntansi tercakup oleh karier bisnis yang tersedia.",
  "Figures are the ones cited in the PathSync proposal (Bab I), taken from BPS releases and the press coverage listed in its references. They give the problem context and are not used by the ranking. Check them against the BPS tables before quoting them elsewhere.":
    "Angka-angka ini dikutip dari proposal PathSync (Bab I), bersumber dari rilis BPS dan liputan media yang tercantum di referensinya. Angka ini memberi konteks masalah dan tidak dipakai untuk ranking. Cocokkan dengan tabel BPS sebelum mengutipnya di tempat lain.",
  // model card
  "quote must exist verbatim in the posting; embedding normalisation 0.85 / 0.7": "kutipan harus ada persis di lowongan; normalisasi embedding 0,85 / 0,7",
  "Google Gemini API (JSON schema output)": "Google Gemini API (keluaran skema JSON)",
  "choosing priorities": "memilih prioritas",
  "estimating mastery": "memperkirakan mastery",
  "ordering the path": "mengurutkan rute",
  "Bayesian knowledge tracing (eq. 3)": "Bayesian knowledge tracing (pers. 3)",
  // evidence weight sensitivity
  "documented prior (0.20/0.25/0.30/0.50)": "prior terdokumentasi (0,20/0,25/0,30/0,50)",
  "random weights near the prior (Dirichlet, concentration 100)": "bobot acak di sekitar prior (Dirichlet, konsentrasi 100)",
  "random weights near the prior (Dirichlet, concentration 30)": "bobot acak di sekitar prior (Dirichlet, konsentrasi 30)",
  "equal weights": "bobot sama rata",
  "no assessment weight boost (assessment = project)": "tanpa tambahan bobot Cek Kemampuan (Cek Kemampuan = project)",
  "grades weigh most (reversed)": "nilai kuliah paling berat (dibalik)",
  "synthetic cohort; source noise follows the error ratios implied by the prior weights":
    "kohort sintetis; noise tiap sumber mengikuti rasio error yang tersirat dari bobot prior",
};

const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^(\d+) of (\d+) pairs collected; the documented prior stays active\.$/, (_, a, b) => `${a} dari ${b} pasangan terkumpul; prior terdokumentasi tetap aktif.`],
  // plain figures: 4.76% -> 4,76%, 1,010,652 -> 1.010.652
  [/^(\d{1,3}(?:,\d{3})+)$/, (n) => n.replace(/,/g, ".")],
  [/^(\d+)\.(\d+)%$/, (_, a, b) => `${a},${b}%`],
];

/** the Indonesian text for an English API string, or the string itself when there is none */
export function idText(s: string | null | undefined, lang: string): string {
  if (s == null) return "";
  if (lang !== "id") return s;
  if (EXACT[s]) return EXACT[s];
  for (const [rx, f] of PATTERNS) {
    const m = rx.exec(s);
    if (m) return f(...m);
  }
  return s;
}
