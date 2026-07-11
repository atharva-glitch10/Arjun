"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [justUpdated, setJustUpdated] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/family/snapshot", { cache: "no-store" });
      if (!res.ok) return;
      const next: FamilySnapshot = await res.json();
      setSnap((prev) => {
        const changed = next.latest?.at !== prev.latest?.at;
        if (changed) {
          setJustUpdated(true);
          setTimeout(() => setJustUpdated(false), 4000);
        }
        return next;
      });
    } catch {
      // Offline for a moment; the poll will try again.
    }
  }, []);

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
            <p className="text-sm font-medium uppercase tracking-widest text-clay-600">
              Arjun
            </p>
            <h1 className="text-xl font-semibold text-ink-900">{name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`flex items-center gap-2 text-sm transition ${
                justUpdated ? "text-sage-600" : "text-ink-500"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  justUpdated ? "bg-sage-600" : "bg-ink-500/40"
                }`}
              />
              {justUpdated ? "Just updated" : "Live"}
            </span>
            <form action={signOut}>
              <button className="text-base text-ink-500 hover:text-ink-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        {!snap.sharing ? (
          <SharingPaused name={name} viewerRole={viewerRole} />
        ) : !snap.latest ? (
          <Empty name={name} />
        ) : (
          <>
            <TodayCard snap={snap} name={name} />
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

function SharingPaused({ name, viewerRole }: { name: string; viewerRole: Role }) {
  return (
    <section className="animate-rise rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-sand-200">
      <h2 className="text-2xl font-semibold text-ink-900">Sharing is paused</h2>
      <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-ink-700">
        {viewerRole === "elder"
          ? "You've turned sharing off. Nothing from your conversations is visible to family."
          : `${name} has turned sharing off. That's their call to make — Arjun won't show you anything until they turn it back on.`}
      </p>
    </section>
  );
}

function Empty({ name }: { name: string }) {
  return (
    <section className="animate-rise flex flex-col items-center justify-center rounded-3xl bg-white/60 px-8 py-16 text-center shadow-sm ring-1 ring-sand-200 backdrop-blur">
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sand-100">
        <div className="absolute h-full w-full animate-ping rounded-full bg-sage-400/20" style={{ animationDuration: "3s" }} />
        <div className="h-4 w-4 rounded-full bg-sage-500" />
      </div>
      <h2 className="text-2xl font-semibold text-ink-900">Waiting for their first session</h2>
      <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed text-ink-700">
        Once {name} finishes a conversation with Arjun, a summary and mood signals will appear here.
        This page updates automatically.
      </p>
    </section>
  );
}

function TodayCard({ snap, name }: { snap: FamilySnapshot; name: string }) {
  const latest = snap.latest!;
  const band = scoreBand(latest.score);

  const tone = {
    good: "bg-sage-100 text-sage-600",
    ok: "bg-sand-200 text-ink-700",
    attention: "bg-warn-100 text-warn-600",
  }[band.tone];

  return (
    <section className="animate-rise rounded-3xl bg-white p-7 shadow-sm ring-1 ring-sand-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-clay-600">
            How {name} seemed
          </p>
          <p className="mt-2 text-4xl font-semibold capitalize text-ink-900">{latest.mood}</p>
          <p className="mt-1 text-base text-ink-500">{when(latest.at)}</p>
        </div>
        <span className={`rounded-full px-4 py-2 text-base font-medium ${tone}`}>
          {band.label}
        </span>
      </div>

      {latest.summary && (
        <p className="mt-6 border-t border-sand-200 pt-6 text-lg leading-relaxed text-ink-900">
          {latest.summary}
        </p>
      )}

      <p className="mt-5 text-sm text-ink-500">
        A summary of the conversation — not a transcript. {name} sees this too.
      </p>
    </section>
  );
}

function RecommendationCard({ text, name }: { text: string; name: string }) {
  return (
    <section className="animate-rise rounded-3xl bg-clay-100 p-7 ring-1 ring-clay-500/20">
      <p className="text-sm font-medium uppercase tracking-widest text-clay-600">
        One thing that would land well
      </p>
      <p className="mt-3 text-xl leading-relaxed text-ink-900">{text}</p>
      <p className="mt-4 text-sm text-ink-500">
        Arjun keeps {name} company. It doesn&apos;t replace you.
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
    <section className="animate-rise rounded-3xl bg-white p-7 shadow-sm ring-1 ring-sand-200">
      <p className="text-sm font-medium uppercase tracking-widest text-clay-600">
        Signals from the conversation
      </p>

      <div className="mt-5 space-y-5">
        {signals.map((s) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between">
              <p className="text-lg text-ink-900">{s.label}</p>
              <p className="text-base tabular-nums text-ink-500">{s.value}</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand-100">
              <div
                className="h-full rounded-full bg-clay-500 transition-all duration-700"
                style={{ width: `${s.value}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-ink-500">{s.hint}</p>
          </div>
        ))}
      </div>
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
    <section className="animate-rise rounded-3xl bg-white p-7 shadow-sm ring-1 ring-sand-200">
      <p className="text-sm font-medium uppercase tracking-widest text-clay-600">
        Over the last {trend.length} conversations
      </p>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-5 w-full"
        role="img"
        aria-label={`Trend across ${trend.length} conversations`}
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

      <p className="mt-2 text-sm text-ink-500">
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
    <section className="animate-rise rounded-3xl border-2 border-dashed border-sand-300 p-7">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-ink-500">Vitals</p>
        <span className="rounded-full bg-sand-200 px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-700">
          Simulated
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        {items.map((i) => (
          <div key={i.label}>
            <p className="text-2xl font-semibold tabular-nums text-ink-900">{i.value}</p>
            <p className="mt-1 text-sm text-ink-500">{i.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm text-ink-500">
        Placeholder data — Arjun is not connected to a real device.
      </p>
    </section>
  );
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
