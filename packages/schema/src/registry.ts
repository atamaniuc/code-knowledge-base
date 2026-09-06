import { z } from "zod";
import { Domain, IsoDate } from "./common.js";

/**
 * Domain tree with market weights. Weights are recomputed from the vacancy
 * frequency map before any bulk generation — they decide depth per domain.
 */
export const DomainsFile = z.strictObject({
  domains: z
    .array(
      z.strictObject({
        id: Domain,
        title: z.string().min(1),
        description: z.string().min(10),
        /** Target number of reviewed questions. Provisional until the vacancy map lands. */
        target_questions: z.number().int().min(0),
        /** 0..1 share of market demand; recomputed from job postings. */
        market_weight: z.number().min(0).max(1).optional(),
        /**
         * Whether questions in this domain must pin a technology and version.
         * False for behavioural domains, where there is no technology to pin.
         */
        requires_tech: z.boolean().default(true),
      }),
    )
    .min(1),
});

/**
 * External content sources and their licenses.
 *
 * The license gate is legal, not stylistic: importing from a source without
 * `commercial_ok` poisons a product that is meant to be sold.
 */
export const SourcesFile = z.strictObject({
  sources: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        name: z.string().min(1),
        url: z.url(),
        kind: z.enum(["github", "md", "dir"]),
        license: z.string().min(1),
        license_verified_at: IsoDate,
        commercial_ok: z.boolean(),
        attribution_required: z.boolean(),
        commit: z.string().min(7).optional(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});

/**
 * Gazetteer for vacancy parsing: canonical technology -> aliases.
 * A closed vocabulary beats a small language model here — deterministic and testable.
 */
export const TechAliasesFile = z.strictObject({
  technologies: z
    .array(
      z.strictObject({
        canonical: z.string().min(1),
        domain: Domain,
        aliases: z.array(z.string().min(1)).default([]),
      }),
    )
    .min(1),
});

export type DomainsFile = z.infer<typeof DomainsFile>;
export type SourcesFile = z.infer<typeof SourcesFile>;
export type TechAliasesFile = z.infer<typeof TechAliasesFile>;
