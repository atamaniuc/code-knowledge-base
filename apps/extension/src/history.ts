import type { ViewId } from "./keys.js";

/**
 * Where the back and forward buttons go.
 *
 * The panel is one page showing one of a handful of places, so navigation is a small stack of
 * places rather than the browser's history: the side panel has no URL to push, and a wiki
 * article reached from the drill has to return to the drill, not to whatever came before it in
 * the tab's life. `push` drops the forward tail — the standard behaviour — and refuses to
 * record the same place twice in a row, which is what keeps a double render from growing the
 * stack.
 */

export interface Place {
  view: ViewId;
  /** The drill question, when the place is a drill. */
  questionId: string | null;
  wiki: { slug: string; anchor: string } | null;
  expanded: string | null;
}

export interface History {
  entries: Place[];
  /** Index of the current entry, or -1 when the stack is empty. */
  index: number;
}

export const EMPTY_HISTORY: History = { entries: [], index: -1 };

/** Deep enough for a session's wandering, bounded so a long read cannot grow without end. */
export const MAX_ENTRIES = 50;

export function samePlace(a: Place, b: Place): boolean {
  return (
    a.view === b.view &&
    a.questionId === b.questionId &&
    a.expanded === b.expanded &&
    (a.wiki?.slug ?? null) === (b.wiki?.slug ?? null) &&
    (a.wiki?.anchor ?? "") === (b.wiki?.anchor ?? "")
  );
}

export function currentPlace(history: History): Place | null {
  return history.entries[history.index] ?? null;
}

export function pushPlace(history: History, place: Place): History {
  const current = currentPlace(history);
  if (current && samePlace(current, place)) return history;
  const kept = history.entries.slice(0, history.index + 1);
  kept.push(place);
  const trimmed = kept.length > MAX_ENTRIES ? kept.slice(kept.length - MAX_ENTRIES) : kept;
  return { entries: trimmed, index: trimmed.length - 1 };
}

export function goBack(history: History): History {
  return history.index <= 0 ? history : { ...history, index: history.index - 1 };
}

export function goForward(history: History): History {
  return history.index >= history.entries.length - 1 ? history : { ...history, index: history.index + 1 };
}

export function canGoBack(history: History): boolean {
  return history.index > 0;
}

export function canGoForward(history: History): boolean {
  return history.index < history.entries.length - 1;
}
