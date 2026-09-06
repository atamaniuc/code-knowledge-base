import { describe, expect, it } from "vitest";
import type { Question } from "@schema/question.js";
import { type BulletVerdict, LEVEL_THRESHOLD, assess, studyRefs } from "../src/assess.js";
import { BULLETS, GOLDEN } from "./golden.js";

const question = (bullets = BULLETS): Question =>
  ({
    id: "11111111-1111-4111-8111-111111111111",
    slug: "q",
    lang: "en",
    domain: "caching",
    topic: "invalidation",
    tracks: ["backend"],
    levels: ["senior"],
    question: "Explain a cache stampede and how to prevent it.",
    probes: "Whether they reason about concurrency rather than reciting patterns.",
    expected_answer: bullets,
    follow_ups: [],
    common_mistakes: [],
    related_questions: [],
    wiki_refs: [{ slug: "cache-stampede", anchor: "single-flight", wiki_reviewed_at: "2026-09-06" }],
    sources: [{ title: "t", url: "https://example.com", kind: "official-docs" }],
    difficulty: 4,
    estimated_minutes: 8,
    review_status: "draft",
  }) as unknown as Question;

describe("golden set: coverage to level", () => {
  // Labels are true by construction — the rule is arithmetic over the stated coverage,
  // so a failure here is a bug in the rule, never a disagreement about taste.
  for (const c of GOLDEN) {
    it(`${c.name} -> ${c.expected ?? "no level"}`, () => {
      const verdicts = c.coverage.map((coverage, index) => ({ index, coverage }));
      expect(assess(question(), verdicts).level, c.rationale).toBe(c.expected);
    });
  }

  it("covers both sides of the threshold", () => {
    // A golden set that only contains easy cases proves nothing about the boundary.
    expect(GOLDEN.some((c) => c.name.includes("at the threshold"))).toBe(true);
    expect(GOLDEN.some((c) => c.name.includes("just below"))).toBe(true);
  });
});

describe("assessment detail", () => {
  const all = (coverage: "covered" | "partial" | "missing") =>
    BULLETS.map((_, index) => ({ index, coverage }) as const);

  it("names what is missing for the next level up", () => {
    const verdicts: BulletVerdict[] = [0, 1, 2, 3, 4, 5].map((index) => ({ index, coverage: "covered" }));
    verdicts.push({ index: 6, coverage: "missing" });
    const result = assess(question(), verdicts);
    expect(result.level).toBe("senior");
    expect(result.nextLevel?.level).toBe("staff");
    expect(result.nextLevel?.missing.map((b) => b.min_level)).toEqual(["staff"]);
  });

  it("has no next level once the top is reached", () => {
    expect(assess(question(), all("covered")).nextLevel).toBeNull();
  });

  it("reports a weighted score independent of the level", () => {
    expect(assess(question(), all("covered")).score).toBe(1);
    expect(assess(question(), all("missing")).score).toBe(0);
    expect(assess(question(), all("partial")).score).toBe(0.5);
  });

  it("points at the wiki only when something was missed", () => {
    expect(studyRefs(question(), assess(question(), all("covered")))).toEqual([]);
    expect(studyRefs(question(), assess(question(), all("missing")))).toHaveLength(1);
  });

  it("treats an unjudged bullet as missing rather than ignoring it", () => {
    // A judge that returns fewer verdicts than bullets must not inflate the level.
    const result = assess(question(), [{ index: 0, coverage: "covered" }]);
    expect(result.level).toBe("middle");
  });

  it("keeps the threshold below full coverage", () => {
    // At 1.0 a single missed bullet is indistinguishable from a blank answer.
    expect(LEVEL_THRESHOLD).toBeLessThan(1);
    expect(LEVEL_THRESHOLD).toBeGreaterThan(0.5);
  });
});
