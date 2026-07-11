"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUser, generateShareCode } from "@/lib/auth";

export type ActionState = { error?: string; sent?: boolean };

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Magic link. No passwords for a user who may not want to manage one. */
export async function sendMagicLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Please enter your email." };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  });

  if (error) return { error: error.message };
  return { sent: true };
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}

/** Elder onboarding: create their elder row + a share code for the family to link with. */
export async function createElderProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in again." };

  const name = String(formData.get("name") ?? "").trim();
  const language = String(formData.get("native_language") ?? "English").trim();
  if (!name) return { error: "Please enter your name." };

  const db = supabaseAdmin();

  const { data: elder, error: elderErr } = await db
    .from("elders")
    .insert({
      name,
      native_language: language || "English",
      share_enabled: true,
      share_code: generateShareCode(),
    })
    .select("id")
    .single();

  if (elderErr || !elder) return { error: elderErr?.message ?? "Could not create profile." };

  const { error: profileErr } = await db.from("profiles").insert({
    id: user.id,
    role: "elder",
    elder_id: elder.id,
    display_name: name,
  });

  if (profileErr) return { error: profileErr.message };

  redirect("/companion");
}

/** Family onboarding: link to an elder using the code the elder gave them. */
export async function linkFamilyProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in again." };

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("share_code") ?? "")
    .trim()
    .toUpperCase();

  if (!code) return { error: "Enter the code from your family member." };

  const db = supabaseAdmin();

  const { data: elder } = await db
    .from("elders")
    .select("id")
    .eq("share_code", code)
    .maybeSingle();

  if (!elder) {
    return { error: "That code doesn't match anyone. Check it and try again." };
  }

  const { error } = await db.from("profiles").insert({
    id: user.id,
    role: "family",
    elder_id: elder.id,
    display_name: name || null,
  });

  if (error) return { error: error.message };

  redirect("/family");
}
