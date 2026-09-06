import { describe, expect, it } from "vitest";
import { Question } from "../src/question.js";
import { explainIssue, formatIssue } from "../src/explain.js";

describe("explainIssue", () => {
  it("turns a bare schema failure into actionable guidance", () => {
    // An agent that reads "invalid schema" has to guess; these messages say what to do.
    const result = Question.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;

    const wikiRefsIssue = result.error.issues.find((i) => i.path.join(".") === "wiki_refs");
    expect(wikiRefsIssue).toBeDefined();

    const explained = explainIssue(wikiRefsIssue!);
    expect(explained.why).toContain("derived from the wiki");
    expect(explained.fix).toContain("write the article first");
  });

  it("formats an issue as what / why / fix", () => {
    const result = Question.safeParse({});
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "sources")!;
    const text = formatIssue("content/questions/x.yaml", issue);
    expect(text).toContain("content/questions/x.yaml: sources");
    expect(text).toContain("what:");
    expect(text).toContain("why:");
    expect(text).toContain("fix:");
  });

  it("still reports issues that have no tailored remedy", () => {
    const result = Question.safeParse({});
    if (result.success) return;
    const issue = result.error.issues.find((i) => i.path.join(".") === "id")!;
    const explained = explainIssue(issue);
    expect(explained.path).toBe("id");
    expect(explained.what.length).toBeGreaterThan(0);
  });
});
