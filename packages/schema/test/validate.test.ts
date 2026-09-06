import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { validateContent } from "../src/validate.js";

/** Builds a throwaway content tree so cross-file rules can be exercised in isolation. */
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "content-fixture-"));
  const defaults: Record<string, string> = {
    "content/domains.yaml": "domains:\n  - id: caching\n    title: Caching\n    description: Cache strategies and invalidation.\n    target_questions: 25\n",
    "content/sources.yaml": "sources: []\n",
    "content/tech-aliases.yaml": "technologies:\n  - canonical: Redis\n    domain: caching\n    aliases: [redis]\n",
  };
  for (const [rel, body] of Object.entries({ ...defaults, ...files })) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

const roots: string[] = [];
const build = (files: Record<string, string>) => {
  const r = fixture(files);
  roots.push(r);
  return r;
};
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const article = `---
slug: cache-basics
title: Cache basics
lang: en
domain: caching
topic: invalidation
tech:
  name: Redis
  version_range: ">=6"
levels: [senior]
summary: How a read-through cache behaves under concurrent misses.
sources:
  - title: Redis SET
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
review_status: draft
---

## Body
Text.
`;

const question = (overrides: string) => `id: 27f93fee-de07-4926-b34d-df073c21f2ec
slug: q-one
lang: en
domain: caching
topic: invalidation
tracks: [backend]
levels: [senior]
tech:
  name: Redis
  version_range: ">=6"
question: Explain what a cache stampede is and how to prevent it.
probes: Whether the candidate reasons about concurrency rather than reciting patterns.
expected_answer:
  - text: Names concurrent misses reaching the origin.
    weight: 5
    min_level: middle
  - text: Explains the burst scales with concurrency at expiry.
    weight: 4
    min_level: senior
sources:
  - title: Redis SET
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
difficulty: 4
estimated_minutes: 8
${overrides}`;

describe("validateContent cross-file rules", () => {
  it("accepts a question whose wiki reference resolves", () => {
    const root = build({
      "content/wiki/caching/cache-basics.md": article,
      "content/questions/caching/q-one.yaml": question(
        'wiki_refs:\n  - slug: cache-basics\n    anchor: body\n    wiki_reviewed_at: "2026-09-06"\nreview_status: draft\n',
      ),
    });
    expect(validateContent(root).errors).toEqual([]);
  });

  it("rejects a question pointing at an article that does not exist", () => {
    const root = build({
      "content/wiki/caching/cache-basics.md": article,
      "content/questions/caching/q-one.yaml": question(
        'wiki_refs:\n  - slug: no-such-article\n    anchor: body\n    wiki_reviewed_at: "2026-09-06"\nreview_status: draft\n',
      ),
    });
    const errors = validateContent(root).errors;
    expect(errors.join("\n")).toContain('article "no-such-article" does not exist');
  });

  it("rejects content derived from a source that is not cleared for commercial use", () => {
    // The license gate is the difference between a sellable product and a liability.
    const root = build({
      "content/sources.yaml":
        "sources:\n  - id: nc-repo\n    name: Non-commercial repo\n    url: https://example.com/repo\n    kind: github\n    license: CC-BY-NC-4.0\n    license_verified_at: '2026-09-06'\n    commercial_ok: false\n    attribution_required: true\n",
      "content/wiki/caching/cache-basics.md": article,
      "content/questions/caching/q-one.yaml": question(
        'wiki_refs:\n  - slug: cache-basics\n    anchor: body\n    wiki_reviewed_at: "2026-09-06"\nreview_status: draft\nprovenance:\n  source_id: nc-repo\n  path: README.md\n  commit: abc1234\n  imported_at: "2026-09-06"\n',
      ),
    });
    expect(validateContent(root).errors.join("\n")).toContain("not cleared for commercial use");
  });

  it("rejects a promoted item that cannot point at the gate run that promoted it", () => {
    // Without the trace reference the status is an assertion, not evidence.
    const root = build({
      "content/wiki/caching/cache-basics.md": article.replace("review_status: draft", "review_status: auto_verified"),
    });
    expect(validateContent(root).errors.join("\n")).toContain("without reviewed_at/verified_by");
  });

  it("requires a technology and version in a technical domain", () => {
    const root = build({
      "content/wiki/caching/cache-basics.md": article,
      "content/questions/caching/q-one.yaml": question(
        'wiki_refs:\n  - slug: cache-basics\n    anchor: body\n    wiki_reviewed_at: "2026-09-06"\nreview_status: draft\n',
      ).replace('tech:\n  name: Redis\n  version_range: ">=6"\n', ""),
    });
    expect(validateContent(root).errors.join("\n")).toContain("requires a technology and version range");
  });

  it("accepts a behavioural question with no technology", () => {
    // Soft-skills questions have nothing to version; the domain declares requires_tech: false.
    const root = build({
      "content/domains.yaml":
        "domains:\n  - id: softskills\n    title: Soft skills\n    description: Behavioural questions.\n    target_questions: 30\n    requires_tech: false\n",
      "content/wiki/softskills/a.md": article
        .replace("domain: caching", "domain: softskills")
        .replace('tech:\n  name: Redis\n  version_range: ">=6"\n', ""),
      "content/questions/softskills/q-one.yaml": question(
        'wiki_refs:\n  - slug: cache-basics\n    anchor: body\n    wiki_reviewed_at: "2026-09-06"\nreview_status: draft\n',
      )
        .replace("domain: caching", "domain: softskills")
        .replace('tech:\n  name: Redis\n  version_range: ">=6"\n', ""),
    });
    expect(validateContent(root).errors).toEqual([]);
  });

  it("rejects a behavioural question that pins a technology", () => {
    // A behavioural answer that depends on a version is a technical question misfiled.
    const root = build({
      "content/domains.yaml":
        "domains:\n  - id: softskills\n    title: Soft skills\n    description: Behavioural questions.\n    target_questions: 30\n    requires_tech: false\n",
      "content/wiki/softskills/a.md": article
        .replace("domain: caching", "domain: softskills")
        .replace('tech:\n  name: Redis\n  version_range: ">=6"\n', ""),
      "content/questions/softskills/q-one.yaml": question(
        'wiki_refs:\n  - slug: cache-basics\n    anchor: body\n    wiki_reviewed_at: "2026-09-06"\nreview_status: draft\n',
      ).replace("domain: caching", "domain: softskills"),
    });
    expect(validateContent(root).errors.join("\n")).toContain("behavioural but the question pins a technology");
  });

  it("rejects an unknown domain", () => {
    const root = build({
      "content/wiki/caching/cache-basics.md": article.replace("domain: caching", "domain: quantum"),
    });
    expect(validateContent(root).errors.join("\n")).toContain('unknown domain "quantum"');
  });

  it("rejects a placeholder marker left in content", () => {
    const root = build({
      "content/wiki/caching/cache-basics.md": article.replace("Text.", "TODO: write this section"),
    });
    expect(validateContent(root).errors.join("\n")).toContain("placeholder marker in content");
  });

  it("rejects a dangling prerequisite", () => {
    const root = build({
      "content/wiki/caching/cache-basics.md": article.replace("sources:", "prerequisites: [missing-article]\nsources:"),
    });
    expect(validateContent(root).errors.join("\n")).toContain('prerequisite "missing-article" has no article');
  });
});
