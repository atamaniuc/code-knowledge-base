import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRANSLATE_ORIGINS } from "../src/translate.js";

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

  it("requests exactly storage and sidePanel", () => {
    expect(manifest.permissions).toEqual(["storage", "sidePanel"]);
    expect(manifest.optional_host_permissions).toBeUndefined();
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });

  it("grants exactly the two translation origins, and nothing wider", () => {
    // The only outbound call in the product is a translation the user asks for, so the host
    // permission is the two Google Translate endpoints and nothing else. Broad host
    // permissions are also the largest cause of slow and failed store review.
    expect(manifest.host_permissions).toEqual([...TRANSLATE_ORIGINS]);
    expect(manifest.host_permissions).toHaveLength(2);
  });

  it("ships the blue IP mark as real icons", () => {
    const icons = manifest.icons as Record<string, string>;
    const actionIcon = (manifest.action as { default_icon?: Record<string, string> }).default_icon;
    expect(Object.keys(icons).sort()).toEqual(["128", "16", "32", "48"]);
    for (const [size, path] of Object.entries(icons)) {
      expect(actionIcon?.[size]).toBe(path);
      const file = join(dist, path);
      expect(existsSync(file)).toBe(true);
      const bytes = readFileSync(file);
      // PNG magic: the browser refuses anything else, and a corrupt file fails at load time.
      expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });

  it("injects nothing into pages", () => {
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
  });

  it("opens as a side panel", () => {
    expect((manifest.side_panel as { default_path?: string }).default_path).toBe("panel.html");
    expect((manifest.background as { service_worker?: string }).service_worker).toBe("background.js");
  });

  it("contains no remote host other than the two translation endpoints", () => {
    // MV3 forbids remote code, and nothing may reach the network except the translation the
    // user asks for: every absolute URL in the built panel has to be one of those two hosts.
    const urls = [...panel.matchAll(/https?:\/\/[^"'\s`)]+/g)].map((match) => match[0]);
    const allowed = TRANSLATE_ORIGINS.map((origin) => origin.replace("/*", ""));
    for (const url of urls) {
      expect(allowed.some((host) => url.startsWith(host)), url + " is an unexpected remote host").toBe(true);
    }
    expect(urls.length).toBeGreaterThan(0);
  });

  it("does not fall back to eval", () => {
    expect(panel).not.toMatch(/\beval\s*\(/);
    expect(panel).not.toMatch(/new\s+Function\s*\(/);
  });

  it("fetches the bundled content file on load, and nothing else literally", () => {
    // The bundle read is the only fetch with a literal URL; the translate call builds its URL
    // from a selection and only ever runs from the popup's click handler.
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
