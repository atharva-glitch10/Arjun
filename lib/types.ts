export type FactCategory =
  | "family"
  | "health"
  | "hobby"
  | "date"
  | "preference"
  | "event";

export const FACT_CATEGORIES: FactCategory[] = [
  "family",
  "health",
  "hobby",
  "date",
  "preference",
  "event",
];

export type Role = "elder" | "family";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Elder = {
  id: string;
  name: string | null;
  native_language: string | null;
  share_enabled: boolean;
  share_code: string | null;
  created_at: string;
};

export type Fact = {
  id: string;
  elder_id: string;
  category: FactCategory;
  key: string;
  value: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  elder_id: string;
  transcript: ChatMessage[] | null;
  summary: string | null;
  created_at: string;
};

/**
 * WHOOP-style health metrics — simulated, never sourced from a real device (prd.md §2).
 *
 * Mirrors WHOOP's three-pillar model: Recovery, Strain, and Sleep.
 * Displayed with a "WHOOP-style · Simulated" label everywhere it surfaces.
 */
export type WhoopVitals = {
  // ── Recovery (0–100 %) ──────────────────────────────────────────────────
  /** Overall recovery score: how ready the body is for effort today. */
  recovery_score: number;
  /** Heart Rate Variability — RMSSD in ms. Higher = better autonomic balance. */
  hrv_rmssd_ms: number;
  /** Resting heart rate in bpm, measured during deepest sleep. */
  resting_heart_rate: number;
  /** Wrist skin temperature in °C vs. personal baseline. */
  skin_temp_celsius: number;
  /** Blood oxygen saturation (SpO2) in %, measured during sleep. */
  blood_oxygen_percent: number;

  // ── Strain (0–21 WHOOP scale) ───────────────────────────────────────────
  /** Cardiovascular strain accumulated over the day (0–21). */
  day_strain: number;
  /** Estimated active calories burned. */
  calories_burned: number;
  /** Average heart rate across the day in bpm. */
  avg_heart_rate: number;
  /** Peak heart rate reached during the day in bpm. */
  max_heart_rate: number;

  // ── Sleep ───────────────────────────────────────────────────────────────
  /** WHOOP's overall sleep performance score (0–100 %). */
  sleep_performance_percent: number;
  /** Total time asleep in hours. */
  sleep_hours: number;
  /** Time spent in REM sleep in hours. */
  time_in_rem_hours: number;
  /** Time spent in slow-wave (deep) sleep in hours. */
  time_in_deep_hours: number;
  /** Time spent in light sleep in hours. */
  time_in_light_hours: number;
  /** Sleep consistency vs. usual schedule (0–100 %). */
  sleep_consistency_percent: number;
  /** Average respiratory rate during sleep in breaths per minute. */
  respiratory_rate: number;

  // ── Extra Details for Demo ────────────────────────────────────────────────
  /** Daily sleep need in hours. */
  sleep_need_hours: number;
  /** Accumulated sleep debt in hours. */
  sleep_debt_hours: number;
  /** Number of sleep disturbances / wake events. */
  sleep_disturbances: number;
  /** Optimal day strain target lower bound (0-21). */
  strain_target_min: number;
  /** Optimal day strain target upper bound (0-21). */
  strain_target_max: number;
  /** List of detected activities / workouts for the day. */
  activities?: {
    name: string;
    duration_minutes: number;
    strain: number;
    avg_hr: number;
    calories: number;
  }[];
};

/** Alias kept so existing code referencing `Vitals` compiles without changes. */
export type Vitals = WhoopVitals;

export type Wellness = {
  id: string;
  elder_id: string;
  conversation_id: string | null;
  /** Non-clinical label: "warm", "quiet", "restless". Never diagnostic. */
  mood: string;
  energy: number;
  loneliness: number;
  concern: number;
  vitals: Vitals | null;
  score: number;
  recommendation: string;
  created_at: string;
};

/** What the single structured LLM call returns for a finished conversation. */
export type ConversationAnalysis = {
  facts: { category: FactCategory; key: string; value: string }[];
  summary: string;
  mood: string;
  energy: number;
  loneliness: number;
  concern: number;
  recommendation: string;
};

/** Everything loaded into the system prompt to make the agent remember. */
export type ElderContext = {
  elder: Elder;
  facts: Fact[];
  lastSummary: string | null;
  lastConversationAt: string | null;
};
