"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Two jobs only:
 *   1. auth (magic link sign-in / sign-out),
 *   2. Realtime *broadcast* subscription on channel `elder-<id>`.
 *
 * It deliberately never SELECTs from elders/conversations/facts/wellness — RLS is off,
 * so a browser query would be able to read every elder's transcript. Data comes from
 * server routes that enforce consent.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
