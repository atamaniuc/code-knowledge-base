import { z } from "zod";
import { Domain, IsoDate, Level, Provenance, ReviewStatus, Slug, Source, Tech, Track } from "./common.js";

/**
 * One bullet of an expected answer.
 *
 * Bullets exist so the evaluator can score coverage per point and derive a level
 * from which points were hit. A prose answer cannot be scored reproducibly.
 */
export const ExpectedAnswerBullet = z.strictObject({
  text: z.string().min(10),
  weight: z.number().int().min(1).max(5),
  min_level: Level,
});

/** A pointer from a question back to the wiki section it was derived from. */
export const WikiRef = z.strictObject({
  slug: Slug,
  anchor: z.string().min(1),
  /** reviewed_at of the article at derivation time; drift means the question needs re-review. */
  wiki_reviewed_at: IsoDate,
});

export const Question = z.strictObject({
  id: z.uuid(),
  slug: Slug,
  lang: z.enum(["en", "ru"]),

  domain: Domain,
  topic: z.string().min(1),
  subtopic: z.string().min(1).optional(),

  tracks: z.array(Track).min(1),
  levels: z.array(Level).min(1),

  /**
   * Optional at the schema level, required by cross-file rule for any domain whose
   * registry entry sets `requires_tech`. A behavioural question has no technology and
   * no version; a technical one must pin both, since versions are what goes stale.
   */
  tech: Tech.optional(),

  question: z.string().min(10),

  /**
   * What the interviewer is actually assessing.
   *
   * Often not the same as the facts in the answer: an opening question may be
   * probing whether the choice of profession was deliberate, and a design question
   * may be probing whether trade-offs get named at all. Required, because an author
   * who cannot say what is being tested has not understood the question.
   */
  probes: z.string().min(15),

  expected_answer: z.array(ExpectedAnswerBullet).min(2),

  /**
   * How to structure the answer out loud. Coaching, not content — the order to say
   * things in, what to open with, what to keep short. Optional: a narrow factual
   * question does not need it, an open or behavioural one is nearly useless without it.
   */
  answer_strategy: z.string().min(30).optional(),

  follow_ups: z.array(z.string().min(10)).default([]),
  common_mistakes: z.array(z.string().min(10)).default([]),
  related_questions: z.array(Slug).default([]),

  wiki_refs: z.array(WikiRef).min(1),
  sources: z.array(Source).min(1),

  difficulty: z.number().int().min(1).max(5),
  estimated_minutes: z.number().int().min(1).max(60),

  review_status: ReviewStatus,
  reviewed_at: IsoDate.optional(),
  /** Which gate run promoted this. Identifies a trace in the archive, not a person. */
  verified_by: z.string().min(1).optional(),
  provenance: Provenance.optional(),
});

export type Question = z.infer<typeof Question>;
export type ExpectedAnswerBullet = z.infer<typeof ExpectedAnswerBullet>;
