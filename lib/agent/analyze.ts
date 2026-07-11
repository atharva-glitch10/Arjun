import "server-only";
import { z } from "zod";
import { structured } from "@/lib/llm";
import { ANALYSIS_SYSTEM_PROMPT, analysisUserPrompt } from "@/lib/agent/prompts";
import { FACT_CATEGORIES, type ChatMessage, type ConversationAnalysis } from "@/lib/types";

/**
 * ONE structured call per finished conversation returns everything downstream needs:
 * facts to remember, the family-facing summary, and the mood signals + recommendation.
 * (CLAUDE.md: one LLM provider, one schema — don't maintain two.)
 */
const analysisSchema = z.object({
  facts: z
    .array(
      z.object({
        category: z.enum(FACT_CATEGORIES as [string, ...string[]]),
        key: z.string().min(1).max(60),
        value: z.string().min(1).max(300),
      }),
    )
    .max(8),
  summary: z.string().min(1),
  mood: z.string().min(1).max(30),
  energy: z.number().int().min(0).max(100),
  loneliness: z.number().int().min(0).max(100),
  concern: z.number().int().min(0).max(100),
  recommendation: z.string().min(1),
});

/** Hand-written because json_schema strict mode is fussier than zod-to-json-schema output. */
const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "facts",
    "summary",
    "mood",
    "energy",
    "loneliness",
    "concern",
    "recommendation",
  ],
  properties: {
    facts: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "key", "value"],
        properties: {
          category: { type: "string", enum: FACT_CATEGORIES },
          key: {
            type: "string",
            description: "stable lowercase snake_case id, e.g. grandson_ravi",
          },
          value: { type: "string", description: "the detail, one plain sentence" },
        },
      },
    },
    summary: {
      type: "string",
      description: "one paragraph, 2-4 sentences, written for the person's family",
    },
    mood: { type: "string", description: "one non-clinical word, e.g. warm, quiet, tired" },
    energy: { type: "integer", minimum: 0, maximum: 100 },
    loneliness: { type: "integer", minimum: 0, maximum: 100 },
    concern: { type: "integer", minimum: 0, maximum: 100 },
    recommendation: {
      type: "string",
      description: "one sentence; a small human action for the family, toward human contact",
    },
  },
} as const;

export async function analyzeConversation(
  transcript: ChatMessage[],
  existingFactKeys: string[],
): Promise<ConversationAnalysis> {
  const result = await structured({
    schemaName: "conversation_analysis",
    jsonSchema: ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
    validator: analysisSchema,
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: analysisUserPrompt(transcript, existingFactKeys) },
    ],
  });

  return result as ConversationAnalysis;
}
