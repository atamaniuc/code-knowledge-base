import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "../public/panel.css"), "utf8");

/**
 * The text-size buttons are only as good as the sheet's discipline. `--font-size` sets the root
 * size, so every rule has to state its size in `rem` to follow it; a `px` value opts out and
 * stays put while the user presses A+. That is exactly how the chips, the probes box and the
 * wiki body shipped unscaled — so it is a test now, not a convention.
 */
describe("panel.css text scale", () => {
  const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((match) => (match[1] ?? "").trim());

  it("states every text size relative to the root", () => {
    expect(sizes.length).toBeGreaterThan(10);
    for (const size of sizes) {
      const relative = size.endsWith("rem") || size.startsWith("var(--font-size");
      expect(relative, size + " is absolute: it will not follow the text-size buttons").toBe(true);
    }
  });

  it("sets the root size from the pref, and lets the body inherit it", () => {
    expect(css).toMatch(/html\s*\{[^}]*font-size:\s*var\(--font-size,\s*14px\)/);
    expect(css).toMatch(/body\s*\{[^}]*font-size:\s*1rem/);
  });
});
