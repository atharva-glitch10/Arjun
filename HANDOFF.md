# Handoff

You're picking up **Arjun**: an AI companion for older adults that remembers them across
sessions, reads mood from each conversation, and gives their family a calm, non-clinical note
with one recommendation.

Read [`prd.md`](./prd.md) for *why*, [`CLAUDE.md`](./CLAUDE.md) for the rules the code is built
to, and [`README.md`](./README.md) for setup. This file is the current state and what's left.

---

## 1. Where things actually stand

The full loop is **written and compiling, but has never run against a real database or a real
model.** Nobody has typed a message to Arjun yet. Treat every claim below as "implemented,
unverified" until `npm run verify:recall` passes.

| Area | State |
|---|---|
| Schema + migration | Written. **Not yet run against a Supabase project.** |
| Chat turn (streaming, memory injected) | Written, unverified |
| Fact extraction + summary + mood (one structured call) | Written, unverified |
| Wellness score + mock vitals | Written, unverified |
| Family dashboard + live update | Written, unverified |
| Magic-link auth + onboarding + share-code linking | Written, unverified |
| Consent toggle + non-clinical guard | Written, unverified |
| Voice (ElevenLabs) | **Not built.** Stretch only. |

**Nothing here is scripted or faked.** If recall appears to work, it's because the fact came
back out of Postgres. That is also why it might simply not work yet — find out before building
anything new.

---

## 2. First 20 minutes (do this before writing any code)

1. **Supabase project** → SQL Editor → paste and run
   [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).
2. Authentication → URL Configuration → add redirect `http://localhost:3000/auth/callback`.
3. `cp .env.example .env.local`, fill in the three Supabase values + `GROQ_API_KEY`.
4. `npm install && npm run check:llm`
   → lists the models your key can call and proves the configured one can be forced into
   structured output. If `qwen/qwen3-32b` isn't in the list, set `GROQ_MODEL` to one that is.
5. `npm run verify:recall`
   → **the acceptance test.** Runs a conversation, ends the session, loads a *completely fresh*
   context from Postgres, and asserts Arjun's unprompted greeting recalls a specific detail
   from the previous session. Cleans up after itself.

**If step 5 fails, fix it before touching anything else.** It is the entire product. A shallow
demo of six features loses to a complete demo of one.

---

## 3. The thing that must not be misunderstood

**Memory is fact retrieval, not semantic search.** No vector DB, no embeddings. After each
conversation, one structured LLM call extracts facts into the `facts` table; next session those
rows plus the last summary are pasted into the system prompt. That's it. That's the whole
engine.

It works because of two unglamorous details:

- **Every chat turn rebuilds the system prompt from Postgres.** Nothing is cached in module
  scope. That's what makes recall survive a cold serverless start, a new browser, or a judge
  picking up a different laptop.
- **Facts UPSERT on `(elder_id, category, key)`.** Mention Ravi again next week and the fact
  *updates*. Without that unique index you get seven near-identical rows about Ravi and the
  system prompt turns to soup by session five.

---

## 4. Map

| Path | What it is |
|---|---|
| `lib/agent/prompts.ts` | The companion prompt + the analysis prompt. **The product lives here.** If recall feels robotic, fix it here, not in the UI. |
| `lib/agent/memory.ts` | `loadElderContext` / `saveFacts`. The memory engine. |
| `lib/agent/analyze.ts` | The one structured call: facts + summary + mood + recommendation. |
| `lib/agent/wellness.ts` | Mock vitals + arithmetic score. No ML, by design. |
| `lib/agent/guard.ts` | Non-clinical language backstop. |
| `lib/llm.ts` | Groq/Qwen. Reasoning-tag suppression + structured-output fallback. |
| `lib/family.ts` | The **only** path family-facing data leaves the DB. Consent enforced here. |
| `app/api/chat` | One chat turn. Streams. |
| `app/api/session/end` | The pipeline: analyse → facts → summary → score → ping dashboard. |
| `app/companion` | Elder chat, "what I remember" panel, share toggle. |
| `app/family` | Dashboard: mood, summary, recommendation, trend, mock vitals. |
| `scripts/verify-recall.ts` | The acceptance test. Run it often. |

---

## 5. Four decisions you'd otherwise undo by accident

**Consent is enforced in one place, on the server.** `lib/family.ts` never selects
`conversations.transcript`. There is no code path that sends an elder's actual words to their
children. If you add one, you've broken the ethical premise the pitch rests on (`prd.md` §7).

**The live update is a contentless broadcast, not `postgres_changes`.** RLS is off (CLAUDE.md
says so — service-role on the server instead). If you subscribe the browser to row inserts, you
push whole rows — transcripts included — to any listener. Instead the server pings
`elder-<id>` with just a timestamp and the dashboard refetches through the API, where consent is
applied. A 15s poll sits behind it so a dropped socket can't cost you the demo.

**Non-clinical language is enforced twice** — in the analysis prompt *and* in `lib/agent/guard.ts`,
which scrubs anything diagnostic before it is persisted. A prompt is not a guarantee, and a
chatbot writing "shows signs of depression" into a row a worried daughter reads is the worst
thing this product could do.

**Qwen is a reasoning model.** It emits `<think>` blocks. They're suppressed at the source,
stripped defensively, and filtered mid-stream in `/api/chat` (with a state machine, because a
tag can split across two chunks). If you swap models or refactor the stream, keep this — an
older adult must never watch the companion reason about her out loud.

---

## 6. Schema contract

`elders`, `conversations`, `facts`, `wellness` are exactly as specified in `prd.md` §8. **Do not
rename a column without telling the other person.** The agent writes; the dashboard reads.

Three **additive** changes were made (no renames, no removals):

- `elders.share_code` — six characters. How a family member links to an elder. Real auth needs
  *some* join key, and "ask Mum for her code" is a better consent story than an invite email.
- `profiles` — maps `auth.users` → `(role, elder_id)`. Required by magic-link auth.
- unique index on `facts(elder_id, category, key)` — the UPSERT target. See §3.

---

## 7. TODO

### P0 — prove the loop (nothing else matters until these are done)

- [ ] Run the migration against a real Supabase project
- [ ] `npm run check:llm` passes; `GROQ_MODEL` set to a model the key can actually call
- [ ] `npm run verify:recall` passes end to end
- [ ] Do it by hand too: sign in → talk → "I'm done for now" → **reload** → Arjun opens by
      recalling what you said. This is the moment that wins the demo; it must be boring and
      repeatable, not lucky.
- [ ] Give the agent a **brand-new** fact live, end, reopen, confirm it recalls that one too
      (`prd.md` §5 — a judge will try exactly this)
- [ ] Two browsers: elder + family. Confirm the dashboard updates **without a refresh** when a
      session ends.

### P1 — make it survive contact with a judge

- [ ] Tune `lib/agent/prompts.ts` so recall lands *naturally* ("Did Ravi's exam go alright?")
      rather than as a recital ("According to my records…"). Read the transcripts; this is
      prompt work, and it's the difference between charming and creepy.
- [ ] Check fact **key stability**: mention the same thing across three sessions, confirm you
      get one updated row and not three. If keys drift, tighten the key guidance in the
      analysis prompt.
- [ ] Empty/short conversation: "I'm done" after one word shouldn't manufacture a mood.
      (Guarded — verify it.)
- [ ] Sad/withdrawn conversation: check `concern` moves, the recommendation still pushes toward
      *human contact*, and **nothing clinical** appears anywhere. This is the risky path.
- [ ] Consent path: elder turns sharing **off** → family dashboard shows "sharing is paused" and
      no data. Turn it back on → data returns.
- [ ] Error states: kill the Groq key mid-demo. Does the UI say something human, or explode?
- [ ] Deploy to Vercel; set `NEXT_PUBLIC_SITE_URL` and add the deployed
      `/auth/callback` to Supabase's redirect URLs (magic links break otherwise).

### P2 — polish worth having

- [ ] Seed a demo elder with 3–4 sessions of history so the trend line isn't a single dot
- [ ] Mobile: the companion is what an older adult would use on a phone. Check tap targets.
- [ ] Loading/empty states on the dashboard before the first conversation exists

### P3 — stretch, only if P0 and P1 are fully done

- [ ] **Voice (ElevenLabs speech-to-speech).** Signed URL minted server-side; the API key never
      reaches the browser. The session runs client-side, *not* through a Vercel function — a
      serverless timeout would kill it. Run the **same** memory + mood pipeline on the emitted
      transcript: a second input surface, never a second pipeline.
- [ ] Life Story Engine (`prd.md` §14) — reuses extract → store → display, no new infrastructure

### Do not build

Phone/smartphone assistant. Real wearables (vitals are **mocked**, labelled "Simulated" in the
UI — keep it that way). Emergency escalation. Vector search. A separate FastAPI service.

---

## 8. Demo script

1. Open the companion. Short conversation; mention something specific.
2. End the session — the elder sees exactly what will be shared *before* it's shared. That's
   the consent beat, and it's worth pausing on.
3. Show the dashboard updating live: mood, summary, wellness, one recommendation.
4. **Start a fresh session. Arjun recalls the detail unprompted.** ← the moment that wins
5. Let a judge give it a new fact. End. Reopen. It remembers. ← survives probing
6. One line on the elder's share toggle. One honest line on ElliQ (`prd.md` §4 — don't claim
   there are no competitors; a judge will call it, and we lose the room).

Target: the whole loop, end to end, under three minutes, with no fallback.
