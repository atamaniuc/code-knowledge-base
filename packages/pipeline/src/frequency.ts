import type { Mention } from "./gazetteer.js";
import { detectLevel, extract, normaliseLevel, type TechEntry } from "./gazetteer.js";
import type { Posting } from "./sources.js";

/**
 * A stack listed under "nice to have" still says something about the market, but not as
 * much as a hard requirement. Counting them equally is what makes a naive frequency map
 * recommend study time for things nobody is tested on.
 */
const STRENGTH_WEIGHT: Record<Mention["strength"], number> = { required: 1, optional: 0.35 };

export interface DomainStat {
  domain: string;
  /** Weighted mentions across the sample. */
  weight: number;
  /** Share of the total, 0..1. */
  share: number;
  /** Postings mentioning this domain at all. */
  postings: number;
  /** Weighted mentions per canonical technology, so a domain's driver is visible. */
  technologies: Record<string, number>;
}

export interface FrequencyMap {
  sampled: number;
  levels: Record<string, number>;
  domains: DomainStat[];
  /** Postings where no known technology matched; a high share means the gazetteer is thin. */
  unmatched: number;
}

/**
 * Restricts the sample to postings whose title matches, so a personal study order is not
 * weighted by roles the candidate is not interviewing for.
 */
export function filterByRole(postings: Posting[], keywords: string[]): Posting[] {
  if (keywords.length === 0) return postings;
  const patterns = keywords.map((k) => new RegExp(k, "i"));
  return postings.filter((p) => patterns.some((r) => r.test(p.title)));
}

export function buildFrequencyMap(postings: Posting[], gazetteer: TechEntry[]): FrequencyMap {
  const domains = new Map<string, DomainStat>();
  const levels: Record<string, number> = {};
  let unmatched = 0;

  for (const posting of postings) {
    const mentions = extract(`${posting.title}\n${posting.body}`, gazetteer);
    if (mentions.length === 0) unmatched += 1;

    const level = normaliseLevel(posting.statedLevel) ?? detectLevel(posting.title, posting.body);
    if (level) levels[level] = (levels[level] ?? 0) + 1;

    const seenDomains = new Set<string>();
    for (const m of mentions) {
      const stat = domains.get(m.domain) ?? {
        domain: m.domain,
        weight: 0,
        share: 0,
        postings: 0,
        technologies: {},
      };
      const w = STRENGTH_WEIGHT[m.strength];
      stat.weight += w;
      stat.technologies[m.canonical] = (stat.technologies[m.canonical] ?? 0) + w;
      if (!seenDomains.has(m.domain)) {
        stat.postings += 1;
        seenDomains.add(m.domain);
      }
      domains.set(m.domain, stat);
    }
  }

  const total = [...domains.values()].reduce((sum, d) => sum + d.weight, 0);
  const ranked = [...domains.values()]
    .map((d) => ({ ...d, share: total === 0 ? 0 : Number((d.weight / total).toFixed(4)) }))
    .sort((a, b) => b.weight - a.weight);

  return { sampled: postings.length, levels, domains: ranked, unmatched };
}
