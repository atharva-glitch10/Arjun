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

        {snap.latest?.crisis_detected && (
          <CrisisCard recommendation={snap.latest.recommendation!} name={name} />
        )}

        {!snap.sharing ? (
          <SharingPaused name={name} viewerRole={viewerRole} />
        ) : !snap.latest ? (
          <Empty name={name} />
        ) : (
          <>
            <TodayCard snap={snap} name={name} headingRef={headingRef} />
            {!snap.latest.crisis_detected && (
              <RecommendationCard text={snap.latest.recommendation!} name={name} />
            )}
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

function CrisisCard({ recommendation, name }: { recommendation: string; name: string }) {
  return (
    <section className="animate-rise rounded-card bg-red-600 p-7 shadow-lg ring-1 ring-red-700/50">
      <div className="flex items-start gap-4 text-white">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h2 className="text-d-title font-bold uppercase tracking-wide">
            Immediate Attention Needed
          </h2>
          <p className="mt-3 text-lg font-medium">
            {recommendation}
          </p>
          <p className="mt-4 text-red-200 text-d-meta font-medium">
            Arjun detected signals of a potential crisis (e.g. medical emergency, severe distress, or self-harm) in {name}&apos;s last conversation. Please contact them or emergency services immediately.
          </p>
        </div>
      </div>
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
  // Guard: old DB rows pre-dating the WHOOP schema won't have recovery_score.
  // Rather than crash on `.toFixed(undefined)`, simply hide the panel for those rows.
  if (!v || typeof v.recovery_score === "undefined") return null;

  // Recovery colour: mirrors WHOOP's green/yellow/red zones
  const recoveryColor =
    v.recovery_score >= 67
      ? { ring: "#22c55e", bg: "bg-green-50",  text: "text-green-700",  label: "text-green-600" }
      : v.recovery_score >= 34
      ? { ring: "#f59e0b", bg: "bg-amber-50",  text: "text-amber-700",  label: "text-amber-600" }
      : { ring: "#ef4444", bg: "bg-red-50",    text: "text-red-700",    label: "text-red-600"   };

  // Strain colour: low=blue, moderate=green, high=orange
  const strainColor =
    v.day_strain < 8
      ? "text-blue-600"
      : v.day_strain < 15
      ? "text-green-600"
      : "text-orange-600";

  // Sleep performance colour
  const sleepColor =
    v.sleep_performance_percent >= 70
      ? "text-green-600"
      : v.sleep_performance_percent >= 50
      ? "text-amber-600"
      : "text-red-600";

  return (
    /*
     * Three separate "Simulated" signals — the dashed border, the chip, and the disclaimer.
     * A family member glancing at a recovery score must never believe we measured it.
     */
    <section className="animate-rise rounded-card border-2 border-dashed border-sand-400 p-7">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-d-eyebrow font-medium uppercase text-ink-700">
          Activity &amp; Recovery
        </h2>
        <span className="rounded-full bg-sand-200 px-3 py-1 text-d-meta font-medium uppercase text-ink-700">
          WHOOP-style · Simulated
        </span>
      </div>

      {/* Three panels */}
      <div className="mt-6 grid gap-5 sm:grid-cols-3">

        {/* ── Recovery ── */}
        <div className={`rounded-xl p-5 ${recoveryColor.bg} ring-1 ring-black/5`}>
          <p className="text-d-eyebrow font-semibold uppercase tracking-wider text-ink-500">
            Recovery
          </p>

          {/* Big score + SVG arc */}
          <div className="my-4 flex items-center gap-4">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" strokeWidth="7" />
              <circle
                cx="32" cy="32" r="26"
                fill="none"
                stroke={recoveryColor.ring}
                strokeWidth="7"
                strokeDasharray={`${(v.recovery_score / 100) * 163.4} 163.4`}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
              />
            </svg>
            <div>
              <p className={`text-4xl font-bold tabular-nums leading-none ${recoveryColor.text}`}>
                {v.recovery_score}
                <span className="ml-0.5 text-lg font-medium">%</span>
              </p>
              <p className={`mt-1 text-d-meta font-medium ${recoveryColor.label}`}>
                {v.recovery_score >= 67 ? "Well recovered" : v.recovery_score >= 34 ? "Moderate" : "Low"}
              </p>
            </div>
          </div>

          {/* Sub-metrics */}
          <dl className="space-y-2 text-d-meta">
            <div className="flex justify-between">
              <dt className="text-ink-500">HRV</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.hrv_rmssd_ms} ms</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Resting HR</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.resting_heart_rate} bpm</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">SpO₂</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.blood_oxygen_percent}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Skin temp</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.skin_temp_celsius} °C</dd>
            </div>
          </dl>
        </div>

        {/* ── Strain ── */}
        <div className="rounded-xl bg-slate-50 p-5 ring-1 ring-black/5 flex flex-col justify-between">
          <div>
            <p className="text-d-eyebrow font-semibold uppercase tracking-wider text-ink-500">
              Strain
            </p>

            {/* Big strain number */}
            <div className="my-4">
              <p className={`text-4xl font-bold tabular-nums leading-none ${strainColor}`}>
                {v.day_strain.toFixed(1)}
                <span className="ml-1 text-lg font-medium text-ink-400">/ 21</span>
              </p>
              <p className="mt-1 text-d-meta font-medium text-ink-500">
                {v.day_strain < 8 ? "Light day" : v.day_strain < 15 ? "Moderate load" : "High effort"}
              </p>
            </div>

            {/* Strain bar */}
            <div
              role="meter"
              aria-valuenow={v.day_strain}
              aria-valuemin={0}
              aria-valuemax={21}
              aria-label={`Day strain: ${v.day_strain.toFixed(1)} out of 21`}
              className="mb-4 h-3 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 via-green-400 to-orange-400 transition-all duration-700"
                style={{ width: `${(v.day_strain / 21) * 100}%` }}
              />
            </div>

            {/* Target strain zone */}
            {v.strain_target_min !== undefined && v.strain_target_max !== undefined && (
              <div className="mb-4 rounded-lg bg-sand-100/60 p-2.5 text-d-meta text-ink-700 flex justify-between items-center ring-1 ring-black/5">
                <span className="font-medium text-ink-500">Optimal Zone:</span>
                <span className="font-semibold tabular-nums text-ink-900">{v.strain_target_min.toFixed(1)} – {v.strain_target_max.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Sub-metrics */}
          <dl className="space-y-2 text-d-meta border-t border-slate-200/60 pt-3">
            <div className="flex justify-between">
              <dt className="text-ink-500">Calories</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.calories_burned.toLocaleString()} kcal</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Avg HR</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.avg_heart_rate} bpm</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Max HR</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.max_heart_rate} bpm</dd>
            </div>
          </dl>
        </div>

        {/* ── Sleep ── */}
        <div className="rounded-xl bg-indigo-50 p-5 ring-1 ring-black/5 flex flex-col justify-between">
          <div>
            <p className="text-d-eyebrow font-semibold uppercase tracking-wider text-ink-500">
              Sleep
            </p>

            {/* Performance score */}
            <div className="my-4">
              <p className={`text-4xl font-bold tabular-nums leading-none ${sleepColor}`}>
                {v.sleep_performance_percent}
                <span className="ml-0.5 text-lg font-medium">%</span>
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <p className="text-d-meta font-medium text-ink-500">
                  {v.sleep_hours.toFixed(1)} h total
                </p>
                {v.sleep_need_hours !== undefined && (
                  <p className="text-[11px] text-ink-400">
                    of {v.sleep_need_hours.toFixed(1)}h needed
                  </p>
                )}
              </div>
            </div>

            {/* Sleep debt indicator */}
            {v.sleep_debt_hours !== undefined && v.sleep_debt_hours > 0 && (
              <div className="mb-4 rounded-lg bg-warn-100 px-3 py-2 text-d-meta text-warn-800 flex justify-between items-center ring-1 ring-warn-600/10">
                <span className="font-medium">Sleep Debt:</span>
                <span className="font-semibold tabular-nums">+{Math.round(v.sleep_debt_hours * 60)} min</span>
              </div>
            )}

            {/* Sleep stage bar */}
            <div
              className="mb-1 flex h-3 overflow-hidden rounded-full"
              role="img"
              aria-label={`Sleep stages: ${v.time_in_deep_hours.toFixed(1)}h deep, ${v.time_in_rem_hours.toFixed(1)}h REM, ${v.time_in_light_hours.toFixed(1)}h light`}
            >
              <div
                className="bg-indigo-700"
                style={{ width: `${(v.time_in_deep_hours  / v.sleep_hours) * 100}%` }}
              />
              <div
                className="bg-indigo-400"
                style={{ width: `${(v.time_in_rem_hours   / v.sleep_hours) * 100}%` }}
              />
              <div
                className="bg-indigo-200"
                style={{ width: `${(v.time_in_light_hours / v.sleep_hours) * 100}%` }}
              />
            </div>
            {/* Stage legend */}
            <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-ink-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-indigo-700" />
                Deep {v.time_in_deep_hours.toFixed(1)}h
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-indigo-400" />
                REM {v.time_in_rem_hours.toFixed(1)}h
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-indigo-200" />
                Light {v.time_in_light_hours.toFixed(1)}h
              </span>
            </div>
          </div>

          {/* Sub-metrics */}
          <dl className="space-y-2 text-d-meta border-t border-indigo-200/50 pt-3">
            <div className="flex justify-between">
              <dt className="text-ink-500">Consistency</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.sleep_consistency_percent}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Resp. rate</dt>
              <dd className="font-semibold tabular-nums text-ink-900">{v.respiratory_rate.toFixed(1)} brpm</dd>
            </div>
            {v.sleep_disturbances !== undefined && (
              <div className="flex justify-between">
                <dt className="text-ink-500">Disturbances</dt>
                <dd className="font-semibold tabular-nums text-ink-900">{v.sleep_disturbances} wake ups</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Logged Activities / Workouts (New section spanning bottom of card) */}
      {v.activities && v.activities.length > 0 && (
        <div className="mt-6 border-t border-dashed border-sand-300 pt-5">
          <h3 className="text-d-eyebrow font-semibold uppercase tracking-wider text-ink-700 mb-3">
            Logged Activities Today
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {v.activities.map((act, i) => (
              <div key={i} className="flex justify-between items-center bg-surface-card rounded-xl p-4 ring-1 ring-black/5 shadow-2xs hover:shadow-xs transition duration-150">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-clay-100 p-2.5 text-clay-700">
                    {act.name.toLowerCase().includes("walk") ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4" r="2"/><path d="M12 12a3 3 0 0 0-3-3H7.8a2 2 0 0 0-1.8 1.1L4 14.5M10.5 15l1.5 5h3l1.5-6.5M14 9l1 3M10 12l2.5 3.5"/></svg>
                    ) : act.name.toLowerCase().includes("garden") ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10"/><path d="M10 20V12"/><path d="M12 17V12"/><path d="M14 20v-5"/><path d="M19 9a7 7 0 0 0-7-7 7 7 0 0 0-7 7M5 9c0 4 3 7 7 7s7-3 7-7"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900 text-d-body">{act.name}</p>
                    <p className="text-ink-500 text-d-meta">{act.duration_minutes} mins · {act.calories} kcal</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Avg HR</p>
                    <p className="font-bold text-ink-900 text-d-body tabular-nums">{act.avg_hr} <span className="text-[10px] font-normal text-ink-500">bpm</span></p>
                  </div>
                  <div className="border-l border-sand-200 pl-4 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold">Strain</p>
                    <p className="font-extrabold text-orange-600 text-d-lead tabular-nums">{act.strain.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 text-d-meta text-ink-500">
        WHOOP-style metrics are simulated — Arjun is not connected to a real device.
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
