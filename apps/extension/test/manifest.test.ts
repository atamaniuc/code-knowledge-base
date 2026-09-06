import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dist = join(import.meta.dirname, "../dist");
const read = (f: string) => readFileSync(join(dist, f), "utf8");

/**
 * These assert the product promises that are easy to break by accident and expensive to
 * discover in store review. They run against the built output, not the source.
 */
describe("built extension", () => {
  const manifest = JSON.parse(read("manifest.json")) as Record<string, unknown>;
  const panel = read("panel.js");

  it("is Manifest V3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("requests no host permissions", () => {
    // Broad host permissions are the largest cause of slow and failed store review.
    expect(manifest.host_permissions).toBeUndefined();
    expect(JSON.stringify(manifest.permissions)).not.toContain("<all_urls>");
  });

  it("loads no remote code", () => {
    // MV3 forbids it and it would break the offline guarantee regardless.
    expect(panel).not.toMatch(/https?:\/\//);
  });

  it("makes no outbound request", () => {
    // The only fetch is the bundled content file; anything absolute would leave the device.
    const fetches = panel.match(/fetch\("([^"]*)"\)/g) ?? [];
    for (const call of fetches) expect(call).not.toMatch(/https?:/);
  });

  it("ships a content bundle the panel can read", () => {
    const bundle = JSON.parse(read("content.json")) as { questions: unknown[]; domains: string[] };
    expect(bundle.questions.length).toBeGreaterThan(0);
    expect(bundle.domains.length).toBeGreaterThan(0);
  });

  it("ships every question with what it probes", () => {
    // The field that distinguishes this from a flashcard deck must survive the bundler.
    const bundle = JSON.parse(read("content.json")) as { questions: { probes: string }[] };
    expect(bundle.questions.every((q) => q.probes.length > 0)).toBe(true);
  });
});
