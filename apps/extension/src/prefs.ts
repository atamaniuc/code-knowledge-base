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

/**
 * Font sizes as multipliers of the base. Steps, because a slider is worse than a button.
 *
 * The ladder climbs to double size: a side panel is read at arm's length in a narrow column,
 * and the two sizes that helped most in practice were the ones past 140% that did not exist
 * yet. Steps are irregular on purpose — equal ratios make the last ones feel like nothing.
 */
export const FONT_STEPS = [0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2] as const;
export const DEFAULT_FONT_STEP = 1;

export interface Session {
  view: ViewId;
  /** The question the drill was showing, so reopening lands on it rather than the next due one. */
  questionId: string | null;
  /** Whether that question's answer was already committed. */
  revealed: boolean;
  filters: Filters;
  expanded: string | null;
  /** The interview tag the reader was filtering by, or "". */
  tag: string;
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

/**
 * The size another window chose, or null when nothing changed.
 *
 * Fullscreen is not the same document: a side panel cannot fill the screen, so fullscreen
 * opens panel.html again in a window of its own, and the two instances then hold a copy of
 * the same pref. Without this, pressing A+ before going fullscreen resizes one window and
 * leaves the other at the old size — which reads as "the button stopped working" exactly
 * when the screen is biggest.
 */
export function adoptedFont(raw: unknown, current: number): number | null {
  const next = parsePrefs(raw).fontStep;
  return next === nearestStep(current) ? null : next;
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
    tag: typeof source.tag === "string" ? source.tag.slice(0, 40) : "",
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
  /**
   * Called with the raw stored value whenever another context writes it. Absent outside
   * Chrome and in tests that do not care; the panel treats a missing watcher as "no other
   * window exists", which is true for both.
   */
  watch?(fn: (raw: unknown) => void): void;
}

const KEY = "ui";

interface StorageChange {
  newValue?: unknown;
}

type ChangeListener = (changes: Record<string, StorageChange | undefined>, areaName: string) => void;

/** chrome.storage.local, or an in-memory stand-in when the page is opened outside Chrome. */
export function chromeStore(): PrefStore {
  const storage = (
    globalThis as {
      chrome?: {
        storage?: {
          local?: { get(keys: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> };
          onChanged?: { addListener(listener: ChangeListener): void };
        };
      };
    }
  ).chrome?.storage;
  const area = storage?.local;
  if (area) {
    const read = async (key: string): Promise<unknown> => (await area.get(key))[key];
    const write = async (key: string, value: unknown): Promise<void> => area.set({ [key]: value });
    const changes = storage?.onChanged;
    if (!changes) return { get: read, set: write };
    return {
      get: read,
      set: write,
      watch: (fn) => {
        changes.addListener((listenerChanges, areaName) => {
          if (areaName !== "local") return;
          const change = listenerChanges[KEY];
          if (change === undefined) return;
          fn(change.newValue);
        });
      },
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
