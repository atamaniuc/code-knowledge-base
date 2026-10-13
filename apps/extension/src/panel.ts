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
import { resolveKey, type Action, type ViewId } from "./keys.js";
import { dayProgress, streak } from "./stats.js";
import { BrowserReviewLog } from "./storage.js";
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

  let viewId: ViewId = "drill";
  let filters: Filters = { ...NO_FILTERS };
  let revealed = false;
  let shownId: string | null = null;
  let pinned: Question | null = null;
  let expanded: string | null = null;
  let wiki: { slug: string; anchor: string; from: ViewId } | null = null;
  let sheet = false;
  let pending: "g" | null = null;

  function announce(message: string): void {
    if (announcer) announcer.textContent = message;
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
    const chrome: view.Chrome = {
      view: wiki ? wiki.from : viewId,
      progress: snap.progress,
      streak: snap.streak,
      remaining: snap.queue.length,
    };
    mount(app, view.shell(chrome, specs, sheet ? view.shortcutSheetView() : undefined));

    const restored = focusKey ? app.querySelector('[data-focus-key="' + focusKey + '"]') : null;
    const target = restored ?? app.querySelector("[data-autofocus]");
    if (target instanceof HTMLElement) target.focus();

    if (wiki && wiki.anchor) {
      scrollToAnchor(wiki.anchor);
      wiki = { ...wiki, anchor: "" };
    }
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
      case "back":
        if (sheet) {
          sheet = false;
          rerender();
          return;
        }
        if (wiki) {
          viewId = wiki.from;
          wiki = null;
          rerender();
          return;
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
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
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    const inField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    const result = resolveKey(pending, event.key, { inField });
    pending = result.pending;

    const action = result.action;
    if (action.type === "none") return;
    // A digit is a grade only while an answer is committed and nothing is covering it.
    if (action.type === "grade" && (viewId !== "drill" || wiki !== null || sheet || !revealed)) return;
    event.preventDefault();
    apply(action);
  });

  rerender();
}

void main();
