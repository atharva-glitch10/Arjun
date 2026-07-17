"use client";

import { useActionState, useState } from "react";
import { loginAsElder, loginAsFamily } from "@/app/actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"elder" | "family">("elder");
  
  const [elderState, elderAction, elderPending] = useActionState(loginAsElder, {});
  const [familyState, familyAction, familyPending] = useActionState(loginAsFamily, {});

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md animate-rise rounded-card bg-surface-card p-8 shadow-sm ring-1 ring-sand-200">
        <div className="text-center mb-8">
          <p className="text-d-eyebrow font-medium uppercase text-clay-700">Arjun</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink-900">Welcome</h1>
        </div>

        <div className="flex bg-sand-100 rounded-full p-1 mb-8">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
              mode === "elder" ? "bg-white text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
            }`}
            onClick={() => setMode("elder")}
          >
            Myself
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-colors ${
              mode === "family" ? "bg-white text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"
            }`}
            onClick={() => setMode("family")}
          >
            Someone in my family
          </button>
        </div>

        {mode === "elder" && (
          <form action={elderAction} className="space-y-6">
            <div className="text-center">
              <p className="text-ink-700 text-sm">Sign in to talk to Arjun.</p>
            </div>
            
            {elderState?.error && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded">{elderState.error}</p>
            )}

            <button
              type="submit"
              disabled={elderPending}
              className="w-full rounded-control bg-clay-700 px-6 py-3 text-e-body font-medium text-white transition-colors hover:bg-clay-800 disabled:opacity-50"
            >
              {elderPending ? "Signing in..." : "Continue"}
            </button>
          </form>
        )}

        {mode === "family" && (
          <form action={familyAction} className="space-y-6">
            <div>
              <label htmlFor="share_code" className="block text-sm font-medium text-ink-900">
                Share Code
              </label>
              <input
                id="share_code"
                name="share_code"
                type="text"
                placeholder="e.g. DEVXXX"
                required
                className="mt-2 block w-full rounded-control border-2 border-sand-300 bg-white px-4 py-3 text-ink-900 focus:border-clay-700 focus:outline-none"
              />
              <p className="mt-2 text-xs text-ink-500">
                Ask your family member for their 6-character code.
              </p>
            </div>

            {familyState?.error && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded">{familyState.error}</p>
            )}

            <button
              type="submit"
              disabled={familyPending}
              className="w-full rounded-control bg-clay-700 px-6 py-3 text-e-body font-medium text-white transition-colors hover:bg-clay-800 disabled:opacity-50"
            >
              {familyPending ? "Signing in..." : "Continue to Dashboard"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
