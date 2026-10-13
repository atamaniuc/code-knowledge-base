import { describe, expect, it } from "vitest";
import type { Grade, ReviewRecord } from "@scheduling/index.js";
import { answeredDays, dayKey, dayProgress, progressPercent, streak } from "../src/stats.js";

function record(answeredAt: string, grade: Grade): ReviewRecord {
  return {
    questionId: "q-" + answeredAt + String(grade),
    answeredAt,
    grade,
    schedule: { repetitions: 1, interval: 1, ease: 2.5 },
    nextDueAt: answeredAt,
  };
}

const NOW = new Date("2026-10-13T18:00:00.000Z");

describe("dayProgress", () => {
  it("counts only today, and calls grade 3 and above a recall", () => {
    const records = [
      record("2026-10-13T09:00:00.000Z", 5),
      record("2026-10-13T10:00:00.000Z", 2),
      record("2026-10-12T23:59:00.000Z", 4),
    ];
    expect(dayProgress(records, NOW)).toEqual({ answered: 2, recalled: 1 });
  });

  it("is empty when nothing was answered today", () => {
    expect(dayProgress([record("2026-10-01T09:00:00.000Z", 5)], NOW)).toEqual({ answered: 0, recalled: 0 });
    expect(dayProgress([], NOW)).toEqual({ answered: 0, recalled: 0 });
  });

  it("uses the UTC day of the timestamp", () => {
    expect(dayKey(new Date("2026-10-13T00:30:00.000Z"))).toBe("2026-10-13");
  });
});

describe("streak", () => {
  it("counts consecutive days ending today", () => {
    const records = [
      record("2026-10-11T09:00:00.000Z", 4),
      record("2026-10-12T09:00:00.000Z", 4),
      record("2026-10-13T09:00:00.000Z", 4),
    ];
    expect(streak(records, NOW)).toBe(3);
    expect(answeredDays(records).size).toBe(3);
  });

  it("still counts through yesterday on a day with no reviews yet", () => {
    const records = [record("2026-10-11T09:00:00.000Z", 4), record("2026-10-12T09:00:00.000Z", 4)];
    expect(streak(records, NOW)).toBe(2);
  });

  it("stops at a missed day", () => {
    const records = [record("2026-10-13T09:00:00.000Z", 4), record("2026-10-11T09:00:00.000Z", 4)];
    expect(streak(records, NOW)).toBe(1);
  });

  it("is zero with no history, or with nothing recent", () => {
    expect(streak([], NOW)).toBe(0);
    expect(streak([record("2026-09-01T09:00:00.000Z", 4)], NOW)).toBe(0);
  });
});

describe("progressPercent", () => {
  it("is the share of today's session already answered", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(1, 3)).toBe(25);
    expect(progressPercent(5, 0)).toBe(100);
  });
});
