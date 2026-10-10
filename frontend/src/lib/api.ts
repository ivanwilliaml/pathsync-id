// Thin client for the FastAPI backend. Requests go to /api/* which next.config.mjs proxies.
import { staffTokenFor } from "./staff";
import { getStudentToken } from "./student";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Bearer token for a route: the student's own token for /students/*, a staff token for staff routes. */
function tokenFor(path: string): string | null {
  if (path.startsWith("/students/")) return getStudentToken();
  return staffTokenFor(path);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenFor(path);
  if (token) headers.authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, "Can't reach the PathSync server. Check that the backend is running.");
  }
  if (!res.ok) {
    let msg = res.status >= 500 ? "Something went wrong on the server. Try again in a moment." : `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
    } catch {}
    if ((res.status === 401 || res.status === 403) && path.startsWith("/students/")) {
      // the stored profile token is missing or stale: sign out so the app offers sign-up / resume
      const { setStudent } = await import("./student");
      setStudent(null);
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b?: unknown) => request<T>("POST", p, b ?? {}),
  patch: <T>(p: string, b: unknown) => request<T>("PATCH", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
};

// ------------------------------------------------------------------ types
export type Features = Record<"G" | "R" | "K" | "D" | "T" | "U" | "B", number>;

export interface Quote {
  quote: string;
  title: string;
  company: string;
  url: string;
  source: string;
  posting_id: string;
}

export interface Explanation {
  what: string;
  why: string;
  why_now: string;
  next: string;
  quotes: Quote[];
  bottleneck: boolean;
  contributions: Features;
  rank: number;
}

export interface RankRow {
  skill_id: string;
  name: string;
  cluster: string;
  rank: number;
  score: number;
  priority: number;
  features: Features;
  contributions: Features;
  rec_type: "pelajari" | "buktikan";
  blocked_by: string[];
  unlocks: string[];
  explanation: Explanation | null;
}

export interface Material {
  id: string;
  title: string;
  provider: string;
  url: string;
  difficulty: string;
  format: string;
  language: string;
  hours: number;
  verified: boolean;
}

export interface PathStep {
  skill_id: string;
  name: string;
  role_in_path: string;
  rank: number | null;
  p: number;
  target: number;
  level_now: string;
  level_target: string;
  rec_type: string;
  hours: number;
  materials: Material[];
  waiting_for: string[];
  learn_what: string;
  why_prereq: string | null;
  explanation: Explanation | null;
}

export interface Competency {
  skill_id: string;
  name: string;
  cluster: string;
  p: number;
  p0: number;
  confidence: number;
  low_confidence: boolean;
  components: Record<string, number>;
  sources: Record<string, string[]>;
  n_items: number;
  n_correct: number;
  bkt_trace: number[];
  claimed: boolean;
  self_rating: number | null;
  flags: string[];
  required: number;
  gap: number;
  demand: number;
  rec_type: string;
  level: string;
  esco: string | null;
}

export interface Dashboard {
  student: { id: string; display_name: string; program: string; target_role: string; preferences: Record<string, unknown> };
  role: { id: string; name: string; n_postings: number; trend_status: string; reference_date: string };
  market_version: string;
  model: { id: number; name: string; weights: Features };
  coverage: number;
  coverage_by_cluster: Record<string, { label: string; coverage: number }>;
  ranking: RankRow[];
  path: PathStep[];
  path_hours: number;
  path_weeks: number;
  counterfactual: {
    alternatives: { label: string; order: string[]; blocked: number; blocked_detail: { skill_id: string; waiting_for: string[] }[] }[];
    notes: string[];
    recommended_blocked: number;
    recommended_is_minimal: boolean;
  };
  competencies: Competency[];
  confirmations: { skill_id: string; name: string; flag: string; message: string }[];
  perception: { skill_id: string; name: string; self_rating: number; p: number }[];
  evidence_summary: Record<string, number>;
  diagnostic_done: boolean;
  blocked_in_path: number;
  features?: { evidence: boolean; graph: boolean; adaptive: boolean; explanations: boolean; path: boolean };
  study_arm?: string | null;
}

export interface Meta {
  roles: { id: string; name: string }[];
  clusters: Record<string, string>;
  taxonomy_version: string;
  skills: { id: string; name: string; name_en: string; cluster: string; kind: string; description: string; learn_what: string }[];
  extractor: string;
  market_versions: Record<string, string | null>;
  model: { name: string; weights: Features } | null;
  n_postings: number;
  n_items: number;
}

export interface Item {
  id: string;
  skill_id: string;
  skill_name: string;
  difficulty: number;
  stem: string;
  options: string[];
}

export interface Student {
  id: string;
  display_name: string;
  program: string;
  target_role: string;
  preferences: Record<string, unknown>;
  self_ratings: Record<string, number> | null;
  evidence: { id: number; kind: string; title: string; scores: Record<string, number>; details: Record<string, unknown>; created_at: string }[];
  n_responses: number;
}

export const FEATURE_LABELS: Record<string, string> = {
  G: "Skill Gap",
  R: "Prerequisites Ready",
  K: "Evidence Confidence",
  D: "Market Demand",
  T: "Demand Trend",
  U: "Unlocks Other Skills",
  B: "Bottleneck",
};
