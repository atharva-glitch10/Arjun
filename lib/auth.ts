import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Elder, Role } from "@/lib/types";

export type Session = {
  userId: string;
  email: string | null;
  role: Role;
  elder: Elder;
};

/** The mock signed-in user, which forces the app to use a single default elder. */
export async function getSession(): Promise<Session | null> {
  const db = supabaseAdmin();
  
  // Try to find the first elder
  let { data: elder } = await db
    .from("elders")
    .select("*")
    .limit(1)
    .maybeSingle();

  // If no elder exists, create a default one
  if (!elder) {
    const { data: newElder, error } = await db
      .from("elders")
      .insert({
        name: "Test Elder",
        native_language: "English",
        share_enabled: true,
        share_code: generateShareCode(),
      })
      .select("*")
      .single();
      
    if (error) {
      console.error("Failed to create default elder:", error);
      return null;
    }
    elder = newElder;
  }

  return {
    userId: "mock-user-id",
    email: "mock@example.com",
    role: "elder",
    elder: elder as Elder,
  };
}

/** Just the mock auth user */
export async function getUser() {
  return { id: "mock-user-id", email: "mock@example.com" };
}

/** Unambiguous characters only — this gets read aloud over the phone. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateShareCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join("");
}
