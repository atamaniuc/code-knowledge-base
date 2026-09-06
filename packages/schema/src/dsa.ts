import { z } from "zod";
import { IsoDate, ReviewStatus, Slug, Source } from "./common.js";

/**
 * Normalized complexity classes, ordered from cheapest to most expensive.
 * The order is what lets CI prove an optimal approach actually beats the naive one.
 */
export const COMPLEXITY_CLASSES = [
  "O(1)",
  "O(log n)",
  "O(sqrt n)",
  "O(n)",
  "O(n log n)",
  "O(n^2)",
  "O(n^2 log n)",
  "O(n^3)",
  "O(2^n)",
  "O(n!)",
] as const;

export const Complexity = z.enum(COMPLEXITY_CLASSES);
export type Complexity = z.infer<typeof Complexity>;

export function complexityRank(c: Complexity): number {
  return COMPLEXITY_CLASSES.indexOf(c);
}

const Cost = z.strictObject({
  time: Complexity,
  space: Complexity,
});

/**
 * Foundation material on complexity: what Big O is and how to recognize it
 * from the shape of code. Studied before any pattern.
 */
export const DsaConcept = z.strictObject({
  slug: Slug,
  title: z.string().min(1),
  lang: z.enum(["en", "ru"]),
  summary: z.string().min(20),
  body: z.string().min(100),
  /** Code shape -> complexity it implies. The trainable half of the concept. */
  recognition_rules: z
    .array(
      z.strictObject({
        code_shape: z.string().min(5),
        implies: Complexity,
        why: z.string().min(10),
      }),
    )
    .min(1),
  sources: z.array(Source).min(1),
  review_status: ReviewStatus,
  reviewed_at: IsoDate.optional(),
  verified_by: z.string().min(1).optional(),
});

/** One of the ~20 canonical patterns. */
export const DsaPattern = z.strictObject({
  slug: Slug,
  title: z.string().min(1),
  lang: z.enum(["en", "ru"]),
  /** Cues in the problem statement that should make you reach for this pattern. */
  recognition_cues: z.array(z.string().min(10)).min(2),
  template: z.string().min(50),
  target_cost: Cost,
  common_mistakes: z.array(z.string().min(10)).default([]),
  related_concepts: z.array(Slug).default([]),
  sources: z.array(Source).min(1),
  review_status: ReviewStatus,
  reviewed_at: IsoDate.optional(),
  verified_by: z.string().min(1).optional(),
});

const Approach = z.strictObject({
  idea: z.string().min(20),
  cost: Cost,
});

/**
 * A curated problem, linked out to LeetCode/NeetCode. We never re-implement the judge.
 * The teaching unit is the delta between the naive and the optimal approach.
 */
export const DsaTask = z
  .strictObject({
    slug: Slug,
    title: z.string().min(1),
    lang: z.enum(["en", "ru"]),
    pattern: Slug,
    url: z.url(),

    naive_approach: Approach.extend({
      /** Where it breaks: input size that TLEs, which work is repeated. */
      breaks_at: z.string().min(15),
    }),
    optimal_approach: Approach.extend({
      /** The single realization that turns naive into optimal. */
      key_insight: z.string().min(20),
    }),
    delta: z.string().min(20),

    review_status: ReviewStatus,
    reviewed_at: IsoDate.optional(),
    verified_by: z.string().min(1).optional(),
  })
  .refine(
    (t) => {
      const timeGain = complexityRank(t.optimal_approach.cost.time) - complexityRank(t.naive_approach.cost.time);
      const spaceGain = complexityRank(t.optimal_approach.cost.space) - complexityRank(t.naive_approach.cost.space);
      // Beating the time bound is the transition worth teaching, and paying for it
      // with space is the canonical way to do it — so a space regression is allowed
      // whenever time improves. Only when time is unchanged must space improve.
      return timeGain < 0 || (timeGain === 0 && spaceGain < 0);
    },
    {
      error:
        "optimal_approach must beat naive_approach on time, or match it on time while using less space. " +
        "Identical costs mean the task teaches no transition — pick a weaker naive approach or a different task.",
      path: ["optimal_approach", "cost"],
    },
  );

export type DsaConcept = z.infer<typeof DsaConcept>;
export type DsaPattern = z.infer<typeof DsaPattern>;
export type DsaTask = z.infer<typeof DsaTask>;
