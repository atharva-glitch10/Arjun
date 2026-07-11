# Arjun

An AI companion for older adults that **actually remembers** — and turns each conversation
into a calm, non-clinical note for the family, with the elder's consent as a hard constraint.

See [`prd.md`](./prd.md) for the product spec and [`CLAUDE.md`](./CLAUDE.md) for the rules this
codebase is built to.

## The one loop

```
elder talks to Arjun  →  ONE structured LLM call  →  facts UPSERTed into `facts`
                                                  →  one-paragraph `summary`
                                                  →  mood signals + one recommendation
                                                  →  mock vitals + arithmetic wellness score
                                                  →  family dashboard updates live

NEXT SESSION: facts + last summary are loaded back out of Postgres into the system prompt,
so Arjun opens with "Did Ravi's exam go alright?" — unprompted.
```

Memory is **fact retrieval, not semantic search** — no vector DB, no embeddings. Every chat
turn rebuilds the system prompt from Postgres, so recall survives a cold start, a new browser,
or a different device.

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then in the **SQL Editor** paste and
run [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

Under **Authentication → URL Configuration**, add a redirect URL:

```
http://localhost:3000/auth/callback
```

RLS is intentionally **off**: every read and write goes through server route handlers holding
the service-role key, and consent (`elders.share_enabled`) is enforced in application code, in
one place — `lib/family.ts`. The browser never queries these tables directly.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in the Supabase URL, anon key, and service-role key (Project Settings → API), plus your
xAI key from [console.x.ai](https://console.x.ai).

### 3. Pick a model

```bash
npm run check:llm
```

Lists the models your key can actually call, and verifies the one in `XAI_MODEL` honours
`json_schema` structured output — which fact and mood extraction depend on.

### 4. Prove the memory works — before touching the UI

```bash
npm run verify:recall
```

This is the acceptance test from `prd.md` §5. It runs a real conversation through the real
pipeline, ends the session, then loads a **completely fresh context from Postgres** and checks
that Arjun's unprompted greeting recalls a specific detail from the previous session. It also
asserts nothing clinical made it into the summary. It cleans up after itself.

If this fails, nothing else matters — fix it first.

### 5. Run it

```bash
npm run dev
```

## Demo path

1. Sign in at `/login` → choose **Myself** → you land in `/companion`.
2. Talk. Mention something specific — a grandchild's exam, a sore knee.
3. Hit **"I'm done for now"**. You see exactly what will be shared with family *before* it goes
   anywhere. That's the consent beat.
4. In another browser, sign in as family → **Someone in my family** → enter the six-character
   code from the elder's **"What I remember"** panel. The dashboard updates live when a session
   ends.
5. Reload `/companion` and start a fresh session. Arjun opens by recalling what you told it.
   ← the moment that wins

## Layout

| Path | What it does |
|---|---|
| `app/companion` | Elder chat. Streams; shows what Arjun remembers; the share toggle. |
| `app/family` | Dashboard. Mood, summary, one recommendation, trend, mock vitals. |
| `app/api/chat` | One chat turn. Rebuilds the system prompt from Postgres every time. |
| `app/api/session/end` | The pipeline: analyse → save facts → save summary → score → ping. |
| `lib/agent/prompts.ts` | The companion prompt and the analysis prompt. The product lives here. |
| `lib/agent/memory.ts` | `loadElderContext` / `saveFacts`. The memory engine. |
| `lib/agent/guard.ts` | Non-clinical language backstop; nothing clinical reaches the database. |
| `lib/family.ts` | The only path family-facing data takes out of the DB. Consent enforced here. |

## Notes for whoever picks this up

- **Vitals are mocked** and labelled "Simulated" in the UI. Do not wire up a real device.
- **Non-clinical language is a hard rule**, enforced in the prompt *and* in `lib/agent/guard.ts`.
- The dashboard **never** receives `conversations.transcript`. There is no code path for it.
- The live update is a *contentless* Realtime broadcast plus a server refetch, not a
  `postgres_changes` subscription: with RLS off, row payloads would push transcripts to any
  subscriber.
- Schema additions beyond `prd.md` §8 (all additive, no renames): `elders.share_code`,
  the `profiles` table, and a unique index on `facts(elder_id, category, key)` so a
  re-mentioned fact updates in place instead of duplicating.
