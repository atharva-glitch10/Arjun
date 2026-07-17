import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadElderContext } from "@/lib/agent/memory";
import Companion from "./companion";

export const dynamic = "force-dynamic";

export default async function CompanionPage() {
  const session = await getSession();
  if (!session) redirect("/");

  // Only used to show the elder what Arjun remembers — the agent loads its own context
  // server-side on every turn.
  const ctx = await loadElderContext(session.elder.id);

  return (
    <Companion
      elderId={session.elder.id}
      elderName={session.elder.name ?? "friend"}
      nativeLanguage={session.elder.native_language ?? "English"}
      shareCode={session.elder.share_code ?? ""}
      shareEnabled={session.elder.share_enabled}
      facts={ctx.facts.map((f) => ({ category: f.category, key: f.key, value: f.value }))}
    />
  );
}
