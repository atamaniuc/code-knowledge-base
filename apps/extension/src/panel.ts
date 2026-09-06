import { type Grade, PASSING_GRADE, nextUp } from "@scheduling/index.js";
import { BrowserReviewLog } from "./storage.js";

/**
 * The drill panel.
 *
 * Deliberately two-stage: the question and what it probes are shown first, and the
 * expected answer only after you commit. Seeing the answer while thinking is the failure
 * mode of every flashcard app used for interview practice — it produces recognition,
 * which is not what an interview tests.
 */
interface Shipped {
  id: string;
  slug: string;
  domain: string;
  levels: string[];
  question: string;
  probes: string;
  answerStrategy?: string;
  expected: { text: string; level: string; weight: number }[];
  followUps: string[];
  mistakes: string[];
  minutes: number;
}

interface Bundle {
  questions: Shipped[];
  domains: string[];
  levels: string[];
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const main = el("main");
const domainSelect = el<HTMLSelectElement>("domain");
const levelSelect = el<HTMLSelectElement>("level");
const progressEl = el("progress");

const bundle: Bundle = await fetch("content.json").then((r) => r.json());
const log = await BrowserReviewLog.load();

const LEVEL_ORDER = ["junior", "middle", "senior", "staff", "head"];
for (const d of bundle.domains) domainSelect.append(new Option(d, d));
for (const l of LEVEL_ORDER.filter((l) => bundle.levels.includes(l))) levelSelect.append(new Option(l, l));

const filters = {
  get domains() {
    return domainSelect.value ? [domainSelect.value] : undefined;
  },
  get levels() {
    return levelSelect.value ? [levelSelect.value] : undefined;
  },
};

function renderProgress(remaining: number): void {
  const { answered, recalled } = log.todaysProgress();
  const today = answered === 0 ? "nothing answered today" : `${recalled}/${answered} recalled today`;
  progressEl.textContent = `${today} · ${remaining} in queue`;
}

function list(items: string[]): HTMLUListElement {
  const ul = document.createElement("ul");
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    ul.append(li);
  }
  return ul;
}

function section(title: string, body: Node): HTMLElement {
  const s = document.createElement("section");
  const h = document.createElement("h2");
  h.textContent = title;
  s.append(h, body);
  return s;
}

function showAnswer(q: Shipped, onGrade: (g: Grade) => void): void {
  const answers = document.createElement("ul");
  for (const b of q.expected) {
    const li = document.createElement("li");
    const level = document.createElement("span");
    level.className = "level";
    level.textContent = b.level;
    li.append(level, document.createTextNode(b.text));
    answers.append(li);
  }
  main.append(section("Expected", answers));

  if (q.answerStrategy) {
    const p = document.createElement("div");
    p.className = "strategy";
    p.textContent = q.answerStrategy;
    main.append(section("How to deliver it", p));
  }
  if (q.mistakes.length) main.append(section("Common mistakes", list(q.mistakes)));
  if (q.followUps.length) main.append(section("Follow-ups they may ask", list(q.followUps)));

  const grades = document.createElement("div");
  grades.className = "grades";
  for (let g = 0; g <= 5; g++) {
    const button = document.createElement("button");
    button.textContent = String(g);
    button.title = g < PASSING_GRADE ? "missed it" : g === PASSING_GRADE ? "got there, with effort" : "immediate";
    button.addEventListener("click", () => onGrade(g as Grade));
    grades.append(button);
  }
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "0 blank · 3 correct but hard · 5 immediate. Grade honestly; the schedule is only as good as this.";
  main.append(grades, hint);
}

function render(): void {
  const queue = nextUp(bundle.questions as never[], log, filters as never) as unknown as Shipped[];
  renderProgress(queue.length);
  main.replaceChildren();

  const q = queue[0];
  if (!q) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = bundle.questions.length === 0 ? "No questions bundled yet." : "Nothing due. Come back later or widen the filter.";
    main.append(p);
    return;
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${q.domain} · ${q.levels.join("/")} · ~${q.minutes} min`;

  const question = document.createElement("p");
  question.className = "question";
  question.textContent = q.question;

  const probes = document.createElement("div");
  probes.className = "probes";
  const label = document.createElement("b");
  label.textContent = "What they are testing";
  probes.append(label, document.createTextNode(q.probes));

  const reveal = document.createElement("button");
  reveal.className = "primary";
  reveal.textContent = "Answer out loud, then reveal";
  reveal.addEventListener("click", () => {
    reveal.remove();
    showAnswer(q, async (grade) => {
      await log.record(q.id, grade);
      render();
    });
  });

  main.append(meta, question, probes, reveal);
}

domainSelect.addEventListener("change", render);
levelSelect.addEventListener("change", render);
render();
