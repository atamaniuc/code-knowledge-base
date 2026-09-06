import { describe, expect, it } from "vitest";
import { Question } from "../src/question.js";

const valid = {
  id: "27f93fee-de07-4926-b34d-df073c21f2ec",
  slug: "example-question",
  lang: "en",
  domain: "caching",
  topic: "invalidation",
  tracks: ["backend"],
  levels: ["senior"],
  tech: { name: "Redis", version_range: ">=6" },
  question: "Explain what a cache stampede is and how you would prevent it.",
  expected_answer: [
    { text: "Names concurrent misses reaching the origin.", weight: 5, min_level: "middle" },
    { text: "Explains that the burst scales with concurrency at expiry.", weight: 4, min_level: "senior" },
  ],
  wiki_refs: [{ slug: "cache-stampede", anchor: "what-happens", wiki_reviewed_at: "2026-09-06" }],
  sources: [{ title: "Redis SET", url: "https://redis.io/docs/latest/commands/set/", kind: "official-docs" }],
  difficulty: 4,
  estimated_minutes: 8,
  review_status: "draft",
};

describe("Question", () => {
  it("accepts a well-formed question", () => {
    expect(Question.safeParse(valid).success).toBe(true);
  });

  it("rejects a single-bullet expected answer", () => {
    // One bullet cannot distinguish a middle answer from a senior one.
    const result = Question.safeParse({ ...valid, expected_answer: [valid.expected_answer[0]] });
    expect(result.success).toBe(false);
  });

  it("rejects a question with no wiki reference", () => {
    // Questions are derived from the wiki; without the ref the evaluator cannot cite a section.
    const result = Question.safeParse({ ...valid, wiki_refs: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a question with no sources", () => {
    const result = Question.safeParse({ ...valid, sources: [] });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields so frontmatter typos surface", () => {
    const result = Question.safeParse({ ...valid, dificulty: 3 });
    expect(result.success).toBe(false);
  });

  it("defaults optional collections to empty arrays", () => {
    const parsed = Question.parse(valid);
    expect(parsed.follow_ups).toEqual([]);
    expect(parsed.related_questions).toEqual([]);
  });
});
