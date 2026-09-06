import type { Grade, Schedule } from "./sm2.js";

/**
 * Review history, independent of where it is stored.
 *
 * The CLI keeps it in SQLite and the extension in IndexedDB. Both scheduling and
 * selection depend on this interface only, so the two surfaces cannot drift into
 * different notions of what is due.
 */
export interface ReviewRecord {
  questionId: string;
  answeredAt: string;
  grade: Grade;
  schedule: Schedule;
  nextDueAt: string;
}

export interface ReviewLog {
  /** Most recent review of a question, or undefined if it has never been answered. */
  latest(questionId: string): ReviewRecord | undefined;
  /** Question ids whose latest review has come due, soonest first. */
  dueIds(now?: Date): string[];
  /** Question ids answered at least once. */
  seenIds(): Set<string>;
}
