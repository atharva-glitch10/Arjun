import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Elder, Role } from "@/lib/types";

export type Session = {
  userId: string;
  email: string | null;
  role: Role;
  elder: Elder;
};

/** The signed-in user, resolved to a role and an elder. Null if not signed in. */
export async function getSession(): Promise<Session | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const db = supabaseAdmin();
  const { data: profile } = await db
    .from("profiles")
    .select("role, elder_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.elder_id) return null; // signed in, but not onboarded yet

  const { data: elder } = await db
    .from("elders")
    .select("*")
    .eq("id", profile.elder_id)
    .maybeSingle();

  if (!elder) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role as Role,
    elder: elder as Elder,
  };
}

/** Just the auth user — used by onboarding, which runs *before* a profile exists. */
export async function getUser() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}

/** Unambiguous characters only — this gets read aloud over the phone. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateShareCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join("");
}
