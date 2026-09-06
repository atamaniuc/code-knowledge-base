import { describe, expect, it } from "vitest";
import { type Item, doneness, readiness } from "../src/readiness.js";

const item = (over: Partial<Item> = {}): Item => ({
  id: "x",
  kind: "code",
  behavior: "The validator rejects a question whose expected answer has fewer than two bullets.",
  verification: "pnpm exec vitest run packages/schema/",
  state: "not_started",
  evidence: null,
  ...over,
});

const reasons = (v: { what: string }[]) => v.map((x) => x.what).join(" | ");

describe("definition of ready", () => {
  it("accepts an item stating an observable outcome with a runnable check", () => {
    expect(readiness(item(), [])).toEqual([]);
  });

  it("rejects an activity description", () => {
    // "Add a check" is complete when you stop typing, which is not a definition of done.
    expect(reasons(readiness(item({ behavior: "Add validation for expected answers and make sure it works." }), []))).toContain("activity");
  });

  it("rejects a behavior too short to verify", () => {
    expect(reasons(readiness(item({ behavior: "Better validation" }), []))).toContain("too short");
  });

  it("rejects an unsettled scope", () => {
    expect(reasons(readiness(item({ behavior: "The validator rejects malformed questions. TODO decide which ones." }), []))).toContain("placeholder");
  });

  it("rejects a missing verification command", () => {
    expect(reasons(readiness(item({ verification: "  " }), []))).toContain("no verification command");
  });

  it("rejects a missing kind, because code and content close differently", () => {
    expect(reasons(readiness(item({ kind: undefined }), []))).toContain("no kind");
  });

  it("blocks on an unfinished dependency", () => {
    const dep = item({ id: "dep", state: "active" });
    expect(reasons(readiness(item({ depends_on: ["dep"] }), [dep]))).toContain("is active");
  });

  it("allows a dependency that has reached a terminal state", () => {
    const dep = item({ id: "dep", state: "passing" });
    expect(readiness(item({ depends_on: ["dep"] }), [dep])).toEqual([]);
  });

  it("reports an unknown dependency rather than ignoring it", () => {
    expect(reasons(readiness(item({ depends_on: ["ghost"] }), []))).toContain("unknown dependency");
  });
});

describe("definition of done", () => {
  it("accepts a passing item with evidence", () => {
    expect(doneness(item({ evidence: "24 tests passed" }), true)).toEqual([]);
  });

  it("rejects a passing command with no evidence", () => {
    // Evidence is what makes the claim re-checkable; CI re-runs these.
    expect(reasons(doneness(item(), true))).toContain("no evidence");
  });

  it("rejects a failed verification", () => {
    expect(reasons(doneness(item({ evidence: "x" }), false))).toContain("did not pass");
  });
});
