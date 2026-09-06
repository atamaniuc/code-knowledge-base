import { describe, expect, it } from "vitest";
import type { Claim } from "../src/claims.js";
import { type Grounder, type SourceDocument, formatFailures, runGroundingGate } from "../src/gate.js";

const claim = (text: string, index = 0): Claim => ({ index, section: "S", text });
const source: SourceDocument = {
  url: "https://example.com/doc",
  text: "Recall at k is the ceiling on everything downstream in a retrieval pipeline.",
};

/** Grounds a claim when the source text shares a distinctive word with it. */
const stubGrounder: Grounder = async (c, sources) => {
  const words = c.text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 6);
  const hit = sources.find((s) => words.some((w) => s.text.toLowerCase().includes(w)));
  return hit
    ? { claim: c, grounded: true, span: hit.text, sourceUrl: hit.url }
    : { claim: c, grounded: false, note: "no passage in any fetched source supports it" };
};

describe("grounding gate", () => {
  it("passes when every claim is located in a fetched source", async () => {
    const result = await runGroundingGate([claim("Recall at k is the ceiling.")], [source], stubGrounder);
    expect(result.passed).toBe(true);
    expect(result.coverage).toBe(1);
    expect(result.groundings[0]?.span).toBeTruthy();
  });

  it("fails on a single ungrounded claim rather than averaging it away", async () => {
    // The claims that fail to ground are the ones most likely to be wrong, so a
    // percentage threshold would ship exactly the wrong ones.
    const result = await runGroundingGate(
      [claim("Recall at k is the ceiling."), claim("Latency triples above forty thousand tokens.", 1)],
      [source],
      stubGrounder,
    );
    expect(result.passed).toBe(false);
    expect(result.coverage).toBeCloseTo(0.5);
    expect(result.failures).toHaveLength(1);
  });

  it("fails when nothing was fetched", async () => {
    // Model recall is not evidence; with no document there is nothing to check against.
    const result = await runGroundingGate([claim("Anything at all here.")], [], stubGrounder);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.note).toContain("no source document");
  });

  it("does not pass an article with no claims", async () => {
    const result = await runGroundingGate([], [source], stubGrounder);
    expect(result.passed).toBe(false);
  });

  it("records the supporting passage, not just a verdict", async () => {
    // The span is what makes the verdict auditable later.
    const result = await runGroundingGate([claim("Recall at k is the ceiling.")], [source], stubGrounder);
    expect(result.groundings[0]?.sourceUrl).toBe(source.url);
  });

  it("formats a failure with the claim, the reason and what to do", async () => {
    const result = await runGroundingGate([claim("Latency triples above forty thousand tokens.")], [source], stubGrounder);
    const text = formatFailures("evaluating-rag", result);
    expect(text).toContain("claim:");
    expect(text).toContain("why:");
    expect(text).toContain("fix:");
  });
});
