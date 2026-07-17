import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.role === "elder" ? "/companion" : "/family");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full animate-rise">
        <p className="text-d-eyebrow font-medium uppercase text-clay-700">Arjun</p>

        <h1 className="mt-4 text-4xl sm:text-5xl font-semibold leading-tight text-ink-900">
          A companion that actually remembers.
        </h1>

        <p className="mt-6 text-e-lead text-ink-700">
          Arjun talks with your parent and remembers what matters — the exam, the sore knee, the
          neighbour who moved away. Next time, it asks how the exam went. Their family gets a
          short, kind note about how they seem. Not a medical chart.
        </p>

        <Link
          href="/login"
          className="mt-10 inline-flex min-h-[56px] items-center justify-center rounded-control bg-clay-700 px-8 py-4 text-e-body font-medium text-white transition-colors duration-[--duration-hover] hover:bg-clay-800"
        >
          Get started
        </Link>

        {/*
          The honest positioning. A judge will know ElliQ exists; claiming we invented elder
          companionship loses the room in one sentence. Name the competition, then say what is
          actually ours: the memory is specific, and consent gates the family layer.
        */}
        <dl className="mt-12 space-y-5 border-t border-sand-200 pt-8">
          <div>
            <dt className="text-d-body font-medium text-ink-900">
              Companions for older adults already exist.
            </dt>
            <dd className="mt-1 text-d-body text-ink-700">
              ElliQ is the best known. What they mostly don&apos;t do is carry a specific detail
              from one conversation into the next one, days later.
            </dd>
          </div>
          <div>
            <dt className="text-d-body font-medium text-ink-900">Arjun does that.</dt>
            <dd className="mt-1 text-d-body text-ink-700">
              And it turns those conversations into one low-friction signal for the family — a
              note and a nudge, not a dashboard to monitor.
            </dd>
          </div>
          <div>
            <dt className="text-d-body font-medium text-ink-900">
              Nothing reaches family without consent.
            </dt>
            <dd className="mt-1 text-d-body text-ink-700">
              Sharing is off until the person using Arjun turns it on, they can see exactly what
              is shared, and they can turn it off again whenever they like. Family never sees the
              words — only a summary.
            </dd>
          </div>
        </dl>

        <p className="mt-8 text-d-meta text-ink-500">
          Arjun supplements relationships. It is not built to replace a phone call, and every
          suggestion it makes points back toward one.
        </p>
      </div>
    </main>
  );
}
