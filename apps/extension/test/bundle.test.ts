import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nextUp, type ReviewLog } from "@scheduling/index.js";
import { toSelectorPool } from "../src/bundle.js";

const dist = join(import.meta.dirname, "../dist");

/** The bundler's own output, typed just enough to assert the contract the panel reads. */
interface DistQuestion {
  id: string;
  slug: string;
  domain: string;
  topic: string;
  levels: string[];
  tech: string | null;
  probes: string;
  expected: unknown[];
  /** camelCase, like answerStrategy/followUps/wikiRefs; see docs/extension-bundle.md. */
  reviewStatus: string;
  minutes: number;
  difficulty: number;
  wikiRefs: { slug: string; anchor: string }[];
}
interface DistArticle {
  slug: string;
  title: string;
  domain: string;
  summary: string;
  body: string;
}
interface DistDomain {
  id: string;
  title: string;
  description: string;
}
interface DistPlanEntry {
  id: string;
  slug: string;
  domain: string;
  levels: string[];
  reason: string;
}
interface DistPlan {
  source: { title: string; url: string; level: string; capturedAt: string };
  levels: string[];
  emphasis: { domain: string; required: string[]; optional: string[] }[];
  core: DistPlanEntry[];
  stretch: DistPlanEntry[];
  gaps: { domain: string; technologies: string[] }[];
}
interface DistBundle {
  schema: number;
  generatedAt: string;
  questions: DistQuestion[];
  wiki: DistArticle[];
  domains: DistDomain[];
  levels: string[];
  plan: DistPlan | null;
}

const bundle = JSON.parse(readFileSync(join(dist, "content.json"), "utf8")) as DistBundle;

/** No history at all: every question the selector accepts is unseen, and so is due. */
const emptyLog: ReviewLog = {
  latest: () => undefined,
  dueIds: () => [],
  seenIds: () => new Set<string>(),
};

/**
 * The panel and the CLI pick a session with the same `nextUp`, which starts only from
 * promoted content. A bundle that dropped the promotion status passed every other test and
 * drilled nothing, so the contract with the selector is asserted here — through the panel's
 * own bridge, `toSelectorPool`, which is what actually hands the shipped bundle to
 * the selector — rather than discovered by loading the extension.
 */
describe("bundled bank", () => {
  it("is content bundle schema 2", () => {
    expect(bundle.schema).toBe(2);
    expect(typeof bundle.generatedAt).toBe("string");
    expect(bundle.generatedAt.length).toBeGreaterThan(0);
  });

  it("carries the domain registry, not just the ids used by questions", () => {
    // The panel labels a filter and an emphasis chip with the title; an id alone reads as "backend-node".
    expect(bundle.domains.length).toBeGreaterThan(0);
    for (const domain of bundle.domains) {
      expect(domain.id.length).toBeGreaterThan(0);
      expect(domain.title.length).toBeGreaterThan(0);
      expect(typeof domain.description).toBe("string");
    }
  });

  it("ships every question with what it probes", () => {
    // The field that distinguishes this from a flashcard deck must survive the bundler.
    expect(bundle.questions.length).toBeGreaterThan(0);
    expect(bundle.questions.every((q) => q.probes.length > 0)).toBe(true);
  });

  it("ships every question in a shape the panel can render", () => {
    for (const question of bundle.questions) {
      expect(question.id.length, question.slug).toBeGreaterThan(0);
      expect(question.levels.length, question.slug).toBeGreaterThan(0);
      expect(question.expected.length, question.slug).toBeGreaterThan(0);
      expect(question.wikiRefs.length, question.slug).toBeGreaterThan(0);
      expect(question.minutes, question.slug).toBeGreaterThan(0);
      expect(question.difficulty, question.slug).toBeGreaterThanOrEqual(1);
      expect(question.difficulty, question.slug).toBeLessThanOrEqual(5);
      expect(question.tech === null || typeof question.tech === "string", question.slug).toBe(true);
    }
  });

  it("ships every question on a rung the selector accepts", () => {
    for (const question of bundle.questions) {
      expect(["auto_verified", "verified"], question.slug).toContain(question.reviewStatus);
    }
  });

  it("ships a wiki article for every reference a question makes", () => {
    const slugs = new Set(bundle.wiki.map((article) => article.slug));
    for (const question of bundle.questions) {
      for (const ref of question.wikiRefs) expect(slugs.has(ref.slug), question.slug + " -> " + ref.slug).toBe(true);
    }
  });

  it("ships a body and a summary for every wiki article", () => {
    // The offline promise: "read this section" has to resolve inside the package.
    expect(bundle.wiki.length).toBeGreaterThan(0);
    for (const article of bundle.wiki) {
      expect(article.title.length, article.slug).toBeGreaterThan(0);
      expect(article.summary.length, article.slug).toBeGreaterThan(0);
      expect(article.body.trim().length, article.slug).toBeGreaterThan(0);
    }
  });

  it("yields a session from an empty review log", () => {
    // The shipped shape is the panel's, not the schema's: the bridge maps it onto the
    // review_status the shared selector reads, so it is part of what is asserted here.
    const pool = toSelectorPool(bundle.questions as unknown as Parameters<typeof toSelectorPool>[0]);
    expect(nextUp(pool as never[], emptyLog, {}).length).toBeGreaterThan(0);
  });
});

describe("baked plan", () => {
  it.skipIf(bundle.plan === null)("names only questions this bundle carries", () => {
    if (!bundle.plan) return;
    const ids = new Set(bundle.questions.map((question) => question.id));
    // The bundler trims entries it cannot resolve; anything left over would drill nothing.
    for (const entry of [...bundle.plan.core, ...bundle.plan.stretch]) {
      expect(ids.has(entry.id), entry.slug).toBe(true);
    }
  });

  it.skipIf(bundle.plan === null)("explains every entry it asks you to rehearse", () => {
    if (!bundle.plan) return;
    for (const entry of [...bundle.plan.core, ...bundle.plan.stretch]) {
      expect(entry.reason.length, entry.slug).toBeGreaterThan(0);
      expect(entry.domain.length, entry.slug).toBeGreaterThan(0);
    }
  });

  it.skipIf(bundle.plan === null)("describes the posting it was built from", () => {
    if (!bundle.plan) return;
    expect(bundle.plan.source.title.length).toBeGreaterThan(0);
    expect(bundle.plan.source.capturedAt.length).toBeGreaterThan(0);
    expect(bundle.plan.levels.length).toBeGreaterThan(0);
  });

  it.skipIf(bundle.plan === null)("keeps emphasis inside the domain registry", () => {
    if (!bundle.plan) return;
    const ids = new Set(bundle.domains.map((domain) => domain.id));
    for (const emphasis of bundle.plan.emphasis) {
      expect(ids.has(emphasis.domain), emphasis.domain).toBe(true);
      expect(emphasis.required.length + emphasis.optional.length, emphasis.domain).toBeGreaterThan(0);
    }
  });
});
