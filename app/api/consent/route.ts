import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * The elder's sharing toggle (prd.md §7). Only the elder can change it — a family member
 * must not be able to turn on visibility into someone else's conversations. That is the
 * whole point of the consent constraint being first-class rather than a checkbox.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "elder") {
    return NextResponse.json(
      { error: "Only the elder can change what is shared." },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.share_enabled !== "boolean") {
    return NextResponse.json({ error: "share_enabled must be a boolean." }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("elders")
    .update({ share_enabled: body.share_enabled })
    .eq("id", session.elder.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ share_enabled: body.share_enabled });
}
