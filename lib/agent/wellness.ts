import type { ConversationAnalysis, Vitals } from "@/lib/types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * MOCK vitals (prd.md §2 — no HealthKit, no Google Fit, no wearable, ever).
 *
 * They're nudged by the conversation's energy so the dashboard reads as one coherent
 * picture instead of a mood card sitting next to contradictory random numbers. Labelled
 * as simulated everywhere they surface.
 */
export function mockVitals(energy: number): Vitals {
  const jitter = (spread: number) => (Math.random() - 0.5) * spread;
  const e = energy / 100;

  return {
    // Lower energy -> slightly higher resting heart rate.
    resting_heart_rate: clamp(78 - e * 12 + jitter(6), 52, 95),
    // 5.5h at zero energy, ~8h at full.
    sleep_hours: Math.round((5.5 + e * 2.5 + jitter(1)) * 10) / 10,
    steps: Math.max(200, Math.round(1200 + e * 5000 + jitter(1200))),
  };
}

/** 0-100, higher is better. Simple arithmetic — no ML (prd.md §6). */
export function wellnessScore(a: ConversationAnalysis, v: Vitals): number {
  const sleep = clamp((1 - Math.abs(v.sleep_hours - 7.5) / 3.5) * 100);
  const steps = clamp((v.steps / 4000) * 100);
  const rhr = clamp((1 - Math.abs(v.resting_heart_rate - 66) / 25) * 100);
  const vitalsScore = 0.4 * sleep + 0.35 * steps + 0.25 * rhr;

  return clamp(
    0.35 * a.energy +
      0.25 * (100 - a.loneliness) +
      0.2 * (100 - a.concern) +
      0.2 * vitalsScore,
  );
}

/** Non-clinical, family-readable band for the score. */
export function scoreBand(score: number): {
  label: string;
  tone: "good" | "ok" | "attention";
} {
  if (score >= 70) return { label: "Doing well", tone: "good" };
  if (score >= 45) return { label: "Steady", tone: "ok" };
  return { label: "Worth a check-in", tone: "attention" };
}
