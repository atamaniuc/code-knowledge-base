import { describe, expect, it } from "vitest";
import {
  articleBySlug,
  BundleError,
  domainTitle,
  humanize,
  parseBundle,
  toSelectorPool,
} from "../src/bundle.js";

const shipped = {
  schema: 4,
  generatedAt: "2026-10-13T16:37:41.191Z",
  questions: [
    {
      id: "q-1",
      slug: "rag-topk-regression",
      domain: "agentic",
      topic: "evaluation",
      subtopic: "retrieval",
      levels: ["senior", "staff"],
      tracks: ["backend"],
      tech: "RAG",
      question: "You raise top-k and quality gets worse.",
      probes: "Whether position effects are known.",
      answerStrategy: "Name the mechanism first.",
      expected: [{ text: "Position effects exist.", level: "senior", weight: 5 }],
      followUps: ["How would you pick k?"],
      mistakes: ["Calling it a paradox."],
      minutes: 6,
      difficulty: 4,
      reviewStatus: "auto_verified",
      wikiRefs: [{ slug: "evaluating-rag", anchor: "position-effects" }],
    },
  ],
  wiki: [
    {
      slug: "evaluating-rag",
      title: "Evaluating a RAG system",
      domain: "agentic",
      topic: "evaluation",
      levels: ["senior"],
      summary: "Retrieval and generation fail differently.",
      body: "## Position effects\n\nText.",
    },
  ],
  domains: [{ id: "agentic", title: "Agentic & AI-assisted development", description: "LLMs in production." }],
  levels: ["senior", "staff"],
  plan: {
    source: { title: "Senior Node.js Engineer", url: "https://example.invalid/jobs/1", level: "senior", capturedAt: "2026-10-13T16:37:41.191Z" },
    levels: ["senior", "staff"],
    emphasis: [{ domain: "agentic", required: ["RAG"], optional: ["Redis"] }],
    core: [{ id: "q-1", slug: "rag-topk-regression", domain: "agentic", levels: ["senior"], reason: "agentic is a stated requirement" }],
    stretch: [],
    gaps: [{ domain: "data", technologies: ["ClickHouse"] }],
  },
  interview: [
    {
      id: "b-1",
      slug: "finverity-senior-node-js",
      lang: "ru",
      title: "Finverity · Senior Node.js Engineer",
      summary: "Защита тестового задания и разговор с CTO.",
      target: { role: "Senior Node.js Engineer", company: "Finverity", domain: "agentic", stack: ["Node.js"] },
      stages: [{ name: "Техническое интервью", minutes: 90, note: "Защита решения." }],
      groups: [
        {
          id: "assignment-core",
          title: "Защита ядра решения",
          side: "technical",
          domain: "agentic",
          intro: "Три операции и один инвариант.",
          wikiRefs: ["evaluating-rag"],
          questions: [
            {
              id: "limit-race-atomic-update",
              question: "Два резерва одновременно. Как гарантируешь один?",
              likelihood: "high",
              tags: ["concurrency", "postgres"],
              asks: "Где живёт проверка лимита.",
              answer: ["Называю окно источником бага.", "Проверка уезжает в условие записи."],
              traps: ["Блокировка в Redis поверх строки в базе."],
              followUps: ["Что если запросы придут на разные реплики?"],
            },
          ],
        },
      ],
    },
  ],
  interviewTags: [{ id: "concurrency", title: "конкурентность" }],
};

describe("parseBundle", () => {
  it("reads the schema 4 shape field for field", () => {
    const bundle = parseBundle(shipped);
    expect(bundle.schema).toBe(4);
    expect(bundle.questions).toHaveLength(1);
    expect(bundle.questions[0]).toMatchObject({
      id: "q-1",
      subtopic: "retrieval",
      tech: "RAG",
      answerStrategy: "Name the mechanism first.",
      minutes: 6,
      difficulty: 4,
      reviewStatus: "auto_verified",
      wikiRefs: [{ slug: "evaluating-rag", anchor: "position-effects" }],
    });
    expect(bundle.questions[0]?.expected).toEqual([{ text: "Position effects exist.", level: "senior", weight: 5 }]);
    expect(bundle.levels).toEqual(["senior", "staff"]);
    expect(bundle.domains).toEqual([
      { id: "agentic", title: "Agentic & AI-assisted development", description: "LLMs in production." },
    ]);
  });

  it("reads a brief down to the question that has to be rehearsed", () => {
    const [brief] = parseBundle(shipped).interview;
    expect(brief?.target.role).toBe("Senior Node.js Engineer");
    expect(brief?.stages).toEqual([{ name: "Техническое интервью", minutes: 90, note: "Защита решения." }]);
    expect(brief?.groups[0]?.side).toBe("technical");
    expect(brief?.groups[0]?.wikiRefs).toEqual(["evaluating-rag"]);
    expect(brief?.groups[0]?.questions[0]).toEqual({
      id: "limit-race-atomic-update",
      question: "Два резерва одновременно. Как гарантируешь один?",
      likelihood: "high",
      tags: ["concurrency", "postgres"],
      asks: "Где живёт проверка лимита.",
      answer: ["Называю окно источником бага.", "Проверка уезжает в условие записи."],
      traps: ["Блокировка в Redis поверх строки в базе."],
      followUps: ["Что если запросы придут на разные реплики?"],
    });
  });

  it("normalises the plan the bundler writes", () => {
    const plan = parseBundle(shipped).plan;
    expect(plan?.source.title).toBe("Senior Node.js Engineer");
    expect(plan?.source.capturedAt).toBe("2026-10-13T16:37:41.191Z");
    expect(plan?.emphasis).toEqual([{ domain: "agentic", required: ["RAG"], optional: ["Redis"] }]);
    expect(plan?.core).toEqual([
      { id: "q-1", slug: "rag-topk-regression", domain: "agentic", levels: ["senior"], reason: "agentic is a stated requirement" },
    ]);
    expect(plan?.gaps).toEqual([{ domain: "data", technologies: ["ClickHouse"] }]);
  });

  it("refuses a file that is not a bundle", () => {
    expect(() => parseBundle(null)).toThrow(BundleError);
    expect(() => parseBundle("nope")).toThrow(BundleError);
    expect(() => parseBundle({ questions: "not an array" })).toThrow(BundleError);
  });

  it("ships the tag registry with the titles the panel draws", () => {
    expect(parseBundle(shipped).interviewTags).toEqual([{ id: "concurrency", title: "конкурентность" }]);
    expect(parseBundle({ questions: [] }).interviewTags).toEqual([]);
  });

  it("defaults what the panel can live without", () => {
    const bundle = parseBundle({ schema: 2, questions: [{ id: "q-9", domain: "data" }] });
    expect(bundle.wiki).toEqual([]);
    expect(bundle.plan).toBeNull();
    expect(bundle.interview).toEqual([]);
    expect(bundle.domains).toEqual([]);
    expect(bundle.questions[0]?.probes).toBe("");
    expect(bundle.questions[0]?.slug).toBe("q-9");
    expect(bundle.questions[0]?.tech).toBeNull();
  });

  it("derives levels from the questions when the bundle does not carry them", () => {
    const bundle = parseBundle({ questions: [{ id: "a", levels: ["staff"] }, { id: "b", levels: ["junior"] }] });
    expect(bundle.levels).toEqual(["junior", "staff"]);
    expect(bundle.schema).toBe(1);
  });
});

describe("legacy and raw shapes", () => {
  it("accepts a string domain list and snake_case question fields", () => {
    const bundle = parseBundle({
      questions: [
        { id: "q-1", domain: "backend-node", levels: ["senior"], expected: [], review_status: "verified" },
      ],
      domains: ["backend-node"],
    });
    expect(bundle.domains).toEqual([{ id: "backend-node", title: "Backend Node", description: "" }]);
    expect(bundle.questions[0]?.reviewStatus).toBe("verified");
  });

  it("reads a raw prep plan: profile, nested question entries and reasons", () => {
    const bundle = parseBundle({
      questions: [{ id: "q-1", slug: "s", domain: "backend-node", levels: ["senior"] }],
      plan: {
        captured_at: "2026-10-12T19:40:38.720Z",
        profile: {
          title: "Senior Node.js Engineer | UK FinTech Startup",
          url: "https://example.invalid/job",
          level: "senior",
          mentions: [
            { canonical: "Node.js", domain: "backend-node", strength: "required" },
            { canonical: "NestJS", domain: "backend-node", strength: "required" },
            { canonical: "Redis", domain: "caching", strength: "optional" },
          ],
        },
        levels: ["senior", "staff", "head"],
        core: [
          {
            question: { id: "q-1", slug: "s", domain: "backend-node", levels: ["senior"] },
            score: 6,
            reasons: ["backend-node is a stated requirement", "names Node.js"],
          },
        ],
        stretch: [],
        gaps: [{ domain: "infra", technologies: ["Kubernetes"] }],
      },
    });
    expect(bundle.plan?.source.level).toBe("senior");
    expect(bundle.plan?.source.capturedAt).toBe("2026-10-12T19:40:38.720Z");
    expect(bundle.plan?.emphasis).toEqual([
      { domain: "backend-node", required: ["Node.js", "NestJS"], optional: [] },
      { domain: "caching", required: [], optional: ["Redis"] },
    ]);
    expect(bundle.plan?.core[0]).toEqual({
      id: "q-1",
      slug: "s",
      domain: "backend-node",
      levels: ["senior"],
      reason: "backend-node is a stated requirement; names Node.js",
    });
  });

  it("resolves a plan entry that only carries an id", () => {
    const bundle = parseBundle({
      questions: [{ id: "q-1", slug: "known-slug", domain: "data", levels: ["staff"] }],
      plan: { core: [{ id: "q-1" }] },
    });
    expect(bundle.plan?.core[0]).toEqual({ id: "q-1", slug: "known-slug", domain: "data", levels: ["staff"], reason: "" });
  });
});

describe("helpers", () => {
  it("finds an article by slug", () => {
    const bundle = parseBundle(shipped);
    expect(articleBySlug(bundle, "evaluating-rag")?.title).toBe("Evaluating a RAG system");
    expect(articleBySlug(bundle, "missing")).toBeUndefined();
  });

  it("falls back to a humanised id when no registry title was bundled", () => {
    expect(domainTitle([], "backend-node")).toBe("Backend Node");
    expect(domainTitle([{ id: "agentic", title: "Agentic", description: "" }], "agentic")).toBe("Agentic");
    expect(humanize("head-of-development")).toBe("Head Of Development");
  });

  it("hands the shared selector the review_status it filters on", () => {
    expect(toSelectorPool(parseBundle(shipped).questions)[0]).toMatchObject({
      id: "q-1",
      review_status: "auto_verified",
      domain: "agentic",
      levels: ["senior", "staff"],
    });
  });
});
