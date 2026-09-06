import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZodType } from "zod";
import { SHIPPABLE_STATUSES } from "./common.js";
import { DsaConcept, DsaPattern, DsaTask } from "./dsa.js";
import { formatIssue } from "./explain.js";
import { type LoadedFile, readMarkdown, readYaml, walk } from "./load.js";
import { Question } from "./question.js";
import { DomainsFile, SourcesFile, TechAliasesFile } from "./registry.js";
import { WikiFrontmatter } from "./wiki.js";

export interface ValidationResult {
  errors: string[];
  counts: Record<string, number>;
}

type Shippable = { review_status: string; reviewed_at?: string; verified_by?: string; slug?: string };

function parseAll<T>(schema: ZodType<T>, files: LoadedFile[], errors: string[]): { file: string; value: T }[] {
  const ok: { file: string; value: T }[] = [];
  for (const f of files) {
    const result = schema.safeParse(f.data);
    if (result.success) {
      ok.push({ file: f.file, value: result.data });
    } else {
      for (const issue of result.error.issues) errors.push(formatIssue(f.file, issue));
    }
  }
  return ok;
}

/** Placeholder markers that must never be mistaken for finished work. */
const PLACEHOLDERS = /\b(TODO|FIXME|TBD|XXX|test\.skip|test\.only|it\.only|describe\.only)\b/;

export function validateContent(root: string): ValidationResult {
  const errors: string[] = [];
  const contentDir = join(root, "content");

  const domainsFile = parseAll(DomainsFile, [readYaml(root, join(contentDir, "domains.yaml"))], errors);
  const sourcesFile = parseAll(SourcesFile, [readYaml(root, join(contentDir, "sources.yaml"))], errors);
  parseAll(TechAliasesFile, [readYaml(root, join(contentDir, "tech-aliases.yaml"))], errors);

  const knownDomains = new Set(domainsFile[0]?.value.domains.map((d) => d.id) ?? []);
  const domainRequiresTech = new Map((domainsFile[0]?.value.domains ?? []).map((d) => [d.id, d.requires_tech]));
  const sourceById = new Map((sourcesFile[0]?.value.sources ?? []).map((s) => [s.id, s]));

  const wiki = parseAll(
    WikiFrontmatter,
    walk(join(contentDir, "wiki"), [".md"]).map((f) => readMarkdown(root, f)),
    errors,
  );
  const questions = parseAll(
    Question,
    walk(join(contentDir, "questions"), [".yaml", ".yml"]).map((f) => readYaml(root, f)),
    errors,
  );
  const concepts = parseAll(
    DsaConcept,
    walk(join(contentDir, "dsa/concepts"), [".yaml", ".yml"]).map((f) => readYaml(root, f)),
    errors,
  );
  const patterns = parseAll(
    DsaPattern,
    walk(join(contentDir, "dsa/patterns"), [".yaml", ".yml"]).map((f) => readYaml(root, f)),
    errors,
  );
  const tasks = parseAll(
    DsaTask,
    walk(join(contentDir, "dsa/tasks"), [".yaml", ".yml"]).map((f) => readYaml(root, f)),
    errors,
  );

  const wikiSlugs = new Set(wiki.map((w) => w.value.slug));
  const questionSlugs = new Set(questions.map((q) => q.value.slug));
  const patternSlugs = new Set(patterns.map((p) => p.value.slug));
  const conceptSlugs = new Set(concepts.map((c) => c.value.slug));

  const domainRef = (file: string, domain: string) => {
    if (knownDomains.size > 0 && !knownDomains.has(domain)) {
      errors.push(
        `${file}: domain\n  what: unknown domain "${domain}"\n` +
          "  why:  domains drive weighting, routing and page structure; an unlisted domain is invisible everywhere\n" +
          "  fix:  use an id from content/domains.yaml, or add the domain there first",
      );
    }
  };

  for (const { file, value } of wiki) {
    domainRef(file, value.domain);
    for (const p of value.prerequisites) {
      if (!wikiSlugs.has(p)) {
        errors.push(
          `${file}: prerequisites\n  what: prerequisite "${p}" has no article\n` +
            "  why:  the study plan walks this graph; a dangling edge produces a plan step that cannot be opened\n" +
            "  fix:  write the prerequisite article or remove the reference",
        );
      }
    }
  }

  for (const { file, value } of questions) {
    domainRef(file, value.domain);

    // Technical domains must pin a version; behavioural ones have nothing to pin.
    const needsTech = domainRequiresTech.get(value.domain) ?? true;
    if (needsTech && !value.tech) {
      errors.push(
        `${file}: tech\n  what: domain "${value.domain}" requires a technology and version range\n` +
          "  why:  versions are the part of an answer that goes stale, so they are tracked as a field rather than buried in prose\n" +
          '  fix:  add tech: { name, version_range }, or set requires_tech: false on the domain if it is behavioural',
      );
    }
    if (!needsTech && value.tech) {
      errors.push(
        `${file}: tech\n  what: domain "${value.domain}" is behavioural but the question pins a technology\n` +
          "  why:  a behavioural answer that depends on a version is really a technical question filed in the wrong domain\n" +
          "  fix:  drop tech, or move the question to the technical domain it belongs to",
      );
    }

    for (const ref of value.wiki_refs) {
      if (!wikiSlugs.has(ref.slug)) {
        errors.push(
          `${file}: wiki_refs\n  what: article "${ref.slug}" does not exist\n` +
            "  why:  the evaluator cites this section when a bullet is missed; a broken ref degrades feedback to a bare 'wrong'\n" +
            "  fix:  point at an existing article, or write it — a question without a backing article is not allowed",
        );
      }
    }
    for (const rel of value.related_questions) {
      if (!questionSlugs.has(rel)) {
        errors.push(`${file}: related_questions\n  what: question "${rel}" does not exist\n  fix:  remove the reference or add the question`);
      }
    }
    if (value.provenance) {
      const src = sourceById.get(value.provenance.source_id);
      if (!src) {
        errors.push(`${file}: provenance.source_id\n  what: source "${value.provenance.source_id}" is not registered\n  fix:  add it to content/sources.yaml with a verified license`);
      } else if (!src.commercial_ok) {
        errors.push(
          `${file}: provenance.source_id\n  what: source "${src.id}" is licensed "${src.license}" and is not cleared for commercial use\n` +
            "  why:  this product is sold; content derived from a non-commercial or unlicensed source cannot ship\n" +
            "  fix:  drop this item, or rewrite it from the wiki so it no longer derives from that source",
        );
      }
    }
  }

  for (const { file, value } of tasks) {
    if (!patternSlugs.has(value.pattern)) {
      errors.push(`${file}: pattern\n  what: pattern "${value.pattern}" does not exist\n  fix:  reference an existing pattern in content/dsa/patterns`);
    }
  }
  for (const { file, value } of patterns) {
    for (const c of value.related_concepts) {
      if (!conceptSlugs.has(c)) {
        errors.push(`${file}: related_concepts\n  what: concept "${c}" does not exist\n  fix:  reference an existing concept in content/dsa/concepts`);
      }
    }
  }

  // A promoted item must point at the gate run that promoted it.
  const shippable: { file: string; value: Shippable }[] = [...wiki, ...questions, ...concepts, ...patterns, ...tasks];
  for (const { file, value } of shippable) {
    if ((SHIPPABLE_STATUSES as readonly string[]).includes(value.review_status)) {
      if (!value.reviewed_at || !value.verified_by) {
        errors.push(
          `${file}: review_status\n  what: status "${value.review_status}" without reviewed_at/verified_by\n` +
            "  why:  promotion must be traceable to the gate run that granted it, or the status is an assertion rather than evidence\n" +
            "  fix:  let the verifier promote this; do not set the status directly",
        );
      }
    }
  }

  // Placeholders are blockers, not progress.
  for (const file of walk(contentDir, [".md", ".yaml", ".yml"])) {
    const raw = readFileSync(file, "utf8");
    const line = raw.split("\n").findIndex((l) => PLACEHOLDERS.test(l));
    if (line >= 0) {
      errors.push(
        `${file.replace(root + "/", "")}:${line + 1}\n  what: placeholder marker in content\n` +
          "  why:  a placeholder that ships reads as a finished answer to the user and as progress to the harness\n" +
          "  fix:  write the missing content, or delete the item until it can be written",
      );
    }
  }

  return {
    errors,
    counts: {
      wiki: wiki.length,
      questions: questions.length,
      dsa_concepts: concepts.length,
      dsa_patterns: patterns.length,
      dsa_tasks: tasks.length,
    },
  };
}
