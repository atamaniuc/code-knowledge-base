import { describe, expect, it } from "vitest";
import { resolveKey, SHORTCUTS } from "../src/keys.js";

const press = (pending: "g" | null, key: string, inField = false) => resolveKey(pending, key, { inField });

describe("resolveKey", () => {
  it("reveals on space or enter", () => {
    expect(press(null, " ").action).toEqual({ type: "reveal" });
    expect(press(null, "Enter").action).toEqual({ type: "reveal" });
  });

  it("grades on the digits 0 to 5 only", () => {
    for (const digit of ["0", "1", "2", "3", "4", "5"]) {
      expect(press(null, digit).action).toEqual({ type: "grade", grade: Number(digit) });
    }
    expect(press(null, "6").action).toEqual({ type: "none" });
    expect(press(null, "12").action).toEqual({ type: "none" });
  });

  it("focuses search on slash and opens the sheet on question mark", () => {
    expect(press(null, "/").action).toEqual({ type: "focusSearch" });
    expect(press(null, "?").action).toEqual({ type: "shortcuts" });
  });

  it("resolves the g chord into a view", () => {
    expect(press(null, "g")).toEqual({ pending: "g", action: { type: "none" } });
    expect(press("g", "d").action).toEqual({ type: "view", view: "drill" });
    expect(press("g", "b").action).toEqual({ type: "view", view: "bank" });
    expect(press("g", "p").action).toEqual({ type: "view", view: "posting" });
  });

  it("clears a half-typed chord on an unknown second key", () => {
    expect(press("g", "x")).toEqual({ pending: null, action: { type: "none" } });
    expect(press("g", " ")).toEqual({ pending: null, action: { type: "none" } });
  });

  it("lets a text field win, except for escape", () => {
    expect(press(null, "3", true).action).toEqual({ type: "none" });
    expect(press(null, " ", true).action).toEqual({ type: "none" });
    expect(press(null, "g", true)).toEqual({ pending: null, action: { type: "none" } });
    expect(press(null, "Escape", true).action).toEqual({ type: "back" });
  });

  it("treats escape as back, and modifiers and arrows as nothing", () => {
    expect(press(null, "Escape").action).toEqual({ type: "back" });
    expect(press("g", "Escape")).toEqual({ pending: null, action: { type: "back" } });
    expect(press(null, "ArrowDown").action).toEqual({ type: "none" });
    expect(press(null, "Shift").action).toEqual({ type: "none" });
  });
});

describe("SHORTCUTS", () => {
  it("documents every gesture the resolver implements", () => {
    const keys = SHORTCUTS.map((s) => s.keys).join(" ");
    for (const expected of ["space", "0 – 5", "/", "g then d", "g then b", "g then p", "?", "esc"]) {
      expect(keys).toContain(expected);
    }
  });
});
