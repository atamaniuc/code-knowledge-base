import type { Filters } from "./bank.js";
import type { ViewId } from "./keys.js";

/**
 * What the panel remembers between openings.
 *
 * A side panel is destroyed the moment it is hidden, so anything not written down is lost:
 * the question being considered, the filter set, the scroll position, the font size. This
 * module is the whole of that memory, and it is deliberately dumb — read, validate, write —
 * so the panel can call it on every change without worrying about what it costs.
 */

/** Font sizes as multipliers of the base. Five steps, because a slider is worse than a button. */
export const FONT_STEPS = [0.9, 1, 1.1, 1.25, 1.4] as const;
export const DEFAULT_FONT_STEP = 1;

export interface Session {
  view: ViewId;
  /** The question the drill was showing, so reopening lands on it rather than the next due one. */
  questionId: string | null;
  /** Whether that question's answer was already committed. */
  revealed: boolean;
  filters: Filters;
  expanded: string | null;
  wiki: { slug: string; anchor: string } | null;
  scrollTop: number;
}

export interface Prefs {
  fontStep: number;
  session: Session | null;
}

export const DEFAULT_PREFS: Prefs = { fontStep: DEFAULT_FONT_STEP, session: null };

/** Nearest step to a stored multiplier; a value from an older build is not trusted. */
function nearestStep(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_FONT_STEP;
  return FONT_STEPS.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best), FONT_STEPS[0]);
}

/** One step up or down, clamped at the ends. Returns the multiplier, not an index. */
export function stepFont(current: number, direction: 1 | -1): number {
  const index = FONT_STEPS.indexOf(nearestStep(current) as (typeof FONT_STEPS)[number]);
  const next = Math.min(FONT_STEPS.length - 1, Math.max(0, index + direction));
  return FONT_STEPS[next] ?? DEFAULT_FONT_STEP;
}

export function fontPercent(step: number): number {
  return Math.round(nearestStep(step) * 100);
}

export function canGrow(step: number): boolean {
  return nearestStep(step) !== FONT_STEPS[FONT_STEPS.length - 1];
}

export function canShrink(step: number): boolean {
  return nearestStep(step) !== FONT_STEPS[0];
}

const VIEWS: ViewId[] = ["drill", "bank", "posting", "interview"];
const FIELDS: (keyof Filters)[] = ["domain", "level", "tech", "query"];

function readFilters(raw: unknown): Filters {
  const out: Filters = { domain: "", level: "", tech: "", query: "" };
  if (typeof raw !== "object" || raw === null) return out;
  const source = raw as Record<string, unknown>;
  for (const field of FIELDS) {
    const value = source[field];
    if (typeof value === "string") out[field] = value.slice(0, 200);
  }
  return out;
}

function readSession(raw: unknown): Session | null {
  if (typeof raw !== "object" || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const view = VIEWS.includes(source.view as ViewId) ? (source.view as ViewId) : "drill";
  const wikiRaw = source.wiki as { slug?: unknown; anchor?: unknown } | null | undefined;
  const slug = typeof wikiRaw?.slug === "string" ? wikiRaw.slug : null;
  return {
    view,
    questionId: typeof source.questionId === "string" ? source.questionId : null,
    revealed: source.revealed === true,
    filters: readFilters(source.filters),
    expanded: typeof source.expanded === "string" ? source.expanded : null,
    wiki: slug ? { slug, anchor: typeof wikiRaw?.anchor === "string" ? wikiRaw.anchor : "" } : null,
    scrollTop: typeof source.scrollTop === "number" && Number.isFinite(source.scrollTop) ? Math.max(0, source.scrollTop) : 0,
  };
}

/** Tolerant by design: prefs from an older build must not break the panel. */
export function parsePrefs(raw: unknown): Prefs {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_PREFS };
  const source = raw as Record<string, unknown>;
  return { fontStep: nearestStep(source.fontStep), session: readSession(source.session) };
}

/** The slice of chrome.storage.local this module needs, so a test can pass a Map. */
export interface PrefStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

const KEY = "ui";

/** chrome.storage.local, or an in-memory stand-in when the page is opened outside Chrome. */
export function chromeStore(): PrefStore {
  const area = (
    globalThis as {
      chrome?: {
        storage?: {
          local?: { get(keys: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> };
        };
      };
    }
  ).chrome?.storage?.local;
  if (area) {
    return {
      get: async (key) => (await area.get(key))[key],
      set: async (key, value) => area.set({ [key]: value }),
    };
  }
  const memory = new Map<string, unknown>();
  return {
    get: async (key) => memory.get(key),
    set: async (key, value) => {
      memory.set(key, value);
    },
  };
}

export async function loadPrefs(store: PrefStore): Promise<Prefs> {
  try {
    return parsePrefs(await store.get(KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function savePrefs(store: PrefStore, prefs: Prefs): Promise<void> {
  try {
    await store.set(KEY, prefs);
  } catch {
    // A failed write costs the next opening its position, never the session in progress.
  }
}

/**
 * Collapses a burst of writes into one.
 *
 * Scrolling and typing fire continuously; every one of them is a storage write otherwise. The
 * trailing call is what matters, and the flush exists because a panel that is being hidden
 * gets no trailing timer.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): ((...args: A) => void) & { flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: A | null = null;
  const run = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (last) {
      const args = last;
      last = null;
      fn(...args);
    }
  };
  const wrapped = (...args: A) => {
    last = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, ms);
  };
  return Object.assign(wrapped, { flush: run });
}
