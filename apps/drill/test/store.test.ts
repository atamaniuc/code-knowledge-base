import { describe, expect, it } from "vitest";
import { ReviewStore } from "../src/store.js";

const at = (iso: string) => new Date(iso);

describe("ReviewStore", () => {
  it("starts a question from the initial schedule", () => {
    const store = new ReviewStore(":memory:");
    const rec = store.record("q1", 4, at("2026-09-06T10:00:00Z"));
    expect(rec.schedule.repetitions).toBe(1);
    expect(rec.schedule.interval).toBe(1);
    store.close();
  });

  it("continues from the question's own history, not from scratch", () => {
    const store = new ReviewStore(":memory:");
    store.record("q1", 4, at("2026-09-01T10:00:00Z"));
    store.record("q1", 4, at("2026-09-02T10:00:00Z"));
    const third = store.record("q1", 4, at("2026-09-08T10:00:00Z"));
    expect(third.schedule.repetitions).toBe(3);
    expect(third.schedule.interval).toBe(15);
    store.close();
  });

  it("keeps history rather than overwriting, so progress can be inspected later", () => {
    const store = new ReviewStore(":memory:");
    store.record("q1", 2, at("2026-09-01T10:00:00Z"));
    store.record("q1", 5, at("2026-09-02T10:00:00Z"));
    expect(store.latest("q1")?.grade).toBe(5);
    store.close();
  });

  it("returns a question as due once its next date has passed", () => {
    const store = new ReviewStore(":memory:");
    store.record("q1", 4, at("2026-09-01T10:00:00Z")); // interval 1 -> due 2026-09-02
    expect(store.dueIds(at("2026-09-01T12:00:00Z"))).toEqual([]);
    expect(store.dueIds(at("2026-09-03T12:00:00Z"))).toEqual(["q1"]);
    store.close();
  });

  it("uses only the newest review when deciding what is due", () => {
    // A question answered again today must not stay due because of an older row.
    const store = new ReviewStore(":memory:");
    store.record("q1", 4, at("2026-09-01T10:00:00Z"));
    store.record("q1", 4, at("2026-09-05T10:00:00Z")); // now 6 days out
    expect(store.dueIds(at("2026-09-06T10:00:00Z"))).toEqual([]);
    store.close();
  });

  it("orders due questions by how overdue they are", () => {
    const store = new ReviewStore(":memory:");
    store.record("old", 4, at("2026-09-01T10:00:00Z"));
    store.record("new", 4, at("2026-09-03T10:00:00Z"));
    expect(store.dueIds(at("2026-09-10T10:00:00Z"))).toEqual(["old", "new"]);
    store.close();
  });

  it("reports which questions have ever been answered", () => {
    const store = new ReviewStore(":memory:");
    store.record("q1", 4);
    expect(store.seenIds()).toEqual(new Set(["q1"]));
    store.close();
  });
});
