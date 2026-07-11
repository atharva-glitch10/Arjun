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

/** Mocked. Never sourced from a real device (prd.md §2). */
export type Vitals = {
  resting_heart_rate: number;
  sleep_hours: number;
  steps: number;
};

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
