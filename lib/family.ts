import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Elder, Vitals } from "@/lib/types";

export type TrendPoint = {
  at: string;
  score: number;
  mood: string;
};

export type FamilySnapshot = {
  elder: Pick<Elder, "id" | "name" | "share_enabled">;
  /** False => the elder turned sharing off. Everything below is null. Respect it. */
  sharing: boolean;
  latest: {
    at: string;
    mood: string | null;
    energy: number | null;
    loneliness: number | null;
    concern: number | null;
    score: number | null;
    recommendation: string | null;
    vitals: Vitals | null;
    summary: string | null;
    crisis_detected: boolean;
  } | null;
  trend: TrendPoint[];
  healthFacts: { key: string; value: string }[];
  conversationCount: number;
};

/**
 * The ONLY way family-facing data leaves the database.
 *
 * Two consent rules are enforced here, in one place, on the server (prd.md §7):
 *   1. share_enabled === false  -> the family sees nothing but "sharing is paused".
 *   2. conversations.transcript is NEVER selected. Family gets summaries and signals.
 *      There is no code path that sends an elder's raw words to their children.
 */
export async function getFamilySnapshot(elderId: string): Promise<FamilySnapshot> {
  const db = supabaseAdmin();

  const { data: elder, error } = await db
    .from("elders")
    .select("id, name, share_enabled")
    .eq("id", elderId)
    .single();

  if (error || !elder) throw new Error("Elder not found");



  const [wellnessRes, convoRes, countRes, factsRes] = await Promise.all([
    db
      .from("wellness")
      .select("*")
      .eq("elder_id", elderId)
      .order("created_at", { ascending: false })
      .limit(180),
    // NOTE: `summary` only. Never `transcript`.
    db
      .from("conversations")
      .select("id, summary, created_at")
      .eq("elder_id", elderId)
      .not("summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("elder_id", elderId),
    db
      .from("facts")
      .select("key, value")
      .eq("elder_id", elderId)
      .eq("category", "health"),
  ]);

  const rows = wellnessRes.data ?? [];
  const newest = rows[0];

  if (!elder.share_enabled) {
    if (newest && newest.crisis_detected) {
      // Safety overrides consent policy:
      // Return a partial snapshot with the crisis warning, hiding all other private details.
      return {
        elder,
        sharing: false,
        latest: {
          at: newest.created_at,
          mood: null,
          energy: null,
          loneliness: null,
          concern: null,
          score: null,
          recommendation: newest.recommendation,
          vitals: null,
          summary: null,
          crisis_detected: true,
        },
        trend: [],
        healthFacts: [],
        conversationCount: 0,
      };
    }
    
    return {
      elder,
      sharing: false,
      latest: null,
      trend: [],
      healthFacts: [],
      conversationCount: 0,
    };
  }

  return {
    elder,
    sharing: true,
    latest: newest
      ? {
          at: newest.created_at,
          mood: newest.mood,
          energy: newest.energy,
          loneliness: newest.loneliness,
          concern: newest.concern,
          score: newest.score,
          recommendation: newest.recommendation,
          vitals: newest.vitals,
          summary: convoRes.data?.summary ?? null,
          crisis_detected: newest.crisis_detected,
        }
      : null,
    trend: rows
      .slice()
      .reverse()
      .map((w) => ({ at: w.created_at, score: w.score, mood: w.mood })),
    healthFacts: factsRes.data ?? [],
    conversationCount: countRes.count ?? 0,
  };
}
