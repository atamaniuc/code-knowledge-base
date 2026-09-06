import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectLevel, extract, loadGazetteer, segment } from "../src/gazetteer.js";

const gazetteer = loadGazetteer(join(import.meta.dirname, "../../../content/tech-aliases.yaml"));
const names = (text: string) => extract(text, gazetteer).map((m) => m.canonical).sort();

describe("extraction", () => {
  it("matches canonical names and aliases, including Cyrillic ones", () => {
    expect(names("We use PostgreSQL and k8s")).toEqual(["Kubernetes", "PostgreSQL"]);
    expect(names("Опыт с постгрес и кубер")).toEqual(["Kubernetes", "PostgreSQL"]);
  });

  it("matches names that punctuation would break a word boundary on", () => {
    // \b fails after a trailing dot, so "Node.js" needs its own boundary handling.
    expect(names("Strong Node.js background")).toEqual(["Node.js"]);
    expect(names("Next.js, please")).toEqual(["Next.js"]);
  });

  it("prefers the longest match when one term nests inside another", () => {
    // "js" is an alias of JavaScript and sits inside "Node.js"; a dot is not a word
    // boundary, so without longest-match-wins every Node.js mention inflates JavaScript.
    expect(names("Strong Node.js background")).toEqual(["Node.js"]);
    expect(names("We build with Next.js")).toEqual(["Next.js"]);
    expect(names("Plain JavaScript and Node.js")).toEqual(["JavaScript", "Node.js"]);
  });

  it("does not match a name embedded in a longer word", () => {
    expect(names("We are a goldmine of opportunity")).toEqual([]);
    expect(names("redistribution logistics")).toEqual([]);
  });

  it("reports each technology once however often it appears", () => {
    expect(names("Redis, Redis and more Redis")).toEqual(["Redis"]);
  });
});

describe("requirement strength", () => {
  const posting = `Requirements:
- Strong TypeScript and Node.js
Nice to have:
- Kubernetes
- Terraform`;

  it("separates required from optional by section heading", () => {
    const byName = new Map(extract(posting, gazetteer).map((m) => [m.canonical, m.strength]));
    expect(byName.get("Node.js")).toBe("required");
    expect(byName.get("Kubernetes")).toBe("optional");
    expect(byName.get("Terraform")).toBe("optional");
  });

  it("treats a technology as required if any section requires it", () => {
    const both = `Nice to have:
- Redis
Requirements:
- Redis in production`;
    expect(extract(both, gazetteer).find((m) => m.canonical === "Redis")?.strength).toBe("required");
  });

  it("carries the section forward across lines", () => {
    const segments = segment("Nice to have:\n- Docker\n- AWS");
    expect(segments.every((s) => s.strength === "optional")).toBe(true);
  });

  it("starts a posting in the required section", () => {
    expect(segment("We need Docker")[0]?.strength).toBe("required");
  });
});

describe("negation", () => {
  it("ignores a technology that is explicitly not required", () => {
    // Without this the frequency map recommends studying what a posting rules out.
    expect(names("No Kubernetes experience required")).toEqual([]);
    expect(names("Backend work without Docker")).toEqual([]);
  });

  it("does not let a negation earlier in the line swallow a later requirement", () => {
    expect(names("No prior finance experience needed. Strong Redis skills.")).toEqual(["Redis"]);
  });
});

describe("level detection", () => {
  it("reads the level from the title first", () => {
    expect(detectLevel("Senior Software Engineer")).toBe("senior");
    expect(detectLevel("Staff Backend Engineer")).toBe("staff");
    expect(detectLevel("Head of Engineering")).toBe("head");
  });

  it("prefers the most senior match when a title carries several", () => {
    expect(detectLevel("Senior Staff Engineer")).toBe("staff");
  });

  it("falls back to the body, then to years of experience", () => {
    expect(detectLevel("Software Engineer", "We are hiring a senior developer")).toBe("senior");
    expect(detectLevel("Software Engineer", "6+ years of backend experience")).toBe("senior");
    expect(detectLevel("Software Engineer", "10 years building platforms")).toBe("staff");
    expect(detectLevel("Software Engineer", "3 years of experience")).toBe("middle");
  });

  it("returns null rather than guessing when nothing indicates a level", () => {
    expect(detectLevel("Software Engineer", "Join our team")).toBeNull();
  });
});
