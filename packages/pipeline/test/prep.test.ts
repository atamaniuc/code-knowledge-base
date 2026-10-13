import { describe, expect, it } from "vitest";
import type { Question } from "@schema/question.js";
import { buildPrepPlan, type JobProfile, targetLevels, toBundlePlan } from "../src/prep.js";

const q = (over: Partial<Question> & { id: string; slug: string; domain: string }): Question =>
  ({
    lang: "en",
    topic: "architecture",
    tracks: ["backend"],
    levels: ["senior"],
    question: "Question text long enough to pass the schema.",
    probes: "Whether the candidate reasons rather than recites.",
    expected_answer: [
      { text: "First bullet of the answer.", weight: 5, min_level: "middle" },
      { text: "Second bullet of the answer.", weight: 4, min_level: "senior" },
    ],
    follow_ups: [],
    common_mistakes: [],
    related_questions: [],
    wiki_refs: [{ slug: "a", anchor: "b", wiki_reviewed_at: "2026-09-06" }],
    sources: [{ title: "t", url: "https://example.com", kind: "official-docs" }],
    difficulty: 3,
    estimated_minutes: 5,
    review_status: "draft",
    ...over,
  }) as Question;

/** The posting under test: two hard requirements, one nice-to-have. */
const profile: JobProfile = {
  title: "Senior Node.js Engineer",
  url: "https://example.com/job",
  level: "senior",
  mentions: [
    { canonical: "NestJS", domain: "backend-node", strength: "required" },
    { canonical: "Apache Kafka", domain: "messaging", strength: "required" },
    { canonical: "Redis", domain: "caching", strength: "optional" },
  ],
};

const questions = [
  q({
    id: "1",
    slug: "nestjs-boundaries",
    domain: "backend-node",
    tech: { name: "NestJS", version_range: ">=10" },
  }),
  q({ id: "2", slug: "kafka-outbox", domain: "messaging", levels: ["senior", "staff"] }),
  q({ id: "3", slug: "cache-stampede", domain: "caching", levels: ["middle"] }),
  q({ id: "4", slug: "agent-loop", domain: "agentic", levels: ["staff"] }),
  q({ id: "5", slug: "http-basics", domain: "network", levels: ["junior"] }),
];

describe("targetLevels", () => {
  it("rehearses the stated band and everything above it", () => {
    expect(targetLevels("senior")).toEqual(["senior", "staff", "head"]);
    expect(targetLevels("junior")).toEqual(["junior", "middle", "senior", "staff", "head"]);
  });

  it("defaults to senior when the posting states no level", () => {
    // The awkward middle case: a posting with no level word is not a junior posting.
    expect(targetLevels(null)).toEqual(["senior", "staff", "head"]);
  });
});

describe("buildPrepPlan", () => {
  it("orders stated requirements first, sharpened by a technology the question names", () => {
    const plan = buildPrepPlan(questions, profile, { stretchDomains: ["agentic"] });
    expect(plan.core.map((r) => r.question.slug)).toEqual(["nestjs-boundaries", "kafka-outbox"]);
    expect(plan.core[0]?.reasons).toContain("names NestJS");
  });

  it("leaves out questions below the band the posting is hiring at", () => {
    const plan = buildPrepPlan(questions, profile);
    expect(plan.core.map((r) => r.question.slug)).not.toContain("http-basics");
    expect(plan.core.map((r) => r.question.slug)).not.toContain("cache-stampede");
  });

  it("keeps stretch questions out of the core plan", () => {
    const plan = buildPrepPlan(questions, profile, { stretchDomains: ["agentic"] });
    expect(plan.stretch.map((r) => r.question.slug)).toEqual(["agent-loop"]);
    expect(plan.core.map((r) => r.question.slug)).not.toContain("agent-loop");
  });

  it("names a requirement the bank does not cover as a gap", () => {
    // The authoring backlog: Kafka is required by the posting and nothing covers it.
    const plan = buildPrepPlan([questions[0]!], profile);
    expect(plan.gaps).toEqual([
      { domain: "caching", technologies: ["Redis"] },
      { domain: "messaging", technologies: ["Apache Kafka"] },
    ]);
  });

  it("caps the core plan so a session stays a session", () => {
    expect(buildPrepPlan(questions, profile, { limit: 1 }).core).toHaveLength(1);
  });
});

describe("toBundlePlan", () => {
  it("stores identities and reasons, not copies of the questions", () => {
    // The bundle already carries the question; a plan that duplicated it would drift from
    // the bank the moment either was edited.
    const bundle = toBundlePlan(buildPrepPlan(questions, profile), "2026-10-13T00:00:00.000Z");
    expect(bundle.core[0]).toEqual({
      id: "1",
      slug: "nestjs-boundaries",
      domain: "backend-node",
      levels: ["senior"],
      reason: "backend-node is a stated requirement; names NestJS; asks at senior, the level the posting states",
    });
    expect(bundle.source).toEqual({
      title: "Senior Node.js Engineer",
      url: "https://example.com/job",
      level: "senior",
      capturedAt: "2026-10-13T00:00:00.000Z",
    });
  });

  it("keeps the emphasis the panel shows, strongest requirement first", () => {
    const bundle = toBundlePlan(buildPrepPlan(questions, profile), "2026-10-13T00:00:00.000Z");
    expect(bundle.emphasis.map((e) => e.domain)).toEqual(["backend-node", "messaging", "caching"]);
    expect(bundle.emphasis[2]).toEqual({ domain: "caching", required: [], optional: ["Redis"] });
  });
});
