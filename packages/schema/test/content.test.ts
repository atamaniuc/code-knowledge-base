import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateContent } from "../src/validate.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("repository content", () => {
  const result = validateContent(root);

  it("passes schema and cross-reference validation", () => {
    // Printed in full so a failure names the file and the fix, not just a count.
    expect(result.errors.join("\n\n")).toBe("");
  });

  it("has at least one article, question and DSA entity to exercise every loader", () => {
    expect(result.counts.wiki).toBeGreaterThan(0);
    expect(result.counts.questions).toBeGreaterThan(0);
    expect(result.counts.dsa_concepts).toBeGreaterThan(0);
    expect(result.counts.dsa_patterns).toBeGreaterThan(0);
    expect(result.counts.dsa_tasks).toBeGreaterThan(0);
  });
});
