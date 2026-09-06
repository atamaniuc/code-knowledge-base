#!/usr/bin/env tsx
/**
 * Builds the topic frequency map from live job postings and writes market_weight into
 * content/domains.yaml.
 *
 * Run before bulk authoring: the map decides which domains get depth. Raw postings are
 * archived so the weights can be audited against the text they came from — a weight with
 * no trace behind it is an assertion.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { loadGazetteer } from "../packages/pipeline/src/gazetteer.js";
import { buildFrequencyMap, filterByRole } from "../packages/pipeline/src/frequency.js";
import { SOURCES, type Posting } from "../packages/pipeline/src/sources.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 50;
const dryRun = process.argv.includes("--dry-run");

const tags = process.argv.find((a) => a.startsWith("--tags="))?.split("=")[1]?.split(",") ?? [];

const postings: Posting[] = [];
for (const source of SOURCES) {
  try {
    const got = await source.fetch(limit, tags);
    postings.push(...got);
    console.log(`${source.id}: ${got.length} postings`);
  } catch (err) {
    console.warn(`${source.id}: unavailable (${(err as Error).message}) — continuing without it`);
  }
}

if (postings.length === 0) {
  console.error("no postings fetched; not touching domains.yaml on an empty sample");
  process.exit(1);
}

const roles = process.argv.find((a) => a.startsWith("--roles="))?.split("=")[1]?.split(",") ?? [];
const scoped = filterByRole(postings, roles);
if (roles.length > 0) console.log(`\nrole filter ${roles.join("|")}: ${scoped.length}/${postings.length} postings`);

const gazetteer = loadGazetteer(join(ROOT, "content/tech-aliases.yaml"));
const map = buildFrequencyMap(scoped, gazetteer);

console.log(`\nsampled ${map.sampled}, unmatched ${map.unmatched} (${Math.round((map.unmatched / map.sampled) * 100)}%)`);
console.log("levels:", map.levels);
console.log("\ndomain share:");
for (const d of map.domains) {
  const top = Object.entries(d.technologies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t, w]) => `${t} ${w.toFixed(1)}`)
    .join(", ");
  console.log(`  ${(d.share * 100).toFixed(1).padStart(5)}%  ${d.domain.padEnd(16)} ${top}`);
}

const archive = join(ROOT, ".pipeline/vacancies");
mkdirSync(archive, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
writeFileSync(join(archive, `${stamp}-postings.json`), JSON.stringify(postings, null, 2));
writeFileSync(join(archive, `${stamp}-frequency.json`), JSON.stringify(map, null, 2));
console.log(`\narchived ${postings.length} postings to .pipeline/vacancies/${stamp}-*.json`);

if (dryRun) {
  console.log("dry run: domains.yaml unchanged");
  process.exit(0);
}

// Rewrite market_weight in place, leaving every other line of the file alone.
const domainsPath = join(ROOT, "content/domains.yaml");
const raw = readFileSync(domainsPath, "utf8");
const known = new Set(
  (parseYaml(raw) as { domains: { id: string }[] }).domains.map((d) => d.id),
);
const shares = new Map(map.domains.filter((d) => known.has(d.domain)).map((d) => [d.domain, d.share]));

const lines = raw.split("\n");
const out: string[] = [];
let current: string | null = null;
for (const line of lines) {
  const idMatch = /^\s*-\s*id:\s*(\S+)/.exec(line);
  if (idMatch) current = idMatch[1] ?? null;
  if (/^\s*market_weight:/.test(line)) continue; // replaced below
  out.push(line);
  if (/^\s*requires_tech:/.test(line) && current && shares.has(current)) {
    out.push(`    market_weight: ${shares.get(current)}`);
  }
}
writeFileSync(domainsPath, out.join("\n"));
console.log(`wrote market_weight for ${shares.size} domains`);
