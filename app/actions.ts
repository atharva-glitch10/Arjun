"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type ActionState = { error?: string; sent?: boolean };

export async function updateElderLanguage(elderId: string, language: string) {
  const db = supabaseAdmin();
  const { error } = await db.from("elders").update({ native_language: language }).eq("id", elderId);
  if (error) throw new Error(error.message);
}
