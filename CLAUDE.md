# Arjun

AI companion for older adults. Next.js (App Router) + Supabase. Text-first; voice is an optional stretch layer.

The product is one demo loop: a check-in that recalls a detail from a **previous** session, reads mood, and updates a family dashboard with a summary + one recommendation. Optimize for that loop working end-to-end, not for feature breadth.

## Architecture
- `/app/companion` — elder-facing chat UI.
- `/app/family` — family dashboard. Reads `wellness` + `conversations.summary`; subscribes to new `wellness`/`conversations` inserts via Supabase Realtime.
- `/app/api/*` — agent route handlers: chat turn, memory extraction, mood scoring, wellness compute.
- Supabase = Postgres + auth + realtime. Server routes use the service-role key; do not build client-side RLS for the MVP.
- Single app, single deploy. Do NOT add a separate FastAPI service.

## Memory model (the core product — get this right)
After each conversation: (1) extract structured facts into `facts` (category ∈ family|health|hobby|date|preference|event), (2) write a one-paragraph `summary`. Next session, load that elder's facts + last summary into the system prompt.
- This is **fact retrieval, not semantic search**. Do NOT add a vector DB or embeddings.
- Recall must be genuinely persisted across separate sessions. Before any UI work, verify: end session → new session → agent recalls a fact given in the prior session.

## Schema contract (do not rename columns without flagging)
Tables: `elders(id, name, native_language, share_enabled)`, `conversations(id, elder_id, transcript jsonb, summary, created_at)`, `facts(id, elder_id, category, key, value, updated_at)`, `wellness(id, elder_id, mood, energy, loneliness, concern, vitals jsonb, score, recommendation, created_at)`.
The agent writes `conversations`, `facts`, `wellness`. The dashboard reads them.

## Mood & health
- One structured LLM call per conversation returns JSON: mood, energy, loneliness, concern (0–100).
- Wellness score = simple arithmetic over mood + mock vitals. No ML.
- Use enforced structured output (tool use / json_schema), not "please return JSON".

## Hard rules
- **Non-clinical language only.** "mood signal", "engagement", "concern" — NEVER "depression indicator", "cognitive decline", or any diagnostic claim.
- **Vitals are mocked.** Do not integrate HealthKit / Google Fit.
- **Elder consent is first-class.** Respect `share_enabled`; dashboard shows summaries/signals, not raw transcript, unless opted in.
- Recommendations push toward human contact; Arjun supplements relationships, never replaces them.

## Out of scope (mock or stub only)
Phone/smartphone assistant, real wearables, emergency escalation, voice in the core loop, vector search.

## Voice (optional stretch only)
If added: OpenAI Realtime `gpt-realtime-2`, browser WebRTC, ephemeral client secret minted server-side (never expose the real key to the browser). Voice session is client-side WebRTC, not through a Vercel function. Memory + mood pipeline runs on the emitted transcript, unchanged from the text path.

## Conventions
- Run `npm run build` before committing.
- Keep agent logic in route handlers under `/app/api`.
- One LLM provider for extraction + mood; don't maintain two schemas.