"use client";

import { useActionState } from "react";
import { sendMagicLink, type ActionState } from "@/app/actions";

const initial: ActionState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  if (state.sent) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full animate-rise text-center">
          <h1 className="text-3xl font-semibold text-ink-900">Check your email</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-700">
            We sent you a link. Open it on this device and you&apos;ll be signed straight in —
            no password to remember.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full animate-rise">
        <h1 className="text-3xl font-semibold text-ink-900">Sign in to Arjun</h1>
        <p className="mt-3 text-lg text-ink-700">
          We&apos;ll email you a link. There is no password.
        </p>

        <form action={action} className="mt-8 space-y-4">
          <label htmlFor="email" className="block text-base font-medium text-ink-700">
            Your email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-2xl border-2 border-sand-200 bg-white px-5 py-4 text-lg text-ink-900 placeholder:text-ink-500/60 focus:border-clay-500 focus:outline-none"
          />

          {state.error && (
            <p role="alert" className="text-base text-clay-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-clay-500 px-6 py-4 text-lg font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Email me a link"}
          </button>
        </form>
      </div>
    </main>
  );
}
