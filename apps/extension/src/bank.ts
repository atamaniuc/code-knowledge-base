import { LEVEL_ORDER, type DomainInfo, type Question } from "./bundle.js";

/**
 * Filtering, search and option lists over the bundled bank.
 *
 * Free text searches the question and what it probes, and nothing else. The expected
 * answer is deliberately not searchable: finding a question by a phrase you only remember
 * from the answer is how you end up drilling the wording instead of the recall.
 */

export interface Filters {
  domain: string;
  level: string;
  tech: string;
  query: string;
}

export const NO_FILTERS: Filters = { domain: "", level: "", tech: "", query: "" };

export interface Option {
  value: string;
  label: string;
  count: number;
}

export function searchText(question: Question): string {
  return (question.question + " " + question.probes).toLowerCase();
}

/** Every whitespace-separated term must appear, so "kafka ordering" narrows rather than widens. */
export function matchesQuery(question: Question, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = searchText(question);
  return terms.every((term) => haystack.includes(term));
}

export function matchesFilters(question: Question, filters: Filters): boolean {
  if (filters.domain && question.domain !== filters.domain) return false;
  if (filters.level && !question.levels.includes(filters.level)) return false;
  if (filters.tech && question.tech !== filters.tech) return false;
  return matchesQuery(question, filters.query);
}

export function applyFilters(questions: Question[], filters: Filters): Question[] {
  return questions.filter((q) => matchesFilters(q, filters));
}

export function hasActiveFilters(filters: Filters): boolean {
  return Boolean(filters.domain || filters.level || filters.tech || filters.query);
}

export function domainOptions(questions: Question[], domains: DomainInfo[]): Option[] {
  const counts = new Map<string, number>();
  for (const q of questions) counts.set(q.domain, (counts.get(q.domain) ?? 0) + 1);
  return domains
    .filter((d) => counts.has(d.id))
    .map((d) => ({ value: d.id, label: d.title, count: counts.get(d.id) ?? 0 }));
}

export function levelOptions(questions: Question[], levels: string[]): Option[] {
  const counts = new Map<string, number>();
  for (const q of questions) for (const level of q.levels) counts.set(level, (counts.get(level) ?? 0) + 1);
  const known = [...new Set([...levels, ...counts.keys()])];
  return known
    .filter((level) => counts.has(level))
    .sort((a, b) => {
      const ai = LEVEL_ORDER.indexOf(a as (typeof LEVEL_ORDER)[number]);
      const bi = LEVEL_ORDER.indexOf(b as (typeof LEVEL_ORDER)[number]);
      return (ai === -1 ? LEVEL_ORDER.length : ai) - (bi === -1 ? LEVEL_ORDER.length : bi) || a.localeCompare(b);
    })
    .map((level) => ({ value: level, label: level, count: counts.get(level) ?? 0 }));
}

export function techOptions(questions: Question[]): Option[] {
  const counts = new Map<string, number>();
  for (const q of questions) if (q.tech) counts.set(q.tech, (counts.get(q.tech) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tech, count]) => ({ value: tech, label: tech, count }));
}

/**
 * Put a specifically chosen question at the front of the session.
 *
 * The bank exists to look something up; without this the only way back to a question you
 * just read is to answer everything the selector puts before it.
 */
export function withPinned(pinned: Question | null, queue: Question[]): Question[] {
  if (!pinned) return queue;
  return [pinned, ...queue.filter((q) => q.id !== pinned.id)];
}

export interface EmptyState {
  title: string;
  hint: string;
}

/**
 * Why the drill queue is empty.
 *
 * Three ways to run dry, and they call for different actions: an empty bundle, a bundle
 * nothing has promoted, and a filter that excludes everything. Reading "nothing due" when
 * the bank is merely unpromoted sends you away for a day instead of rebuilding it.
 */
export function emptyState(input: { total: number; promoted: number; shown: number; filtered: boolean }): EmptyState {
  if (input.total === 0) {
    return { title: "No questions are bundled yet.", hint: "The bundle shipped without questions; rebuild it with make extension." };
  }
  if (input.promoted === 0) {
    return {
      title: "No question has been promoted yet.",
      hint: 'Drafts stay quarantined until a gate promotes them. Rebuild with make extension ARGS="--include-drafts" to practise against unreviewed content.',
    };
  }
  if (input.filtered && input.shown === 0) {
    return { title: "No question matches these filters.", hint: "Clear a filter or the search to widen the session." };
  }
  return {
    title: "Nothing is due.",
    hint: "Everything in this filter is waiting for its next review. Widen the filter, or come back tomorrow.",
  };
}

export type BankStatus = "due" | "seen" | "new";

export function statusOf(question: Question, seen: ReadonlySet<string>, due: ReadonlySet<string>): BankStatus {
  if (due.has(question.id)) return "due";
  return seen.has(question.id) ? "seen" : "new";
}
