/**
 * Select text, click Translate, read Russian.
 *
 * Self-contained on purpose: this is the one feature that leaves the device, so everything it
 * needs — endpoint, request shape, response parsing, the popup — lives in this file and nothing
 * else in the panel knows it exists. The manifest grants exactly the two Google Translate
 * origins below and no more, and every call happens on a click; nothing here fetches on load.
 *
 * Both endpoints are the free, keyless ones Google's own dictionary extension used. They are
 * undocumented and rate limited (the gtx one answers 429 under load), which is why there are
 * two and why a failure is shown rather than swallowed.
 */

export const TRANSLATE_TARGET = "ru";

/** Tried in order. clients5 accepts a plain query string; gtx is the classic single endpoint. */
export const TRANSLATE_ENDPOINTS = [
  "https://clients5.google.com/translate_a/t",
  "https://translate.googleapis.com/translate_a/single",
] as const;

/** The origins the manifest must allow — kept here so the permission and the call cannot drift. */
export const TRANSLATE_ORIGINS = ["https://clients5.google.com/*", "https://translate.googleapis.com/*"] as const;

export const MAX_SELECTION = 1000;

export type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function buildTranslateUrl(endpoint: string, text: string, target: string = TRANSLATE_TARGET): string {
  const url = new URL(endpoint);
  url.searchParams.set("client", endpoint.includes("clients5") ? "dict-chrome-ex" : "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", target);
  url.searchParams.set("q", text);
  if (!endpoint.includes("clients5")) url.searchParams.set("dt", "t");
  return url.toString();
}

/**
 * Both response shapes, and nothing else.
 *
 * gtx answers a nested array of segments: [[["перевод","source",null,null,10]],null,"en"].
 * clients5 answers [[translated, detectedLanguage]] (or one entry per sentence). A shape we do
 * not recognise is an error rather than an empty string, because a silent empty popup looks
 * like a translation of nothing.
 */
export function parseTranslateResponse(payload: unknown): string {
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (typeof first === "string") return first.trim();

    if (Array.isArray(first)) {
      // The nesting depth is what identifies the shape, not guesswork about which string is a
      // language code:
      //   gtx                    [[["t1","src",null,null,10]], null, "en"]  first[0] is a segment
      //   clients5               [["t1","en"], ["t2","en"]]                 first[0] is the text
      const pieces = Array.isArray(first[0])
        ? first.map((segment) => (Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : ""))
        : payload.map((pair) => (Array.isArray(pair) && typeof pair[0] === "string" ? pair[0] : ""));
      const joined = pieces.join("").trim();
      if (joined) return joined;
    }
  }

  const sentences = (payload as { sentences?: { trans?: unknown }[] } | null)?.sentences;
  if (Array.isArray(sentences)) {
    const joined = sentences.map((s) => (typeof s?.trans === "string" ? s.trans : "")).join("").trim();
    if (joined) return joined;
  }

  throw new Error("the translation response had no text in a shape this panel knows");
}

export interface TranslateOptions {
  fetchImpl?: FetchLike;
  target?: string;
  /** Injectable for tests; defaults to the real endpoints in order. */
  endpoints?: readonly string[];
  signal?: AbortSignal;
}

/** The whole network feature: one selection in, one translation out, first endpoint that answers. */
export async function translateText(text: string, options: TranslateOptions = {}): Promise<string> {
  const query = selectionText(text);
  if (!query) throw new Error("nothing selected to translate");

  const doFetch: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const endpoints = options.endpoints ?? TRANSLATE_ENDPOINTS;
  const failures: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const response = await doFetch(buildTranslateUrl(endpoint, query, options.target ?? TRANSLATE_TARGET), {
        signal: options.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        failures.push(new URL(endpoint).host + " answered " + String(response.status));
        continue;
      }
      return parseTranslateResponse(await response.json());
    } catch (error) {
      failures.push(new URL(endpoint).host + ": " + (error instanceof Error ? error.message : String(error)));
    }
  }
  throw new Error(failures.join("; "));
}

/** One line, whitespace collapsed, bounded. What a selection has to be before it is worth a request. */
export function selectionText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_SELECTION);
}

export interface PopupPosition {
  x: number;
  y: number;
}

/** Keeps the popup on screen: the cursor can be at the very edge of a side panel. */
export function clampPosition(point: PopupPosition, size: { width: number; height: number }, view: { width: number; height: number }): PopupPosition {
  const x = Math.max(6, Math.min(point.x, Math.max(6, view.width - size.width - 6)));
  const y = Math.max(6, Math.min(point.y + 12, Math.max(6, view.height - size.height - 6)));
  return { x, y };
}

export interface SelectionTranslatorOptions {
  doc?: Document;
  fetchImpl?: FetchLike;
  target?: string;
  /** Called after a translation is shown; the panel uses it for the screen-reader announcement. */
  onTranslated?: (text: string) => void;
}

export interface SelectionTranslator {
  destroy(): void;
}

/**
 * Wires the popup up. Everything decided here is thin: which element, where, and what the two
 * states say. The work is in translateText above, which is what the tests exercise.
 */
export function attachSelectionTranslator(options: SelectionTranslatorOptions = {}): SelectionTranslator {
  const doc = options.doc ?? document;
  let pop: HTMLElement | null = null;
  let controller: AbortController | null = null;

  function close(): void {
    controller?.abort();
    controller = null;
    pop?.remove();
    pop = null;
  }

  function element(tag: string, className: string, text?: string): HTMLElement {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function open(point: PopupPosition, text: string): void {
    close();
    const box = element("div", "translate-pop");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Translate the selection");

    const source = element("p", "translate-pop-source", text.length > 90 ? text.slice(0, 90) + "…" : text);
    const run = element("button", "translate-pop-run", "Translate → " + (options.target ?? TRANSLATE_TARGET).toUpperCase()) as HTMLButtonElement;
    run.type = "button";
    const output = element("p", "translate-pop-output");
    output.setAttribute("aria-live", "polite");
    const closeBtn = element("button", "translate-pop-close", "×") as HTMLButtonElement;
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");

    run.addEventListener("click", () => {
      controller?.abort();
      controller = new AbortController();
      run.disabled = true;
      output.textContent = "…";
      output.setAttribute("data-state", "loading");
      void translateText(text, { fetchImpl: options.fetchImpl, target: options.target, signal: controller.signal })
        .then((translated) => {
          if (!pop) return;
          output.textContent = translated;
          output.setAttribute("data-state", "done");
          options.onTranslated?.(translated);
        })
        .catch((error: unknown) => {
          if (!pop) return;
          output.textContent = error instanceof Error ? error.message : String(error);
          output.setAttribute("data-state", "error");
        })
        .finally(() => {
          run.disabled = false;
        });
    });
    closeBtn.addEventListener("click", close);

    box.append(source, run, output, closeBtn);
    // On body, not inside the panel's root: every re-render replaces that subtree.
    (doc.body ?? doc.documentElement).append(box);

    const rect = box.getBoundingClientRect();
    const at = clampPosition(point, { width: rect.width, height: rect.height }, { width: window.innerWidth, height: window.innerHeight });
    box.style.left = String(Math.round(at.x)) + "px";
    box.style.top = String(Math.round(at.y)) + "px";
    pop = box;
    run.focus();
  }

  function onMouseUp(event: MouseEvent): void {
    const selection = doc.getSelection();
    const text = selectionText(selection?.toString() ?? "");
    if (!text || text.length < 2) {
      close();
      return;
    }
    const target = event.target;
    if (target instanceof Node && pop?.contains(target)) return;
    open({ x: event.clientX, y: event.clientY }, text);
  }

  function onMouseDown(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Node && pop?.contains(target)) return;
    close();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") close();
  }

  doc.addEventListener("mouseup", onMouseUp);
  doc.addEventListener("mousedown", onMouseDown);
  doc.addEventListener("keydown", onKeyDown);

  return {
    destroy(): void {
      doc.removeEventListener("mouseup", onMouseUp);
      doc.removeEventListener("mousedown", onMouseDown);
      doc.removeEventListener("keydown", onKeyDown);
      close();
    },
  };
}
