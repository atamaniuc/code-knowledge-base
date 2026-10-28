import { describe, expect, it } from "vitest";
import { domainOptions, levelOptions, NO_FILTERS, techOptions, type Option } from "../src/bank.js";
import { SHORTCUTS } from "../src/keys.js";
import {
  bankItems,
  bankResults,
  countText,
  drillView,
  emptyView,
  errorView,
  filtersBar,
  GRADE_SCALE,
  metaRow,
  interviewView,
  postingView,
  shell,
  shortcutSheetView,
  wikiView,
  type BankInput,
  type Spec,
} from "../src/view.js";
import { article, brief, DOMAINS, plan, question, TAGS, WIKI_TITLES } from "./fixture.js";

const rag = question();
const cache = question({
  id: "q-2",
  slug: "cache-stampede",
  domain: "data",
  levels: ["middle"],
  tech: "Redis",
  question: "How do you stop a cache stampede?",
  probes: "Whether single-flight with a lease is known.",
  expected: [{ text: "A lease makes one caller miss.", level: "middle", weight: 4 }],
  wikiRefs: [],
});

function walk(spec: Spec | string, visit: (spec: Spec) => void): void {
  if (typeof spec === "string") return;
  visit(spec);
  for (const child of spec.children ?? []) walk(child, visit);
}

function specs(spec: Spec): Spec[] {
  const out: Spec[] = [];
  walk(spec, (node) => out.push(node));
  return out;
}

/** Everything a person could read off the tree: text children, aria labels and rendered html. */
function text(spec: Spec): string {
  let out = "";
  walk(spec, (node) => {
    for (const child of node.children ?? []) if (typeof child === "string") out += " " + child;
    for (const name of ["aria-label", "title"]) {
      const value = node.attrs?.[name];
      if (typeof value === "string") out += " " + value;
    }
    if (node.html) out += " " + node.html;
  });
  return out;
}

function byAction(spec: Spec, action: string): Spec[] {
  return specs(spec).filter((node) => node.attrs?.["data-action"] === action);
}

function attr(spec: Spec, name: string): string {
  return String(spec.attrs?.[name] ?? "");
}

function bankInput(overrides: Partial<BankInput> = {}): BankInput {
  const questions = overrides.questions ?? [rag, cache];
  const options: { domains: Option[]; levels: Option[]; techs: Option[] } = {
    domains: domainOptions(questions, DOMAINS),
    levels: levelOptions(questions, []),
    techs: techOptions(questions),
  };
  return {
    questions,
    total: 2,
    filters: NO_FILTERS,
    domains: DOMAINS,
    domainOptions: options.domains,
    levelOptions: options.levels,
    techOptions: options.techs,
    expanded: null,
    seen: new Set<string>(),
    due: new Set<string>(),
    wikiTitles: WIKI_TITLES,
    ...overrides,
  };
}

const drill = (revealed: boolean) =>
  drillView({ question: rag, revealed, domains: DOMAINS, wikiTitles: WIKI_TITLES, remaining: 3 });

describe("the two-stage drill", () => {
  it("shows the question and what it probes, and nothing of the answer", () => {
    const spec = drill(false);
    const rendered = text(spec);
    expect(rendered).toContain("You raise top-k from 5 to 20");
    expect(rendered).toContain("Whether the candidate knows that context position matters");
    expect(rendered).not.toContain("Attention is not uniform");
    expect(byAction(spec, "grade")).toHaveLength(0);
  });

  it("offers exactly one way to commit, and focuses it", () => {
    const reveal = byAction(drill(false), "reveal");
    expect(reveal).toHaveLength(1);
    expect(attr(reveal[0] as Spec, "data-autofocus")).toBe("true");
    expect(byAction(drill(false), "wiki")).toHaveLength(0);
  });

  it("reveals the expected answer, the strategy, the mistakes and the source", () => {
    const rendered = text(drill(true));
    expect(rendered).toContain("Attention is not uniform");
    expect(rendered).toContain("Expected answer");
    expect(rendered).toContain("Common mistakes");
    expect(rendered).toContain("Evaluating a RAG system");
    const answer = specs(drill(true)).find((node) => String(node.attrs?.["class"] ?? "").includes("answer"));
    expect(answer?.attrs?.["tabindex"]).toBe("-1");
    expect(answer?.attrs?.["data-autofocus"]).toBe("true");
  });

  it("keeps the expected answer out of the DOM of the first stage entirely", () => {
    expect(JSON.stringify(drill(false))).not.toContain("Attention is not uniform");
  });
});

describe("grading", () => {
  it("offers all six grades once the answer is showing", () => {
    const grades = byAction(drill(true), "grade");
    expect(grades.map((node) => attr(node, "data-grade"))).toEqual(["0", "1", "2", "3", "4", "5"]);
  });

  it("puts the SM-2 meaning on the face of each button", () => {
    expect(GRADE_SCALE.map((entry) => entry.grade)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(GRADE_SCALE.map((entry) => entry.short)).toEqual(["blank", "wrong", "shaky", "hard", "good", "easy"]);
    expect(GRADE_SCALE[0]?.meaning).toContain("No memory");
    expect(GRADE_SCALE[3]?.meaning).toContain("passing threshold");
    expect(GRADE_SCALE[5]?.meaning).toContain("Immediate");
    const rendered = text(drill(true));
    for (const entry of GRADE_SCALE) expect(rendered).toContain(entry.meaning);
    expect(rendered).toContain("restarts the interval at one day");
  });
});

describe("bank", () => {
  it("lists one row per question with the two actions that matter", () => {
    const items = bankItems(bankInput());
    expect(items).toHaveLength(2);
    expect(byAction({ tag: "ul", children: items }, "toggle").map((n) => attr(n, "data-id"))).toEqual(["q-1", "q-2"]);
    expect(byAction({ tag: "ul", children: items }, "drill")).toHaveLength(2);
  });

  it("shows the answer inline only for the expanded row, and marks it expanded", () => {
    const closed = bankItems(bankInput());
    expect(text(closed[0] as Spec)).not.toContain("Attention is not uniform");
    const open = bankItems(bankInput({ expanded: "q-1" }));
    expect(text(open[0] as Spec)).toContain("Attention is not uniform");
    expect(attr(byAction(open[0] as Spec, "toggle")[0] as Spec, "aria-expanded")).toBe("true");
    expect(text(open[1] as Spec)).not.toContain("A lease makes one caller miss");
  });

  it("says so when a search matches nothing", () => {
    expect(text(bankResults(bankInput({ questions: [] })))).toContain("Nothing matches");
  });

  it("counts what is shown, and what the query matched", () => {
    expect(countText(4, 40, "")).toBe("4 of 40 questions");
    expect(countText(4, 40, "kafka")).toBe("4 of 40 questions matching “kafka”");
  });

  it("shows the search field in the bank and hides it in the drill", () => {
    expect(byAction(filtersBar(bankInput(), true), "search")).toHaveLength(1);
    expect(byAction(filtersBar(bankInput(), false), "search")).toHaveLength(0);
  });

  it("offers every filter value with its count", () => {
    const bar = filtersBar(bankInput(), false);
    const rendered = text(bar);
    expect(rendered).toContain("Agentic & AI-assisted development (1)");
    expect(rendered).toContain("Databases (1)");
    expect(rendered).toContain("Redis (1)");
    expect(byAction(bar, "filter").map((n) => attr(n, "data-filter"))).toEqual(["domain", "level", "tech"]);
  });
});

describe("wiki reader", () => {
  it("renders the body as sanitised markdown with the anchor ids wiki_refs point at", () => {
    const spec = wikiView({ article: article(), articles: [article()], domains: DOMAINS });
    const body = specs(spec).find((node) => String(node.attrs?.["class"] ?? "").includes("md"));
    expect(body?.html).toContain('<h2 id="position-effects">');
    expect(body?.html).toContain("<strong>not</strong>");
    expect(body?.html).not.toContain("<script");
  });

  it("marks the open article and offers a way back", () => {
    const spec = wikiView({ article: article(), articles: [article()], domains: DOMAINS });
    const current = specs(spec).filter((node) => attr(node, "aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(byAction(spec, "back")).toHaveLength(1);
  });
});

describe("posting", () => {
  it("explains itself when no plan is baked in", () => {
    expect(text(postingView({ plan: null, questions: [rag], domains: DOMAINS }))).toContain("No posting is baked into this build");
  });

  it("shows the source, the emphasis, the ordered plan and the gaps", () => {
    const spec = postingView({ plan: plan(), questions: [rag, cache], domains: DOMAINS });
    const rendered = text(spec);
    expect(rendered).toContain("Senior Node.js Engineer");
    expect(rendered).toContain("https://example.invalid/jobs/1");
    expect(rendered).toContain("RAG");
    expect(rendered).toContain("Redis");
    expect(rendered).toContain("How do you stop a cache stampede?");
    expect(rendered).toContain("ClickHouse");
    // Both the core entry and the stretch entry resolve to a question in the bank.
    const open = byAction(spec, "open-question");
    expect(open.map((node) => attr(node, "data-id"))).toEqual(["q-1", "q-2"]);
  });

  it("handles a plan entry whose question is not in the bank", () => {
    const missing = plan({
      core: [{ id: "gone", slug: "vanished", domain: "infra", levels: ["senior"], reason: "nothing covers this" }],
    });
    const spec = postingView({ plan: missing, questions: [rag], domains: DOMAINS });
    expect(text(spec)).toContain("vanished");
    expect(byAction(spec, "open-question")).toHaveLength(0);
  });
});

describe("interview brief", () => {
  const input = (overrides: Partial<Parameters<typeof interviewView>[0]> = {}) => ({
    briefs: [brief()],
    domains: DOMAINS,
    expanded: null,
    tag: "",
    tags: TAGS,
    wikiTitles: WIKI_TITLES,
    ...overrides,
  });

  it("says so when a build baked no brief", () => {
    expect(text(interviewView(input({ briefs: [] })))).toContain("No interview brief is baked into this build");
  });

  it("introduces the target, the process and how many questions are almost certain", () => {
    const rendered = text(interviewView(input()));
    expect(rendered).toContain("Finverity · Senior Node.js Engineer");
    expect(rendered).toContain("Senior Node.js Engineer");
    expect(rendered).toContain("Техническое интервью");
    expect(rendered).toContain("90");
    expect(rendered).toContain("2 вопроса · 1 спросят почти наверняка");
  });

  it("declines its count the way the language does, not the way a template does", () => {
    // Every group here holds one question, so the count on the page is the group count.
    const withGroups = (n: number) => {
      const one = brief();
      const group = one.groups[0];
      if (!group) throw new Error("fixture lost its group");
      const groups = Array.from({ length: n }, (_, index) => ({ ...group, id: "group-" + String(index) }));
      return text(interviewView(input({ briefs: [{ ...one, groups }] })));
    };
    expect(withGroups(1)).toContain("1 вопрос ·");
    expect(withGroups(3)).toContain("3 вопроса ·");
    expect(withGroups(5)).toContain("5 вопросов ·");
  });

  it("groups the questions by the side of the interview they rehearse", () => {
    const rendered = text(interviewView(input()));
    expect(rendered).toContain("Защита ядра решения");
    expect(rendered).toContain("техническая сторона");
    expect(rendered).toContain("доменная сторона");
    expect(rendered).toContain("Вопросы по сторонам интервью");
  });

  it("keeps the answer off the screen until the question is opened", () => {
    const closed = interviewView(input());
    expect(JSON.stringify(closed)).not.toContain("Называю окно");
    const trigger = byAction(closed, "toggle");
    expect(trigger.map((node) => attr(node, "data-id"))).toEqual(["limit-race-atomic-update", "fx-drift-on-release"]);
    expect(attr(trigger[0] as Spec, "aria-expanded")).toBe("false");
  });

  it("opens one answer: what is checked, the answer, the traps and the follow-up", () => {
    const spec = interviewView(input({ expanded: "limit-race-atomic-update" }));
    const rendered = text(spec);
    expect(rendered).toContain("Что проверяют");
    expect(rendered).toContain("Называю окно прочитал-проверил-записал источником бага");
    expect(rendered).toContain("Ловушки");
    expect(rendered).toContain("Распределённая блокировка");
    expect(rendered).toContain("Что спросят дальше");
    expect(rendered).toContain("Что если запросы придут на разные реплики?");
    expect(attr(byAction(spec, "toggle")[0] as Spec, "aria-expanded")).toBe("true");
    // The other question stays shut.
    expect(rendered).not.toContain("Пересчёт по текущему курсу");
  });

  it("links back to the articles behind a group", () => {
    const spec = interviewView(input());
    expect(byAction(spec, "wiki").map((node) => attr(node, "data-slug"))).toEqual(["evaluating-rag"]);
    expect(text(spec)).toContain("Evaluating a RAG system");
  });

  it("offers every theme the brief actually uses, with counts", () => {
    const rendered = text(interviewView(input()));
    expect(rendered).toContain("Темы");
    expect(rendered).toContain("все (2)");
    expect(rendered).toContain("конкурентность (1)");
    expect(rendered).toContain("PostgreSQL (1)");
    // A registry tag nothing carries stays out of the bar: it would filter to an empty page.
    expect(rendered).not.toContain("деньги (0)");
  });

  it("filters to one theme across groups and drops the groups left empty", () => {
    const spec = interviewView(input({ tag: "postgres" }));
    const rendered = text(spec);
    expect(rendered).toContain("1 вопрос по теме «PostgreSQL»");
    expect(rendered).toContain("Защита ядра решения");
    // The money group knows nothing about PostgreSQL, so it is gone rather than empty.
    expect(rendered).not.toContain("Деньги и валюты");
    expect(byAction(spec, "toggle").map((node) => attr(node, "data-id"))).toEqual(["limit-race-atomic-update"]);
    expect(attr(byAction(spec, "tag").find((node) => attr(node, "data-tag") === "postgres") as Spec, "aria-pressed")).toBe("true");
  });

  it("says so when a theme matches nothing", () => {
    const rendered = text(interviewView(input({ tag: "tenancy" })));
    expect(rendered).toContain("По этой теме ничего нет");
  });

  it("turns a question's own tags into the way to its neighbours", () => {
    const spec = interviewView(input({ expanded: "limit-race-atomic-update" }));
    const chips = byAction(spec, "tag").filter((node) => String(node.attrs?.["data-focus-key"] ?? "").startsWith("qtag-"));
    expect(chips.map((node) => attr(node, "data-tag"))).toEqual(["concurrency", "postgres"]);
  });

  it("falls back to the id when a group names a domain the registry does not carry", () => {
    const orphan = brief({ target: { role: "r", company: "c", domain: "unknown-domain", stack: [] } });
    expect(text(interviewView(input({ briefs: [orphan] })))).toContain("Unknown Domain");
  });
});
describe("shortcut sheet", () => {
  it("lists every shortcut and is labelled as a dialog", () => {
    const spec = shortcutSheetView();
    const dialog = specs(spec)[0] ?? spec;
    expect(attr(specs(spec).find((node) => node.attrs?.["role"] === "dialog") ?? dialog, "aria-modal")).toBe("true");
    const rendered = text(spec);
    for (const shortcut of SHORTCUTS) expect(rendered).toContain(shortcut.keys);
    expect(byAction(spec, "close-shortcuts")).toHaveLength(1);
  });
});

describe("shell", () => {
  const chrome = {
    view: "bank" as const,
    progress: { answered: 3, recalled: 2 },
    streak: 4,
    remaining: 5,
    fontPercent: 100,
    canBack: false,
    canForward: false,
    fullscreen: false,
  };

  it("marks the open view and reports today, the streak and the queue", () => {
    const spec = shell(chrome, [emptyView("empty")]);
    expect(byAction(spec, "view").map((node) => attr(node, "data-view"))).toEqual(["drill", "bank", "posting", "interview"]);
    expect(attr(specs(spec).find((node) => attr(node, "data-view") === "bank") ?? spec, "aria-current")).toBe("page");
    const rendered = text(spec);
    expect(rendered).toContain("2 of 3 recalled today");
    expect(rendered).toContain("4-day streak");
    expect(rendered).toContain("5 in the queue");
    const meter = specs(spec).find((node) => node.attrs?.["role"] === "progressbar");
    expect(meter?.attrs?.["aria-valuenow"]).toBe(3);
    expect(meter?.attrs?.["aria-valuemax"]).toBe(8);
  });

  it("reports a day with nothing answered yet", () => {
    const rendered = text(shell({ ...chrome, progress: { answered: 0, recalled: 0 }, streak: 0 }, []));
    expect(rendered).toContain("nothing answered today");
    expect(rendered).toContain("no streak yet");
  });

  it("appends the overlay when one is given", () => {
    expect(byAction(shell(chrome, [], shortcutSheetView()), "close-shortcuts")).toHaveLength(1);
  });

  it("carries the history, text-size and fullscreen controls", () => {
    const idle = shell(chrome, []);
    expect(byAction(idle, "back")).toHaveLength(1);
    // Nothing behind you yet, so both arrows are inert rather than absent.
    expect(byAction(idle, "back")[0]?.attrs?.disabled).toBe(true);
    expect(byAction(idle, "forward")[0]?.attrs?.disabled).toBe(true);

    const deep = shell({ ...chrome, canBack: true, canForward: true, fontPercent: 125, fullscreen: true }, []);
    expect(byAction(deep, "back")[0]?.attrs?.disabled).toBe(false);
    expect(byAction(deep, "forward")[0]?.attrs?.disabled).toBe(false);
    expect(text(deep)).toContain("125%");
    expect(attr(byAction(deep, "fullscreen")[0]!, "aria-pressed")).toBe("true");
    expect(attr(byAction(idle, "fullscreen")[0]!, "aria-pressed")).toBe("false");
    expect(byAction(deep, "font").map((node) => attr(node, "data-dir"))).toEqual(["-1", "1"]);
  });
});

describe("small views", () => {
  it("labels a question with its domain title, levels, technology and cost", () => {
    const rendered = text(metaRow(rag, DOMAINS));
    expect(rendered).toContain("Agentic & AI-assisted development");
    expect(rendered).toContain("senior");
    expect(rendered).toContain("RAG");
    expect(rendered).toContain("~6 min");
    expect(rendered).toContain("difficulty 4/5");
  });

  it("renders an error as an alert with the message", () => {
    const spec = errorView("content.json returned HTTP 404");
    expect(attr(spec, "role")).toBe("alert");
    expect(text(spec)).toContain("content.json returned HTTP 404");
  });
});
