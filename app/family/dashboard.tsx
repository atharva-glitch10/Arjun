"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { elderChannel, SESSION_ENDED } from "@/lib/realtime";
import { scoreBand } from "@/lib/agent/wellness";
import type { FamilySnapshot } from "@/lib/family";
import type { Role } from "@/lib/types";

export default function Dashboard({
  initial,
  elderId,
  viewerRole,
}: {
  initial: FamilySnapshot;
  elderId: string;
  viewerRole: Role;
}) {
  const [snap, setSnap] = useState(initial);

  /**
   * A new note must never appear under someone's eyes while they're mid-sentence.
   *
   * When a conversation ends we hold the new snapshot HERE, show a quiet banner, and let the
   * reader decide when to take it. Silently swapping the summary a daughter is reading —
   * about her mother — is the difference between a note from someone who cares and a
   * surveillance feed that refreshes itself. We are building the first one.
   */
  const [pending, setPending] = useState<FamilySnapshot | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/family/snapshot", { cache: "no-store" });
      if (!res.ok) return;
      const next: FamilySnapshot = await res.json();

      setSnap((prev) => {
        const changed = next.latest?.at !== prev.latest?.at;

        // Nothing on screen to disturb yet (first ever note, or sharing state flipped):
        // apply it straight away — there is no reading being interrupted.
        if (!changed || !prev.latest) {
          setPending(null);
          return next;
        }

        setPending(next);
        return prev; // hold. The reader is mid-note.
      });
    } catch {
      // Offline for a moment; the poll will try again.
    }
  }, []);

  function acceptUpdate() {
    if (!pending) return;
    setSnap(pending);
    setPending(null);
    // Send the reader to the thing that changed, rather than making them hunt for it.
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  useEffect(() => {
    // Live path: the server pings this channel when a conversation ends. The ping carries no
    // content — we refetch through the API, which is where consent is enforced.
    const sb = supabaseBrowser();
    const channel = sb
      .channel(elderChannel(elderId))
      .on("broadcast", { event: SESSION_ENDED }, () => void refetch())
      .subscribe();

    // Safety net so a dropped socket can't cost us the demo.
    const poll = setInterval(() => void refetch(), 15_000);

    return () => {
      void sb.removeChannel(channel);
      clearInterval(poll);
    };
  }, [elderId, refetch]);

  const name = snap.elder.name ?? "Your family member";

  return (
    <div className="flex-1">
      <header className="border-b border-sand-200 bg-sand-100/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-d-eyebrow font-medium uppercase text-clay-700">Arjun</p>
            <h1 className="text-d-title font-semibold text-ink-900">{name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-d-meta text-ink-500">
              <span className="h-2 w-2 rounded-full bg-sage-600" aria-hidden="true" />
              Live
            </span>
            <form action={signOut}>
              <button className="text-d-body text-ink-700 hover:text-ink-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        {pending && <NewNoteBanner onRead={acceptUpdate} name={name} />}

        {!snap.sharing ? (
          <SharingPaused name={name} viewerRole={viewerRole} />
        ) : !snap.latest ? (
          <Empty name={name} />
        ) : (
          <>
            <TodayCard snap={snap} name={name} headingRef={headingRef} />
            <RecommendationCard text={snap.latest.recommendation} name={name} />
            <SignalsCard snap={snap} />
            {snap.trend.length > 1 && <TrendCard trend={snap.trend} />}
            <VitalsCard snap={snap} />
          </>
        )}
      </main>
    </div>
  );
}

/**
 * The arrival. Announced politely (never "assertive" — this is not an emergency, and a rude
 * live region that interrupts a screen reader mid-sentence would be exactly the "surveillance
 * feed" posture we're designing against). The reader takes the update when they're ready.
 */
function NewNoteBanner({ onRead, name }: { onRead: () => void; name: string }) {
  return (
    <div
      aria-live="polite"
      className="animate-arrive flex flex-wrap items-center justify-between gap-3 rounded-card bg-sage-100 px-6 py-4 ring-1 ring-sage-600/25"
    >
      <p className="text-d-body text-sage-800">
        {`${name} just finished a conversation. There’s a new note.`}
      </p>
      <button
        onClick={onRead}
        className="rounded-control bg-sage-800 px-5 py-2 text-d-body font-medium text-white transition-colors duration-[--duration-hover] hover:bg-ink-900"
      >
        Read it
      </button>
    </div>
  );
}

function SharingPaused({ name, viewerRole }: { name: string; viewerRole: Role }) {
  return (
    /* Graceful, never accusatory. The elder exercising consent is the system working —
       so this reads as a fact, not a fault, and there is no "ask them to turn it on" button.
       Nagging your mother through our UI is not a feature. */
    <section className="animate-rise rounded-card bg-surface-card p-8 text-center shadow-sm ring-1 ring-sand-200">
      <h2 className="text-d-title font-semibold text-ink-900">Sharing is paused</h2>
      <p className="mx-auto mt-3 max-w-md text-d-lead text-ink-700">
        {viewerRole === "elder"
          ? "You've turned sharing off. Nothing from your conversations is visible to family."
          : `${name} has turned sharing off. That's their call to make — Arjun won't show you anything until they turn it back on.`}
      </p>
    </section>
  );
}

function Empty({ name }: { name: string }) {
  return (
    <section className="animate-rise flex flex-col items-center justify-center rounded-card bg-surface-card px-8 py-16 text-center shadow-sm ring-1 ring-sand-200">
      <div
        aria-hidden="true"
        className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sand-100"
      >
        <div
          className="absolute h-full w-full animate-ping rounded-full bg-sage-600/20"
          style={{ animationDuration: "3s" }}
        />
        <div className="h-4 w-4 rounded-full bg-sage-600" />
      </div>
      <h2 className="text-d-title font-semibold text-ink-900">
        Waiting for their first conversation
      </h2>
      <p className="mx-auto mt-3 max-w-md text-d-lead text-ink-700">
        {`Once ${name} finishes talking with Arjun, a note about how they seemed will appear here. You don’t need to refresh.`}
      </p>
    </section>
  );
}

function TodayCard({
  snap,
  name,
  headingRef,
}: {
  snap: FamilySnapshot;
  name: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const latest = snap.latest!;
  const band = scoreBand(latest.score);

  // No red exists here. The worst case is amber, and it says "worth a check-in".
  const tone = {
    good: "bg-sage-100 text-sage-800",
    ok: "bg-sand-200 text-ink-700",
    attention: "bg-warn-100 text-warn-800",
  }[band.tone];

  return (
    <section className="animate-rise rounded-card bg-surface-card p-7 shadow-sm ring-1 ring-sand-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-d-eyebrow font-medium uppercase text-clay-700 focus-visible:outline-clay-700"
          >
            {`How ${name} seemed`}
          </h2>
          <p className="mt-2 text-d-display font-semibold capitalize text-ink-900">
            {latest.mood}
          </p>
          <p className="mt-1 text-d-meta text-ink-500">{when(latest.at)}</p>
        </div>
        {/* The band label carries the meaning in words. The tint only agrees with it —
            colour is never the sole signal. */}
        <span className={`rounded-full px-4 py-2 text-d-body font-medium ${tone}`}>
          {band.label}
        </span>
      </div>

      {latest.summary && (
        <p className="mt-6 border-t border-sand-200 pt-6 text-d-lead text-ink-900">
          {latest.summary}
        </p>
      )}

      <p className="mt-5 text-d-meta text-ink-500">
        {`A summary of the conversation — not a transcript. ${name} sees this too.`}
      </p>
    </section>
  );
}

/**
 * The only card with an accent fill, and that is the hierarchy argument in one stroke.
 *
 * The score answers "how is she?" — but the family already got that from the mood word and
 * the summary above. This answers "what do I do?", and a nudge toward a phone call is the
 * only output of this product that can actually change the elder's day. It outranks the
 * number, so it gets the colour. Engagement with Arjun is never the win metric; a call is.
 */
function RecommendationCard({ text, name }: { text: string; name: string }) {
  return (
    <section className="animate-rise rounded-card bg-clay-100 p-7 ring-1 ring-clay-500/25">
      <h2 className="text-d-eyebrow font-medium uppercase text-clay-700">
        One thing that would land well
      </h2>
      <p className="mt-3 text-d-title text-ink-900">{text}</p>
      <p className="mt-4 text-d-meta text-ink-700">
        {`Arjun keeps ${name} company. It doesn’t replace you.`}
      </p>
    </section>
  );
}

function SignalsCard({ snap }: { snap: FamilySnapshot }) {
  const l = snap.latest!;
  const signals = [
    { label: "Engagement", value: l.energy, hint: "how animated they were" },
    { label: "Wanting company", value: l.loneliness, hint: "signals they'd like more contact" },
    { label: "Worth a check-in", value: l.concern, hint: "how much a call would help" },
  ];

  return (
    <section className="animate-rise rounded-card bg-surface-card p-7 shadow-sm ring-1 ring-sand-200">
      <h2 className="text-d-eyebrow font-medium uppercase text-clay-700">
        Signals from the conversation
      </h2>

      <div className="mt-5 space-y-5">
        {signals.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between">
              <p className="text-d-lead text-ink-900">{s.label}</p>
              <p className="text-d-body tabular-nums text-ink-500">{s.value}</p>
            </div>
            <div
              role="meter"
              aria-valuenow={s.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${s.label} — ${s.hint}`}
              className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand-100"
            >
              <div
                className="h-full rounded-full bg-clay-500 transition-all duration-700"
                style={{ width: `${s.value}%` }}
              />
            </div>
            <p className="mt-1 text-d-meta text-ink-500">{s.hint}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-d-meta text-ink-500">
        {`Signals read from how ${snap.elder.name ?? "they"} spoke — not a measurement, and not a medical assessment.`}
      </p>
    </section>
  );
}

function TrendCard({ trend }: { trend: FamilySnapshot["trend"] }) {
  const w = 640;
  const h = 120;
  const pad = 8;
  const pts = trend.map((t, i) => {
    const x = pad + (i / Math.max(1, trend.length - 1)) * (w - pad * 2);
    const y = h - pad - (t.score / 100) * (h - pad * 2);
    return `${x},${y}`;
  });

  return (
    <section className="animate-rise rounded-card bg-surface-card p-7 shadow-sm ring-1 ring-sand-200">
      <h2 className="text-d-eyebrow font-medium uppercase text-clay-700">
        Over the last {trend.length} conversations
      </h2>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-5 w-full"
        role="img"
        aria-label={trendSummary(trend)}
      >
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="var(--color-clay-500)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => {
          const [x, y] = p.split(",");
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === pts.length - 1 ? 5 : 3}
              fill={i === pts.length - 1 ? "var(--color-clay-500)" : "var(--color-sand-300)"}
            />
          );
        })}
      </svg>

      <p className="mt-2 text-d-meta text-ink-500">
        Most recent on the right. Higher is steadier — it is not a medical measurement.
      </p>
    </section>
  );
}

function VitalsCard({ snap }: { snap: FamilySnapshot }) {
  const v = snap.latest?.vitals;
  if (!v) return null;

  const items = [
    { label: "Resting heart rate", value: `${v.resting_heart_rate} bpm` },
    { label: "Sleep", value: `${v.sleep_hours} h` },
    { label: "Steps", value: v.steps.toLocaleString() },
  ];

  return (
    /* Dashed border + "Simulated" chip + a plain-English disclaimer. Three separate signals
       that this is not real, because a family member glancing at a heart rate must never
       come away believing we measured it. */
    <section className="animate-rise rounded-card border-2 border-dashed border-sand-400 p-7">
      <div className="flex items-center gap-3">
        <h2 className="text-d-eyebrow font-medium uppercase text-ink-700">Vitals</h2>
        <span className="rounded-full bg-sand-200 px-3 py-1 text-d-meta font-medium uppercase text-ink-700">
          Simulated
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        {items.map((i) => (
          <div key={i.label}>
            <p className="text-d-title font-semibold tabular-nums text-ink-900">{i.value}</p>
            <p className="mt-1 text-d-meta text-ink-500">{i.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-d-meta text-ink-500">
        Placeholder data — Arjun is not connected to a real device.
      </p>
    </section>
  );
}

/**
 * A line chart is invisible to a screen reader. Spell out what the shape says, in the same
 * non-clinical register the rest of the dashboard uses.
 */
function trendSummary(trend: FamilySnapshot["trend"]): string {
  const first = trend[0].score;
  const last = trend[trend.length - 1].score;
  const delta = last - first;
  const direction =
    Math.abs(delta) < 5 ? "holding steady" : delta > 0 ? "trending up" : "trending down";
  return `Wellness across the last ${trend.length} conversations: ${direction}, from ${first} to ${last} out of 100. Most recent last.`;
}

function when(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
