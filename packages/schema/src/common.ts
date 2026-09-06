import { z } from "zod";

export const LEVELS = ["junior", "middle", "senior", "staff", "head"] as const;
/** "any" marks a question that applies regardless of track — soft skills, leadership, process. */
export const TRACKS = ["frontend", "backend", "fullstack", "any"] as const;
export const REVIEW_STATUSES = ["imported", "draft", "reviewed", "verified"] as const;

/** Statuses whose content may ship to a trainer session or a public surface. */
export const SHIPPABLE_STATUSES = ["reviewed", "verified"] as const;

export const Level = z.enum(LEVELS);
export const Track = z.enum(TRACKS);
export const ReviewStatus = z.enum(REVIEW_STATUSES);

export const Slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case: lowercase letters, digits and single hyphens");

export const Domain = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case and match a key in content/domains.yaml");

export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date, YYYY-MM-DD");

/** A technology plus the version range the statement is true for. Versions are what goes stale. */
export const Tech = z.strictObject({
  name: z.string().min(1),
  version_range: z.string().min(1),
});

/** An external reference backing a factual claim. */
export const Source = z.strictObject({
  title: z.string().min(1),
  url: z.url(),
  kind: z.enum(["official-docs", "rfc", "spec", "release-notes", "paper", "book", "article"]),
});

/** Where an imported item came from, pinned to an exact commit. */
export const Provenance = z.strictObject({
  source_id: z.string().min(1),
  path: z.string().min(1),
  anchor: z.string().optional(),
  commit: z.string().min(7),
  imported_at: IsoDate,
});

export type Level = z.infer<typeof Level>;
export type Track = z.infer<typeof Track>;
export type ReviewStatus = z.infer<typeof ReviewStatus>;
export type Tech = z.infer<typeof Tech>;
export type Source = z.infer<typeof Source>;
