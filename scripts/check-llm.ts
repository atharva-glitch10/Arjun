/**
 * Confirms XAI_API_KEY works and lists the models you can actually call, so XAI_MODEL is
 * set from reality rather than from a guess.
 *
 *   npm run check:llm
 */
import { llm, MODEL } from "../lib/llm";

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
      ? `\n\x1b[32mXAI_MODEL="${MODEL}" is available.\x1b[0m\n`
      : `\n\x1b[31mXAI_MODEL="${MODEL}" is NOT in that list. Set XAI_MODEL in .env.local to one of the above.\x1b[0m\n`,
  );

  if (!configured) process.exit(1);

  // Structured output is load-bearing (CLAUDE.md), so prove the model honours json_schema.
  process.stdout.write("Checking json_schema structured output… ");
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: "Return the number 7 and the word seven." }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "probe",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["n", "word"],
          properties: { n: { type: "integer" }, word: { type: "string" } },
        },
      },
    },
  });

  const raw = res.choices[0]?.message?.content ?? "";
  JSON.parse(raw); // throws if the model ignored the schema
  console.log(`\x1b[32mOK\x1b[0m — ${raw}\n`);
}

main().catch((err) => {
  console.error("\n\x1b[31mcheck-llm failed:\x1b[0m", err instanceof Error ? err.message : err);
  process.exit(1);
});
