import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFamilySnapshot } from "@/lib/family";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the dashboard refetches when a session ends. Consent is applied in getFamilySnapshot. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const snapshot = await getFamilySnapshot(session.elder.id);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
