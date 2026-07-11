import { redirect } from "next/navigation";
import { getSession, getUser } from "@/lib/auth";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  // Already onboarded — go where you belong.
  const session = await getSession();
  if (session) redirect(session.role === "elder" ? "/companion" : "/family");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <OnboardingForm />
    </main>
  );
}
