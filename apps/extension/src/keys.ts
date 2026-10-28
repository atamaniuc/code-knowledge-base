import type { Grade } from "@scheduling/index.js";

/**
 * Keyboard-first navigation, as a pure reducer.
 *
 * The panel is the thing with listeners; this decides what a key means and whether a
 * sequence is half-typed. Keeping it out of the DOM is what makes "g then d" testable —
 * a chord is exactly the state that silently breaks when it is written as two keydown
 * ifs in a view file.
 */

export type ViewId = "drill" | "bank" | "posting" | "interview";

export type Action =
  | { type: "reveal" }
  | { type: "grade"; grade: Grade }
  | { type: "focusSearch" }
  | { type: "view"; view: ViewId }
  | { type: "shortcuts" }
  | { type: "back" }
  | { type: "forward" }
  | { type: "font"; direction: 1 | -1 }
  | { type: "fullscreen" }
  | { type: "none" };

export interface KeyResult {
  /** Half-typed chord, or null. */
  pending: "g" | null;
  action: Action;
}

export interface KeyContext {
  /** True while the event target is a text field: typing beats shortcuts. */
  inField?: boolean;
  /** Alt is held. The only chords that use it are the browser-standard history arrows. */
  alt?: boolean;
}

const PENDING_G = "g" as const;

const VIEW_KEYS: Record<string, ViewId> = { d: "drill", b: "bank", p: "posting", i: "interview" };

/** Digits 0-5 grade; anything else is not a grade. */
function gradeFrom(key: string): Grade | null {
  if (key.length !== 1 || key < "0" || key > "5") return null;
  return Number(key) as Grade;
}

export function resolveKey(pending: "g" | null, key: string, context: KeyContext = {}): KeyResult {
  // Escape always works: closing a sheet and leaving a text field are the same gesture.
  if (key === "Escape") return { pending: null, action: { type: "back" } };

  // Alt-arrow is what a browser does with history, so it means the same thing here.
  if (context.alt) {
    if (key === "ArrowLeft") return { pending: null, action: { type: "back" } };
    if (key === "ArrowRight") return { pending: null, action: { type: "forward" } };
    return { pending: null, action: { type: "none" } };
  }

  if (context.inField) return { pending: null, action: { type: "none" } };

  if (pending === PENDING_G) {
    const target = VIEW_KEYS[key];
    return { pending: null, action: target ? { type: "view", view: target } : { type: "none" } };
  }

  if (key === PENDING_G) return { pending: PENDING_G, action: { type: "none" } };

  if (key === " " || key === "Spacebar" || key === "Enter") return { pending: null, action: { type: "reveal" } };

  const grade = gradeFrom(key);
  if (grade !== null) return { pending: null, action: { type: "grade", grade } };

  if (key === "/") return { pending: null, action: { type: "focusSearch" } };
  if (key === "?") return { pending: null, action: { type: "shortcuts" } };

  if (key === "+" || key === "=") return { pending: null, action: { type: "font", direction: 1 } };
  if (key === "-" || key === "_") return { pending: null, action: { type: "font", direction: -1 } };
  if (key === "f") return { pending: null, action: { type: "fullscreen" } };
  if (key === "Backspace") return { pending: null, action: { type: "back" } };

  return { pending: null, action: { type: "none" } };
}

/** The shortcut sheet is content, so it lives next to the resolver it documents. */
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "space / enter", label: "Reveal the expected answer" },
  { keys: "0 – 5", label: "Grade the recall once the answer is showing" },
  { keys: "/", label: "Focus search in the bank" },
  { keys: "g then d", label: "Drill" },
  { keys: "g then b", label: "Bank" },
  { keys: "g then p", label: "Posting" },
  { keys: "g then i", label: "Interview" },
  { keys: "+ / -", label: "Larger or smaller text, remembered between openings" },
  { keys: "f", label: "Fullscreen, or a panel tab when the side panel cannot go fullscreen" },
  { keys: "alt + ← / →", label: "Back and forward through where you have been" },
  { keys: "?", label: "This sheet" },
  { keys: "esc", label: "Close the sheet, or go back" },
];
