import type { Level } from "@schema/common.js";
import type { Coverage } from "../src/assess.js";

/**
 * Golden set for level derivation.
 *
 * Every label here is true **by construction**: the case states which bullets were
 * covered, and the expected level follows from the rule arithmetically. Nobody has to
 * judge whether an answer "feels senior" — that judgement belongs to the separate
 * judge test, which needs a real model.
 *
 * Bullets mirror the real cache-stampede question: weights 5,5,4,4,3,2,2 at levels
 * middle, senior x5, staff. Totals: middle 5, senior 23, staff 25.
 */
export const BULLETS = [
  { text: "Names the failure: concurrent readers all recompute against the origin.", weight: 5, min_level: "middle" },
  { text: "Burst scales with concurrency at expiry, not with average traffic.", weight: 5, min_level: "senior" },
  { text: "Single-flight via an atomic lock, and what waiting callers do.", weight: 4, min_level: "senior" },
  { text: "Sizes the lease TTL above p99 recompute and bounds it.", weight: 4, min_level: "senior" },
  { text: "Offers stale-while-revalidate and states the staleness window.", weight: 3, min_level: "senior" },
  { text: "TTL jitter for a family of keys that expire together.", weight: 2, min_level: "senior" },
  { text: "Probabilistic early recomputation scaled by measured recompute time.", weight: 2, min_level: "staff" },
] as const;

export interface GoldenCase {
  name: string;
  /** Coverage per bullet, in order. */
  coverage: Coverage[];
  expected: Level | null;
  /** Why that label follows from the rule. Reviewed by a human, not inferred by one. */
  rationale: string;
}

const C: Coverage = "covered";
const P: Coverage = "partial";
const M: Coverage = "missing";

export const GOLDEN: GoldenCase[] = [
  {
    name: "everything covered",
    coverage: [C, C, C, C, C, C, C],
    expected: "staff",
    rationale: "All levels clear both the cumulative and the introduced-bullet threshold.",
  },
  {
    name: "blank answer",
    coverage: [M, M, M, M, M, M, M],
    expected: null,
    rationale: "Nothing covered, so not even the middle bullet clears the bar.",
  },
  {
    name: "basics only",
    coverage: [C, M, M, M, M, M, M],
    expected: "middle",
    rationale: "Middle is 5/5. Senior is 5/23 = 0.22, far below 0.75.",
  },
  {
    name: "all senior points, staff point missed",
    coverage: [C, C, C, C, C, C, M],
    expected: "senior",
    rationale:
      "Cumulative staff coverage is 23/25 = 0.92 and would pass on its own; the introduced-bullet rule is what holds the level at senior, since the staff bullet is 0/2.",
  },
  {
    name: "staff point only, basics missed",
    coverage: [M, M, M, M, M, M, C],
    expected: null,
    rationale: "Middle fails at 0/5, so nothing above it can be claimed. Depth cannot substitute for basics.",
  },
  {
    name: "senior mostly covered, one light point missed",
    coverage: [C, C, C, C, C, M, M],
    expected: "senior",
    rationale: "Senior is 21/23 = 0.91 cumulative and 16/18 = 0.89 introduced. Both clear 0.75.",
  },
  {
    name: "senior heavy points missed",
    coverage: [C, M, M, C, C, C, M],
    expected: "middle",
    rationale: "Senior is 14/23 = 0.61. The two heaviest senior points carry the level and both are missing.",
  },
  {
    name: "everything half-stated",
    coverage: [P, P, P, P, P, P, P],
    expected: null,
    rationale: "Partial credit is 0.5, so every level lands at exactly 0.5 — below the 0.75 bar at middle already.",
  },
  {
    name: "basics stated fully, senior half-stated",
    coverage: [C, P, P, P, P, P, M],
    expected: "middle",
    rationale: "Middle is 5/5. Senior is (5 + 9)/23 = 0.61, so the level stops at middle.",
  },
  {
    name: "at the threshold exactly",
    coverage: [C, C, C, P, C, M, M],
    expected: "senior",
    rationale:
      "Senior cumulative is (5+5+4+2+3)/23 = 0.826 and introduced is (5+4+2+3)/18 = 0.778. Both sit just above 0.75, so the level holds.",
  },
  {
    name: "just below the threshold",
    coverage: [C, C, C, M, P, M, M],
    expected: "middle",
    rationale: "Senior cumulative is (5+5+4+1.5)/23 = 0.674. Missing the lease-TTL point drops it under the bar.",
  },
  {
    name: "staff point partial, senior complete",
    coverage: [C, C, C, C, C, C, P],
    expected: "senior",
    rationale: "The staff bullet at 0.5 gives an introduced ratio of 1/2 = 0.5, under 0.75. Half a staff answer is not a staff answer.",
  },
];
