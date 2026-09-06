import { describe, expect, it } from "vitest";
import { extractClaims } from "../src/claims.js";

const texts = (md: string) => extractClaims(md).map((c) => c.text);

describe("claim extraction", () => {
  it("takes assertions from prose", () => {
    const claims = extractClaims("## Retrieval\n\nRecall at k is the ceiling on everything downstream.");
    expect(claims).toHaveLength(1);
    expect(claims[0]?.section).toBe("Retrieval");
  });

  it("splits a paragraph into separate claims", () => {
    expect(texts("Input tokens are processed in parallel during prefill. Output tokens are produced one at a time.")).toHaveLength(2);
  });

  it("skips instructions to the reader", () => {
    // "Say the mechanism first" is coaching, not a fact a source can support.
    expect(texts("Say the mechanism first before proposing any fix to the system.")).toEqual([]);
  });

  it("skips questions", () => {
    expect(texts("How would you know that the retrieval layer is working at all?")).toEqual([]);
  });

  it("skips sentences too short to assert anything checkable", () => {
    expect(texts("It varies a lot.")).toEqual([]);
  });

  it("skips list items, which enumerate a claim rather than making one", () => {
    expect(texts("- Recall at k is the ceiling on everything downstream here")).toEqual([]);
  });

  it("keeps the heading a claim sits under so a failure names the section", () => {
    const md = "## Retrieval metrics\n\nRecall at k bounds every downstream metric here.\n\n## Generation\n\nFaithfulness detects unsupported claims in the answer.";
    expect(extractClaims(md).map((c) => c.section)).toEqual(["Retrieval metrics", "Generation"]);
  });

  it("ignores code blocks and inline code", () => {
    expect(texts("```\nconst x = someLongFunctionName(1, 2, 3);\n```")).toEqual([]);
  });

  it("is deterministic, so claims cannot be dropped by judgement", () => {
    // A model deciding what counts as a claim would put model judgement upstream of the
    // check meant to constrain it, and dropped claims pass by never being examined.
    const md = "## A\n\nThe burst scales with concurrency at the moment of expiry here.";
    expect(extractClaims(md)).toEqual(extractClaims(md));
  });
});
