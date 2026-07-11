/**
 * THE ACCEPTANCE TEST (prd.md §5, §12).
 *
 * "Close the session, reopen, give the agent a new fact, and confirm it recalls it in the
 * next session. Judges will try this live. If recall is scripted rather than genuinely
 * persisted, the whole pitch collapses."
 *
 * So this proves it without a browser, without a session cookie, and without any in-memory
 * state carried between the two halves: session 2 loads its context from Postgres from
 * scratch, exactly as a cold serverless invocation would.
 *
 *   npm run verify:recall
 */
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../lib/supabase/admin";
import { loadElderContext, saveFacts } from "../lib/agent/memory";
import { analyzeConversation } from "../lib/agent/analyze";
import { companionSystemPrompt } from "../lib/agent/prompts";
import { mockVitals, wellnessScore } from "../lib/agent/wellness";
import { containsClinicalLanguage, scrubClinical } from "../lib/agent/guard";
import { streamChat, stripThinking, MODEL } from "../lib/llm";
import type { ChatMessage } from "../lib/types";

const db = supabaseAdmin();

// The specific detail the agent must remember. Deliberately unusual so we can't get a false
// pass from a generic "how are you?" greeting.
const NEEDLE = "Ravi";
const SESSION_1: ChatMessage[] = [
  { role: "assistant", content: "Good morning. How are you today?" },
  {
    role: "user",
    content:
      "I'm alright. A bit restless, honestly. My grandson Ravi has his chemistry exam on Friday and he's been so anxious about it. I've been thinking about him all week.",
  },
  { role: "assistant", content: "That sounds like it's weighing on you. Are you close with Ravi?" },
  {
    role: "user",
    content:
      "Very. He used to come over every Sunday for lunch, but he's been studying. I miss those lunches. I also still do my morning walk in the park, that helps.",
  },
];

const ok = (m: string) => console.log(`\x1b[32m  PASS\x1b[0m ${m}`);
const bad = (m: string) => console.log(`\x1b[31m  FAIL\x1b[0m ${m}`);

let failures = 0;
function check(condition: boolean, message: string) {
  if (condition) ok(message);
  else {
    bad(message);
    failures++;
  }
}

async function main() {
  console.log(`\nArjun — cross-session recall test (model: ${MODEL})\n`);

  // A throwaway elder so this never pollutes demo data.
  const { data: elder, error } = await db
    .from("elders")
    .insert({
      name: "Test Elder",
      native_language: "English",
      share_enabled: true,
      share_code: randomUUID().slice(0, 6).toUpperCase(),
    })
    .select("id")
    .single();

  if (error || !elder) throw new Error(`Could not create test elder: ${error?.message}`);
  const elderId = elder.id;

  try {
    // ---------------------------------------------------------------------
    // SESSION 1 — they mention Ravi's exam. Run the real end-of-session pipeline.
    // ---------------------------------------------------------------------
    console.log("Session 1: conversation happens, then ends.");

    const analysis = await analyzeConversation(SESSION_1, []);
    const savedCount = await saveFacts(elderId, analysis.facts);

    const vitals = mockVitals(analysis.energy);
    const score = wellnessScore(analysis, vitals);

    const { data: convo } = await db
      .from("conversations")
      .insert({
        elder_id: elderId,
        transcript: SESSION_1,
        summary: scrubClinical(analysis.summary),
      })
      .select("id")
      .single();

    await db.from("wellness").insert({
      elder_id: elderId,
      conversation_id: convo!.id,
      mood: scrubClinical(analysis.mood),
      energy: analysis.energy,
      loneliness: analysis.loneliness,
      concern: analysis.concern,
      vitals,
      score,
      recommendation: scrubClinical(analysis.recommendation),
    });

    console.log(`  extracted ${savedCount} fact(s), mood "${analysis.mood}", score ${score}`);
    console.log(`  summary: ${analysis.summary}\n`);

    check(savedCount > 0, "facts were extracted and persisted");
    check(
      analysis.facts.some((f) => JSON.stringify(f).toLowerCase().includes("ravi")),
      "a fact about Ravi was extracted",
    );
    check(
      !containsClinicalLanguage(scrubClinical(analysis.summary)) &&
        !containsClinicalLanguage(scrubClinical(analysis.recommendation)),
      "summary + recommendation are free of clinical language",
    );
    check(
      score >= 0 && score <= 100,
      `wellness score is a sane 0-100 value (${score})`,
    );

    // ---------------------------------------------------------------------
    // SESSION 2 — a COLD load. Nothing from session 1 is in memory: the context is
    // re-read from Postgres, which is the only place the fact now exists.
    // ---------------------------------------------------------------------
    console.log("\nSession 2: fresh context loaded from the database only.");

    const ctx = await loadElderContext(elderId);
    check(ctx.facts.length > 0, `facts loaded back out of Postgres (${ctx.facts.length})`);
    check(ctx.lastSummary !== null, "last conversation's summary loaded back out of Postgres");

    // Exactly the call /api/chat makes on an opening turn.
    const stream = await streamChat([
      { role: "system", content: companionSystemPrompt(ctx) },
      {
        role: "user",
        content: "(They have just opened the app and are waiting for you to say hello.)",
      },
    ]);

    let text = "";
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta?.content ?? "";
    }
    text = stripThinking(text);

    check(text.length > 0, "the agent produced an opening greeting");
    check(!/<think>/i.test(text), "no chain-of-thought leaked into the greeting");
    console.log(`\n  Arjun opens with:\n  \x1b[36m"${text.trim()}"\x1b[0m\n`);

    check(
      text.toLowerCase().includes(NEEDLE.toLowerCase()),
      `the unprompted greeting recalls "${NEEDLE}" from the previous session`,
    );
    check(
      /exam|chemistry|friday/i.test(text),
      "the greeting follows through on the exam specifically",
    );
    check(!containsClinicalLanguage(text), "the greeting is free of clinical language");
  } finally {
    // Cascades to conversations, facts, wellness.
    await db.from("elders").delete().eq("id", elderId);
    console.log("Cleaned up test elder.\n");
  }

  if (failures > 0) {
    console.log(`\x1b[31m${failures} check(s) failed.\x1b[0m\n`);
    process.exit(1);
  }
  console.log("\x1b[32mMemory survives a session boundary. The core loop is real.\x1b[0m\n");
}

main().catch((err) => {
  console.error("\n\x1b[31mverify-recall crashed:\x1b[0m", err);
  process.exit(1);
});
