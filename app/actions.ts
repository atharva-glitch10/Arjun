"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ActionState = { error?: string; sent?: boolean };

export async function updateElderLanguage(elderId: string, language: string) {
  const db = supabaseAdmin();
  const { error } = await db.from("elders").update({ native_language: language }).eq("id", elderId);
  if (error) throw new Error(error.message);
}

export async function loginAsElder(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({
    email: "dev-elder@test.local",
    password: "develder123",
  });
  if (error) return { error: error.message };
  redirect("/companion");
}

export async function loginAsFamily(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("share_code") ?? "").trim().toUpperCase();
  if (!code) return { error: "Please enter the share code." };

  const sb = await supabaseServer();
  const { error: signInError } = await sb.auth.signInWithPassword({
    email: "dev-family@test.local",
    password: "devfamily123",
  });
  if (signInError) return { error: signInError.message };

  // Validate the code
  const db = supabaseAdmin();
  const { data: user } = await sb.auth.getUser();
  if (!user.user) return { error: "Authentication failed." };

  const { data: profile } = await db.from("profiles").select("elder_id").eq("id", user.user.id).maybeSingle();
  if (!profile?.elder_id) return { error: "Family profile not linked." };

  const { data: elder } = await db.from("elders").select("share_code").eq("id", profile.elder_id).maybeSingle();
  if (elder?.share_code !== code) {
    await sb.auth.signOut();
    return { error: "Invalid share code." };
  }

  redirect("/family");
}

export async function signOutAction() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}

