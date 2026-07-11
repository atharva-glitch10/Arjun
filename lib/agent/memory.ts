import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ElderContext, Elder, Fact, FactCategory } from "@/lib/types";

/** Cap what goes into the system prompt so it stays sharp as facts accumulate. */
const MAX_FACTS_IN_PROMPT = 40;

/**
 * Load everything the agent needs to remember this person: their stored facts plus the
 * summary of their LAST conversation. This is the whole memory engine — no embeddings,
 * no similarity search, just the rows for this elder (prd.md §5).
 */
export async function loadElderContext(elderId: string): Promise<ElderContext> {
  const db = supabaseAdmin();

  const [elderRes, factsRes, lastConvoRes] = await Promise.all([
    db.from("elders").select("*").eq("id", elderId).single(),
    db
      .from("facts")
      .select("*")
      .eq("elder_id", elderId)
      .order("updated_at", { ascending: false })
      .limit(MAX_FACTS_IN_PROMPT),
    db
      .from("conversations")
      .select("summary, created_at")
      .eq("elder_id", elderId)
      .not("summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (elderRes.error) throw new Error(`Elder not found: ${elderRes.error.message}`);
  if (factsRes.error) throw new Error(`Could not load facts: ${factsRes.error.message}`);

  return {
    elder: elderRes.data as Elder,
    facts: (factsRes.data ?? []) as Fact[],
    lastSummary: lastConvoRes.data?.summary ?? null,
    lastConversationAt: lastConvoRes.data?.created_at ?? null,
  };
}

/**
 * Upsert extracted facts. The unique index on (elder_id, category, key) means a fact the
 * person mentions again UPDATES in place rather than piling up a duplicate row — which is
 * what keeps the system prompt clean over many sessions.
 */
export async function saveFacts(
  elderId: string,
  facts: { category: FactCategory; key: string; value: string }[],
): Promise<number> {
  if (!facts.length) return 0;

  const rows = facts.map((f) => ({
    elder_id: elderId,
    category: f.category,
    key: f.key.trim().toLowerCase().replace(/\s+/g, "_"),
    value: f.value.trim(),
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabaseAdmin()
    .from("facts")
    .upsert(rows, { onConflict: "elder_id,category,key", count: "exact" });

  if (error) throw new Error(`Could not save facts: ${error.message}`);
  return count ?? rows.length;
}
