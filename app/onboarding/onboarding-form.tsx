"use client";

import { useActionState, useState } from "react";
import { createElderProfile, linkFamilyProfile, type ActionState } from "@/app/actions";

const initial: ActionState = {};

const inputClass =
  "w-full rounded-control border-2 border-ink-500 bg-white px-5 py-4 text-e-body text-ink-900 placeholder:text-ink-500 focus:border-clay-700 focus:outline-none";

export default function OnboardingForm() {
  const [role, setRole] = useState<"elder" | "family" | null>(null);

  if (role === null) {
    return (
      <div className="max-w-md w-full animate-rise">
        <h1 className="text-e-display font-semibold text-ink-900">Who are you here for?</h1>

        <div className="mt-8 space-y-4">
          <button
            onClick={() => setRole("elder")}
            className="w-full rounded-control border-2 border-sand-400 bg-white p-6 text-left transition hover:border-clay-700"
          >
            <p className="text-e-lead font-medium text-ink-900">Myself</p>
            <p className="mt-1 text-e-meta text-ink-700">
              I want someone to talk to who remembers me.
            </p>
          </button>

          <button
            onClick={() => setRole("family")}
            className="w-full rounded-control border-2 border-sand-400 bg-white p-6 text-left transition hover:border-clay-700"
          >
            <p className="text-e-lead font-medium text-ink-900">Someone in my family</p>
            <p className="mt-1 text-e-meta text-ink-700">
              I&apos;d like to see how they&apos;re doing — if they choose to share.
            </p>
          </button>
        </div>
      </div>
    );
  }

  return role === "elder" ? (
    <ElderForm onBack={() => setRole(null)} />
  ) : (
    <FamilyForm onBack={() => setRole(null)} />
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-e-meta text-ink-700 underline underline-offset-4 hover:text-ink-700"
    >
      ← Back
    </button>
  );
}

function ElderForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(createElderProfile, initial);

  return (
    <div className="max-w-md w-full animate-rise">
      <BackButton onBack={onBack} />
      <h1 className="mt-6 text-e-display font-semibold text-ink-900">Let&apos;s get acquainted</h1>
      <p className="mt-3 text-e-lead text-ink-700">Arjun will use your name when you talk.</p>

      <form action={action} className="mt-8 space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-e-meta font-medium text-ink-900">
            What should Arjun call you?
          </label>
          <input id="name" name="name" required placeholder="Priya" className={inputClass} />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="native_language"
            className="block text-e-meta font-medium text-ink-900"
          >
            Which language feels most like home?
          </label>
          <input
            id="native_language"
            name="native_language"
            defaultValue="English"
            className={inputClass}
          />
        </div>

        {state.error && (
          <p role="alert" className="text-e-meta text-clay-700">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-control bg-clay-700 px-6 py-4 text-e-body font-medium text-white transition hover:bg-clay-800 disabled:opacity-60"
        >
          {pending ? "One moment…" : "Start talking"}
        </button>
      </form>
    </div>
  );
}

function FamilyForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState(linkFamilyProfile, initial);

  return (
    <div className="max-w-md w-full animate-rise">
      <BackButton onBack={onBack} />
      <h1 className="mt-6 text-e-display font-semibold text-ink-900">Enter their code</h1>
      <p className="mt-3 text-e-lead text-ink-700">
        Ask your family member for the six-character code in their Arjun app. They have to
        give it to you — that&apos;s how you know they agreed to this.
      </p>

      <form action={action} className="mt-8 space-y-5">
        <div className="space-y-2">
          <label htmlFor="share_code" className="block text-e-meta font-medium text-ink-900">
            Their code
          </label>
          <input
            id="share_code"
            name="share_code"
            required
            maxLength={6}
            autoCapitalize="characters"
            placeholder="K3M7QP"
            className={`${inputClass} font-mono text-e-title uppercase tracking-[0.3em]`}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="name" className="block text-e-meta font-medium text-ink-900">
            Your name <span className="text-ink-500">(optional)</span>
          </label>
          <input id="name" name="name" placeholder="Anita" className={inputClass} />
        </div>

        {state.error && (
          <p role="alert" className="text-e-meta text-clay-700">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-control bg-clay-700 px-6 py-4 text-e-body font-medium text-white transition hover:bg-clay-800 disabled:opacity-60"
        >
          {pending ? "Linking…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
