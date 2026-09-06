import { describe, expect, it } from "vitest";
import { EASE_FLOOR, INITIAL, type Grade, type Schedule, isDue, nextDue, review } from "../src/sm2.js";

const run = (grades: Grade[]): Schedule => grades.reduce<Schedule>(review, INITIAL);

describe("SM-2 scheduling", () => {
  it("uses the fixed first two intervals before compounding", () => {
    expect(run([4]).interval).toBe(1);
    expect(run([4, 4]).interval).toBe(6);
    // Third success compounds: 6 * ease.
    const third = run([4, 4, 4]);
    expect(third.interval).toBe(Math.round(6 * third.ease));
  });

  it("returns a failed item the next day and resets the streak", () => {
    const after = run([4, 4, 4, 1]);
    expect(after.interval).toBe(1);
    expect(after.repetitions).toBe(0);
  });

  it("keeps the ease penalty across a failure so a hard item grows slowly", () => {
    // The point of SM-2: failing does not just restart, it makes the ladder shallower.
    const easy = run([5, 5, 5]);
    const struggled = run([5, 1, 5, 5]);
    expect(struggled.ease).toBeLessThan(easy.ease);
  });

  it("raises ease for a perfect answer and lowers it for a barely-passing one", () => {
    expect(review(INITIAL, 5).ease).toBeGreaterThan(INITIAL.ease);
    expect(review(INITIAL, 3).ease).toBeLessThan(INITIAL.ease);
  });

  it("never lets ease fall below the floor", () => {
    // Without a floor, a chronically hard item collapses into a daily loop and
    // crowds out everything else in the queue.
    const battered = run(Array<Grade>(20).fill(0));
    expect(battered.ease).toBe(EASE_FLOOR);
  });

  it("is deterministic for a known grade sequence", () => {
    const s = run([4, 4, 4]);
    expect(s).toEqual({ repetitions: 3, interval: 15, ease: 2.5 });
  });
});

describe("due dates", () => {
  it("schedules the interval forward from the review date", () => {
    const reviewed = new Date("2026-09-06T14:30:00Z");
    const due = nextDue(reviewed, { repetitions: 2, interval: 6, ease: 2.5 });
    expect(due.getDate()).toBe(new Date("2026-09-12T00:00:00Z").getUTCDate());
    expect(due.getHours()).toBe(0);
  });

  it("treats an item as due once its date has arrived", () => {
    const due = new Date("2026-09-06T00:00:00");
    expect(isDue(due, new Date("2026-09-06T09:00:00"))).toBe(true);
    expect(isDue(due, new Date("2026-09-05T23:00:00"))).toBe(false);
  });
});
