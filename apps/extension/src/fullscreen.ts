/**
 * The header's fullscreen button, decided from where the panel is running.
 *
 * One `requestFullscreen()` call is not enough, because a side panel is not a tab. Measured on
 * Chrome 155: from a side panel the call returns a promise that `never settles` — no
 * `fullscreenchange`, no `fullscreenerror`, nothing on screen — so a bare `await` hangs and the
 * button looks dead. Two consequences shape this module: the wait is bounded, and the outcome
 * is read back from the document rather than trusted from the promise.
 *
 * Everything is decided from an injected host, so every branch (side panel, tab, a window we
 * already put into fullscreen, an API that refuses) is testable without a browser.
 */

export type FullscreenAction =
  | "exit-element"
  | "enter-element"
  | "exit-window"
  | "focus-window"
  | "open-window"
  | "open-tab"
  | "unavailable";

export interface FullscreenWindow {
  id?: number;
  state?: string;
  type?: string;
}

export interface FullscreenHost {
  /** Where the panel lives: opened again when this window cannot go fullscreen itself. */
  readonly url: string;
  /** `document.fullscreenElement`, read fresh: the promise is not the source of truth. */
  readonly element: unknown;
  requestElement(): Promise<unknown>;
  exitElement(): Promise<unknown>;
  /** A Tab in a tab or popup window; `null` or `undefined` in a side panel, which has none. */
  currentTab(): Promise<unknown>;
  currentWindow(): Promise<FullscreenWindow | undefined>;
  updateWindow(id: number | undefined, state: "fullscreen" | "normal"): Promise<unknown>;
  createWindow(url: string): Promise<FullscreenWindow | undefined>;
  createTab(url: string): Promise<unknown>;
  /** A panel window that is already filling the screen, so a second press does not open another. */
  findFullscreenWindow(): Promise<FullscreenWindow | undefined>;
  focusWindow(id: number): Promise<unknown>;
  /** How long to wait for the element API before deciding it did nothing. */
  timeoutMs?: number;
}

export interface FullscreenResult {
  action: FullscreenAction;
  /** What the button's pressed state should be afterwards. */
  fullscreen: boolean;
  message: string;
}

const DEFAULT_TIMEOUT_MS = 1200;

type Attempt<T> = { ok: true; value: T } | { ok: false };

async function attempt<T>(run: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await run() };
  } catch {
    return { ok: false };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isSidePanel(tab: Attempt<unknown>): boolean {
  return !tab.ok || tab.value === null || tab.value === undefined;
}

/** True only when the API actually put something on screen, not merely resolved. */
async function enterElement(host: FullscreenHost): Promise<boolean> {
  const called = attempt(() => host.requestElement());
  const settled = await Promise.race([
    called.then(() => true),
    sleep(host.timeoutMs ?? DEFAULT_TIMEOUT_MS).then(() => false),
  ]);
  return settled && host.element !== null && host.element !== undefined;
}

/**
 * Show the panel in a window of its own that can actually fill the screen.
 *
 * A missing API resolves `undefined` rather than throwing, so what comes back is checked and not
 * just the fact that the call was made. An earlier fullscreen window is focused instead of
 * opening a second one: the side panel has no way to tell that it is already showing.
 */
async function openWindowOrTab(host: FullscreenHost): Promise<FullscreenResult> {
  const existing = await attempt(() => host.findFullscreenWindow());
  const existingId = existing.ok ? existing.value?.id : undefined;
  if (existingId !== undefined) {
    const focused = await attempt(() => host.focusWindow(existingId));
    if (focused.ok) {
      return { action: "focus-window", fullscreen: false, message: "The panel is already open in a fullscreen window." };
    }
  }
  const opened = await attempt(() => host.createWindow(host.url));
  if (opened.ok && opened.value) {
    return {
      action: "open-window",
      fullscreen: true,
      message: "Opened the panel in a fullscreen window: a side panel cannot go fullscreen itself.",
    };
  }
  const tab = await attempt(() => host.createTab(host.url));
  if (tab.ok && tab.value) {
    return { action: "open-tab", fullscreen: false, message: "Opened the panel in a tab. Press fullscreen there to fill the screen." };
  }
  return { action: "unavailable", fullscreen: false, message: "Fullscreen is not available in this window." };
}

export async function toggleFullscreen(host: FullscreenHost): Promise<FullscreenResult> {
  if (host.element) {
    await attempt(() => host.exitElement());
    return { action: "exit-element", fullscreen: false, message: "Left fullscreen." };
  }

  const tab = await attempt(() => host.currentTab());
  if (isSidePanel(tab)) return openWindowOrTab(host);

  const window = await attempt(() => host.currentWindow());
  const current = window.ok ? window.value : undefined;
  if (current?.state === "fullscreen") {
    if (current.id === undefined) return { action: "unavailable", fullscreen: false, message: "This window could not leave fullscreen." };
    const left = await attempt(() => host.updateWindow(current.id, "normal"));
    if (left.ok) return { action: "exit-window", fullscreen: false, message: "Left fullscreen." };
    return { action: "unavailable", fullscreen: false, message: "This window could not leave fullscreen." };
  }

  if (await enterElement(host)) return { action: "enter-element", fullscreen: true, message: "Fullscreen on: esc leaves it." };
  // Either the API refused or — as it does in a side panel — never answered at all.
  return openWindowOrTab(host);
}

/** Whether the panel is filling the screen right now, for the button's pressed state. */
export async function fullscreenActive(host: FullscreenHost): Promise<boolean> {
  if (host.element) return true;
  const tab = await attempt(() => host.currentTab());
  if (isSidePanel(tab)) return false;
  const window = await attempt(() => host.currentWindow());
  return window.ok && window.value?.state === "fullscreen";
}

interface ChromeApi {
  tabs?: {
    getCurrent?: () => Promise<unknown>;
    create?: (options: { url: string }) => Promise<unknown>;
  };
  windows?: {
    getCurrent?: () => Promise<FullscreenWindow | undefined>;
    getAll?: () => Promise<FullscreenWindow[] | undefined>;
    create?: (options: { url: string; type?: string; focused?: boolean }) => Promise<FullscreenWindow | undefined>;
    update?: (id: number, options: { state?: string; focused?: boolean }) => Promise<FullscreenWindow | undefined>;
  };
  runtime?: { getURL?: (path: string) => string };
}

/**
 * The real Chrome bindings.
 *
 * `windows.create` ignores `state: "fullscreen"` (measured: the window comes back "normal"), so
 * fullscreen is a second call on the window Chrome actually created.
 */
export function browserHost(doc: Document, api: unknown): FullscreenHost {
  const chrome = (api ?? {}) as ChromeApi;
  return {
    url: chrome.runtime?.getURL?.("panel.html") ?? "panel.html",
    get element(): unknown {
      return doc.fullscreenElement;
    },
    requestElement: () => doc.documentElement.requestFullscreen(),
    exitElement: () => doc.exitFullscreen(),
    currentTab: () => chrome.tabs?.getCurrent?.() ?? Promise.resolve(null),
    currentWindow: () => chrome.windows?.getCurrent?.() ?? Promise.resolve(undefined),
    updateWindow: (id, state) => (id === undefined ? Promise.resolve(undefined) : chrome.windows?.update?.(id, { state }) ?? Promise.resolve(undefined)),
    createWindow: async (url) => {
      const created = await chrome.windows?.create?.({ url, type: "popup", focused: true });
      if (!created) return undefined;
      if (created.state !== "fullscreen" && created.id !== undefined) {
        await chrome.windows?.update?.(created.id, { state: "fullscreen" });
      }
      return created;
    },
    createTab: (url) => chrome.tabs?.create?.({ url }) ?? Promise.resolve(undefined),
    findFullscreenWindow: async () => {
      const all = await chrome.windows?.getAll?.();
      return all?.find((window) => window.type === "popup" && window.state === "fullscreen");
    },
    focusWindow: (id) => chrome.windows?.update?.(id, { focused: true }) ?? Promise.resolve(undefined),
  };
}
