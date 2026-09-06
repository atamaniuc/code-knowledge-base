import type { Question } from "@schema/question.js";
import type { ReviewLog } from "./log.js";

export interface Filter {
  domains?: string[];
  levels?: string[];
  /** Cap on how many questions a session offers. */
  limit?: number;
}

/**
 * Only promoted content reaches a session. Drafts are working state and quarantined
 * items failed a gate; drilling against either teaches the wrong thing.
 */
const SHIPPABLE = new Set(["auto_verified", "verified"]);

export function eligible(questions: Question[], filter: Filter): Question[] {
  return questions.filter((q) => {
    if (!SHIPPABLE.has(q.review_status)) return false;
    if (filter.domains?.length && !filter.domains.includes(q.domain)) return false;
    if (filter.levels?.length && !q.levels.some((l) => filter.levels!.includes(l))) return false;
    return true;
  });
}

/**
 * Due repetitions first, then questions never seen.
 *
 * The order matters: a session that opens with new material lets the backlog of
 * things you already got wrong keep growing, which is the failure mode spaced
 * repetition exists to prevent.
 */
export function nextUp(questions: Question[], store: ReviewLog, filter: Filter = {}, now = new Date()): Question[] {
  const pool = eligible(questions, filter);
  const byId = new Map(pool.map((q) => [q.id, q]));

  const due = store
    .dueIds(now)
    .map((id) => byId.get(id))
    .filter((q): q is Question => q !== undefined);

  const seen = store.seenIds();
  const fresh = pool.filter((q) => !seen.has(q.id));

  const ordered = [...due, ...fresh];
  return filter.limit ? ordered.slice(0, filter.limit) : ordered;
}
