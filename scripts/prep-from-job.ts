#!/usr/bin/env tsx
/**
 * Prepares a rehearsal plan from a job posting URL, or from a posting saved to a file.
 *
 * The posting is read the way the frequency ingest reads a board — a closed gazetteer over
 * the text — so the plan cannot claim the posting asked for something it did not. What
 * comes out is what the posting emphasises, which of it the bank already covers, and the
 * part that drives authoring: the requirements nothing covers yet.
 *
 * A file argument keeps the whole thing offline: a posting that was pasted into the repo
 * (content/postings/) is a plan that can be rebuilt by anyone, byte for byte, with no URL
 * that may expire under it. Only the URL form needs the network.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { readYaml, walk } from "@schema/load.js";
import { Question } from "@schema/question.js";
import { DomainsFile } from "@schema/registry.js";
import { detectLevel, extract, loadGazetteer } from "../packages/pipeline/src/gazetteer.js";
import { readPosting } from "../packages/pipeline/src/posting.js";
import { buildPrepPlan, type JobProfile, toBundlePlan } from "../packages/pipeline/src/prep.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
};

const target = args.find((a) => !a.startsWith("--"));
if (!target) {
  console.error(`usage: make prep ARGS="<job-url|posting-file> [--limit=12] [--levels=senior,staff] [--stretch=none|domain,...]"`);
  process.exit(1);
}

/**
 * The posting's bytes, and what came with them.
 *
 * A URL is fetched; anything else is a path relative to the repository. The plan records
 * the URL when there is one and leaves it empty for a saved posting, because a made-up link
 * would be worse than none: the panel renders that field as text, and nobody should follow it.
 */
async function loadPosting(source: string): Promise<{ raw: string; fallbackTitle: string; url: string }> {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, {
      redirect: "follow",
      headers: {
        // A plain user agent: boards serve a reduced page to unidentifiable clients.
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) interview-prep/0.1 personal-use",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      console.error(`fetch failed: ${response.status} ${response.statusText} for ${source}`);
      process.exit(1);
    }
    const raw = await response.text();
    return { raw, fallbackTitle: /<title[^>]*>([^<]*)<\/title>/i.exec(raw)?.[1]?.trim() ?? source, url: source };
  }

  const file = resolve(ROOT, source);
  if (!existsSync(file)) {
    console.error(`no such posting: ${source} (neither a URL nor a file in the repository)`);
    process.exit(1);
  }
  return { raw: readFileSync(file, "utf8"), fallbackTitle: basename(file).replace(/\.[a-z0-9]+$/i, ""), url: "" };
}

const posting = await loadPosting(target);
const { title, body } = readPosting(posting.raw, posting.fallbackTitle);

const gazetteer = loadGazetteer(join(ROOT, "content/tech-aliases.yaml"));
const mentions = extract(body, gazetteer);
const level = detectLevel(title, body);
const profile: JobProfile = { title, url: posting.url, level, mentions };

const questions = walk(join(ROOT, "content/questions"), [".yaml", ".yml"])
  .map((file) => Question.safeParse(readYaml(ROOT, file).data))
  .flatMap((parsed) => (parsed.success ? [parsed.data] : []));

const domains = DomainsFile.parse(parseYaml(readFileSync(join(ROOT, "content/domains.yaml"), "utf8"))).domains;
const named = new Set(mentions.map((m) => m.domain));
// Stretch defaults to the heaviest domains the posting does not mention: the market says
// they are asked, and a posting that ignores them is not evidence that interviewers do.
const stretchAsked = flag("stretch");
const stretchDomains =
  stretchAsked === "none"
    ? []
    : (stretchAsked?.split(",").filter(Boolean) ??
      domains
        .filter((d) => !named.has(d.id))
        .sort((a, b) => (b.market_weight ?? 0) - (a.market_weight ?? 0))
        .slice(0, 3)
        .map((d) => d.id));

const plan = buildPrepPlan(questions, profile, {
  levels: flag("levels")?.split(",").filter(Boolean),
  stretchDomains,
  limit: Number(flag("limit")) || 12,
});

const emphasis = [...named]
  .map((domain) => ({
    domain,
    required: mentions.filter((m) => m.domain === domain && m.strength === "required").map((m) => m.canonical),
    optional: mentions.filter((m) => m.domain === domain && m.strength === "optional").map((m) => m.canonical),
  }))
  .sort((a, b) => b.required.length - a.required.length || a.domain.localeCompare(b.domain));

console.log(`
${title}`);
console.log(`${target}`);
console.log(`level: ${level ?? "unstated"} → rehearsing ${plan.levels.join(", ")}`);
console.log(`
requirement emphasis (gazetteer, closed vocabulary):`);
for (const e of emphasis) {
  const parts = [e.required.length ? `required: ${e.required.join(", ")}` : "", e.optional.length ? `optional: ${e.optional.join(", ")}` : ""];
  console.log(`  ${e.domain.padEnd(14)} ${parts.filter(Boolean).join(" | ")}`);
}

console.log(`
core plan — ${plan.core.length} question(s)`);
for (const [i, r] of plan.core.entries()) {
  console.log(`  ${String(i + 1).padStart(2)}. ${r.question.domain.padEnd(13)} ${r.question.slug}  [${r.question.levels.join("/")}]`);
  console.log(`      ${r.reasons.join("; ")}`);
}

if (plan.stretch.length) {
  console.log(`
stretch — domains the posting does not name`);
  for (const r of plan.stretch) console.log(`  - ${r.question.domain.padEnd(13)} ${r.question.slug}  [${r.question.levels.join("/")}]`);
}

if (plan.gaps.length) {
  console.log(`
gaps — required by the posting, nothing in the bank`);
  for (const g of plan.gaps) console.log(`  ! ${g.domain.padEnd(13)} ${g.technologies.join(", ")}`);
}

const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const outFile = flag("out")
  ? resolve(ROOT, flag("out") as string)
  : join(ROOT, ".pipeline/prep", `${new Date().toISOString().slice(0, 10)}-${slug}.json`);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(toBundlePlan(plan, new Date().toISOString()), null, 2));
const rel = outFile.replace(ROOT + "/", "");

const domainsInPlan = [...new Set(plan.core.map((r) => r.question.domain))];
console.log(`
plan written: ${rel}`);
console.log(`next: make drill ARGS="--domains=${domainsInPlan.join(",") || "all"} --levels=${plan.levels.slice(0, 2).join(",")} --include-drafts --limit=${Math.max(plan.core.length, 1)}"`);
console.log(`      make extension ARGS="--include-drafts --plan=${rel}"`);
