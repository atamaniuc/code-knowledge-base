import type { Claim } from "./claims.js";

/**
 * G1, source grounding.
 *
 * A claim ships because a passage supporting it was located in a document that was
 * actually fetched — not because a model found the claim plausible. Model recall is not
 * evidence, and the distinction is the entire reason this gate exists.
 */
export interface SourceDocument {
  url: string;
  /** Text as fetched. Stored so a verdict can be re-checked against what was actually read. */
  text: string;
}

export interface Grounding {
  claim: Claim;
  grounded: boolean;
  /** The passage that supports it, quoted from the fetched document. */
  span?: string;
  sourceUrl?: string;
  /** Why it failed, when it did. */
  note?: string;
}

/**
 * Locates a supporting passage, or reports that there is none.
 *
 * An interface rather than a call so the gate is testable without a model and without a
 * network, and so a stronger grounder can replace a weaker one without touching the gate.
 */
export type Grounder = (claim: Claim, sources: SourceDocument[]) => Promise<Grounding>;

export interface GateResult {
  passed: boolean;
  groundings: Grounding[];
  /** Share of claims with a located passage. */
  coverage: number;
  failures: Grounding[];
}

/**
 * Every claim must be grounded.
 *
 * Not a percentage: a threshold below one means some claims ship ungrounded, and the ones
 * that fail to ground are exactly the ones most likely to be wrong. A claim that cannot be
 * supported is removed or rewritten, not averaged away.
 */
export async function runGroundingGate(
  claims: Claim[],
  sources: SourceDocument[],
  ground: Grounder,
): Promise<GateResult> {
  if (sources.length === 0) {
    return {
      passed: false,
      groundings: [],
      coverage: 0,
      failures: claims.map((claim) => ({ claim, grounded: false, note: "no source document was fetched" })),
    };
  }

  const groundings: Grounding[] = [];
  for (const claim of claims) groundings.push(await ground(claim, sources));

  const failures = groundings.filter((g) => !g.grounded);
  return {
    passed: failures.length === 0 && claims.length > 0,
    groundings,
    coverage: claims.length === 0 ? 0 : (claims.length - failures.length) / claims.length,
    failures,
  };
}

export function formatFailures(slug: string, result: GateResult): string {
  return result.failures
    .map(
      (f) =>
        `${slug}: claim not grounded (${f.claim.section})\n` +
        `  claim: ${f.claim.text}\n` +
        `  why:   ${f.note ?? "no passage in any fetched source supports it"}\n` +
        `  fix:   cite a source that states it, rewrite the claim to what the sources support, or remove it`,
    )
    .join("\n\n");
}
