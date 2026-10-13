#!/usr/bin/env tsx
/**
 * Prepares a rehearsal plan from a job posting URL.
 *
 * The posting is read the way the frequency ingest reads a board — a closed gazetteer over
 * the text — so the plan cannot claim the posting asked for something it did not. What
 * comes out is what the posting emphasises, which of it the bank already covers, and the
 * part that drives authoring: the requirements nothing covers yet.
 *
 * This is the one command here that needs the network. Everything else runs locally.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { readYaml, walk } from "@schema/load.js";
import { Question } from "@schema/question.js";
import { DomainsFile } from "@schema/registry.js";
import { detectLevel, extract, loadGazetteer } from "../packages/pipeline/src/gazetteer.js";
import { buildPrepPlan, type JobProfile, toBundlePlan } from "../packages/pipeline/src/prep.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
};

const url = args.find((a) => !a.startsWith("--"));
if (!url) {
  console.error(`usage: make prep ARGS="<job-url> [--limit=12] [--levels=senior,staff] [--stretch=none|domain,...]"`);
  process.exit(1);
}

/** Postings are HTML with entities escaped twice over; text is what the gazetteer reads. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|hellip|mdash|ndash|rsquo|lsquo|rdquo|ldquo);/g, (_, name: string) => {
      const table: Record<string, string> = {
        amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "\u2026",
        mdash: "\u2014", ndash: "\u2013", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c",
      };
      return table[name] ?? " ";
    });
}

function toText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|li|h[1-6]|div|tr|ul|ol)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Title and body, preferring the schema.org block a job board publishes for machines.
 *
 * Boards that emit structured data put the whole description there, unrendered; falling
 * back to the page means a posting whose markup changes still parses.
 */
function readPosting(html: string, fallbackTitle: string): { title: string; body: string } {
  for (const block of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1] ?? "");
    } catch {
      continue;
    }
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      const node = item as { "@type"?: string; title?: string; name?: string; description?: string };
      if (node["@type"] !== "JobPosting" || !node.description) continue;
      return { title: node.title ?? node.name ?? fallbackTitle, body: toText(node.description) };
    }
  }
  return { title: fallbackTitle, body: toText(html) };
}

const response = await fetch(url, {
  redirect: "follow",
  headers: {
    // A plain user agent: boards serve a reduced page to unidentifiable clients.
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) interview-prep/0.1 personal-use",
    accept: "text/html,application/xhtml+xml",
  },
});
if (!response.ok) {
  console.error(`fetch failed: ${response.status} ${response.statusText} for ${url}`);
  process.exit(1);
}
const html = await response.text();
const pageTitle = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? url;
const { title, body } = readPosting(html, pageTitle);

const gazetteer = loadGazetteer(join(ROOT, "content/tech-aliases.yaml"));
const mentions = extract(body, gazetteer);
const level = detectLevel(title, body);
const profile: JobProfile = { title, url, level, mentions };

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
console.log(`${url}`);
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
