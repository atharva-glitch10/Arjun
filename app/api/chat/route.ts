import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadElderContext } from "@/lib/agent/memory";
import { companionSystemPrompt } from "@/lib/agent/prompts";
import { streamChat } from "@/lib/llm";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One chat turn.
 *
 * The memory lives here: every single turn rebuilds the system prompt from the elder's
 * stored facts + last summary, freshly loaded from Postgres. Nothing is cached in module
 * scope, so recall works across a cold start, a new browser, a different device — which is
 * exactly what a judge is testing when they reopen the app (prd.md §5).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (session.role !== "elder") {
    return NextResponse.json(
      { error: "Only the companion's owner can chat." },
      { status: 403 },
    );
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const ctx = await loadElderContext(session.elder.id);

  const turns: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: companionSystemPrompt(ctx) },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content ?? ""),
    })),
  ];

  // Opening the app is itself a turn: the agent greets first, using what it remembers.
  if (messages.length === 0) {
    turns.push({
      role: "user",
      content: "(They have just opened the app and are waiting for you to say hello.)",
    });
  }

  let stream: Awaited<ReturnType<typeof streamChat>>;
  try {
    stream = await streamChat(turns);
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Qwen is a reasoning model. Groq is told to hide the chain of thought, but if any
      // <think> block ever slips through we swallow it rather than let an older adult watch
      // the companion reason about her out loud.
      let inThought = false;
      let pending = "";

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (!delta) continue;

          pending += delta;

          // Hold back any partial "<think" / "</think" so a tag can't be split across chunks.
          for (;;) {
            if (inThought) {
              const close = pending.indexOf("</think>");
              if (close === -1) {
                pending = pending.slice(-8); // keep enough to match a split closing tag
                break;
              }
              pending = pending.slice(close + 8);
              inThought = false;
              continue;
            }

            const open = pending.indexOf("<think>");
            if (open !== -1) {
              const emit = pending.slice(0, open);
              if (emit) controller.enqueue(encoder.encode(emit));
              pending = pending.slice(open + 7);
              inThought = true;
              continue;
            }

            // No complete tag. Emit everything except a possible partial "<think" suffix.
            const safe = pending.length - 7;
            if (safe > 0 && !pending.slice(safe).includes("<")) {
              controller.enqueue(encoder.encode(pending));
              pending = "";
            } else if (safe > 0) {
              const cut = pending.lastIndexOf("<");
              const emit = cut === -1 ? pending : pending.slice(0, cut);
              if (emit) controller.enqueue(encoder.encode(emit));
              pending = cut === -1 ? "" : pending.slice(cut);
            }
            break;
          }
        }

        if (!inThought && pending) controller.enqueue(encoder.encode(pending));
      } catch (err) {
        console.error("[chat] stream broke", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
