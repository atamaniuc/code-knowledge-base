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
  tech: Tech,

  question: z.string().min(10),
  expected_answer: z.array(ExpectedAnswerBullet).min(2),

  follow_ups: z.array(z.string().min(10)).default([]),
  common_mistakes: z.array(z.string().min(10)).default([]),
  related_questions: z.array(Slug).default([]),

  wiki_refs: z.array(WikiRef).min(1),
  sources: z.array(Source).min(1),

  difficulty: z.number().int().min(1).max(5),
  estimated_minutes: z.number().int().min(1).max(60),

  review_status: ReviewStatus,
  reviewed_at: IsoDate.optional(),
  reviewed_by: z.string().min(1).optional(),
  provenance: Provenance.optional(),
});

export type Question = z.infer<typeof Question>;
export type ExpectedAnswerBullet = z.infer<typeof ExpectedAnswerBullet>;
