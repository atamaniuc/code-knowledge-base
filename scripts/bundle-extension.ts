#!/usr/bin/env tsx
/**
 * Bakes content into the extension.
 *
 * Manifest V3 forbids remotely hosted code, and the product promise is that the bank works
 * offline with nothing sent anywhere. So content ships inside the package and updates arrive
 * as extension updates, which the store distributes.
 *
 * The bundle carries the whole bank — questions and the wiki they cite — plus, when a
 * posting was parsed with `make prep`, the rehearsal plan for that posting. The posting is
 * always an argument to a command: no job URL is written into the repository, only into the
 * generated bundle.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { parse as parseYaml } from "yaml";
import { readMarkdown, readYaml, walk } from "@schema/load.js";
import { Question } from "@schema/question.js";
import { INTERVIEW_TAG_IDS, INTERVIEW_TAG_TITLES, InterviewBrief } from "@schema/interview.js";
import { DomainsFile } from "@schema/registry.js";
import { SHIPPABLE_STATUSES } from "@schema/common.js";
import { WikiFrontmatter } from "@schema/wiki.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "apps/extension");
const OUT = join(SRC, "dist");

/** Only what the extension actually renders; the rest is authoring metadata. */
interface Shipped {
  id: string;
  slug: string;
  domain: string;
  topic: string;
  subtopic?: string;
  levels: string[];
  tracks: string[];
  tech: string | null;
  question: string;
  probes: string;
  answerStrategy?: string;
  expected: { text: string; level: string; weight: number }[];
  followUps: string[];
  mistakes: string[];
  /** Written by the bundler; the selector refuses a session on anything the gates have not promoted. */
  reviewStatus: string;
  difficulty: number;
  minutes: number;
  wikiRefs: { slug: string; anchor: string }[];
}

/** A rehearsal brief, trimmed to what the panel renders. Authoring metadata stays in content/. */
interface ShippedBrief {
  id: string;
  slug: string;
  lang: string;
  title: string;
  summary: string;
  target: { role: string; company: string; domain: string; stack: string[] };
  stages: { name: string; minutes: number; note: string }[];
  groups: {
    id: string;
    title: string;
    side: string;
    domain: string | null;
    intro: string;
    wikiRefs: string[];
    questions: {
      id: string;
      question: string;
      likelihood: string;
      tags: string[];
      asks: string;
      answer: string[];
      traps: string[];
      followUps: string[];
    }[];
  }[];
}

interface ShippedArticle {
  slug: string;
  title: string;
  domain: string;
  topic: string;
  levels: string[];
  summary: string;
  /** Markdown. The panel escapes it before rendering; it is data, never markup to trust. */
  body: string;
}

const includeDrafts = process.argv.includes("--include-drafts");
if (includeDrafts) console.warn("including drafts: these answers have not been fact-checked by a human");

const planPath = process.argv.find((a) => a.startsWith("--plan="))?.split("=").slice(1).join("=");

/** Files that could not even be read. Collected so the warning names them instead of hiding them. */
const unreadable: string[] = [];

const questions: Shipped[] = [];
for (const file of walk(join(ROOT, "content/questions"), [".yaml", ".yml"])) {
  let parsed;
  try {
    parsed = Question.safeParse(readYaml(ROOT, file).data);
  } catch {
    // A build must not die on one author's typo — `make validate` is the gate that fails
    // loudly and names the line. Shipping without the file silently would be the real bug,
    // so the warning below lists every one of them.
    unreadable.push(file.replace(ROOT + "/", ""));
    continue;
  }
  if (!parsed.success) continue;
  const q = parsed.data;
  if (!includeDrafts && !(SHIPPABLE_STATUSES as readonly string[]).includes(q.review_status)) continue;

  questions.push({
    id: q.id,
    slug: q.slug,
    domain: q.domain,
    topic: q.topic,
    subtopic: q.subtopic,
    levels: q.levels,
    tracks: q.tracks,
    tech: q.tech?.name ?? null,
    question: q.question.trim(),
    probes: q.probes.trim(),
    answerStrategy: q.answer_strategy?.trim(),
    expected: q.expected_answer.map((b) => ({ text: b.text.trim(), level: b.min_level, weight: b.weight })),
    followUps: q.follow_ups.map((f) => f.trim()),
    mistakes: q.common_mistakes.map((m) => m.trim()),
    // Drafts ship as if promoted — the same remap the CLI does for --include-drafts.
    // The shared selector starts a session only from shippable content, so a bundle
    // that carried `draft` renders an empty panel however many questions it holds.
    reviewStatus: includeDrafts ? "auto_verified" : q.review_status,
    difficulty: q.difficulty,
    minutes: q.estimated_minutes,
    wikiRefs: q.wiki_refs.map((r) => ({ slug: r.slug, anchor: r.anchor })),
  });
}

/**
 * The wiki is bundled whole.
 *
 * A question's feedback is "read this section", and the promise is that the bank works with
 * the network off — so the section has to be in the package, not one link away from it.
 */
const wiki: ShippedArticle[] = [];
for (const file of walk(join(ROOT, "content/wiki"), [".md"])) {
  const { data, body } = readMarkdown(ROOT, file);
  const parsed = WikiFrontmatter.safeParse(data);
  if (!parsed.success) continue;
  const w = parsed.data;
  if (!includeDrafts && !(SHIPPABLE_STATUSES as readonly string[]).includes(w.review_status)) continue;
  wiki.push({
    slug: w.slug,
    title: w.title,
    domain: w.domain,
    topic: w.topic,
    levels: w.levels,
    summary: w.summary.trim(),
    body: (body ?? "").trim(),
  });
}

/**
 * Rehearsal briefs.
 *
 * One target, one file: the posting, its assignment and the interview that follows. They go
 * through the same promotion gate as the bank — a brief is an opinion about what will be
 * asked, so it ships only when a build asked for drafts.
 */
const interview: ShippedBrief[] = [];
for (const file of walk(join(ROOT, "content/interview"), [".yaml", ".yml"])) {
  let parsed;
  try {
    parsed = InterviewBrief.safeParse(readYaml(ROOT, file).data);
  } catch {
    unreadable.push(file.replace(ROOT + "/", ""));
    continue;
  }
  if (!parsed.success) continue;
  const brief = parsed.data;
  if (!includeDrafts && !(SHIPPABLE_STATUSES as readonly string[]).includes(brief.review_status)) continue;

  interview.push({
    id: brief.id,
    slug: brief.slug,
    lang: brief.lang,
    title: brief.title.trim(),
    summary: brief.summary.trim(),
    target: {
      role: brief.target.role.trim(),
      company: brief.target.company.trim(),
      domain: brief.target.domain,
      stack: brief.target.stack.map((s) => s.trim()),
    },
    stages: brief.stages.map((s) => ({ name: s.name.trim(), minutes: s.minutes, note: s.note.trim() })),
    groups: brief.groups.map((g) => ({
      id: g.id,
      title: g.title.trim(),
      side: g.side,
      domain: g.domain ?? null,
      intro: g.intro.trim(),
      wikiRefs: g.wiki_refs.map((r) => r),
      questions: g.questions.map((q) => ({
        id: q.id,
        question: q.question.trim(),
        likelihood: q.likelihood,
        tags: [...q.tags],
        asks: q.asks.trim(),
        answer: q.answer.map((a) => a.trim()),
        traps: q.traps.map((t) => t.trim()),
        followUps: q.follow_ups.map((x) => x.trim()),
      })),
    })),
  });
}

const domains = DomainsFile.parse(parseYaml(readFileSync(join(ROOT, "content/domains.yaml"), "utf8")))
  .domains.map((d) => ({ id: d.id, title: d.title, description: d.description.trim() }));

const LEVEL_ORDER = ["junior", "middle", "senior", "staff", "head"];
const levels = [...new Set(questions.flatMap((q) => q.levels))].sort(
  (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
);

/**
 * The posting plan, when one was passed.
 *
 * It is read as data and trimmed against the questions that actually made it into the
 * bundle: a plan that names a question the bundle does not carry would render as an empty
 * session, which is exactly the bug this check exists to make impossible.
 */
let plan: unknown = null;
if (planPath) {
  const file = resolve(ROOT, planPath);
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    core?: { id: string }[];
    stretch?: { id: string }[];
  };
  const ids = new Set(questions.map((q) => q.id));
  const core = (parsed.core ?? []).filter((r) => ids.has(r.id));
  const stretch = (parsed.stretch ?? []).filter((r) => ids.has(r.id));
  const dropped = (parsed.core?.length ?? 0) + (parsed.stretch?.length ?? 0) - core.length - stretch.length;
  if (dropped > 0) console.warn(`plan: dropped ${dropped} entr(ies) whose question is not in this bundle`);
  plan = { ...parsed, core, stretch };
  console.log(`plan: ${core.length} core, ${stretch.length} stretch from ${planPath}`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, "public"), OUT, { recursive: true });

await build({
  entryPoints: [join(SRC, "src/panel.ts")],
  outfile: join(OUT, "panel.js"),
  bundle: true,
  format: "esm",
  target: "chrome120",
  minify: true,
  alias: {
    "@scheduling": join(ROOT, "packages/scheduling/src"),
    "@schema": join(ROOT, "packages/schema/src"),
  },
});

/**
 * The tag registry travels with the bundle.
 *
 * The vocabulary is closed in the schema, and the panel needs the title to draw a chip; the
 * bundler is where the authoring vocabulary and the rendered one meet, exactly as it is for
 * snake_case → camelCase everywhere else.
 */
const interviewTags = INTERVIEW_TAG_IDS.map((id) => ({ id, title: INTERVIEW_TAG_TITLES[id] }));

const bundle = {
  schema: 4,
  generatedAt: new Date().toISOString(),
  questions,
  wiki,
  domains,
  levels,
  plan,
  interview,
  interviewTags,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "content.json"), JSON.stringify(bundle));
if (unreadable.length) {
  console.warn(`skipped ${String(unreadable.length)} unparseable content file(s) — run make validate:`);
  for (const f of unreadable) console.warn("  " + f);
}

console.log(
  `built extension -> apps/extension/dist` +
    `\nbundled ${questions.length} questions across ${new Set(questions.map((q) => q.domain)).size} domains` +
    `, ${wiki.length} wiki articles` +
    `${plan ? `, a posting plan` : ""}` +
    `${interview.length > 0 ? `, ${String(interview.length)} interview brief(s)` : ""}` +
    `${includeDrafts ? " (drafts included)" : ""}`,
);
