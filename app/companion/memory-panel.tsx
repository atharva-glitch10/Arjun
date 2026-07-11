"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Fact = { category: string; key: string; value: string };

/**
 * The schema's categories are engineering words. An elder reading this panel should see her
 * life described the way she'd describe it, not a database enum. Same six values, human voice.
 */
const CATEGORY_LABEL: Record<string, string> = {
  family: "Your family",
  health: "How you've been feeling",
  hobby: "What you enjoy",
  date: "Dates you mentioned",
  preference: "What you like",
  event: "Something that happened",
};

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

  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Escape closes, and focus returns to the button that opened it — otherwise a keyboard user
  // is dumped back at the top of the document with no idea where they are.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closer.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) opener.current?.focus();
  }, [open]);

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
        ref={opener}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="rounded-control border-2 border-sand-400 bg-surface-card px-4 py-2 text-e-meta text-ink-900 transition-colors duration-[--duration-hover] hover:border-clay-700"
      >
        What I remember
        {facts.length > 0 && (
          <span className="ml-2 rounded-full bg-sand-200 px-2 py-0.5 text-d-meta text-ink-700">
            {facts.length}
          </span>
        )}
      </button>

      {/*
        Portalled to <body> on purpose, and it is NOT cosmetic.

        This panel lives inside the companion header, which has `backdrop-blur`. A
        backdrop-filter makes an element a containing block for position:fixed descendants
        (CSS Containment / Filter Effects), so `fixed inset-0` was resolving against the 78px
        header instead of the viewport — the panel was rendering, then being clipped to a
        sliver by its own overflow-y-auto. Everything below the title was unreachable.

        The portal escapes that containing block and keeps the header's blur.
      */}
      {/* `open` only flips true on a click, so createPortal is never reached during SSR. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex justify-end bg-ink-900/40"
            onClick={() => setOpen(false)}
          >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-panel-title"
            className="h-full w-full max-w-md overflow-y-auto bg-sand-50 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 id="memory-panel-title" className="text-e-title font-semibold text-ink-900">
                What Arjun remembers
              </h2>
              <button
                ref={closer}
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl text-ink-500 hover:text-ink-900"
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-e-meta text-ink-700">
              Everything Arjun has kept from your conversations. Nothing is hidden from you.
            </p>

            {facts.length === 0 ? (
              <p className="mt-6 text-e-body text-ink-700">
                Nothing yet. Tell Arjun about your day and it will remember next time.
              </p>
            ) : (
              <ul className="mt-6 space-y-3">
                {facts.map((f) => (
                  <li
                    key={`${f.category}:${f.key}`}
                    className="rounded-card bg-surface-card p-4 shadow-sm ring-1 ring-sand-200"
                  >
                    <p className="text-d-eyebrow font-medium uppercase text-clay-700">
                      {CATEGORY_LABEL[f.category] ?? f.category}
                    </p>
                    <p className="mt-1 text-e-body text-ink-900">{f.value}</p>
                  </li>
                ))}
              </ul>
            )}

            <section className="mt-10 rounded-card bg-surface-card p-5 shadow-sm ring-1 ring-sand-200">
              <h3 className="text-e-lead font-medium text-ink-900">Sharing with family</h3>
              <p className="mt-2 text-e-meta text-ink-700">
                When this is on, your family sees a short note about how you seem — never the
                words you actually said. You can turn it off at any time, and you don&apos;t have
                to explain why.
              </p>

              <button
                onClick={toggle}
                disabled={saving}
                aria-pressed={sharing}
                className={`mt-4 flex min-h-[64px] w-full items-center justify-between rounded-control px-5 py-4 text-e-body transition-colors duration-[--duration-hover] disabled:opacity-60 ${
                  sharing ? "bg-sage-100 text-ink-900" : "bg-sand-200 text-ink-900"
                }`}
              >
                <span>{sharing ? "Sharing is on" : "Sharing is off"}</span>
                <span
                  className={`relative h-7 w-12 rounded-full transition ${
                    sharing ? "bg-sage-600" : "bg-ink-500"
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
                  <p className="text-e-meta text-ink-700">
                    Give this code to the family member you want to share with. They can&apos;t
                    see anything until you hand it over.
                  </p>
                  <p className="mt-2 font-mono text-e-display tracking-[0.3em] text-ink-900">
                    {shareCode}
                  </p>
                </div>
              )}
            </section>
          </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
