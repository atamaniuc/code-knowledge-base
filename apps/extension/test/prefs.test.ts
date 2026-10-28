import { describe, expect, it } from "vitest";
import { canGrow, canShrink, debounce, FONT_STEPS, fontPercent, loadPrefs, type PrefStore, parsePrefs, savePrefs, stepFont } from "../src/prefs.js";

function memoryStore(): PrefStore & { raw: Map<string, unknown> } {
  const raw = new Map<string, unknown>();
  return {
    raw,
    get: async (key) => raw.get(key),
    set: async (key, value) => {
      raw.set(key, value);
    },
  };
}

describe("font size", () => {
  it("steps through the scale and clamps at both ends", () => {
    expect(stepFont(1, 1)).toBe(1.1);
    expect(stepFont(1, -1)).toBe(0.9);
    expect(stepFont(1.4, 1)).toBe(1.4);
    expect(stepFont(0.9, -1)).toBe(0.9);
  });

  it("snaps a value from an older build onto the nearest step", () => {
    expect(stepFont(1.02, 1)).toBe(1.1);
    expect(parsePrefs({ fontStep: 99 }).fontStep).toBe(FONT_STEPS[FONT_STEPS.length - 1]);
    expect(parsePrefs({ fontStep: "big" }).fontStep).toBe(1);
  });

  it("reports the scale as a percentage for the label", () => {
    expect(fontPercent(1)).toBe(100);
    expect(fontPercent(1.25)).toBe(125);
  });

  it("keeps the default inside the scale and stops at both ends", () => {
    expect(FONT_STEPS).toContain(1);
    expect(canGrow(1.4)).toBe(false);
    expect(canShrink(0.9)).toBe(false);
    expect(canGrow(0.9)).toBe(true);
    expect(canShrink(1.4)).toBe(true);
  });
});

describe("parsePrefs", () => {
  it("returns defaults for anything that is not an object", () => {
    for (const value of [null, undefined, 7, "x"]) expect(parsePrefs(value).session).toBeNull();
  });

  it("drops an unknown view and keeps the rest of the session", () => {
    const prefs = parsePrefs({ session: { view: "nope", questionId: "q1", filters: { domain: "infra" }, scrollTop: 120 } });
    expect(prefs.session?.view).toBe("drill");
    expect(prefs.session?.questionId).toBe("q1");
    expect(prefs.session?.filters.domain).toBe("infra");
    expect(prefs.session?.scrollTop).toBe(120);
  });

  it("ignores a wiki entry with no slug and a negative scroll", () => {
    const prefs = parsePrefs({ session: { view: "bank", wiki: { anchor: "x" }, scrollTop: -50 } });
    expect(prefs.session?.wiki).toBeNull();
    expect(prefs.session?.scrollTop).toBe(0);
  });

  it("coerces non-string filter values to empty rather than trusting them", () => {
    const prefs = parsePrefs({ session: { view: "bank", filters: { domain: 5, query: "kafka" } } });
    expect(prefs.session?.filters.domain).toBe("");
    expect(prefs.session?.filters.query).toBe("kafka");
  });
});

describe("store", () => {
  it("round-trips through a store under one key", async () => {
    const store = memoryStore();
    await savePrefs(store, { fontStep: 1.25, session: { view: "posting", questionId: null, revealed: false, filters: { domain: "", level: "", tech: "", query: "" }, expanded: null, tag: "kafka", wiki: null, scrollTop: 40 } });
    const loaded = await loadPrefs(store);
    expect(loaded.fontStep).toBe(1.25);
    expect(loaded.session?.view).toBe("posting");
    // The brief's filter survives the panel being destroyed, like every other place in it.
    expect(loaded.session?.tag).toBe("kafka");
    expect(store.raw.size).toBe(1);
  });

  it("survives a store that throws, in both directions", async () => {
    const store: PrefStore = {
      get: async () => {
        throw new Error("no storage");
      },
      set: async () => {
        throw new Error("no storage");
      },
    };
    await expect(loadPrefs(store)).resolves.toEqual({ fontStep: 1, session: null });
    await expect(savePrefs(store, { fontStep: 1.1, session: null })).resolves.toBeUndefined();
  });
});

describe("debounce", () => {
  it("collapses a burst into one trailing call and flushes on demand", async () => {
    const seen: string[] = [];
    const fn = debounce((value: string) => seen.push(value), 10);
    fn("a");
    fn("b");
    fn("c");
    expect(seen).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(seen).toEqual(["c"]);
    fn("d");
    fn.flush();
    expect(seen).toEqual(["c", "d"]);
  });
});
