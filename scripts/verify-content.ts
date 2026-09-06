#!/usr/bin/env tsx
/**
 * Runs the grounding gate over wiki articles and promotes what passes.
 *
 * Needs a model key, because grounding is the one part that cannot be decided by a rule.
 * Without one it reports what it would check and changes nothing, so the command is still
 * useful for seeing where an article stands.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { walk } from "@schema/load.js";
import { WikiFrontmatter } from "@schema/wiki.js";
import { extractClaims } from "../packages/verifier/src/claims.js";
import { fetchAll } from "../packages/verifier/src/fetch.js";
import { formatFailures, runGroundingGate } from "../packages/verifier/src/gate.js";
import { type ModelClient, modelGrounder } from "../packages/verifier/src/grounder.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".pipeline/sources");
const EVIDENCE = join(ROOT, ".pipeline/evidence");
const only = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
const apiKey = process.env.ANTHROPIC_API_KEY;

/** Minimal client so the gate has no SDK dependency; the operator's key, their endpoint. */
const client: ModelClient = {
  async complete(prompt) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`grounder HTTP ${res.status}`);
    const data = (await res.json()) as { content: { text?: string }[] };
    return data.content.map((c) => c.text ?? "").join("");
  },
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
let promoted = 0;
let failed = 0;

for (const file of walk(join(ROOT, "content/wiki"), [".md"])) {
  const raw = readFileSync(file, "utf8");
  const match = FRONTMATTER.exec(raw);
  if (!match) continue;

  const parsed = WikiFrontmatter.safeParse(parseYaml(match[1] ?? ""));
  if (!parsed.success) continue;
  const front = parsed.data;
  if (only && front.slug !== only) continue;
  if (front.review_status !== "draft") continue;

  const claims = extractClaims(match[2] ?? "");
  const urls = front.sources.map((s) => s.url);

  if (!apiKey) {
    console.log(`${front.slug}: ${claims.length} claims against ${urls.length} sources (dry — set ANTHROPIC_API_KEY to check)`);
    continue;
  }

  const { sources, failed: unreachable } = await fetchAll(urls, CACHE);
  if (unreachable.length > 0) console.warn(`${front.slug}: unreachable ${unreachable.join(", ")}`);

  const result = await runGroundingGate(claims, sources, modelGrounder(client));
  mkdirSync(EVIDENCE, { recursive: true });
  writeFileSync(join(EVIDENCE, `${front.slug}.json`), JSON.stringify(result.groundings, null, 2));

  if (!result.passed) {
    failed += 1;
    console.error(`\n${formatFailures(front.slug, result)}\n`);
    console.error(`${front.slug}: ${Math.round(result.coverage * 100)}% grounded, not promoted`);
    continue;
  }

  const runId = `grounding-${new Date().toISOString().slice(0, 10)}`;
  const updated = raw
    .replace(/^review_status: draft$/m, "review_status: auto_verified")
    .replace(/^(review_status: auto_verified)$/m, `$1\nreviewed_at: "${new Date().toISOString().slice(0, 10)}"\nverified_by: ${runId}`);
  writeFileSync(file, updated);
  promoted += 1;
  console.log(`${front.slug}: ${claims.length}/${claims.length} grounded -> auto_verified`);
}

console.log(`\npromoted ${promoted}, failed ${failed}`);
if (failed > 0) process.exit(1);
