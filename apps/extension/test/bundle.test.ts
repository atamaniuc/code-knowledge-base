import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nextUp, type ReviewLog } from "@scheduling/index.js";

const dist = join(import.meta.dirname, "../dist");
const bundle = JSON.parse(readFileSync(join(dist, "content.json"), "utf8")) as {
  questions: { id: string; review_status: string; probes: string }[];
  domains: string[];
};

/** No history at all: every question the selector accepts is unseen, and so is due. */
const emptyLog: ReviewLog = {
  latest: () => undefined,
  dueIds: () => [],
  seenIds: () => new Set<string>(),
};

/**
 * The panel and the CLI pick a session with the same `nextUp`, which starts only from
 * promoted content. A bundle that dropped `review_status` passed every other test and
 * drilled nothing, so the contract with the selector is asserted here rather than
 * discovered by loading the extension.
 */
describe("bundled bank", () => {
  it("yields a session from an empty review log", () => {
    expect(nextUp(bundle.questions as never[], emptyLog, {}).length).toBeGreaterThan(0);
  });

  it("ships every question on a rung the selector accepts", () => {
    expect(bundle.questions.length).toBeGreaterThan(0);
    for (const q of bundle.questions) {
      expect(["auto_verified", "verified"]).toContain(q.review_status);
    }
  });
});
