// Thin client for the FastAPI backend. Requests go to /api/* which next.config.mjs proxies.
import { tNow } from "./i18n";
import { getStudentToken } from "./student";

export class ApiError extends Error {
  status: number;
  requestId?: string;
  constructor(status: number, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.requestId = requestId;
  }
}

/** Student routes use the student's bearer token; staff routes use the HttpOnly session cookie (no token in JS). */
function tokenFor(path: string): string | null {
  return path.startsWith("/students/") ? getStudentToken() : null;
}

let lastRequestId: string | null = null;
/** Request id of the most recent response, attached to problem reports so the team can trace them. */
export function getLastRequestId() {
  return lastRequestId;
}

const TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 90_000;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenFor(path);
  if (token) headers.authorization = `Bearer ${token}`;
  if (method !== "GET") headers["x-pathsync"] = "1"; // CSRF guard for cookie-authenticated staff writes
  headers["x-pathsync-lang"] = tNow("en", "id"); // the backend writes its explanations and messages in this language
  const init: RequestInit = { method, headers, credentials: "same-origin" };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    headers["content-type"] = "application/json";
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), body instanceof FormData ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  init.signal = ctl.signal;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      // the server may still have saved it: tell the user to reload before retrying (PM audit P0-5)
      throw new ApiError(
        408,
        method === "GET"
          ? tNow("This is taking longer than expected. Check your connection and try again.", "Ini lebih lama dari biasanya. Cek koneksimu dan coba lagi.")
          : tNow(
              "Still processing… your change may already be saved. Reload the page to check before trying again.",
              "Masih diproses… perubahanmu mungkin sudah tersimpan. Muat ulang halaman untuk mengecek sebelum mencoba lagi.",
            ),
      );
    }
    throw new ApiError(0, tNow("Can't reach PathSync. Check your internet connection and try again.", "Tidak bisa terhubung ke PathSync. Cek koneksi internetmu dan coba lagi."));
  } finally {
    clearTimeout(timer);
  }
  lastRequestId = res.headers.get("x-request-id") ?? lastRequestId;
  if (!res.ok) {
    const rid = res.headers.get("x-request-id");
    let msg = res.status >= 500 ? tNow("Something went wrong on the server. Try again in a moment.", "Ada masalah di server. Coba lagi sebentar.") : `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
    } catch {}
    if ((res.status === 401 || res.status === 403) && path.startsWith("/students/")) {
      // never sign out silently: the access-key dialog asks for the key again (PM audit P0-4)
      window.dispatchEvent(new CustomEvent("pathsync-reauth"));
    }
    throw new ApiError(res.status, rid && res.status >= 500 && !msg.includes("ref ") ? `${msg} (ref ${rid})` : msg, rid ?? undefined);
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b?: unknown) => request<T>("POST", p, b ?? {}),
  patch: <T>(p: string, b: unknown) => request<T>("PATCH", p, b),
  put: <T>(p: string, b: unknown) => request<T>("PUT", p, b),
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
  /** ticked as finished on the Learn page (study progress only, never mastery) */
  done?: boolean;
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
  first_module_hours?: number;
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

export interface SoftSkill {
  skill_id: string; name: string; demand: number; level: number; level_label: string; note: string; how_to_build: string;
}

export interface Dashboard {
  soft_skills?: SoftSkill[];
  student: { id: string; display_name: string; program: string; target_role: string; preferences: Record<string, unknown> };
  role: { id: string; name: string; n_postings: number; trend_status: string; reference_date: string };
  market_version: string;
  model: { id: number; name: string; weights: Features };
  coverage: number;
  coverage_by_cluster: Record<string, { label: string; coverage: number; n_skills?: number; measured?: boolean }>;
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
  models?: { validation?: { real_experts: number; ranker_trained_on: string; status: string }; planned?: string[] };
  roles: { id: string; name: string; family: string; blurb: string; n_postings: number; limited_data: boolean }[];
  families: Record<string, string>;
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
  evidence: { id: number; kind: string; title: string; scores: Record<string, number>; details: Record<string, unknown>; review_status?: string; created_at: string }[];
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

// ------------------------------------------------------------------ learning loop (backend pathsync.learning_loop)
export type LoopTier = "basic" | "applied" | "transfer";
export type LoopCode = "mastered" | "transfer" | "prove" | "retry" | "practice_basic" | "review_basic" | "practice_applied" | "prerequisite";

export interface LoopStatus {
  skill_id: string;
  name: string;
  supported: boolean;
  objective: string | null;
  criteria: string[];
  provenance: string | null;
  target: number;
  level_target: string;
  p: number;
  level_now: string;
  p_proven: number | null;
  confidence: number;
  low_confidence: boolean;
  stages: {
    learn: { done: number; total: number };
    practice: Partial<Record<LoopTier, { total: number; done: number; correct: number; passed: boolean }>>;
    prove: { proven: boolean; last: { at: string; correct: number; total: number } | null };
  };
  decision: { code: LoopCode; title: string; reason: string; href: string; cta: string; prereqs: { skill_id: string; name: string }[] };
}

export interface LoopTask {
  id: string;
  tier: LoopTier;
  type: "choice" | "order";
  context: string | null;
  stem: string;
  options?: { idx: number; text: string }[];
  steps?: { idx: number; text: string }[];
  last: { correct: boolean; answer: number[] } | null;
}

export interface PracticeGrade {
  task_id: string;
  tier: LoopTier;
  correct: boolean;
  answer: number[];
  feedback: string;
  takeaway: string;
  options?: { idx: number; text: string; correct: boolean; feedback: string }[];
  steps?: string[];
  first_wrong?: number | null;
  status: LoopStatus;
}
