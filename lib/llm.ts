import "server-only";
import OpenAI from "openai";
import type { ZodType } from "zod";

/**
 * Single LLM provider for the whole app: Groq (Qwen), via its OpenAI-compatible endpoint.
 * CLAUDE.md: "One LLM provider for extraction + mood; don't maintain two schemas."
 */
export function llm() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY. Copy .env.example to .env.local.");
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    timeout: 20_000,
    maxRetries: 1,
  });
}

export const MODEL = process.env.GROQ_MODEL || "qwen/qwen3-32b";

/**
 * Qwen3 is a reasoning model: left alone it emits its chain of thought in <think> tags.
 * An older adult must never watch the companion think out loud, and a <think> block must
 * never end up inside a stored summary. Groq lets us suppress it at the source.
 */
const isReasoningModel = () => /qwen|deepseek|gpt-oss/i.test(MODEL);

const reasoningParams = (): Record<string, unknown> =>
  isReasoningModel() ? { reasoning_format: "hidden" } : {};

/** Belt and braces: strip any <think> block that slips through anyway. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "") // unterminated opener at the start of a stream
    .trim();
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

/** A chat turn. Streams tokens so the companion doesn't feel dead while it thinks. */
export async function streamChat(messages: Msg[]) {
  return llm().chat.completions.create({
    model: MODEL,
    messages,
    stream: true,
    temperature: 0.7,
    ...reasoningParams(),
  });
}

/**
 * An *enforced* structured call (CLAUDE.md: "tool use / json_schema, not 'please return JSON'").
 *
 * Groq's json_schema support varies by model — Qwen honours tool calling far more reliably
 * than response_format. So we ask for json_schema, and if the model or the endpoint rejects
 * it, we fall back to a single forced tool call, which is the same guarantee by another road.
 * Either way the payload is validated with zod before anyone downstream trusts its shape.
 */
export async function structured<T>(opts: {
  messages: Msg[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: ZodType<T>;
}): Promise<T> {
  let raw: string | undefined;

  try {
    const res = await llm().chat.completions.create({
      model: MODEL,
      messages: opts.messages,
      temperature: 0.2,
      ...reasoningParams(),
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: opts.jsonSchema },
      },
    });
    raw = res.choices[0]?.message?.content ?? undefined;
  } catch (err) {
    console.warn(
      `[llm] json_schema rejected by ${MODEL}; falling back to forced tool call.`,
      err instanceof Error ? err.message : err,
    );
    raw = await viaToolCall(opts);
  }

  if (!raw) raw = await viaToolCall(opts);

  return parseAndValidate(raw, opts.validator);
}

/** The fallback: one tool, and the model is required to call it. */
async function viaToolCall(opts: {
  messages: Msg[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
}): Promise<string> {
  const res = await llm().chat.completions.create({
    model: MODEL,
    messages: opts.messages,
    temperature: 0.2,
    ...reasoningParams(),
    tools: [
      {
        type: "function",
        function: {
          name: opts.schemaName,
          description: "Record the analysis of this conversation.",
          parameters: opts.jsonSchema,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: opts.schemaName },
    },
  });

  const call = res.choices[0]?.message?.tool_calls?.[0];
  if (!call || !("function" in call)) {
    throw new Error(`${MODEL} returned no tool call for ${opts.schemaName}.`);
  }
  return call.function.arguments;
}

function parseAndValidate<T>(raw: string, validator: ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripThinking(raw));
  } catch {
    throw new Error(`LLM returned non-JSON despite enforced output: ${raw.slice(0, 200)}`);
  }

  const result = validator.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `LLM JSON failed validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
