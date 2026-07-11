import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFamilySnapshot } from "@/lib/family";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const snapshot = await getFamilySnapshot(session.elder.id);

  return <Dashboard initial={snapshot} elderId={session.elder.id} viewerRole={session.role} />;
}
