import { describe, expect, it } from "vitest";
import {
  applyFilters,
  domainOptions,
  emptyState,
  hasActiveFilters,
  levelOptions,
  matchesFilters,
  matchesQuery,
  NO_FILTERS,
  statusOf,
  techOptions,
  withPinned,
} from "../src/bank.js";
import { DOMAINS, question } from "./fixture.js";

const rag = question();
const cache = question({
  id: "q-2",
  slug: "cache-stampede",
  domain: "data",
  levels: ["middle"],
  tech: "Redis",
  question: "How do you stop a cache stampede?",
  probes: "Whether single-flight with a lease is known.",
  expected: [{ text: "A lease makes one caller miss.", level: "middle", weight: 4 }],
});

describe("matchesQuery", () => {
  it("searches the question and what it probes, case-insensitively", () => {
    expect(matchesQuery(rag, "")).toBe(true);
    expect(matchesQuery(rag, "TOP-K")).toBe(true);
    expect(matchesQuery(rag, "position matters")).toBe(true);
    expect(matchesQuery(rag, "  top-k  ")).toBe(true);
  });

  it("does not search the expected answer", () => {
    expect(matchesQuery(rag, "attention")).toBe(false);
  });

  it("requires every term, so a query narrows", () => {
    expect(matchesQuery(rag, "top-k zebra")).toBe(false);
    expect(matchesQuery(rag, "top-k quality")).toBe(true);
  });
});

describe("matchesFilters", () => {
  it("matches a domain, a level and a technology exactly", () => {
    expect(matchesFilters(rag, { ...NO_FILTERS, domain: "agentic" })).toBe(true);
    expect(matchesFilters(rag, { ...NO_FILTERS, domain: "data" })).toBe(false);
    expect(matchesFilters(rag, { ...NO_FILTERS, level: "staff" })).toBe(true);
    expect(matchesFilters(rag, { ...NO_FILTERS, level: "middle" })).toBe(false);
    expect(matchesFilters(rag, { ...NO_FILTERS, tech: "RAG" })).toBe(true);
    expect(matchesFilters(rag, { ...NO_FILTERS, tech: "Redis" })).toBe(false);
  });

  it("combines every filter", () => {
    expect(applyFilters([rag, cache], { ...NO_FILTERS, level: "middle", query: "stampede" })).toEqual([cache]);
    expect(applyFilters([rag, cache], NO_FILTERS)).toEqual([rag, cache]);
  });
});

describe("hasActiveFilters", () => {
  it("is false only for the empty set", () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, query: "x" })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, tech: "RAG" })).toBe(true);
  });
});

describe("option lists", () => {
  it("lists domains present in the bank, with the registry title", () => {
    expect(domainOptions([rag, cache], DOMAINS)).toEqual([
      { value: "agentic", label: "Agentic & AI-assisted development", count: 1 },
      { value: "data", label: "Databases", count: 1 },
    ]);
  });

  it("drops a domain that no question uses", () => {
    expect(domainOptions([rag], DOMAINS).map((o) => o.value)).toEqual(["agentic"]);
  });

  it("orders levels junior to head, then anything unknown", () => {
    const options = levelOptions([rag, cache], ["staff", "middle"]);
    expect(options.map((o) => o.value)).toEqual(["middle", "senior", "staff"]);
    expect(options.map((o) => o.count)).toEqual([1, 1, 1]);
  });

  it("lists technologies sorted and drops the behavioural null", () => {
    const behavioral = question({ id: "q-3", slug: "s3", tech: null, domain: "softskills", levels: ["head"] });
    expect(techOptions([cache, rag, behavioral])).toEqual([
      { value: "RAG", label: "RAG", count: 1 },
      { value: "Redis", label: "Redis", count: 1 },
    ]);
  });
});

describe("withPinned", () => {
  it("moves the chosen question to the front without duplicating it", () => {
    expect(withPinned(cache, [rag, cache]).map((q) => q.id)).toEqual(["q-2", "q-1"]);
  });

  it("prepends a question the selector left out, and passes through when nothing is pinned", () => {
    expect(withPinned(cache, [rag]).map((q) => q.id)).toEqual(["q-2", "q-1"]);
    expect(withPinned(null, [rag])).toEqual([rag]);
  });
});

describe("statusOf", () => {
  it("reads due before seen before new", () => {
    expect(statusOf(rag, new Set(["q-1"]), new Set(["q-1"]))).toBe("due");
    expect(statusOf(rag, new Set(["q-1"]), new Set())).toBe("seen");
    expect(statusOf(rag, new Set(), new Set())).toBe("new");
  });
});

describe("emptyState", () => {
  it("separates an empty bundle from an unpromoted one", () => {
    expect(emptyState({ total: 0, promoted: 0, shown: 0, filtered: false }).title).toContain("No questions are bundled");
    expect(emptyState({ total: 10, promoted: 0, shown: 0, filtered: false }).title).toContain("promoted");
  });

  it("separates an over-filtered session from a genuinely empty queue", () => {
    expect(emptyState({ total: 10, promoted: 10, shown: 0, filtered: true }).title).toContain("filters");
    expect(emptyState({ total: 10, promoted: 10, shown: 4, filtered: true }).title).toContain("Nothing is due");
  });
});
