import type { ReviewRecord } from "@scheduling/index.js";

/**
 * Today's progress and the streak.
 *
 * Both are derived from the review log rather than stored, so they cannot disagree with
 * the schedule: the log is the only state the panel keeps.
 */

export interface DayProgress {
  answered: number;
  /** Answered with a passing grade, i.e. grade >= 3 in SM-2 terms. */
  recalled: number;
}

/** Review records carry ISO timestamps; the day is their UTC date, matching the log's own ordering. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function answeredDay(record: ReviewRecord): string {
  return record.answeredAt.slice(0, 10);
}

export function dayProgress(records: readonly ReviewRecord[], now: Date = new Date()): DayProgress {
  const today = dayKey(now);
  const answered = records.filter((r) => answeredDay(r) === today);
  return { answered: answered.length, recalled: answered.filter((r) => r.grade >= 3).length };
}

export function answeredDays(records: readonly ReviewRecord[]): Set<string> {
  return new Set(records.map(answeredDay));
}

/**
 * Consecutive days with at least one review, counting back from today.
 *
 * A day with no reviews does not end the streak until it is over: on the morning of a
 * rest day the count still includes yesterday, which is the behaviour every streak UI has.
 */
export function streak(records: readonly ReviewRecord[], now: Date = new Date()): number {
  const days = answeredDays(records);
  if (days.size === 0) return 0;
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!days.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

/** Share of today's session already answered, for the progress bar. */
export function progressPercent(answered: number, remaining: number): number {
  const total = answered + remaining;
  if (total <= 0) return 0;
  return Math.round((answered / total) * 100);
}
