/**
 * Non-clinical language backstop (CLAUDE.md hard rule).
 *
 * The prompt is the primary defence; this is the seatbelt. Anything the model writes that
 * a family member will READ (summary, recommendation, mood label) passes through here
 * before it is persisted. We never want a row in the database that says a person shows
 * "signs of depression" — that is a diagnostic claim about a vulnerable person, made by a
 * chatbot, shown to their worried child.
 *
 * Substitutions always move toward everyday description, never toward a stronger claim.
 */
const SUBSTITUTIONS: [RegExp, string][] = [
  [/\b(clinical(ly)?\s+)?depress(ion|ed|ive)\b/gi, "low"],
  [/\bcognitive (decline|impairment|deficit)\b/gi, "difficulty finding words"],
  [/\b(early[- ])?dementia\b/gi, "memory trouble"],
  [/\balzheimer'?s?\b/gi, "memory trouble"],
  [/\banxiety disorder\b/gi, "worry"],
  [/\b(clinical|generalised|generalized) anxiety\b/gi, "worry"],
  [/\banxious\b/gi, "uneasy"],
  [/\bsymptoms?\b/gi, "signs"],
  [/\bdiagnos(is|es|ed|tic)\b/gi, "impression"],
  [/\bpatient\b/gi, "person"],
  [/\bscreening\b/gi, "check-in"],
  [/\bat risk of\b/gi, "worth watching for"],
  [/\brisk factors?\b/gi, "things to keep an eye on"],
  [/\bpathological\b/gi, "unusual"],
  [/\bdisorder\b/gi, "difficulty"],
  [/\bcondition\b/gi, "situation"],
  [/\bprognosis\b/gi, "outlook"],
  [/\bcomorbid(ity|ities)?\b/gi, "other things going on"],
  [/\bsuicidal ideation\b/gi, "talk of not wanting to go on"],
  [/\b(withdrawn|apathetic)\b/gi, "quiet"],
  [/\blethargic\b/gi, "tired"],
  [/\bisolated\b/gi, "missing company"],
  [/\b(hallucinat(ing|ions?)|delusion(al|s)?)\b/gi, "confused"],
  [/\bparanoid\b/gi, "worried"],
];

/** True if the text still reads clinically. Used by tests and by scrubClinical's warning. */
export function containsClinicalLanguage(text: string): boolean {
  return SUBSTITUTIONS.some(([pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function scrubClinical(text: string): string {
  let out = text;
  let hit = false;

  for (const [pattern, replacement] of SUBSTITUTIONS) {
    pattern.lastIndex = 0;
    if (pattern.test(out)) {
      hit = true;
      pattern.lastIndex = 0;
      out = out.replace(pattern, replacement);
    }
  }

  if (hit) {
    // Worth knowing about: it means the analysis prompt is drifting clinical.
    console.warn("[guard] clinical language scrubbed from model output");
  }
  return out;
}
