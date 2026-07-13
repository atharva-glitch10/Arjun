import type { ConversationAnalysis, WhoopVitals } from "@/lib/types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const clampF = (n: number, lo: number, hi: number, dp = 1) =>
  Math.max(lo, Math.min(hi, parseFloat(n.toFixed(dp))));

/**
 * WHOOP-style simulated health data (prd.md §2 — no real device, ever).
 *
 * All 15 fields are correlated to the conversation's energy score so the family
 * dashboard reads as one coherent picture. Displayed with a "WHOOP-style · Simulated"
 * label everywhere they surface.
 *
 * WHOOP measures three pillars:
 *   Recovery  — how ready the body is for effort
 *   Strain    — cardiovascular load accumulated during the day
 *   Sleep     — quantity + quality of the previous night
 */
export function mockVitals(energy: number): WhoopVitals {
  const jitter = (spread: number) => (Math.random() - 0.5) * spread;
  const e = energy / 100; // 0–1 convenience

  // ── Recovery ──────────────────────────────────────────────────────────────
  // Higher energy → higher recovery score (well-rested day reads as more animated)
  const recovery_score = clamp(38 + e * 52 + jitter(12));

  // HRV follows recovery. Older-adult baseline ~25–45 ms; lower energy → lower HRV.
  const hrv_rmssd_ms = clampF(22 + e * 26 + jitter(8), 12, 65);

  // Resting HR: lower is better. Energy correlates inversely.
  const resting_heart_rate = clamp(78 - e * 12 + jitter(6), 52, 95);

  // Skin temp deviation from personal baseline (−0.5 to +1.5 °C is normal)
  const skin_temp_celsius = clampF(36.5 + jitter(0.6), 35.8, 38.0);

  // SpO2 — normal range 94–100 %, mild dip when energy is very low
  const blood_oxygen_percent = clampF(96 + e * 2 + jitter(1.5), 93, 100, 1);

  // ── Strain ────────────────────────────────────────────────────────────────
  // WHOOP strain is 0–21; for a sedentary older adult a typical day is 6–14.
  const day_strain = clampF(5 + e * 9 + jitter(2.5), 1, 21);

  // Calories: modest range for older adult (1 200–2 200 kcal including TDEE)
  const calories_burned = Math.round(1300 + e * 700 + jitter(200));

  // Average HR across the day
  const avg_heart_rate = clamp(68 + e * 10 + jitter(5), 58, 100);

  // Max HR during any activity; always above avg
  const max_heart_rate = clamp(avg_heart_rate + 20 + e * 25 + jitter(8), avg_heart_rate + 10, 165);

  // ── Sleep ──────────────────────────────────────────────────────────────────
  // Sleep performance: WHOOP scores need vs. actual.
  const sleep_performance_percent = clamp(42 + e * 48 + jitter(15));

  // Total sleep: 5.5 h at zero energy, ~8 h at full.
  const sleep_hours = clampF(5.5 + e * 2.5 + jitter(1), 3.5, 10.0);

  // REM ≈ 20–25 % of total; deep ≈ 15–20 %; light makes up the rest.
  const time_in_rem_hours   = clampF(sleep_hours * (0.20 + jitter(0.05)), 0.5, 3.0);
  const time_in_deep_hours  = clampF(sleep_hours * (0.17 + jitter(0.04)), 0.3, 2.5);
  const time_in_light_hours = clampF(
    sleep_hours - time_in_rem_hours - time_in_deep_hours,
    0.5,
    6.0,
  );

  // Sleep consistency vs. usual schedule (good schedulers tend to recover better)
  const sleep_consistency_percent = clamp(50 + e * 40 + jitter(18));

  // Respiratory rate during sleep: normal 12–20 breaths/min
  const respiratory_rate = clampF(14 + jitter(2.5), 11, 20);

  return {
    // Recovery
    recovery_score,
    hrv_rmssd_ms,
    resting_heart_rate,
    skin_temp_celsius,
    blood_oxygen_percent,
    // Strain
    day_strain,
    calories_burned,
    avg_heart_rate,
    max_heart_rate,
    // Sleep
    sleep_performance_percent,
    sleep_hours,
    time_in_rem_hours,
    time_in_deep_hours,
    time_in_light_hours,
    sleep_consistency_percent,
    respiratory_rate,
  };
}

/** 0–100, higher is better. Simple arithmetic — no ML (prd.md §6). */
export function wellnessScore(a: ConversationAnalysis, v: WhoopVitals): number {
  // Recovery pillar: WHOOP's own score + HRV proxy
  const recoveryClamped = clamp(v.recovery_score);

  // Sleep pillar: WHOOP's performance score (already 0–100)
  const sleepClamped = clamp(v.sleep_performance_percent);

  // Activity pillar: moderate strain is good; very low or very high is less optimal
  //   Strain 8–14 is a healthy zone → maps to ~100; extremes → lower.
  const strainOptimal = 11; // midpoint of healthy zone
  const strainScore = clamp((1 - Math.abs(v.day_strain - strainOptimal) / 11) * 100);

  const vitalsScore = 0.45 * recoveryClamped + 0.35 * sleepClamped + 0.2 * strainScore;

  return clamp(
    0.35 * a.energy +
      0.25 * (100 - a.loneliness) +
      0.2  * (100 - a.concern) +
      0.2  * vitalsScore,
  );
}

/** Non-clinical, family-readable band for the score. */
export function scoreBand(score: number): {
  label: string;
  tone: "good" | "ok" | "attention";
} {
  if (score >= 70) return { label: "Doing well",        tone: "good" };
  if (score >= 45) return { label: "Steady",             tone: "ok" };
  return              { label: "Worth a check-in",    tone: "attention" };
}
