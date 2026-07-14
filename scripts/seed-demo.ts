import { createClient } from "@supabase/supabase-js";
import { mockVitals } from "../lib/agent/wellness";

// Run via: npx tsx scripts/seed-demo.ts <elder_id>

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key === "your-service-role-key") {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or valid SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const elderId = process.argv[2];
  if (!elderId) {
    console.error("Usage: npx tsx scripts/seed-demo.ts <elder_id>");
    console.error("You can find the elder_id in the Supabase 'elders' table.");
    process.exit(1);
  }

  const sb = createClient(url, key);

  console.log(`Seeding demo data for elder: ${elderId}...`);

  // Clear existing data for this elder to avoid duplicates
  await sb.from("facts").delete().eq("elder_id", elderId);
  await sb.from("wellness").delete().eq("elder_id", elderId);
  await sb.from("conversations").delete().eq("elder_id", elderId);

  // Generate dates: 4 days ago, 3 days ago, 2 days ago, 1 day ago
  const now = new Date();
  const dates = [4, 3, 2, 1].map((daysAgo) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  });

  // 1. Insert Facts
  const facts = [
    {
      elder_id: elderId,
      category: "family",
      key: "daughter_sarah",
      value: "Has a daughter named Sarah who calls on Sundays.",
    },
    {
      elder_id: elderId,
      category: "hobby",
      key: "gardening",
      value: "Loves tending to the tomato plants on the balcony.",
    },
    {
      elder_id: elderId,
      category: "health",
      key: "knee_pain",
      value: "Mentioned their left knee aches when it rains.",
    }
  ];
  await sb.from("facts").insert(facts);

  // 2. Insert Conversations
  const convos = [
    {
      elder_id: elderId,
      started_at: dates[0],
      ended_at: dates[0],
      transcript: [], // Mock past transcripts can be empty
      summary: "Talked about the weather and looking forward to the weekend. Sounded a bit tired but generally okay.",
      mood: "quiet",
    },
    {
      elder_id: elderId,
      started_at: dates[1],
      ended_at: dates[1],
      transcript: [],
      summary: "Much more upbeat today. Mentioned spending time on the balcony tending to the tomatoes.",
      mood: "cheerful",
    },
    {
      elder_id: elderId,
      started_at: dates[2],
      ended_at: dates[2],
      transcript: [],
      summary: "Had a nice chat about Sarah calling. Said the left knee was acting up a bit due to the rain.",
      mood: "warm",
    },
    {
      elder_id: elderId,
      started_at: dates[3],
      ended_at: dates[3],
      transcript: [],
      summary: "A very calm conversation. Shared a recipe they used to make when the kids were young.",
      mood: "wistful",
    },
  ];

  for (let i = 0; i < convos.length; i++) {
    const { data: cData, error: cErr } = await sb
      .from("conversations")
      .insert(convos[i])
      .select("id")
      .single();

    if (cErr) throw cErr;

    // 3. Insert Wellness scores corresponding to conversations
    const scores = [65, 80, 75, 78]; // Upward trend
    await sb.from("wellness").insert({
      elder_id: elderId,
      conversation_id: cData.id,
      score: scores[i],
      energy: scores[i] + 5,
      loneliness: 100 - scores[i],
      concern: 20,
      vitals: mockVitals(scores[i] + 5),
      created_at: dates[i],
    });
  }

  console.log("✅ Seed complete! The family dashboard trend line will now look populated.");
}

main().catch(console.error);
