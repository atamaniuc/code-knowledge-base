import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { INITIAL, type Grade, type Schedule, nextDue, review } from "./sm2.js";

/**
 * Review history and schedules.
 *
 * Backed by `node:sqlite`, which ships with Node and needs no native build. That API
 * is still experimental, so everything touching it lives behind this interface: if it
 * changes, the replacement is confined to this file.
 */
export interface ReviewRecord {
  questionId: string;
  answeredAt: string;
  grade: Grade;
  schedule: Schedule;
  nextDueAt: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id  TEXT    NOT NULL,
  answered_at  TEXT    NOT NULL,
  grade        INTEGER NOT NULL,
  repetitions  INTEGER NOT NULL,
  interval      INTEGER NOT NULL,
  ease         REAL    NOT NULL,
  next_due_at  TEXT    NOT NULL
);
-- Reads are always "the newest row for a question", so order the index that way.
CREATE INDEX IF NOT EXISTS reviews_by_question ON reviews (question_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS reviews_by_due ON reviews (next_due_at);
`;

interface Row {
  question_id: string;
  answered_at: string;
  grade: number;
  repetitions: number;
  interval: number;
  ease: number;
  next_due_at: string;
}

const toRecord = (r: Row): ReviewRecord => ({
  questionId: r.question_id,
  answeredAt: r.answered_at,
  grade: r.grade as Grade,
  schedule: { repetitions: r.repetitions, interval: r.interval, ease: r.ease },
  nextDueAt: r.next_due_at,
});

export class ReviewStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
  }

  /** Most recent review of a question, or undefined if it has never been answered. */
  latest(questionId: string): ReviewRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM reviews WHERE question_id = ? ORDER BY answered_at DESC, id DESC LIMIT 1")
      .get(questionId) as Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  /** Applies SM-2 to the question's current schedule and appends the result. */
  record(questionId: string, grade: Grade, at: Date = new Date()): ReviewRecord {
    const current = this.latest(questionId)?.schedule ?? INITIAL;
    const schedule = review(current, grade);
    const record: ReviewRecord = {
      questionId,
      answeredAt: at.toISOString(),
      grade,
      schedule,
      nextDueAt: nextDue(at, schedule).toISOString(),
    };

    this.db
      .prepare(
        "INSERT INTO reviews (question_id, answered_at, grade, repetitions, interval, ease, next_due_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        record.questionId,
        record.answeredAt,
        record.grade,
        schedule.repetitions,
        schedule.interval,
        schedule.ease,
        record.nextDueAt,
      );

    return record;
  }

  /** Question ids whose latest review has come due, soonest first. */
  dueIds(now: Date = new Date()): string[] {
    const rows = this.db
      .prepare(
        `SELECT r.question_id, r.next_due_at
           FROM reviews r
           JOIN (SELECT question_id, MAX(id) AS id FROM reviews GROUP BY question_id) latest
             ON latest.id = r.id
          WHERE r.next_due_at <= ?
          ORDER BY r.next_due_at ASC`,
      )
      .all(now.toISOString()) as { question_id: string }[];
    return rows.map((r) => r.question_id);
  }

  /** Question ids that have been answered at least once. */
  seenIds(): Set<string> {
    const rows = this.db.prepare("SELECT DISTINCT question_id FROM reviews").all() as { question_id: string }[];
    return new Set(rows.map((r) => r.question_id));
  }

  close(): void {
    this.db.close();
  }
}
