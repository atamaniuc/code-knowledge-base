import { INITIAL, type Grade, type ReviewLog, type ReviewRecord, nextDue, review } from "@scheduling/index.js";
import { dayProgress } from "./stats.js";

/**
 * Review history in IndexedDB.
 *
 * Loaded into memory on open so the synchronous ReviewLog interface holds — the corpus
 * is a few hundred questions and a few thousand review rows, which is nothing to hold,
 * and it keeps one scheduling implementation shared with the CLI rather than forking an
 * async copy of it.
 */
const DB_NAME = "interview-prep";
const STORE = "reviews";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function all(db: IDBDatabase): Promise<ReviewRecord[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as ReviewRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export class BrowserReviewLog implements ReviewLog {
  private constructor(
    private readonly db: IDBDatabase,
    private records: ReviewRecord[],
  ) {}

  static async load(): Promise<BrowserReviewLog> {
    const db = await open();
    return new BrowserReviewLog(db, await all(db));
  }

  latest(questionId: string): ReviewRecord | undefined {
    let best: ReviewRecord | undefined;
    for (const r of this.records) {
      if (r.questionId !== questionId) continue;
      if (!best || r.answeredAt > best.answeredAt) best = r;
    }
    return best;
  }

  dueIds(now = new Date()): string[] {
    const latest = new Map<string, ReviewRecord>();
    for (const r of this.records) {
      const seen = latest.get(r.questionId);
      if (!seen || r.answeredAt > seen.answeredAt) latest.set(r.questionId, r);
    }
    return [...latest.values()]
      .filter((r) => new Date(r.nextDueAt).getTime() <= now.getTime())
      .sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt))
      .map((r) => r.questionId);
  }

  seenIds(): Set<string> {
    return new Set(this.records.map((r) => r.questionId));
  }

  async record(questionId: string, grade: Grade, at: Date = new Date()): Promise<ReviewRecord> {
    const schedule = review(this.latest(questionId)?.schedule ?? INITIAL, grade);
    const entry: ReviewRecord = {
      questionId,
      answeredAt: at.toISOString(),
      grade,
      schedule,
      nextDueAt: nextDue(at, schedule).toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    this.records.push(entry);
    return entry;
  }

  /** Everything answered, for the header and the streak. A copy: the log stays the only writer. */
  allRecords(): ReviewRecord[] {
    return [...this.records];
  }

  /** Answered today, and how many of those were recalled. Shares the implementation with the header stats. */
  todaysProgress(now = new Date()): { answered: number; recalled: number } {
    return dayProgress(this.records, now);
  }
}
