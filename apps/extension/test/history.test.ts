import { describe, expect, it } from "vitest";
import { canGoBack, canGoForward, currentPlace, EMPTY_HISTORY, goBack, goForward, type History, MAX_ENTRIES, type Place, pushPlace } from "../src/history.js";

const place = (over: Partial<Place> = {}): Place => ({ view: "drill", questionId: null, wiki: null, expanded: null, ...over });

describe("panel history", () => {
  it("records places and walks back to the first", () => {
    let h: History = EMPTY_HISTORY;
    h = pushPlace(h, place({ view: "drill", questionId: "q1" }));
    h = pushPlace(h, place({ view: "bank" }));
    h = pushPlace(h, place({ view: "posting" }));
    expect(currentPlace(h)?.view).toBe("posting");
    expect(canGoBack(h)).toBe(true);
    h = goBack(h);
    h = goBack(h);
    expect(currentPlace(h)?.view).toBe("drill");
    expect(canGoBack(h)).toBe(false);
    expect(goBack(h)).toBe(h);
  });

  it("walks forward again after going back", () => {
    let h: History = EMPTY_HISTORY;
    h = pushPlace(h, place({ view: "drill" }));
    h = pushPlace(h, place({ view: "bank" }));
    h = goBack(h);
    expect(canGoForward(h)).toBe(true);
    expect(currentPlace(goForward(h))?.view).toBe("bank");
    // Already at the end: going forward again is a no-op, not an error.
    expect(goForward(goForward(h))).toEqual(goForward(h));
    expect(canGoForward(goForward(h))).toBe(false);
  });

  it("drops the forward tail when a new place is pushed", () => {
    let h: History = EMPTY_HISTORY;
    h = pushPlace(h, place({ view: "drill" }));
    h = pushPlace(h, place({ view: "bank" }));
    h = goBack(h);
    h = pushPlace(h, place({ view: "posting" }));
    expect(h.entries.map((e) => e.view)).toEqual(["drill", "posting"]);
    expect(canGoForward(h)).toBe(false);
  });

  it("ignores a repeated place, so a re-render cannot grow the stack", () => {
    let h: History = EMPTY_HISTORY;
    h = pushPlace(h, place({ view: "bank", expanded: "q1" }));
    h = pushPlace(h, place({ view: "bank", expanded: "q1" }));
    expect(h.entries).toHaveLength(1);
  });

  it("treats the same article without an anchor as the same place", () => {
    let h: History = EMPTY_HISTORY;
    h = pushPlace(h, place({ view: "bank" }));
    h = pushPlace(h, place({ wiki: { slug: "kafka", anchor: "a" } }));
    h = pushPlace(h, place({ wiki: { slug: "kafka", anchor: "a" } }));
    expect(h.entries).toHaveLength(2);
  });

  it("bounds the stack, keeping the newest places", () => {
    let h: History = EMPTY_HISTORY;
    for (let i = 0; i < MAX_ENTRIES + 20; i++) h = pushPlace(h, place({ questionId: "q" + String(i) }));
    expect(h.entries).toHaveLength(MAX_ENTRIES);
    expect(h.index).toBe(MAX_ENTRIES - 1);
    expect(currentPlace(h)?.questionId).toBe("q" + String(MAX_ENTRIES + 19));
  });
});
