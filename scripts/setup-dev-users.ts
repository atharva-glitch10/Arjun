/**
 * DEV ONLY — Creates two test users in Supabase and seeds mock data.
 * Run once: npx tsx --env-file=.env.local scripts/setup-dev-users.ts
 *
 * Creates:
 *   Elder:  dev-elder@test.local  / develder123
 *   Family: dev-family@test.local / devfamily123
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey || serviceKey === "your-service-role-key") {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertUser(email: string, password: string) {
  // Check if user already exists
  const { data: existing } = await sb.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);
  if (found) {
    console.log(`  ↩ User ${email} already exists (${found.id})`);
    return found.id;
  }

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email verification
  });
  if (error) throw new Error(`Failed to create ${email}: ${error.message}`);
  console.log(`  ✓ Created ${email} (${data.user.id})`);
  return data.user.id;
}

async function main() {
  console.log("\n🔧  Arjun — dev user setup\n");

  // ── 1. Create auth users ────────────────────────────────────────────────────
  console.log("Creating auth users…");
  const elderId = await upsertUser("dev-elder@test.local", "develder123");
  const familyId = await upsertUser("dev-family@test.local", "devfamily123");

  // ── 2. Make sure the elder row exists ───────────────────────────────────────
  console.log("\nSetting up elder row…");
  let elderRowId: string;

  // Check if elder profile already exists
  const { data: existingProfile } = await sb
    .from("profiles")
    .select("elder_id")
    .eq("id", elderId)
    .maybeSingle();

  if (existingProfile?.elder_id) {
    elderRowId = existingProfile.elder_id;
    console.log(`  ↩ Elder row already exists (${elderRowId})`);
  } else {
    const { data: elder, error: elderErr } = await sb
      .from("elders")
      .insert({
        name: "Dev Elder",
        native_language: "English",
        share_enabled: true,
        share_code: "DEVXXX",
      })
      .select("id")
      .single();
    if (elderErr) throw elderErr;
    elderRowId = elder.id;
    console.log(`  ✓ Elder row created (${elderRowId})`);

    // Elder profile
    await sb.from("profiles").upsert({
      id: elderId,
      role: "elder",
      elder_id: elderRowId,
      display_name: "Dev Elder",
    });
    console.log("  ✓ Elder profile linked");
  }

  // ── 3. Family profile ────────────────────────────────────────────────────────
  const { data: existingFamProfile } = await sb
    .from("profiles")
    .select("id")
    .eq("id", familyId)
    .maybeSingle();

  if (!existingFamProfile) {
    await sb.from("profiles").insert({
      id: familyId,
      role: "family",
      elder_id: elderRowId,
      display_name: "Dev Family",
    });
    console.log("  ✓ Family profile linked");
  } else {
    console.log("  ↩ Family profile already exists");
  }

  // ── 4. Seed 4 past sessions so the family dashboard trend line looks great ──
  console.log("\nSeeding mock conversation history…");
  const { data: existingConvos } = await sb
    .from("conversations")
    .select("id")
    .eq("elder_id", elderRowId)
    .limit(1);

  if (existingConvos && existingConvos.length > 0) {
    console.log("  ↩ Conversations already seeded — skipping");
  } else {
    const now = new Date();
    const sessions = [
      {
        daysAgo: 4,
        summary:
          "Talked about the weather and was looking forward to the weekend. Seemed a bit tired but generally okay.",
        mood: "quiet",
        score: 62,
        energy: 55,
        loneliness: 48,
        concern: 22,
      },
      {
        daysAgo: 3,
        summary:
          "Much more upbeat. Mentioned spending time tending to the tomatoes on the balcony and enjoyed it.",
        mood: "cheerful",
        score: 80,
        energy: 82,
        loneliness: 30,
        concern: 10,
      },
      {
        daysAgo: 2,
        summary:
          "Had a warm conversation. Mentioned family calling over the weekend and the left knee acting up.",
        mood: "warm",
        score: 74,
        energy: 70,
        loneliness: 35,
        concern: 18,
      },
      {
        daysAgo: 1,
        summary:
          "Calm and reflective. Shared memories of making pasta on Sundays with the grandchildren.",
        mood: "wistful",
        score: 78,
        energy: 72,
        loneliness: 38,
        concern: 15,
      },
    ];

    for (const s of sessions) {
      const at = new Date(now);
      at.setDate(at.getDate() - s.daysAgo);
      const iso = at.toISOString();

      const { data: convo } = await sb
        .from("conversations")
        .insert({ elder_id: elderRowId, transcript: [], summary: s.summary, created_at: iso })
        .select("id")
        .single();

      await sb.from("wellness").insert({
        elder_id: elderRowId,
        conversation_id: convo!.id,
        mood: s.mood,
        energy: s.energy,
        loneliness: s.loneliness,
        concern: s.concern,
        score: s.score,
        vitals: { resting_heart_rate: 68, sleep_hours: 7.2, steps: 4500 },
        recommendation:
          "A short call today would go a long way — even just checking in about the week.",
        created_at: iso,
      });
    }

    // Also seed a couple of facts so Arjun has memory on first greeting
    await sb.from("facts").upsert(
      [
        {
          elder_id: elderRowId,
          category: "family",
          key: "grandchild_ravi",
          value: "Has a grandson named Ravi who visits on Sundays and loves pasta.",
        },
        {
          elder_id: elderRowId,
          category: "hobby",
          key: "balcony_tomatoes",
          value: "Tends to tomato plants on the balcony — finds it calming.",
        },
        {
          elder_id: elderRowId,
          category: "health",
          key: "knee_pain",
          value: "Left knee aches when it rains.",
        },
      ],
      { onConflict: "elder_id,category,key" },
    );

    console.log("  ✓ Seeded 4 conversations, wellness scores, and 3 facts");
  }

  // ── 5. Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(56));
  console.log("✅  Dev users ready!\n");
  console.log("  Elder login:  dev-elder@test.local  /  develder123");
  console.log("  Family login: dev-family@test.local /  devfamily123");
  console.log("  Share code:   DEVXXX");
  console.log("\n  Dev bypass (once DEV_BYPASS=true is in .env.local):");
  console.log("  → http://localhost:3000/dev/login?as=elder");
  console.log("  → http://localhost:3000/dev/login?as=family");
  console.log("─".repeat(56) + "\n");
}

main().catch((e) => {
  console.error("\n❌  Setup failed:", e.message);
  process.exit(1);
});
