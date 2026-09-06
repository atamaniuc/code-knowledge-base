import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { TechAliasesFile } from "@schema/registry.js";

/**
 * Technology extraction over a closed vocabulary.
 *
 * A gazetteer beats a small model on this task: the list of technologies we cover is
 * known in advance, matching is deterministic and instant, and it never invents a
 * technology that is not in the posting — which is the failure mode that makes a
 * model-extracted frequency map untrustworthy as a planning input.
 */

export interface TechEntry {
  canonical: string;
  domain: string;
  patterns: RegExp[];
}

/** Escapes regex metacharacters so "Next.js" matches literally rather than as a pattern. */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Word-boundary match that survives the punctuation these names carry.
 *
 * `\b` fails on a trailing "." or "+", so "Node.js" and "C++" need boundaries expressed
 * as "not preceded/followed by a word character" instead.
 */
function toPattern(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escape(term)}(?![\\p{L}\\p{N}_])`, "iu");
}

export function loadGazetteer(path: string): TechEntry[] {
  const parsed = TechAliasesFile.parse(parseYaml(readFileSync(path, "utf8")));
  return parsed.technologies.map((t) => ({
    canonical: t.canonical,
    domain: t.domain,
    // Longest terms first, so "Node.js" is considered before the "js" alias it contains.
    patterns: [t.canonical, ...t.aliases].sort((a, b) => b.length - a.length).map(toPattern),
  }));
}

/** Requirement strength. A "nice to have" should not weigh the same as a hard requirement. */
export type Strength = "required" | "optional";

export interface Mention {
  canonical: string;
  domain: string;
  strength: Strength;
}

const OPTIONAL_HEADINGS =
  /(nice[\s-]?to[\s-]?have|would be a plus|bonus points|plus(es)?\b|desirable|preferred qualifications|будет плюсом|желательно)/i;
const REQUIRED_HEADINGS =
  /(requirements|qualifications|what you.{0,10}ll need|must[\s-]?have|we expect|требовани|обязательн)/i;

const NEGATION = /\b(no|not|without|don.?t need|not required)\b[^.;:\n]{0,40}$/i;

/**
 * Splits a posting into segments tagged required or optional.
 *
 * Segmentation is why this beats naive counting: a stack listed under "nice to have"
 * inflates a frequency map into recommending study time for things nobody is tested on.
 */
export function segment(text: string): { text: string; strength: Strength }[] {
  const lines = text.split(/\n+/);
  const out: { text: string; strength: Strength }[] = [];
  let strength: Strength = "required";

  for (const line of lines) {
    if (OPTIONAL_HEADINGS.test(line)) strength = "optional";
    else if (REQUIRED_HEADINGS.test(line)) strength = "required";
    out.push({ text: line, strength });
  }
  return out;
}

interface Hit {
  entry: TechEntry;
  start: number;
  end: number;
}

/**
 * All gazetteer hits in a line, with shorter matches nested inside longer ones removed.
 *
 * Longest-match-wins is load-bearing, not tidiness: the alias "js" sits inside "Node.js"
 * and ".js" is not a word boundary, so without this every Node.js, Next.js and Vue.js
 * mention would also be counted as a JavaScript mention and inflate that technology
 * throughout the frequency map.
 */
function hitsIn(line: string, gazetteer: TechEntry[]): Hit[] {
  const hits: Hit[] = [];
  for (const entry of gazetteer) {
    for (const pattern of entry.patterns) {
      const m = pattern.exec(line);
      if (!m) continue;
      hits.push({ entry, start: m.index, end: m.index + m[0].length });
      break; // one hit per technology per line is enough; we count technologies, not tokens
    }
  }
  return hits.filter(
    (h) => !hits.some((other) => other !== h && other.start <= h.start && other.end >= h.end && other.end - other.start > h.end - h.start),
  );
}

export function extract(text: string, gazetteer: TechEntry[]): Mention[] {
  const found = new Map<string, Mention>();

  for (const { text: line, strength } of segment(text)) {
    for (const hit of hitsIn(line, gazetteer)) {
      // "no Kubernetes experience required" is not a Kubernetes requirement.
      if (NEGATION.test(line.slice(0, hit.start))) continue;

      const entry = hit.entry;
      const existing = found.get(entry.canonical);
      // A technology named as required anywhere in the posting is required.
      if (!existing || (existing.strength === "optional" && strength === "required")) {
        found.set(entry.canonical, { canonical: entry.canonical, domain: entry.domain, strength });
      }
    }
  }
  return [...found.values()];
}

const LEVEL_PATTERNS: [RegExp, string][] = [
  [/\b(head of|vp of engineering|engineering manager|cto)\b/i, "head"],
  [/\b(staff|principal|architect)\b/i, "staff"],
  [/\b(senior|sr\.?|lead)\b/i, "senior"],
  [/\b(middle|mid[\s-]?level|regular)\b/i, "middle"],
  [/\b(junior|jr\.?|entry[\s-]?level|intern)\b/i, "junior"],
];

/** Years of experience as a fallback when the title carries no level word. */
const YEARS = /(\d+)\s*\+?\s*(?:years|yrs|лет|года?)\b/i;

export function detectLevel(title: string, body = ""): string | null {
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(title)) return level;
  }
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(body)) return level;
  }
  const years = YEARS.exec(body);
  if (years) {
    const n = Number(years[1]);
    if (n >= 8) return "staff";
    if (n >= 5) return "senior";
    if (n >= 2) return "middle";
    return "junior";
  }
  return null;
}

/**
 * Maps a source's own level vocabulary onto ours.
 *
 * Boards use their own words — "midweight", "director", "any" — and letting them through
 * unmapped puts foreign categories into the level histogram, where they look like data.
 */
const STATED_LEVEL: Record<string, string | null> = {
  junior: "junior",
  entry: "junior",
  intern: "junior",
  "entry-level": "junior",
  middle: "middle",
  midweight: "middle",
  mid: "middle",
  "mid-level": "middle",
  intermediate: "middle",
  senior: "senior",
  lead: "senior",
  staff: "staff",
  principal: "staff",
  architect: "staff",
  director: "head",
  head: "head",
  executive: "head",
  manager: "head",
  any: null,
  "any level": null,
  "": null,
};

/** Normalises a source-stated level, returning null when it does not map onto ours. */
export function normaliseLevel(stated: string | undefined): string | null {
  if (!stated) return null;
  return STATED_LEVEL[stated.trim().toLowerCase()] ?? null;
}
