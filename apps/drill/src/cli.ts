#!/usr/bin/env tsx
/**
 * Drill session.
 *
 * Shows what is being probed before the answer, because rehearsing the question
 * cold is the point; the expected bullets only appear once you have committed.
 */
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import type { Grade } from "./sm2.js";
import { PASSING_GRADE } from "./sm2.js";
import { ReviewStore } from "./store.js";
import { REPO_ROOT, loadQuestions } from "./content.js";
import { nextUp } from "./select.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
};
const list = (name: string): string[] | undefined => flag(name)?.split(",").filter(Boolean);
const includeDrafts = args.includes("--include-drafts");

if (args.includes("--help")) {
  console.log(`usage: make drill [ARGS="..."]

  --domains=caching,network   restrict to these domains
  --levels=senior,staff       restrict to these levels
  --limit=10                  cap the session length
  --include-drafts            include content no human has reviewed yet
  --db=path                   review database (default .drill/reviews.db)

Grades follow SM-2: 0-2 is a failure and the question returns tomorrow,
3 is a correct answer that was hard, 5 is immediate and complete.`);
  process.exit(0);
}

const store = new ReviewStore(flag("db") ?? join(REPO_ROOT, ".drill/reviews.db"));
let questions = loadQuestions();

if (includeDrafts) {
  console.warn("including drafts: these answers have not been fact-checked by a human\n");
  questions = questions.map((q) => ({ ...q, review_status: "reviewed" as const }));
}

const session = nextUp(questions, store, {
  domains: list("domains"),
  levels: list("levels"),
  limit: Number(flag("limit")) || undefined,
});

if (session.length === 0) {
  const reviewed = questions.filter((q) => q.review_status === "reviewed" || q.review_status === "verified").length;
  console.log(
    reviewed === 0
      ? "Nothing to drill: no question has been reviewed yet.\nUse --include-drafts to work against unreviewed content."
      : "Nothing due. Come back when a repetition falls due, or widen the filter.",
  );
  store.close();
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const rule = "─".repeat(72);
let correct = 0;
let answered = 0;

/**
 * Reads one line, or null when input ends.
 *
 * Pulled from the line iterator rather than `rl.question`, because with piped input
 * readline closes as soon as the stream ends and a race against "close" would drop
 * lines that are still buffered. Ctrl-D and an exhausted pipe both end the session.
 */
const lines = rl[Symbol.asyncIterator]();

async function ask(prompt: string): Promise<string | null> {
  process.stdout.write(prompt);
  const next = await lines.next();
  if (next.done) {
    process.stdout.write("\n");
    return null;
  }
  return next.value;
}

function finish(): never {
  console.log(`\n${rule}\n${correct}/${answered} recalled${answered < session.length ? ", session ended early" : ""}.`);
  rl.close();
  store.close();
  process.exit(0);
}

for (const [i, q] of session.entries()) {
  console.log(`\n${rule}\n[${i + 1}/${session.length}]  ${q.domain} · ${q.levels.join("/")}\n`);
  console.log(q.question.trim());
  console.log(`\nProbing: ${q.probes.trim()}`);

  if ((await ask("\nAnswer out loud, then press enter. ")) === null) finish();

  console.log("\nExpected:");
  for (const b of q.expected_answer) console.log(`  · [${b.min_level}] ${b.text.trim()}`);

  if (q.answer_strategy) console.log(`\nDelivery: ${q.answer_strategy.trim()}`);
  if (q.common_mistakes.length > 0) {
    console.log("\nCommon mistakes:");
    for (const m of q.common_mistakes) console.log(`  · ${m.trim()}`);
  }
  if (q.follow_ups.length > 0) {
    console.log("\nFollow-ups they may ask:");
    for (const f of q.follow_ups) console.log(`  · ${f.trim()}`);
  }

  let grade: Grade | undefined;
  while (grade === undefined) {
    const raw = await ask("\nGrade 0-5 (0 blank, 3 correct but hard, 5 immediate): ");
    if (raw === null) finish();
    const n = Number(raw.trim());
    if (Number.isInteger(n) && n >= 0 && n <= 5) grade = n as Grade;
    else console.log("  enter a whole number from 0 to 5");
  }

  const rec = store.record(q.id, grade);
  answered += 1;
  if (grade >= PASSING_GRADE) correct += 1;
  console.log(`  next review in ${rec.schedule.interval} day${rec.schedule.interval === 1 ? "" : "s"}`);
}

finish();
