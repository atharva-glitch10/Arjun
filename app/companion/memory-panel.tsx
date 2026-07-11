"use client";

import { useState } from "react";

type Fact = { category: string; key: string; value: string };

/**
 * "The elder can see what's shared and turn sharing off" (prd.md §7), made literal:
 * everything Arjun remembers, the code that lets family in, and the switch that cuts them off.
 */
export default function MemoryPanel({
  facts,
  shareCode,
  shareEnabled,
}: {
  facts: Fact[];
  shareCode: string;
  shareEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(shareEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !sharing;
    setSaving(true);
    setSharing(next); // optimistic
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_enabled: next }),
      });
      if (!res.ok) setSharing(!next);
    } catch {
      setSharing(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border-2 border-sand-200 bg-white px-4 py-2 text-base text-ink-700 transition hover:border-clay-500"
      >
        What I remember
        {facts.length > 0 && (
          <span className="ml-2 rounded-full bg-sand-200 px-2 py-0.5 text-sm text-ink-700">
            {facts.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-ink-900/30"
          onClick={() => setOpen(false)}
        >
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-sand-50 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-semibold text-ink-900">What Arjun remembers</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-xl px-3 py-1 text-2xl text-ink-500 hover:text-ink-900"
              >
                ×
              </button>
            </div>

            {facts.length === 0 ? (
              <p className="mt-6 text-lg text-ink-700">
                Nothing yet. Tell Arjun about your day and it will remember next time.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {facts.map((f) => (
                  <li
                    key={`${f.category}:${f.key}`}
                    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sand-200"
                  >
                    <p className="text-xs font-medium uppercase tracking-widest text-clay-600">
                      {f.category}
                    </p>
                    <p className="mt-1 text-lg leading-relaxed text-ink-900">{f.value}</p>
                  </li>
                ))}
              </ul>
            )}

            <section className="mt-10 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-sand-200">
              <h3 className="text-lg font-medium text-ink-900">Sharing with family</h3>
              <p className="mt-2 text-base leading-relaxed text-ink-700">
                When this is on, your family sees a short note about how you seem — never the
                words you actually said.
              </p>

              <button
                onClick={toggle}
                disabled={saving}
                aria-pressed={sharing}
                className={`mt-4 flex w-full items-center justify-between rounded-2xl px-5 py-4 text-lg transition disabled:opacity-60 ${
                  sharing
                    ? "bg-sage-100 text-ink-900"
                    : "bg-sand-200 text-ink-700"
                }`}
              >
                <span>{sharing ? "Sharing is on" : "Sharing is off"}</span>
                <span
                  className={`relative h-7 w-12 rounded-full transition ${
                    sharing ? "bg-sage-600" : "bg-ink-500/40"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                      sharing ? "left-6" : "left-1"
                    }`}
                  />
                </span>
              </button>

              {sharing && shareCode && (
                <div className="mt-5 border-t border-sand-200 pt-5">
                  <p className="text-base text-ink-700">
                    Give this code to the family member you want to share with:
                  </p>
                  <p className="mt-2 font-mono text-3xl tracking-[0.3em] text-ink-900">
                    {shareCode}
                  </p>
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
