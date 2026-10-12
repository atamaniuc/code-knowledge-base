#!/usr/bin/env tsx
/**
 * Bakes content into the extension.
 *
 * Manifest V3 forbids remotely hosted code, and the product promise is that the bank
 * works offline with nothing sent anywhere. So content ships inside the package and
 * updates arrive as extension updates, which the store distributes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readYaml, walk } from "@schema/load.js";
import { Question } from "@schema/question.js";
import { SHIPPABLE_STATUSES } from "@schema/common.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "apps/extension/dist");

/** Only what the extension actually renders; the rest is authoring metadata. */
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
  /** Where the item sits on the promotion ladder; the shared selector starts a session only from the top of it. */
  review_status: string;
  minutes: number;
}

const includeDrafts = process.argv.includes("--include-drafts");
if (includeDrafts) console.warn("including drafts: these answers have not been fact-checked by a human");

const questions: Shipped[] = [];
for (const file of walk(join(ROOT, "content/questions"), [".yaml", ".yml"])) {
  const parsed = Question.safeParse(readYaml(ROOT, file).data);
  if (!parsed.success) continue;
  const q = parsed.data;
  if (!includeDrafts && !(SHIPPABLE_STATUSES as readonly string[]).includes(q.review_status)) continue;

  questions.push({
    id: q.id,
    slug: q.slug,
    domain: q.domain,
    levels: q.levels,
    question: q.question.trim(),
    probes: q.probes.trim(),
    answerStrategy: q.answer_strategy?.trim(),
    expected: q.expected_answer.map((b) => ({ text: b.text.trim(), level: b.min_level, weight: b.weight })),
    followUps: q.follow_ups.map((f) => f.trim()),
    mistakes: q.common_mistakes.map((m) => m.trim()),
    // Drafts ship as if promoted — the same remap the CLI does for --include-drafts.
    // The shared selector starts a session only from shippable content, so a bundle
    // that carried `draft` renders an empty panel however many questions it holds.
    review_status: includeDrafts ? "auto_verified" : q.review_status,
    minutes: q.estimated_minutes,
  });
}

const domains = [...new Set(questions.map((q) => q.domain))].sort();
const levels = [...new Set(questions.flatMap((q) => q.levels))];

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "content.json"), JSON.stringify({ questions, domains, levels }));
console.log(`bundled ${questions.length} questions across ${domains.length} domains${includeDrafts ? " (drafts included)" : ""}`);
