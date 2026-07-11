# Arjun — Product Requirements & Project Spec

**Version:** 0.1 (hackathon MVP)
**Owners:** Veerbhadra + 1
**Status:** Build

---

## 1. One-line definition

Arjun is an AI companion for older adults: a conversational agent that remembers the person across sessions, reads mood from each conversation, and gives their family a calm daily summary instead of raw medical data.

## 2. What we are actually building (and what we are not)

This is a hackathon MVP. The vision is large; the build is one loop. We are optimizing for a single convincing demo narrative, not breadth. A shallow demo of six features loses to a complete demo of one.

**The one loop we demo:**
A morning check-in that (a) recalls something specific from a *previous* session, (b) reads the person's mood, and (c) produces a family-facing summary with one recommendation — updating the family dashboard live.

### In scope
- Conversational agent with a fixed companion persona (text-first).
- **Cross-session memory** via structured fact extraction + a per-conversation summary. This is the core product.
- Per-conversation mood/engagement scoring (JSON).
- Wellness score combining mood + *mock* vitals.
- Family dashboard: today's mood, conversation summary, wellness score, one recommendation, a mood trend line, live update on new conversation.

### Out of scope (mock or stub if referenced)
- **Phone/smartphone assistant.** Hard on real devices (no third-party WhatsApp read API, Netflix/cab control needs accessibility hacks or is impossible on iOS), low demo payoff on a web build. If a judge asks, one faked action, clearly labelled.
- **Real wearable integration** (HealthKit / Google Fit). Vitals are mocked. Zero demo payoff for real integration.
- **Emergency escalation.** Describe the design; don't build it.
- **Voice** in the core loop. Optional demo layer only (see §9).
- **Vector DB / embeddings.** Memory is fact retrieval, not semantic search — see §5.

## 3. Users

**Primary — older adult (60+).** Lives alone or semi-independently. Wants conversation and light structure; finds most apps hard. Interacts by talking/typing to one thing, not navigating menus.

**Secondary — family member.** Wants reassurance without a medical dashboard. Reads a summary, not charts. Acts on a nudge ("she mentioned missing everyone — a call this weekend would land well").

## 4. Positioning (be honest about this)

"Daily emotional companionship for elders" is **not** an empty field. ElliQ (Intuition Robotics) is a deployed AI companion aimed at exactly this user, and companion memory is now commodity across consumer AI. The original vision doc claimed "very few focus on daily companionship" — that claim is wrong and a judge will probe it.

Our defensible angle is not "we invented elder companionship." It is: **the memory is specific and persistent, and the family layer turns private conversation into a low-friction care signal — with the elder's consent as a first-class constraint, not an afterthought.** Study ElliQ before the pitch so the comparison is ours to frame, not the judge's.

## 5. The memory engine (the thing that must actually work)

After each conversation:
1. **Extract** structured facts into a `facts` table (family, health mentions, hobbies, dates, ongoing events, preferences).
2. **Summarize** the conversation into one paragraph.

Next session, load the person's facts + the last summary into the system prompt. That is what produces *"You mentioned your grandson's exam yesterday — how did it go?"*

**Why not vector search:** the compelling demo moment is precise fact recall, not fuzzy similarity. Injecting extracted structured facts into context is more reliable and more impressive than embedding retrieval, which recalls vaguely. No vector DB.

**Demo-critical acceptance test:** close the session, reopen, give the agent a *new* fact, and confirm it recalls it in the next session. Judges will try this live. If recall is scripted rather than genuinely persisted, the whole pitch collapses. Prove this end-to-end **before** any UI polish.

## 6. Health, mood & the language rule

- One structured LLM call per conversation returns mood, energy, loneliness, concern (0–100) as JSON.
- Combine with mock vitals into a wellness score (simple arithmetic — no ML needed).
- **Language rule:** all mood/health output is non-clinical. "Mood signal", "engagement", "concern level" — never "depression indicator", "cognitive decline", or any diagnostic claim. Inferring clinical conditions in a vulnerable population and surfacing them to family is a liability and a research problem, not an MVP feature.

## 7. Consent & the surveillance tension (product principle, not legalese)

The family dashboard reports on private conversations. "Mom spoke happily about gardening" is a summary of something she said in confidence. This is the ethical crux and a likely judge question.

- **Elder consent is required and visible**, separate from family consent. The elder can see what's shared and turn sharing off.
- The dashboard shows *summaries and signals*, never raw transcript, unless the elder opts in.
- Design principle to protect throughout: **strengthen the relationship, don't replace it.** Watch the failure mode where the elder confides in Arjun and calls family *less*. Recommendations should push toward human contact, not substitute for it.

## 8. Data model (the schema contract)

This is the seam between the two builders. The agent **writes**; the dashboard **reads**. Lock this before writing feature code. No column renames without telling the other person.

```sql
create table elders (
  id uuid primary key default gen_random_uuid(),
  name text, native_language text,
  share_enabled boolean default true,   -- elder's consent toggle
  created_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid references elders(id),
  transcript jsonb,              -- [{role, content}]
  summary text,                  -- one-paragraph recap (agent writes)
  created_at timestamptz default now()
);

create table facts (             -- the memory store
  id uuid primary key default gen_random_uuid(),
  elder_id uuid references elders(id),
  category text,                 -- family|health|hobby|date|preference|event
  key text, value text,
  updated_at timestamptz default now()
);

create table wellness (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid references elders(id),
  mood text, energy int, loneliness int, concern int,  -- 0-100
  vitals jsonb,                  -- MOCK for MVP
  score int, recommendation text,
  created_at timestamptz default now()
);
```

## 9. Architecture

Single Next.js app (App Router). No separate FastAPI service for the MVP — one deploy, one repo, no CORS, no cross-service auth. Peel out Python later only if a Python-only lib forces it (it won't, for this scope).

- `/app/companion` — elder-facing chat.
- `/app/family` — family dashboard (reads `wellness` + `conversations.summary`, subscribes to live inserts via Supabase Realtime).
- `/app/api/*` — agent: chat turn, memory extraction, mood scoring, wellness compute.
- Supabase: Postgres + auth + realtime.
- Server route handlers use the service-role key; skip client-side RLS wrangling for the hackathon.

**Optional voice layer (stretch, not the spine):** OpenAI Realtime speech-to-speech (`gpt-realtime-2`), browser WebRTC, ephemeral client secret minted server-side (never ship the real key to the browser). The voice session runs client-side over WebRTC — not through a Vercel function (serverless timeout would kill it). The memory + mood pipeline is unchanged: it runs on the transcript the Realtime session emits, exactly as in the text path.

## 10. Ownership split

Meet at the schema contract (§8); otherwise work independently.

- **Veerbhadra — agent half:** chat orchestration, memory extraction, summary, mood JSON, wellness compute, (optional) voice layer.
- **Partner — product half:** family dashboard, data layer wiring, realtime subscription, mock vitals generator, elder/family auth.

## 11. Demo script (what we show judges)

1. Open companion. Have a short conversation; mention a specific detail (e.g. a grandchild's exam, a hobby).
2. End session. Show the dashboard updating live: mood, summary, wellness, recommendation.
3. **Start a fresh session.** Agent recalls the detail unprompted. ← the moment that wins.
4. Judge gives the agent a new fact; we end and reopen; it remembers. ← survives probing.
5. One line on consent (elder's share toggle) and one on the honest ElliQ comparison.

## 12. Success criteria

- Memory recall works across genuinely separate sessions, including a fact given live (§5 test).
- Dashboard updates without refresh when a conversation ends.
- Mood JSON is stable and non-clinical.
- The demo runs the full loop end-to-end in under 3 minutes without a fallback.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Memory recall is faked / not truly persisted | Prove §5 test first, before UI. This is the whole product. |
| Voice eats the schedule | Voice is optional; text loop must stand alone. |
| "No competitors" claim gets challenged | Frame the ElliQ comparison ourselves (§4). |
| Clinical language creates liability | Non-clinical rule (§6), enforced in prompts + CLAUDE.md. |
| Surveillance objection | Elder consent toggle + summaries-not-transcripts (§7). |
| Two builders block each other | Schema contract locked hour one (§8). |

## 14. Post-hackathon (not now)

Life Story Engine (best next feature — reuses the extract→store→display pipeline as a "tell me about when you were young" mode), caregiver/doctor portals, real wearables, voice emotion cues, weekly reports. All must serve the §7 principle: make the elder feel understood and less alone while helping family care thoughtfully from a distance.