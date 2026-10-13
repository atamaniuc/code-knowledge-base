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
  const html = read("panel.html");

  it("is Manifest V3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("requests exactly storage and sidePanel, and no host permissions", () => {
    expect(manifest.permissions).toEqual(["storage", "sidePanel"]);
    // Broad host permissions are the largest cause of slow and failed store review.
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.optional_host_permissions).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });

  it("injects nothing into pages", () => {
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
  });

  it("opens as a side panel", () => {
    expect((manifest.side_panel as { default_path?: string }).default_path).toBe("panel.html");
    expect((manifest.background as { service_worker?: string }).service_worker).toBe("background.js");
  });

  it("loads no remote code", () => {
    // MV3 forbids it and it would break the offline guarantee regardless.
    expect(panel).not.toMatch(/https?:\/\//);
  });

  it("does not fall back to eval", () => {
    expect(panel).not.toMatch(/\beval\s*\(/);
    expect(panel).not.toMatch(/new\s+Function\s*\(/);
  });

  it("makes exactly one request, for the bundled content file", () => {
    const fetches = [...panel.matchAll(/fetch\(\s*(["'])([^"']*)\1\s*\)/g)].map((match) => match[2] ?? "");
    expect(fetches).toEqual(["content.json"]);
  });

  it("loads its own assets relatively", () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('href="panel.css"');
    expect(html).toContain('src="panel.js"');
  });

  it("ships a content bundle the panel can read", () => {
    const bundle = JSON.parse(read("content.json")) as { schema: number; questions: unknown[]; domains: unknown[] };
    expect(bundle.schema).toBe(2);
    expect(bundle.questions.length).toBeGreaterThan(0);
    expect(bundle.domains.length).toBeGreaterThan(0);
  });
});
