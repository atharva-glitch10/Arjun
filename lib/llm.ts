import "server-only";
import OpenAI from "openai";
import type { ZodType } from "zod";

/**
 * Single LLM provider for the whole app: xAI (Grok), via its OpenAI-compatible endpoint.
 * CLAUDE.md: "One LLM provider for extraction + mood; don't maintain two schemas."
 */
export function llm() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing XAI_API_KEY. Copy .env.example to .env.local.");
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.XAI_BASE_URL || "https://api.x.ai/v1",
  });
}

export const MODEL = process.env.XAI_MODEL || "grok-4-fast";

type Msg = { role: "system" | "user" | "assistant"; content: string };

/**
 * A chat turn. Streams tokens so the companion doesn't feel dead while it thinks.
 */
export async function streamChat(messages: Msg[]) {
  return llm().chat.completions.create({
    model: MODEL,
    messages,
    stream: true,
    temperature: 0.7,
  });
}

/**
 * An *enforced* structured call: the model must return JSON matching `jsonSchema`.
 * We validate with zod afterwards anyway — a provider honouring the schema is not a
 * reason to trust the payload shape at the type level.
 */
export async function structured<T>(opts: {
  messages: Msg[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  validator: ZodType<T>;
}): Promise<T> {
  const res = await llm().chat.completions.create({
    model: MODEL,
    messages: opts.messages,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: opts.schemaName,
        strict: true,
        schema: opts.jsonSchema,
      },
    },
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("LLM returned an empty structured response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`LLM returned non-JSON despite json_schema: ${raw.slice(0, 200)}`);
  }

  const result = opts.validator.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `LLM JSON failed validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
