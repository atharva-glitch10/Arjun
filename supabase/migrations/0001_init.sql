-- Arjun — initial schema.
-- Implements the schema contract in prd.md §8 verbatim, plus three ADDITIVE changes
-- (no contract column was renamed or removed):
--
--   1. elders.share_code   — 6-char code an elder gives family so they can link. Needed
--                            because we shipped real auth; there is otherwise no way for a
--                            family member's account to find the elder's account.
--   2. profiles            — maps auth.users -> (role, elder_id). Required by magic-link auth.
--   3. facts unique(elder_id, category, key)
--                          — lets extraction UPSERT a fact instead of appending a duplicate
--                            row every session. Without it, "grandson's name" accumulates
--                            once per conversation and the system prompt fills with dupes.
--
-- RLS is intentionally DISABLED (CLAUDE.md: "Server routes use the service-role key; do not
-- build client-side RLS for the MVP"). All reads/writes go through server route handlers that
-- hold the service-role key and enforce consent (elders.share_enabled) in application code.
-- The browser never queries these tables directly — see supabase/README.md.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- elders
-- ---------------------------------------------------------------------------
create table if not exists elders (
  id uuid primary key default gen_random_uuid(),
  name text,
  native_language text default 'English',
  share_enabled boolean default true,          -- elder's consent toggle (prd.md §7)
  share_code text unique,                      -- ADDITIVE: family links via this code
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- profiles — ADDITIVE: auth.users -> elder + role
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('elder', 'family')),
  elder_id uuid references elders(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);
create index if not exists profiles_elder_id_idx on profiles (elder_id);

-- ---------------------------------------------------------------------------
-- conversations — one row per completed session. Agent writes; dashboard reads summary.
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid references elders(id) on delete cascade,
  transcript jsonb,                            -- [{role, content}]
  summary text,                                -- one-paragraph recap (agent writes)
  created_at timestamptz default now()
);
create index if not exists conversations_elder_created_idx
  on conversations (elder_id, created_at desc);

-- ---------------------------------------------------------------------------
-- facts — THE MEMORY STORE. Loaded into the system prompt on the next session.
-- ---------------------------------------------------------------------------
create table if not exists facts (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid references elders(id) on delete cascade,
  category text check (category in ('family', 'health', 'hobby', 'date', 'preference', 'event')),
  key text,
  value text,
  updated_at timestamptz default now()
);
-- ADDITIVE: the upsert target. Re-mentioning a fact updates it in place.
create unique index if not exists facts_elder_category_key_uniq
  on facts (elder_id, category, key);
create index if not exists facts_elder_updated_idx on facts (elder_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- wellness — mood signals + mock vitals + score + one recommendation.
-- ---------------------------------------------------------------------------
create table if not exists wellness (
  id uuid primary key default gen_random_uuid(),
  elder_id uuid references elders(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete cascade,
  mood text,                                   -- non-clinical label, e.g. "warm", "quiet"
  energy int check (energy between 0 and 100),
  loneliness int check (loneliness between 0 and 100),
  concern int check (concern between 0 and 100),
  vitals jsonb,                                -- MOCK for MVP (prd.md §2)
  score int check (score between 0 and 100),
  recommendation text,                         -- pushes toward human contact (prd.md §7)
  created_at timestamptz default now()
);
create index if not exists wellness_elder_created_idx
  on wellness (elder_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Realtime.
-- The dashboard does NOT subscribe to postgres_changes: with RLS off, row payloads
-- (including conversations.transcript) would be pushed to any subscriber, which breaks the
-- consent rule in prd.md §7. Instead the server broadcasts a contentless "session ended"
-- ping on channel `elder-<id>` and the dashboard refetches through a server route that
-- enforces share_enabled. Nothing to configure here — broadcast needs no publication.
-- ---------------------------------------------------------------------------
