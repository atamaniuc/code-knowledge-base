import { type Grade, eligible, nextUp } from "@scheduling/index.js";
import {
  applyFilters,
  domainOptions,
  emptyState,
  hasActiveFilters,
  levelOptions,
  NO_FILTERS,
  techOptions,
  withPinned,
  type Filters,
} from "./bank.js";
import { articleBySlug, parseBundle, toSelectorPool, type Bundle, type Question } from "./bundle.js";
import { mount, render } from "./dom.js";
import { browserHost, fullscreenActive, toggleFullscreen } from "./fullscreen.js";
import {
  canGoBack,
  canGoForward,
  currentPlace,
  EMPTY_HISTORY,
  goBack as historyBack,
  goForward as historyForward,
  type History,
  type Place,
  pushPlace,
} from "./history.js";
import { resolveKey, type Action, type ViewId } from "./keys.js";
import {
  canGrow,
  canShrink,
  chromeStore,
  debounce,
  fontPercent,
  loadPrefs,
  savePrefs,
  type Session,
  stepFont,
} from "./prefs.js";
import { dayProgress, streak } from "./stats.js";
import { BrowserReviewLog } from "./storage.js";
import { attachSelectionTranslator } from "./translate.js";
import * as view from "./view.js";

/**
 * The side panel controller.
 *
 * Views are pure specs (view.ts) and this file only decides which one to build and what a
 * click or a key means. The two-stage drill lives here as one boolean: `revealed` is set
 * only by an explicit commit, and a new question clears it, which is what keeps the
 * expected answer off the screen while you are still thinking.
 */
async function main(): Promise<void> {
  const found = document.getElementById("app");
  const announcer = document.getElementById("announce");
  if (!found) return;
  // Non-null alias: closures below are analysed outside the guard's narrowing.
  const app = found;

  let bundle: Bundle;
  try {
    const response = await fetch("content.json");
    if (!response.ok) throw new Error("content.json returned HTTP " + String(response.status));
    bundle = parseBundle(await response.json());
  } catch (error) {
    mount(app, view.errorView(error instanceof Error ? error.message : String(error)));
    return;
  }

  const log = await BrowserReviewLog.load();

  // Everything the panel has to remember is read here and written by persist() below: a side
  // panel is destroyed when it is hidden, so the session exists only in storage.
  const store = chromeStore();
  const prefs = await loadPrefs(store);
  let fontStep = prefs.fontStep;
  let history: History = EMPTY_HISTORY;
  let fullscreen = document.fullscreenElement !== null;
  let restoredScroll = prefs.session?.scrollTop ?? 0;

  let viewId: ViewId = "drill";
  let filters: Filters = { ...NO_FILTERS };
  let revealed = false;
  let shownId: string | null = null;
  let pinned: Question | null = null;
  let expanded: string | null = null;
  let wiki: { slug: string; anchor: string; from: ViewId } | null = null;
  let sheet = false;
  let pending: "g" | null = null;

  if (prefs.session) {
    viewId = prefs.session.view;
    filters = prefs.session.filters;
    expanded = prefs.session.expanded;
    wiki = prefs.session.wiki ? { ...prefs.session.wiki, from: prefs.session.view } : null;
    pinned = prefs.session.questionId ? (bundle.questions.find((q) => q.id === prefs.session?.questionId) ?? null) : null;
    shownId = prefs.session.questionId;
    revealed = prefs.session.revealed;
  }

  function announce(message: string): void {
    if (announcer) announcer.textContent = message;
  }

  function applyFont(step: number): void {
    // Rounded to two decimals: 14 * 1.1 is 15.400000000000002 in binary floating point.
    document.documentElement.style.setProperty("--font-size", String(Math.round(14 * step * 100) / 100) + "px");
  }
  applyFont(fontStep);

  /**
   * The element that actually scrolls.
   *
   * The sheet lays the panel out as one tall column today, so the document scrolls; #main only
   * scrolls if a rule ever gives it an overflow. Asking for the overflow as well as the range
   * is what tells the two apart — a flex child is as tall as its content, so its scrollHeight
   * merely equals its clientHeight and it looks scrollable while never moving.
   */
  function scroller(): Element {
    const main = document.getElementById("main");
    if (main && /auto|scroll/.test(getComputedStyle(main).overflowY) && main.scrollHeight > main.clientHeight) return main;
    return document.scrollingElement ?? document.documentElement;
  }

  function currentSession(): Session {
    return {
      view: wiki ? wiki.from : viewId,
      questionId: pinned?.id ?? shownId,
      revealed,
      filters,
      expanded,
      wiki: wiki ? { slug: wiki.slug, anchor: wiki.anchor } : null,
      scrollTop: scroller()?.scrollTop ?? 0,
    };
  }

  const persist = debounce(() => {
    void savePrefs(store, { fontStep, session: currentSession() });
  }, 250);

  function place(): Place {
    return { view: viewId, questionId: pinned?.id ?? shownId, wiki: wiki ? { slug: wiki.slug, anchor: wiki.anchor } : null, expanded };
  }

  /** Put the panel back where a history entry was, without adding a new one. */
  function restorePlace(target: Place): void {
    viewId = target.view;
    wiki = target.wiki ? { ...target.wiki, from: target.view } : null;
    expanded = target.expanded;
    pinned = target.questionId ? (bundle.questions.find((q) => q.id === target.questionId) ?? null) : null;
    shownId = target.questionId;
    revealed = false;
    sheet = false;
    rerender();
  }

  const fullscreenHost = browserHost(document, (globalThis as { chrome?: unknown }).chrome);

  /**
   * The button's whole job is to report what fullscreen.ts decided: a side panel cannot fill
   * the screen itself (Chrome accepts the call there and never answers it), so the module falls
   * back to a window it can put into fullscreen, and this only reflects the outcome.
   */
  async function applyFullscreen(): Promise<void> {
    const result = await toggleFullscreen(fullscreenHost);
    fullscreen = result.fullscreen || document.fullscreenElement !== null;
    announce(result.message);
    rerender();
  }

  let refreshingFullscreen = false;

  /** Leaving a fullscreen window is a window event, not a fullscreenchange, so both are read. */
  async function refreshFullscreen(): Promise<void> {
    if (refreshingFullscreen) return;
    refreshingFullscreen = true;
    try {
      const active = await fullscreenActive(fullscreenHost);
      if (active !== fullscreen) {
        fullscreen = active;
        rerender();
      }
    } finally {
      refreshingFullscreen = false;
    }
  }

  function snapshot(): {
    filtered: Question[];
    queue: Question[];
    progress: view.Chrome["progress"];
    streak: number;
    seen: ReadonlySet<string>;
    due: ReadonlySet<string>;
  } {
    const filtered = applyFilters(bundle.questions, filters);
    const chosen = pinned;
    if (chosen && !filtered.some((q) => q.id === chosen.id)) pinned = null;

    // The selector reads review_status and nothing else about provenance; the pool is
    // pre-filtered here so domain/level/tech/search all behave as one filter set.
    const byId = new Map(filtered.map((q) => [q.id, q]));
    const ordered = nextUp(toSelectorPool(filtered) as never, log, {}) as unknown as { id: string }[];
    const queue = withPinned(
      pinned,
      ordered.map((s) => byId.get(s.id)).filter((q): q is Question => q !== undefined),
    );

    const records = log.allRecords();
    return { filtered, queue, progress: dayProgress(records), streak: streak(records), seen: log.seenIds(), due: new Set(log.dueIds(new Date())) };
  }

  type Snap = ReturnType<typeof snapshot>;

  function currentQuestion(snap: Snap): Question | null {
    const next = snap.queue[0] ?? null;
    if ((next ? next.id : null) !== shownId) {
      shownId = next ? next.id : null;
      revealed = false;
    }
    return next;
  }

  function promptPool(): number {
    return eligible(toSelectorPool(bundle.questions) as never, {}).length;
  }

  function wikiTitles(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const article of bundle.wiki) out[article.slug] = article.title;
    return out;
  }

  function bankInput(snap: Snap): view.BankInput {
    return {
      questions: snap.filtered,
      total: bundle.questions.length,
      filters,
      domains: bundle.domains,
      // Option lists come from the whole bank, not the filtered slice, so a filter cannot
      // hide the values needed to undo it.
      domainOptions: domainOptions(bundle.questions, bundle.domains),
      levelOptions: levelOptions(bundle.questions, bundle.levels),
      techOptions: techOptions(bundle.questions),
      expanded,
      seen: snap.seen,
      due: snap.due,
      wikiTitles: wikiTitles(),
    };
  }

  function body(snap: Snap): view.Spec[] {
    if (wiki) {
      const article = articleBySlug(bundle, wiki.slug);
      if (article) return [view.wikiView({ article, articles: bundle.wiki, domains: bundle.domains })];
      wiki = null;
    }
    if (viewId === "bank") return [view.bankView(bankInput(snap))];
    if (viewId === "posting") {
      return [view.postingView({ plan: bundle.plan, questions: bundle.questions, domains: bundle.domains })];
    }
    const question = currentQuestion(snap);
    if (!question) {
      const empty = emptyState({
        total: bundle.questions.length,
        promoted: promptPool(),
        shown: snap.filtered.length,
        filtered: hasActiveFilters(filters),
      });
      return [view.emptyView(empty.title, empty.hint)];
    }
    return [view.drillView({ question, revealed, domains: bundle.domains, wikiTitles: wikiTitles(), remaining: snap.queue.length })];
  }

  function scrollToAnchor(anchor: string): void {
    if (!anchor) return;
    const node = document.getElementById(anchor);
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }

  function rerender(): void {
    const active = document.activeElement;
    const focusKey = active instanceof HTMLElement ? active.getAttribute("data-focus-key") : null;

    const snap = snapshot();
    const specs = body(snap);
    // Every distinct place the panel shows is a history entry, so back walks the session
    // rather than the browser tab: question, article, filter set, expanded answer.
    history = pushPlace(history, place());
    const chrome: view.Chrome = {
      view: wiki ? wiki.from : viewId,
      progress: snap.progress,
      streak: snap.streak,
      remaining: snap.queue.length,
      fontPercent: fontPercent(fontStep),
      canBack: canGoBack(history),
      canForward: canGoForward(history),
      fullscreen,
    };
    mount(app, view.shell(chrome, specs, sheet ? view.shortcutSheetView() : undefined));

    const restored = focusKey ? app.querySelector('[data-focus-key="' + focusKey + '"]') : null;
    const target = restored ?? app.querySelector("[data-autofocus]");
    if (target instanceof HTMLElement) target.focus();

    if (wiki && wiki.anchor) {
      scrollToAnchor(wiki.anchor);
      wiki = { ...wiki, anchor: "" };
    } else if (restoredScroll > 0) {
      // Returning to where the session stopped: once per opening, not on every render.
      scroller().scrollTop = restoredScroll;
      restoredScroll = 0;
    }
    persist();
  }

  /** Search re-renders only the list, so the caret survives every keystroke. */
  function refreshResults(): void {
    const snap = snapshot();
    const old = app.querySelector("#bank-results");
    if (old) old.replaceWith(render(view.bankResults(bankInput(snap))));
    const text = view.countText(snap.filtered.length, bundle.questions.length, filters.query);
    const count = app.querySelector("#bank-count");
    if (count) count.textContent = text;
    announce(text);
  }

  async function gradeQuestion(question: Question, grade: Grade): Promise<void> {
    try {
      await log.record(question.id, grade);
    } catch {
      announce("That review could not be saved.");
      return;
    }
    const meaning = view.GRADE_SCALE[grade];
    announce("Graded " + String(grade) + (meaning ? " (" + meaning.short + ")" : ""));
    pinned = null;
    expanded = null;
    revealed = false;
    shownId = null;
    rerender();
  }

  function apply(action: Action): void {
    switch (action.type) {
      case "reveal":
        if (viewId === "drill" && !wiki && !sheet && !revealed) {
          revealed = true;
          announce("Expected answer shown.");
          rerender();
        }
        return;
      case "grade": {
        if (wiki || sheet) return;
        const snap = snapshot();
        const question = currentQuestion(snap);
        if (revealed && question) void gradeQuestion(question, action.grade);
        return;
      }
      case "view":
        viewId = action.view;
        wiki = null;
        sheet = false;
        rerender();
        return;
      case "focusSearch":
        viewId = "bank";
        wiki = null;
        sheet = false;
        rerender();
        app.querySelector<HTMLInputElement>("#search")?.focus();
        return;
      case "shortcuts":
        sheet = !sheet;
        rerender();
        return;
      case "back": {
        if (sheet) {
          sheet = false;
          rerender();
          return;
        }
        if (canGoBack(history)) {
          history = historyBack(history);
          const target = currentPlace(history);
          if (target) restorePlace(target);
          return;
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        return;
      }
      case "forward": {
        if (canGoForward(history)) {
          history = historyForward(history);
          const target = currentPlace(history);
          if (target) restorePlace(target);
        }
        return;
      }
      case "font": {
        const next = stepFont(fontStep, action.direction);
        if (next === fontStep) {
          announce(action.direction > 0 ? "Already at the largest text size." : "Already at the smallest text size.");
          return;
        }
        fontStep = next;
        applyFont(fontStep);
        announce("Text size " + String(fontPercent(fontStep)) + "%");
        rerender();
        return;
      }
      case "fullscreen":
        void applyFullscreen();
        return;
      case "none":
        return;
    }
  }

  function dispatch(action: string, element: HTMLElement): void {
    switch (action) {
      case "reveal":
        apply({ type: "reveal" });
        return;
      case "grade": {
        const grade = Number(element.getAttribute("data-grade")) as Grade;
        apply({ type: "grade", grade });
        return;
      }
      case "view": {
        const target = element.getAttribute("data-view");
        if (target === "drill" || target === "bank" || target === "posting") apply({ type: "view", view: target });
        return;
      }
      case "toggle": {
        const id = element.getAttribute("data-id");
        expanded = expanded === id ? null : id;
        rerender();
        return;
      }
      case "drill": {
        const question = bundle.questions.find((q) => q.id === element.getAttribute("data-id"));
        if (!question) return;
        pinned = question;
        viewId = "drill";
        wiki = null;
        expanded = null;
        revealed = false;
        shownId = null;
        rerender();
        return;
      }
      case "wiki": {
        const slug = element.getAttribute("data-slug") ?? "";
        if (!articleBySlug(bundle, slug)) return;
        wiki = { slug, anchor: element.getAttribute("data-anchor") ?? "", from: viewId };
        sheet = false;
        rerender();
        return;
      }
      case "back":
        apply({ type: "back" });
        return;
      case "forward":
        apply({ type: "forward" });
        return;
      case "font": {
        const direction = Number(element.getAttribute("data-dir")) === 1 ? 1 : -1;
        apply({ type: "font", direction });
        return;
      }
      case "fullscreen":
        apply({ type: "fullscreen" });
        return;
      case "shortcuts":
        apply({ type: "shortcuts" });
        return;
      case "close-shortcuts":
        sheet = false;
        rerender();
        return;
      case "open-question": {
        const id = element.getAttribute("data-id");
        if (!id) return;
        viewId = "bank";
        wiki = null;
        expanded = id;
        rerender();
        return;
      }
      default:
        return;
    }
  }

  app.addEventListener("click", (event) => {
    const hit = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    if (hit instanceof HTMLElement) dispatch(hit.getAttribute("data-action") ?? "", hit);
  });

  app.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.getAttribute("data-action") !== "search") return;
    filters = { ...filters, query: target.value };
    refreshResults();
  });

  app.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.getAttribute("data-action") !== "filter") return;
    const name = target.getAttribute("data-filter");
    if (name === "domain") filters = { ...filters, domain: target.value };
    else if (name === "level") filters = { ...filters, level: target.value };
    else if (name === "tech") filters = { ...filters, tech: target.value };
    rerender();
  });

  window.addEventListener("keydown", (event) => {
    // Alt is allowed through for the history arrows; the resolver decides what it means.
    if (event.metaKey || event.ctrlKey) return;
    const target = event.target;
    const inField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    const result = resolveKey(pending, event.key, { inField, alt: event.altKey });
    pending = result.pending;

    const action = result.action;
    if (action.type === "none") return;
    // A digit is a grade only while an answer is committed and nothing is covering it.
    if (action.type === "grade" && (viewId !== "drill" || wiki !== null || sheet || !revealed)) return;
    event.preventDefault();
    apply(action);
  });

  // Scroll events do not bubble, so the listener captures the panel's own scroller.
  document.addEventListener("scroll", () => persist(), { passive: true, capture: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist.flush();
  });
  window.addEventListener("pagehide", () => persist.flush());
  document.addEventListener("fullscreenchange", () => void refreshFullscreen());
  window.addEventListener("resize", () => void refreshFullscreen());

  // The one feature that leaves the device, wired last so its failure cannot stop the drill.
  attachSelectionTranslator({ onTranslated: (text) => announce("Translated: " + text) });

  // The panel may already be filling the screen in the window it was opened into.
  fullscreen = await fullscreenActive(fullscreenHost);

  rerender();
}

void main();
