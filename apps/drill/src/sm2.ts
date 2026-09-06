/**
 * SM-2 spaced repetition.
 *
 * This is the progress tracking and most of the motivation system: what you got
 * wrong comes back sooner, what you know drifts out of the way. Streaks and badges
 * are not needed on top of it.
 *
 * Reference: P.A. Wozniak, "Optimization of repetition spacing in the practice of
 * learning", 1990. https://super-memory.com/english/ol/sm2.htm
 */

/** How well the answer went. Below 3 is a failure and restarts the interval. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

export const PASSING_GRADE = 3;

export interface Schedule {
  /** Number of successful reviews in a row. Reset to 0 on a failure. */
  repetitions: number;
  /** Days until the next review. */
  interval: number;
  /** How quickly this item's interval grows. Never below EASE_FLOOR. */
  ease: number;
}

export const INITIAL: Schedule = { repetitions: 0, interval: 0, ease: 2.5 };

/**
 * SM-2 lets ease decay indefinitely, which drives chronically hard items into a
 * daily loop that crowds out everything else. Anki's floor of 1.3 is the standard
 * fix and is applied here for the same reason.
 */
export const EASE_FLOOR = 1.3;

export function review(current: Schedule, grade: Grade): Schedule {
  const ease = Math.max(EASE_FLOOR, current.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  // A failed recall restarts the ladder but keeps the accumulated ease penalty:
  // an item you keep failing should return often and grow slowly once it sticks.
  if (grade < PASSING_GRADE) {
    return { repetitions: 0, interval: 1, ease };
  }

  const repetitions = current.repetitions + 1;
  const interval = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(current.interval * ease);

  return { repetitions, interval, ease };
}

/** Adds `interval` days to `from`, normalised to the start of that day. */
export function nextDue(from: Date, schedule: Schedule): Date {
  const due = new Date(from);
  due.setDate(due.getDate() + schedule.interval);
  due.setHours(0, 0, 0, 0);
  return due;
}

export function isDue(nextDueAt: Date, now: Date): boolean {
  return nextDueAt.getTime() <= now.getTime();
}
