/**
 * Confirms GROQ_API_KEY works, lists the models you can actually call, and proves the
 * configured model can be forced into structured output — which fact + mood extraction
 * depends on. Qwen on Groq is happier with tool calling than with response_format, so
 * lib/llm.ts tries json_schema and falls back; this shows you which road it took.
 *
 *   npm run check:llm
 */
import { structured, llm, MODEL } from "../lib/llm";
import { z } from "zod";

async function main() {
  const client = llm();

  const models = await client.models.list();
  const ids = models.data.map((m) => m.id).sort();

  console.log("\nModels available to this key:\n");
  for (const id of ids) {
    console.log(`  ${id === MODEL ? "\x1b[32m*\x1b[0m" : " "} ${id}`);
  }

  const configured = ids.includes(MODEL);
  console.log(
    configured
      ? `\n\x1b[32mGROQ_MODEL="${MODEL}" is available.\x1b[0m`
      : `\n\x1b[31mGROQ_MODEL="${MODEL}" is NOT in that list. Set GROQ_MODEL in .env.local to one of the above.\x1b[0m\n`,
  );
  if (!configured) process.exit(1);

  console.log("\nChecking enforced structured output…\n");

  const probe = await structured({
    schemaName: "probe",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["n", "word"],
      properties: {
        n: { type: "integer", description: "the number" },
        word: { type: "string", description: "the number spelled out" },
      },
    },
    validator: z.object({ n: z.number(), word: z.string() }),
    messages: [{ role: "user", content: "Return the number 7 and the word seven." }],
  });

  console.log(`\x1b[32mOK\x1b[0m — structured output works: ${JSON.stringify(probe)}\n`);
}

main().catch((err) => {
  console.error("\n\x1b[31mcheck-llm failed:\x1b[0m", err instanceof Error ? err.message : err);
  process.exit(1);
});
