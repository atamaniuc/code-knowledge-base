import { z } from "zod";
import { Domain, IsoDate, Level, ReviewStatus, Slug, Source, Tech } from "./common.js";

/**
 * Frontmatter of a wiki article. The article body is Markdown below the frontmatter.
 *
 * The wiki is the source of truth for facts; questions are derived from it and
 * reference it. Updating an article is what propagates freshness.
 */
export const WikiFrontmatter = z.strictObject({
  slug: Slug,
  title: z.string().min(1),
  lang: z.enum(["en", "ru"]),

  domain: Domain,
  topic: z.string().min(1),
  tech: Tech,
  levels: z.array(Level).min(1),

  summary: z.string().min(20),
  /** Articles that must be read first. Forms the learning-order graph. */
  prerequisites: z.array(Slug).default([]),
  related: z.array(Slug).default([]),
  sources: z.array(Source).min(1),

  review_status: ReviewStatus,
  reviewed_at: IsoDate.optional(),
  reviewed_by: z.string().min(1).optional(),
});

export type WikiFrontmatter = z.infer<typeof WikiFrontmatter>;
