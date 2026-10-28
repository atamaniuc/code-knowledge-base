import { statusOf, type BankStatus, type Filters, type Option } from "./bank.js";
import {
  domainTitle,
  humanize,
  type Brief,
  type BriefGroup,
  type BriefQuestion,
  type DomainInfo,
  type Plan,
  type Question,
  type TagInfo,
  type WikiArticle,
} from "./bundle.js";
import { SHORTCUTS, type ViewId } from "./keys.js";
import { renderMarkdown } from "./markdown.js";
import { progressPercent, type DayProgress } from "./stats.js";

/**
 * Every pixel the panel draws, as data.
 *
 * Views are plain trees of {tag, attrs, children} rather than live elements, and they take
 * data in and return that tree. Two things fall out of it: the whole interface is testable
 * in Node without a DOM, and there is exactly one place where markup becomes nodes
 * (`dom.ts`), so the unsafe path is a single, reviewable assignment.
 *
 * The one escape hatch is `html`, used only for wiki bodies, which arrive already
 * escaped and rendered by `markdown.ts`.
 */

export interface Spec {
  tag: string;
  attrs?: Record<string, string | number | boolean | undefined>;
  children?: (Spec | string)[];
  html?: string;
}

type Attrs = Spec["attrs"];
type Kids = (Spec | string | null | undefined)[];

export function h(tag: string, attrs: Attrs, children: Kids = []): Spec {
  const kept = children.filter((child): child is Spec | string => child !== null && child !== undefined);
  return { tag, attrs, children: kept };
}

function chip(label: string, kind?: string): Spec {
  return h("span", { class: kind ? "chip chip-" + kind : "chip" }, [label]);
}

function chips(labels: string[], kind?: string): Spec[] {
  return labels.map((label) => chip(label, kind));
}

function levelChips(levels: string[]): Spec[] {
  return chips(levels, "level");
}

export function metaRow(question: Question, domains: DomainInfo[]): Spec {
  const parts: Spec[] = [chip(domainTitle(domains, question.domain))];
  parts.push(...levelChips(question.levels));
  if (question.tech) parts.push(chip(question.tech, "tech"));
  if (question.minutes > 0) parts.push(chip("~" + String(question.minutes) + " min"));
  if (question.difficulty > 0) parts.push(chip("difficulty " + String(question.difficulty) + "/5"));
  return h("div", { class: "meta" }, parts);
}

/**
 * The grade buttons carry the SM-2 meaning on their face.
 *
 * A bare 0-5 row is a scale nobody remembers two days later, and grading by feel is the
 * only input the scheduler gets; the label is the difference between a schedule that
 * works and one that is noise.
 */
export const GRADE_SCALE = [
  { grade: 0, short: "blank", meaning: "No memory of it at all." },
  { grade: 1, short: "wrong", meaning: "Recognised the topic, the answer was wrong." },
  { grade: 2, short: "shaky", meaning: "Wrong, but it was on the tip of your tongue." },
  { grade: 3, short: "hard", meaning: "Correct with serious effort — the passing threshold." },
  { grade: 4, short: "good", meaning: "Correct after a hesitation." },
  { grade: 5, short: "easy", meaning: "Immediate and complete." },
] as const;

function gradeRow(): Spec {
  const buttons = GRADE_SCALE.map((entry) =>
    h(
      "button",
      {
        type: "button",
        class: entry.grade < 3 ? "grade fail" : "grade pass",
        "data-action": "grade",
        "data-grade": entry.grade,
        "data-focus-key": "grade-" + String(entry.grade),
        "aria-keyshortcuts": String(entry.grade),
        "aria-label": "Grade " + String(entry.grade) + " of 5, " + entry.short + ": " + entry.meaning,
        title: entry.meaning,
      },
      [h("span", { class: "grade-n" }, [String(entry.grade)]), h("span", { class: "grade-short" }, [entry.short])],
    ),
  );
  return h("section", { class: "grading", "aria-label": "Grade your recall" }, [
    h("h2", {}, ["How did that go?"]),
    h("div", { class: "grades", role: "group", "aria-label": "Grade the recall from 0 to 5" }, buttons),
    h("p", { class: "hint" }, [
      "SM-2: 0-2 is a failed recall and restarts the interval at one day; 3 is correct but hard, 4 after a hesitation, 5 immediate. Grade honestly — the schedule is only as good as this.",
    ]),
  ]);
}

/** The answer half of a question: the part that must not be on screen while thinking in Drill. */
export function answerDetail(question: Question, domains: DomainInfo[], wikiTitles: Record<string, string>): Spec[] {
  const sections: Spec[] = [];

  const expected = h(
    "ol",
    { class: "expected" },
    question.expected.map((bullet) =>
      h("li", { class: "expected-item" }, [
        chip(bullet.level, "level"),
        h("span", { class: "expected-text" }, [bullet.text]),
        chip("w" + String(bullet.weight), "weight"),
      ]),
    ),
  );
  sections.push(h("section", {}, [h("h2", {}, ["Expected answer"]), expected]));

  if (question.answerStrategy) {
    sections.push(h("section", {}, [h("h2", {}, ["How to deliver it"]), h("p", { class: "strategy" }, [question.answerStrategy])]));
  }
  if (question.mistakes.length > 0) {
    sections.push(h("section", {}, [h("h2", {}, ["Common mistakes"]), h("ul", {}, question.mistakes.map((m) => h("li", {}, [m])))]));
  }
  if (question.followUps.length > 0) {
    sections.push(h("section", {}, [h("h2", {}, ["Follow-ups they may ask"]), h("ul", {}, question.followUps.map((f) => h("li", {}, [f])))]));
  }
  if (question.wikiRefs.length > 0) {
    sections.push(
      h("section", { class: "wiki-refs" }, [
        h("h2", {}, ["Read the source"]),
        h(
          "div",
          { class: "chips" },
          question.wikiRefs.map((ref) =>
            h(
              "button",
              {
                type: "button",
                class: "link",
                "data-action": "wiki",
                "data-slug": ref.slug,
                "data-anchor": ref.anchor,
                "data-focus-key": "wiki-" + ref.slug,
              },
              [wikiTitles[ref.slug] ?? ref.slug],
            ),
          ),
        ),
      ]),
    );
  }
  return sections;
}

export interface DrillInput {
  question: Question;
  /** False until the user has committed: the whole point of the two-stage drill. */
  revealed: boolean;
  domains: DomainInfo[];
  wikiTitles: Record<string, string>;
  remaining: number;
}

export function drillView(input: DrillInput): Spec {
  const question = input.question;
  const card: Spec[] = [
    metaRow(question, input.domains),
    h("p", { class: "question" }, [question.question]),
    h("div", { class: "probes" }, [h("b", {}, ["What they are testing"]), h("span", {}, [question.probes])]),
  ];

  if (!input.revealed) {
    card.push(
      h("div", { class: "actions" }, [
        h(
          "button",
          {
            type: "button",
            class: "primary",
            "data-action": "reveal",
            "data-autofocus": "true",
            "aria-keyshortcuts": "Space Enter",
          },
          ["Answer out loud, then reveal ", h("kbd", {}, ["space"])],
        ),
        h("p", { class: "hint" }, [
          "The expected answer stays hidden until you commit. Recognising it on sight is not what the interview tests.",
        ]),
      ]),
    );
  } else {
    card.push(
      h("section", { class: "answer", tabindex: "-1", "data-autofocus": "true", "aria-label": "Expected answer" }, [
        ...answerDetail(question, input.domains, input.wikiTitles),
        gradeRow(),
      ]),
    );
  }

  return h("article", { class: "card drill" }, card);
}

export function emptyView(title: string, hint?: string): Spec {
  return h("div", { class: "card empty" }, [h("p", { class: "empty-title" }, [title]), hint ? h("p", { class: "hint" }, [hint]) : null]);
}

export interface BankInput {
  /** Already filtered. */
  questions: Question[];
  total: number;
  filters: Filters;
  domains: DomainInfo[];
  domainOptions: Option[];
  levelOptions: Option[];
  techOptions: Option[];
  expanded: string | null;
  seen: ReadonlySet<string>;
  due: ReadonlySet<string>;
  wikiTitles: Record<string, string>;
}

export function countText(shown: number, total: number, query: string): string {
  const base = String(shown) + " of " + String(total) + " questions";
  return query ? base + " matching “" + query + "”" : base;
}

function select(name: string, label: string, all: string, selected: string, options: Option[]): Spec {
  const items: Spec[] = [h("option", { value: "", selected: selected === "" }, [all])];
  for (const option of options) {
    items.push(h("option", { value: option.value, selected: selected === option.value }, [option.label + " (" + String(option.count) + ")"]));
  }
  return h("label", { class: "field" }, [
    h("span", { class: "field-label" }, [label]),
    h(
      "select",
      { "data-action": "filter", "data-filter": name, "data-focus-key": "filter-" + name, "aria-label": label },
      items,
    ),
  ]);
}

export function filtersBar(input: BankInput, search: boolean): Spec {
  const filters = input.filters;
  return h("section", { class: "filters", "aria-label": "Filter the bank" }, [
    select("domain", "Domain", "All domains", filters.domain, input.domainOptions),
    select("level", "Level", "All levels", filters.level, input.levelOptions),
    select("tech", "Technology", "All technologies", filters.tech, input.techOptions),
    search
      ? h("label", { class: "field search-field" }, [
          h("span", { class: "field-label" }, ["Search"]),
          h("input", {
            type: "search",
            id: "search",
            class: "search",
            placeholder: "Search the question and what it probes",
            "aria-label": "Search the question and what it probes",
            "data-action": "search",
            "data-focus-key": "search",
            value: filters.query,
            autocomplete: "off",
            spellcheck: "false",
          }),
        ])
      : null,
    h("p", { id: "bank-count", class: "count" }, [countText(input.questions.length, input.total, filters.query)]),
  ]);
}

export function bankItems(input: BankInput): Spec[] {
  return input.questions.map((question) => {
    const status: BankStatus = statusOf(question, input.seen, input.due);
    const open = input.expanded === question.id;
    const children: Spec[] = [
      h("p", { class: "q" }, [question.question]),
      metaRow(question, input.domains),
      h("div", { class: "chips" }, [chip(status, "status-" + status), chip(question.reviewStatus, "promo")]),
      h("div", { class: "item-actions" }, [
        h(
          "button",
          {
            type: "button",
            class: "ghost",
            "data-action": "toggle",
            "data-id": question.id,
            "data-focus-key": "toggle-" + question.id,
            "aria-expanded": open,
          },
          [open ? "Hide answer" : "Show answer"],
        ),
        h(
          "button",
          { type: "button", class: "ghost", "data-action": "drill", "data-id": question.id, "data-focus-key": "drill-" + question.id },
          ["Drill this"],
        ),
      ]),
    ];
    if (open) children.push(h("div", { class: "answer" }, answerDetail(question, input.domains, input.wikiTitles)));
    return h("li", { class: "card item" }, children);
  });
}

export function bankResults(input: BankInput): Spec {
  const items = bankItems(input);
  if (items.length === 0) {
    return h("div", { id: "bank-results", class: "results" }, [
      emptyView("Nothing matches.", "Clear the search or widen a filter.") as Spec,
    ]);
  }
  return h("ul", { id: "bank-results", class: "results" }, items);
}

export function bankView(input: BankInput): Spec {
  return h("div", { class: "bank" }, [filtersBar(input, true), bankResults(input)]);
}

export interface WikiInput {
  article: WikiArticle;
  articles: WikiArticle[];
  domains: DomainInfo[];
}

/** Previous and next article, so reading through a topic does not mean going back to the list. */
function pager(articles: WikiArticle[], slug: string): Spec | null {
  const index = articles.findIndex((entry) => entry.slug === slug);
  if (index === -1 || articles.length < 2) return null;
  const before = articles[index - 1];
  const after = articles[index + 1];
  return h("div", { class: "wiki-pager" }, [
    before
      ? h(
          "button",
          { type: "button", class: "ghost", "data-action": "wiki", "data-slug": before.slug, "data-focus-key": "wiki-prev", title: before.title },
          ["← " + before.title],
        )
      : null,
    after
      ? h(
          "button",
          { type: "button", class: "ghost", "data-action": "wiki", "data-slug": after.slug, "data-focus-key": "wiki-next", title: after.title },
          [after.title + " →"],
        )
      : null,
  ]);
}

export function wikiView(input: WikiInput): Spec {
  const article = input.article;
  const meta: Spec[] = [chip(domainTitle(input.domains, article.domain))];
  meta.push(...levelChips(article.levels));
  return h("div", { class: "wiki" }, [
    h("nav", { class: "wiki-nav", "aria-label": "Wiki articles" }, [
      h("p", { class: "field-label" }, ["Wiki"]),
      ...input.articles.map((entry) =>
        h(
          "button",
          {
            type: "button",
            class: "ghost wiki-link",
            "data-action": "wiki",
            "data-slug": entry.slug,
            "data-focus-key": "wiki-link-" + entry.slug,
            "aria-current": entry.slug === article.slug ? "page" : undefined,
          },
          [entry.title],
        ),
      ),
    ]),
    h("article", { class: "card wiki-article" }, [
      h("button", { type: "button", class: "ghost back", "data-action": "back", "data-focus-key": "back" }, ["← Back"]),
      h("h1", {}, [article.title]),
      pager(input.articles, article.slug),
      h("div", { class: "meta" }, meta),
      article.summary ? h("p", { class: "summary" }, [article.summary]) : null,
      // The only place content becomes markup, and it is escaped before any tag is emitted.
      { tag: "div", attrs: { class: "md" }, html: renderMarkdown(article.body) },
    ]),
  ]);
}

function planEntry(entry: Plan["core"][number], index: number, questions: Question[], domains: DomainInfo[]): Spec {
  const known = questions.find((q) => q.id === entry.id || (entry.slug && q.slug === entry.slug));
  const title = known?.question ?? entry.slug;
  const head: Spec = known
    ? h(
        "button",
        { type: "button", class: "plan-item", "data-action": "open-question", "data-id": known.id, "data-focus-key": "plan-" + known.id },
        [title],
      )
    : h("span", { class: "plan-item" }, [title]);
  return h("li", { class: "plan-entry" }, [
    h("span", { class: "plan-num" }, [String(index + 1)]),
    h("div", { class: "plan-body" }, [
      head,
      h("div", { class: "meta" }, [
        chip(domainTitle(domains, entry.domain)),
        ...levelChips(entry.levels),
        chip(entry.slug, "slug"),
      ]),
      entry.reason ? h("p", { class: "reason" }, [entry.reason]) : null,
    ]),
  ]);
}

export interface PostingInput {
  plan: Plan | null;
  questions: Question[];
  domains: DomainInfo[];
}

export function postingView(input: PostingInput): Spec {
  const plan = input.plan;
  if (!plan) {
    return emptyView(
      "No posting is baked into this build.",
      "Run make prep with a job URL to write a plan, then rebuild with make extension --plan=<file>. The bank works without one.",
    );
  }

  const sourceMeta: Spec[] = [];
  if (plan.source.level) sourceMeta.push(chip(plan.source.level, "level"));
  sourceMeta.push(...levelChips(plan.levels.filter((level) => level !== plan.source.level)));
  if (plan.source.capturedAt) sourceMeta.push(chip("captured " + plan.source.capturedAt.slice(0, 10)));

  const emphasis = plan.emphasis.map((entry) =>
    h("div", { class: "emphasis" }, [
      h("b", {}, [domainTitle(input.domains, entry.domain)]),
      h("div", { class: "chips" }, [
        ...chips(entry.required, "required"),
        ...chips(entry.optional, "optional"),
        entry.required.length === 0 && entry.optional.length === 0 ? chip("named, nothing extracted", "muted") : null,
      ]),
    ]),
  );

  const gaps = plan.gaps.map((gap) =>
    h("div", { class: "gap" }, [
      h("b", {}, [domainTitle(input.domains, gap.domain)]),
      h("div", { class: "chips" }, chips(gap.technologies.length > 0 ? gap.technologies : ["(no technology named)"], "gap-tech")),
    ]),
  );

  return h("div", { class: "posting" }, [
    h("section", { class: "card posting-source" }, [
      h("h1", {}, [plan.source.title]),
      sourceMeta.length > 0 ? h("div", { class: "meta" }, sourceMeta) : null,
      // Rendered as text on purpose: the panel makes no outbound request, so a posting URL
      // is something to read, not a link the extension would follow.
      plan.source.url ? h("p", { class: "url" }, [plan.source.url]) : null,
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, ["What the posting emphasises"]),
      h("p", { class: "hint" }, [
        "Technologies a closed gazetteer found in the posting text, so this cannot claim a requirement the posting never stated.",
      ]),
      emphasis.length > 0 ? h("div", { class: "emphasis-list" }, emphasis) : h("p", { class: "hint" }, ["Nothing matched the gazetteer."]),
    ]),
    h("section", { class: "card" }, [
      h("h2", {}, ["The plan, in order"]),
      plan.core.length > 0
        ? h("ol", { class: "plan" }, plan.core.map((entry, index) => planEntry(entry, index, input.questions, input.domains)))
        : h("p", { class: "hint" }, ["The plan names nothing the bank covers yet."]),
    ]),
    plan.stretch.length > 0
      ? h("section", { class: "card" }, [
          h("h2", {}, ["Stretch"]),
          h("p", { class: "hint" }, ["Domains the posting does not name but the market asks for, so they are worth rehearsing anyway."]),
          h("ol", { class: "plan stretch" }, plan.stretch.map((entry, index) => planEntry(entry, index, input.questions, input.domains))),
        ])
      : null,
    h("section", { class: "card" }, [
      h("h2", {}, ["Gaps"]),
      h("p", { class: "hint" }, ["Required by the posting, covered by nothing in the bank — the authoring backlog, not a scheduling detail."]),
      gaps.length > 0 ? h("div", { class: "gap-list" }, gaps) : h("p", { class: "hint" }, ["None: the bank covers everything named."]),
    ]),
  ]);
}

export interface InterviewInput {
  briefs: Brief[];
  domains: DomainInfo[];
  /** The one question whose answer is showing, or null. Keyed on the brief question id. */
  expanded: string | null;
  /** The tag the reader picked, or "" for everything. */
  tag: string;
  /** The shipped tag registry: id and the title to draw. */
  tags: TagInfo[];
  wikiTitles: Record<string, string>;
}

/**
 * The brief's own headings are Russian, because the brief is.
 *
 * The panel's chrome stays English everywhere else; here the content is a Russian rehearsal
 * for a Russian-speaking candidate, and an English frame around a Russian answer reads like a
 * translation that stopped halfway down the page.
 */
const BRIEF_LABELS = {
  process: "Как устроен процесс",
  stages: "минут",
  sides: "Вопросы по сторонам интервью",
  topics: "Темы",
  topicsHint: "Один вопрос живёт в группе и в нескольких темах: тема собирает связанное по всему брифу.",
  all: "все",
  technical: "техническая сторона",
  domain: "доменная сторона",
  high: "спросят почти наверняка",
  asks: "Что проверяют",
  answer: "Ответ",
  traps: "Ловушки",
  followUps: "Что спросят дальше",
  reread: "Перечитать",
  nothing: "Здесь пока пусто",
  nothingTagged: "По этой теме ничего нет.",
};

/**
 * Russian counts take three forms: 1 вопрос, 2 вопроса, 5 вопросов.
 *
 * The panel is English everywhere else, so this is the one place a count has to be declined —
 * and "1 вопросов" in the first line of the page reads as a machine translation.
 */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function questionCount(n: number): string {
  return String(n) + " " + plural(n, "вопрос", "вопроса", "вопросов");
}

/** One line about size and about what to answer first, without a verb to disagree with. */
function briefCount(questions: BriefQuestion[]): string {
  const high = questions.filter((q) => q.likelihood === "high").length;
  return questionCount(questions.length) + " · " + String(high) + " " + BRIEF_LABELS.high;
}

function sideLabel(side: string): string {
  return side === "domain" ? BRIEF_LABELS.domain : BRIEF_LABELS.technical;
}

function tagTitle(tags: TagInfo[], id: string): string {
  return tags.find((tag) => tag.id === id)?.title ?? humanize(id);
}

/** A chip that filters the brief. Pressed state is the ARIA one, not a second class. */
function tagButton(input: InterviewInput, id: string, label: string, focusKey: string): Spec {
  return h(
    "button",
    {
      type: "button",
      class: "chip tag-chip",
      "data-action": "tag",
      "data-tag": id,
      "data-focus-key": focusKey,
      "aria-pressed": input.tag === id,
    },
    [label],
  );
}

/**
 * The tag bar is the navigation the groups cannot give you.
 *
 * A group answers "where in the interview"; a tag answers "what is this about". Idempotency is
 * spread across six groups, and rehearsing it means collecting those answers, not re-reading
 * the assignment section around each one.
 */
function tagBar(input: InterviewInput, questions: BriefQuestion[]): Spec {
  const counts = new Map<string, number>();
  for (const question of questions) {
    for (const tag of question.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const present = input.tags.filter((tag) => (counts.get(tag.id) ?? 0) > 0);
  const buttons: Spec[] = [
    tagButton(input, "", BRIEF_LABELS.all + " (" + String(questions.length) + ")", "tag-all"),
    ...present.map((tag) =>
      tagButton(input, tag.id, tag.title + " (" + String(counts.get(tag.id) ?? 0) + ")", "tag-" + tag.id),
    ),
  ];
  return h("section", { class: "card brief-tags", "aria-label": "Темы вопросов" }, [
    h("h2", {}, [BRIEF_LABELS.topics]),
    h("p", { class: "hint" }, [BRIEF_LABELS.topicsHint]),
    h("div", { class: "chips" }, buttons),
  ]);
}

function briefQuestionItem(question: BriefQuestion, input: InterviewInput): Spec {
  const open = input.expanded === question.id;
  const children: Spec[] = [
    h(
      "button",
      {
        type: "button",
        class: "brief-toggle",
        "data-action": "toggle",
        "data-id": question.id,
        "data-focus-key": "brief-" + question.id,
        "aria-expanded": open,
      },
      [
        chip(question.likelihood === "high" ? "high" : "medium", "likelihood-" + question.likelihood),
        h("span", { class: "brief-q" }, [question.question]),
      ],
    ),
  ];

  if (open) {
    const body: Spec[] = [
      h("div", { class: "probes" }, [h("b", {}, [BRIEF_LABELS.asks]), h("span", {}, [question.asks])]),
      h("section", {}, [
        h("h2", {}, [BRIEF_LABELS.answer]),
        h(
          "ol",
          { class: "expected" },
          question.answer.map((line) => h("li", { class: "expected-item" }, [h("span", { class: "expected-text" }, [line])])),
        ),
      ]),
    ];
    if (question.traps.length > 0) {
      body.push(
        h("section", {}, [h("h2", {}, [BRIEF_LABELS.traps]), h("ul", {}, question.traps.map((trap) => h("li", {}, [trap])))]),
      );
    }
    if (question.followUps.length > 0) {
      body.push(
        h("section", {}, [
          h("h2", {}, [BRIEF_LABELS.followUps]),
          h("ul", {}, question.followUps.map((follow) => h("li", {}, [follow]))),
        ]),
      );
    }
    // From one answer to the others on the same theme, which is where rehearsal continues.
    if (question.tags.length > 0) {
      body.push(
        h(
          "div",
          { class: "chips brief-q-tags" },
          question.tags.map((id) => tagButton(input, id, tagTitle(input.tags, id), "qtag-" + question.id + "-" + id)),
        ),
      );
    }
    children.push(h("div", { class: "answer" }, body));
  }

  return h("li", { class: "brief-item" }, children);
}

function briefGroupCard(group: BriefGroup, questions: BriefQuestion[], input: InterviewInput): Spec {
  const high = questions.filter((q) => q.likelihood === "high").length;
  const refs = group.wikiRefs.map((slug) =>
    h(
      "button",
      { type: "button", class: "link", "data-action": "wiki", "data-slug": slug, "data-anchor": "", "data-focus-key": "brief-wiki-" + slug },
      [input.wikiTitles[slug] ?? slug],
    ),
  );

  return h("section", { class: "card brief-group" }, [
    h("h3", {}, [group.title]),
    h("div", { class: "meta" }, [
      chip(sideLabel(group.side), "side-" + group.side),
      group.domain ? chip(domainTitle(input.domains, group.domain)) : null,
      chip(questionCount(questions.length) + (high > 0 ? " · " + String(high) + " high" : ""), "muted"),
    ]),
    h("p", { class: "hint" }, [group.intro]),
    h("ul", { class: "brief-questions" }, questions.map((question) => briefQuestionItem(question, input))),
    refs.length > 0 ? h("div", { class: "brief-refs" }, [h("span", { class: "field-label" }, [BRIEF_LABELS.reread]), ...refs]) : null,
  ]);
}

export function interviewView(input: InterviewInput): Spec {
  if (input.briefs.length === 0) {
    return emptyView(
      "No interview brief is baked into this build.",
      "Author one under content/interview/, then rebuild with make extension --include-drafts. The bank works without one.",
    );
  }

  const everything = input.briefs.flatMap((brief) => brief.groups.flatMap((group) => group.questions));
  const picked = (question: BriefQuestion): boolean => input.tag === "" || question.tags.includes(input.tag);
  const shown = everything.filter(picked);

  const process = input.briefs.map((brief) =>
    h("section", { class: "card brief-process" }, [
      h("h2", {}, [BRIEF_LABELS.process]),
      brief.stages.length > 0
        ? h(
            "ol",
            { class: "stages" },
            brief.stages.map((stage) =>
              h("li", { class: "stage" }, [
                h("b", {}, [stage.name]),
                chip(String(stage.minutes) + " " + BRIEF_LABELS.stages, "muted"),
                h("span", { class: "stage-note" }, [stage.note]),
              ]),
            ),
          )
        : h("p", { class: "hint" }, [BRIEF_LABELS.nothing]),
    ]),
  );

  const groups = input.briefs.flatMap((brief) =>
    brief.groups
      .map((group) => ({ group, questions: group.questions.filter(picked) }))
      .filter((entry) => entry.questions.length > 0)
      .map((entry) => briefGroupCard(entry.group, entry.questions, input)),
  );

  return h("div", { class: "interview" }, [
    ...input.briefs.map((brief) =>
      h("article", { class: "card brief-head" }, [
        h("h1", {}, [brief.title]),
        h("div", { class: "meta" }, [
          chip(brief.target.role),
          chip(brief.target.company, "muted"),
          chip(domainTitle(input.domains, brief.target.domain)),
          ...brief.target.stack.map((tech) => chip(tech, "tech")),
        ]),
        h("p", { class: "summary" }, [brief.summary]),
        h("p", { class: "count" }, [
          input.tag === ""
            ? briefCount(shown)
            : questionCount(shown.length) + " по теме «" + tagTitle(input.tags, input.tag) + "»",
        ]),
      ]),
    ),
    ...process,
    tagBar(input, everything),
    shown.length === 0
      ? (emptyView(BRIEF_LABELS.nothingTagged, "Снимите тему или выберите другую.") as Spec)
      : h("h2", { class: "brief-sides" }, [input.tag === "" ? BRIEF_LABELS.sides : tagTitle(input.tags, input.tag)]),
    ...groups,
  ]);
}

export function shortcutSheetView(): Spec {
  return h("div", { class: "overlay" }, [
    h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Keyboard shortcuts", tabindex: "-1", "data-autofocus": "true" }, [
      h("h2", {}, ["Keyboard shortcuts"]),
      h(
        "dl",
        { class: "shortcuts" },
        SHORTCUTS.flatMap((shortcut) => [h("dt", {}, [h("kbd", {}, [shortcut.keys])]), h("dd", {}, [shortcut.label])]),
      ),
      h("button", { type: "button", class: "primary", "data-action": "close-shortcuts", "data-focus-key": "close-shortcuts" }, ["Close (esc)"]),
    ]),
  ]);
}

export function errorView(message: string): Spec {
  return h("div", { class: "card error", role: "alert" }, [
    h("h1", {}, ["The content bundle could not be read"]),
    h("p", {}, [message]),
    h("p", { class: "hint" }, [
      "The panel reads the bundle that ships inside the extension; rebuilding it is the fix. Nothing left the device either way.",
    ]),
  ]);
}

export interface Chrome {
  view: ViewId;
  progress: DayProgress;
  streak: number;
  remaining: number;
  /** Current text scale, as a percentage, for the label between the two size buttons. */
  fontPercent: number;
  canBack: boolean;
  canForward: boolean;
  fullscreen: boolean;
}

/**
 * Back, forward, text size and fullscreen.
 *
 * These live in the header rather than in a menu because a side panel is narrow and a menu
 * costs a click for something used constantly: text size is set once and adjusted often, and
 * back is the only way out of a wiki article without losing the question behind it.
 */
function tools(chrome: Chrome): Spec {
  const icon = (label: string, action: string, title: string, extra: Attrs = {}): Spec =>
    h("button", { type: "button", class: "icon-btn", "data-action": action, title, "aria-label": title, ...extra }, [label]);
  return h("div", { class: "tools", role: "group", "aria-label": "History and display" }, [
    h("div", { class: "tools-group" }, [
      icon("←", "back", "Back (alt + left)", {
        "data-focus-key": "nav-back",
        disabled: !chrome.canBack,
        "aria-keyshortcuts": "Alt+ArrowLeft",
      }),
      icon("→", "forward", "Forward (alt + right)", {
        "data-focus-key": "nav-forward",
        disabled: !chrome.canForward,
        "aria-keyshortcuts": "Alt+ArrowRight",
      }),
    ]),
    h("div", { class: "tools-group" }, [
      icon("A−", "font", "Smaller text (-)", { "data-dir": "-1", "data-focus-key": "font-smaller", "aria-keyshortcuts": "-" }),
      h("span", { class: "font-label", "aria-live": "polite", title: "Text size, remembered between openings" }, [
        String(chrome.fontPercent) + "%",
      ]),
      icon("A+", "font", "Larger text (+)", { "data-dir": "1", "data-focus-key": "font-larger", "aria-keyshortcuts": "+" }),
    ]),
    icon(chrome.fullscreen ? "⤡" : "⤢", "fullscreen", chrome.fullscreen ? "Leave fullscreen (f)" : "Fullscreen (f)", {
      "data-focus-key": "fullscreen",
      // Strings, not booleans: the renderer writes an empty attribute for true, which is right
      // for disabled but wrong for an ARIA state that has to read "false" when it is off.
      "aria-pressed": chrome.fullscreen ? "true" : "false",
      "aria-keyshortcuts": "f",
    }),
  ]);
}

const VIEWS: { id: ViewId; label: string; key: string }[] = [
  { id: "drill", label: "Drill", key: "d" },
  { id: "bank", label: "Bank", key: "b" },
  { id: "posting", label: "Posting", key: "p" },
  { id: "interview", label: "Interview", key: "i" },
];

function statusBar(chrome: Chrome): Spec {
  const { answered, recalled } = chrome.progress;
  const total = answered + chrome.remaining;
  const today = answered === 0 ? "nothing answered today" : String(recalled) + " of " + String(answered) + " recalled today";
  const streakLabel = chrome.streak === 0 ? "no streak yet" : String(chrome.streak) + "-day streak";
  const meter = h(
    "div",
    {
      class: "meter",
      role: "progressbar",
      "aria-label": "Today's session progress",
      "aria-valuemin": 0,
      "aria-valuemax": total,
      "aria-valuenow": answered,
    },
    [h("span", { class: "meter-fill", style: "width:" + String(progressPercent(answered, chrome.remaining)) + "%" })],
  );
  return h("div", { class: "status" }, [
    meter,
    h("p", { class: "status-line" }, [
      h("span", { class: "stat" }, [today]),
      h("span", { class: "sep" }, ["·"]),
      h("span", { class: "stat" }, [streakLabel]),
      h("span", { class: "sep" }, ["·"]),
      h("span", { class: "stat" }, [String(chrome.remaining) + " in the queue"]),
    ]),
  ]);
}

export function shell(chrome: Chrome, body: Spec[], overlay?: Spec): Spec {
  const nav = h("nav", { class: "nav", "aria-label": "Views" }, [
    ...VIEWS.map((entry) =>
      h(
        "button",
        {
          type: "button",
          class: "nav-btn",
          "data-action": "view",
          "data-view": entry.id,
          "data-focus-key": "nav-" + entry.id,
          "aria-current": chrome.view === entry.id ? "page" : undefined,
          "aria-keyshortcuts": "g " + entry.key,
          title: entry.label + " (g then " + entry.key + ")",
        },
        [entry.label],
      ),
    ),
    h(
      "button",
      { type: "button", class: "nav-btn ghost", "data-action": "shortcuts", "data-focus-key": "shortcuts", "aria-keyshortcuts": "?" , title: "Keyboard shortcuts" },
      ["?"],
    ),
  ]);

  const children: Spec[] = [
    h("header", { class: "top" }, [
      h("div", { class: "brand-row" }, [
        h("div", { class: "brand" }, [h("span", { class: "brand-mark" }, ["IP"]), h("span", { class: "brand-name" }, ["Interview Prep"])]),
        tools(chrome),
      ]),
      nav,
      statusBar(chrome),
    ]),
    h("main", { id: "main", class: "main" }, body),
  ];
  if (overlay) children.push(overlay);
  return h("div", { class: "shell" }, children);
}