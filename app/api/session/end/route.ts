import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadElderContext, saveFacts } from "@/lib/agent/memory";
import { analyzeConversation } from "@/lib/agent/analyze";
import { mockVitals, wellnessScore } from "@/lib/agent/wellness";
import { scrubClinical, hasCrisisKeywords } from "@/lib/agent/guard";
import { elderChannel, SESSION_ENDED } from "@/lib/realtime";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * End of session — the whole pipeline, in order:
 *
 *   transcript -> ONE structured LLM call -> { facts, summary, mood signals, recommendation }
 *              -> facts UPSERTed        (this is what the NEXT session will recall)
 *              -> conversation + summary INSERTed
 *              -> mock vitals + arithmetic wellness score INSERTed
 *              -> "session ended" ping broadcast to the family dashboard
 *
 * Order matters: facts and the summary are committed before we tell anyone we're done, so
 * a new session started the instant the dashboard lights up already sees the new memory.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "elder") {
    return NextResponse.json({ error: "Not signed in as an elder." }, { status: 401 });
  }

  let transcript: ChatMessage[];
  try {
    const body = await req.json();
    transcript = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  // Nothing was said. Don't manufacture a memory or a mood out of an empty room.
  const spoke = transcript.filter((m) => m.role === "user" && m.content?.trim());
  if (spoke.length === 0) {
    return NextResponse.json({ skipped: "empty_conversation" }, { status: 200 });
  }

  const elderId = session.elder.id;
  const db = supabaseAdmin();

  const ctx = await loadElderContext(elderId);
  const existingKeys = ctx.facts.map((f) => `${f.category}:${f.key}`);

  let analysis;
  try {
    analysis = await analyzeConversation(transcript, existingKeys);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    console.error("[session/end] analysis failed", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Hard rule: nothing clinical is ever written to a row a family member will read.
  const summary = scrubClinical(analysis.summary);
  const recommendation = scrubClinical(analysis.recommendation);
  const mood = scrubClinical(analysis.mood);

  // Hybrid crisis detection: LLM flag OR deterministic regex on user's messages
  const userText = transcript.filter(m => m.role === "user").map(m => m.content).join(" ");
  const crisis_detected = analysis.crisis_detected || hasCrisisKeywords(userText);

  // 1. Memory first. If this fails, the session is worthless — fail loudly.
  const factCount = await saveFacts(elderId, analysis.facts);

  // 2. The conversation + its summary.
  const { data: conversation, error: convoErr } = await db
    .from("conversations")
    .insert({ elder_id: elderId, transcript, summary })
    .select("id")
    .single();

  if (convoErr) {
    return NextResponse.json(
      { error: `Could not save conversation: ${convoErr.message}` },
      { status: 500 },
    );
  }

  // 3. Mood signals + MOCK vitals + arithmetic score.
  const vitals = mockVitals(analysis.energy);
  const score = wellnessScore(analysis, vitals);

  const { error: wellnessErr } = await db.from("wellness").insert({
    elder_id: elderId,
    conversation_id: conversation.id,
    mood,
    energy: analysis.energy,
    loneliness: analysis.loneliness,
    concern: analysis.concern,
    vitals,
    score,
    recommendation,
    crisis_detected,
  });

  if (wellnessErr) {
    return NextResponse.json(
      { error: `Could not save wellness: ${wellnessErr.message}` },
      { status: 500 },
    );
  }

  // 4. Tell the dashboard something changed. Contentless on purpose — the payload carries
  //    no summary and no transcript, so a Realtime subscriber learns nothing it shouldn't.
  //    The dashboard refetches through getFamilySnapshot(), which is where consent is applied.
  //    A failed broadcast must never fail the session: the dashboard also polls.
  try {
    await db.channel(elderChannel(elderId)).send({
      type: "broadcast",
      event: SESSION_ENDED,
      payload: { at: new Date().toISOString(), crisis: crisis_detected },
    });
  } catch (err) {
    console.warn("[session/end] broadcast failed; dashboard will pick it up by polling", err);
  }

  return NextResponse.json({
    conversation_id: conversation.id,
    facts_remembered: factCount,
    summary,
    mood,
    score,
    recommendation,
  });
}
