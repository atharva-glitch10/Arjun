import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.role === "elder" ? "/companion" : "/family");

  const user = await getUser();
  if (user) redirect("/onboarding");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full animate-rise">
        <p className="text-sm font-medium uppercase tracking-widest text-clay-600">Arjun</p>

        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold leading-tight text-ink-900">
          A companion that actually remembers.
        </h1>

        <p className="mt-6 text-xl leading-relaxed text-ink-700">
          Arjun talks with your parent and remembers what matters — the exam, the sore knee,
          the neighbour who moved away. Their family gets a short, kind note about how they
          seem. Not a medical chart.
        </p>

        <Link
          href="/login"
          className="mt-10 inline-flex items-center justify-center rounded-2xl bg-clay-500 px-8 py-4 text-lg font-medium text-white transition hover:bg-clay-600"
        >
          Get started
        </Link>

        <p className="mt-8 text-base leading-relaxed text-ink-500">
          Nothing reaches family unless the person using Arjun turns sharing on — and they can
          turn it off whenever they like.
        </p>
      </div>
    </main>
  );
}
