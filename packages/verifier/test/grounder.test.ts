import { describe, expect, it } from "vitest";
import type { SourceDocument } from "../src/gate.js";
import { type ModelClient, modelGrounder } from "../src/grounder.js";

const claim = { index: 0, section: "S", text: "Recall at k is the ceiling on downstream quality." };
const sources: SourceDocument[] = [
  { url: "https://example.com/a", text: "Recall at k is the ceiling on everything downstream in a retrieval pipeline." },
];
const client = (reply: string): ModelClient => ({ complete: async () => reply });

describe("model grounder", () => {
  it("accepts a span that appears in the cited document", async () => {
    const ground = modelGrounder(client('{"grounded":true,"source":0,"span":"Recall at k is the ceiling on everything downstream"}'));
    const result = await ground(claim, sources);
    expect(result.grounded).toBe(true);
    expect(result.sourceUrl).toBe("https://example.com/a");
  });

  it("rejects a span the document does not contain", async () => {
    // Without this check the gate accepts a fabricated quote — the same failure it exists
    // to catch, one level up.
    const ground = modelGrounder(client('{"grounded":true,"source":0,"span":"Recall at k triples latency above 40k tokens"}'));
    const result = await ground(claim, sources);
    expect(result.grounded).toBe(false);
    expect(result.note).toContain("does not appear");
  });

  it("matches a quote across whitespace and case differences", async () => {
    const ground = modelGrounder(client('{"grounded":true,"source":0,"span":"recall at   K IS the ceiling"}'));
    expect((await ground(claim, sources)).grounded).toBe(true);
  });

  it("carries the reason through when the model finds nothing", async () => {
    const ground = modelGrounder(client('{"grounded":false,"reason":"the documents do not mention latency"}'));
    const result = await ground(claim, sources);
    expect(result.grounded).toBe(false);
    expect(result.note).toContain("do not mention latency");
  });

  it("fails closed on an unparseable reply", async () => {
    // A grounder that errors must not be read as a pass.
    const result = await modelGrounder(client("I think that's probably right!"))(claim, sources);
    expect(result.grounded).toBe(false);
  });

  it("fails closed when the cited source index does not exist", async () => {
    const ground = modelGrounder(client('{"grounded":true,"source":7,"span":"Recall at k is the ceiling"}'));
    expect((await ground(claim, sources)).grounded).toBe(false);
  });
});
