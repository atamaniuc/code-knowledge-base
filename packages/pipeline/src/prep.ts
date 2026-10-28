import type { Question } from "@schema/question.js";
import type { Mention, Strength } from "./gazetteer.js";

/**
 * Turning one job posting into a rehearsal plan.
 *
 * The posting is parsed with the gazetteer (a closed vocabulary, so it cannot invent a
 * technology the poster did not name), and the plan is built from the bank that exists:
 * what the posting emphasises, what the bank covers for it, and — the part that drives
 * authoring — which of its requirements nothing covers yet.
 *
 * Nothing here fetches. The caller hands in a profile and the questions, so the ranking
 * is testable without a network or a fixture server.
 */

export interface JobProfile {
  title: string;
  url: string;
  /** Level detected from the title and body; null when the posting states neither. */
  level: string | null;
  mentions: Mention[];
}

export interface RankedQuestion {
  question: Question;
  score: number;
  reasons: string[];
}

export interface Gap {
  domain: string;
  technologies: string[];
}

export interface PrepPlan {
  profile: JobProfile;
  /** The bands worth rehearsing: the detected level and everything above it. */
  levels: string[];
  core: RankedQuestion[];
  /** Domains the posting does not name but that are worth rehearsing anyway. */
  stretch: RankedQuestion[];
  gaps: Gap[];
}

/** The plan as a bundle stores it: identities and reasons, not second copies of questions. */
export interface PlanEntry {
  id: string;
  slug: string;
  domain: string;
  levels: string[];
  reason: string;
}

export interface BundlePlan {
  source: { title: string; url: string; level: string | null; capturedAt: string };
  levels: string[];
  emphasis: { domain: string; required: string[]; optional: string[] }[];
  core: PlanEntry[];
  stretch: PlanEntry[];
  gaps: Gap[];
}

export function toBundlePlan(plan: PrepPlan, capturedAt: string): BundlePlan {
  const entry = (r: RankedQuestion): PlanEntry => ({
    id: r.question.id,
    slug: r.question.slug,
    domain: r.question.domain,
    levels: r.question.levels,
    reason: r.reasons.join("; "),
  });
  const emphasis = [...new Set(plan.profile.mentions.map((m) => m.domain))]
    .map((domain) => ({
      domain,
      required: plan.profile.mentions.filter((m) => m.domain === domain && m.strength === "required").map((m) => m.canonical),
      optional: plan.profile.mentions.filter((m) => m.domain === domain && m.strength === "optional").map((m) => m.canonical),
    }))
    .sort((a, b) => b.required.length - a.required.length || a.domain.localeCompare(b.domain));

  return {
    source: { title: plan.profile.title, url: plan.profile.url, level: plan.profile.level, capturedAt },
    levels: plan.levels,
    emphasis,
    core: plan.core.map(entry),
    stretch: plan.stretch.map(entry),
    gaps: plan.gaps,
  };
}

const ORDER = ["junior", "middle", "senior", "staff", "head"];

/**
 * Bands to rehearse for a posting.
 *
 * A senior posting is not rehearsed at middle: the interview that decides the outcome is
 * the one above the title. Unknown defaults to senior because that is the band this
 * preparation system is aimed at, and a posting that says nothing usually means "senior,
 * titled loosely" rather than junior.
 */
export function targetLevels(detected: string | null): string[] {
  const from = ORDER.indexOf(detected ?? "senior");
  return ORDER.slice(from === -1 ? ORDER.indexOf("senior") : from);
}

const strengthOf = (mentions: Mention[], domain: string): Strength | null => {
  const hits = mentions.filter((m) => m.domain === domain);
  if (hits.some((h) => h.strength === "required")) return "required";
  return hits.length > 0 ? "optional" : null;
};

const technologiesFor = (mentions: Mention[], domain: string): string[] =>
  [...new Set(mentions.filter((m) => m.domain === domain).map((m) => m.canonical))].sort();

/** A technology the posting names appearing anywhere in the question's own text. */
function namedIn(question: Question, mentions: Mention[]): string[] {
  const haystack = [question.question, question.probes, question.tech?.name ?? ""].join(" ").toLowerCase();
  return mentions
    .filter((m) => haystack.includes(m.canonical.toLowerCase()))
    .map((m) => m.canonical);
}

/**
 * How strongly one question answers this posting.
 *
 * Domain overlap dominates, because a question about Kafka is not more relevant for
 * mentioning "scalable" — the words a posting uses are the same words every posting uses.
 * A technology named inside the question is the sharper signal, so it adds on top.
 */
export function scoreFor(question: Question, profile: JobProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const strength = strengthOf(profile.mentions, question.domain);
  if (strength === "required") {
    score += 6;
    reasons.push(`${question.domain} is a stated requirement`);
  } else if (strength === "optional") {
    score += 2;
    reasons.push(`${question.domain} is a nice-to-have`);
  }

  const named = namedIn(question, profile.mentions);
  if (named.length > 0) {
    score += 2 * named.length;
    reasons.push(`names ${named.join(", ")}`);
  }

  if (profile.level && question.levels.includes(profile.level as Question["levels"][number])) {
    score += 2;
    reasons.push(`asks at ${profile.level}, the level the posting states`);
  }
  return { score, reasons };
}

/** Questions in the requested bands, best match first; score ties break on slug so plans are stable. */
export function rank(questions: Question[], profile: JobProfile, levels: string[]): RankedQuestion[] {
  const wanted = new Set(levels);
  return questions
    .filter((q) => q.levels.some((l) => wanted.has(l)))
    .map((question) => ({ question, ...scoreFor(question, profile) }))
    .sort((a, b) => b.score - a.score || a.question.slug.localeCompare(b.question.slug));
}

/**
 * One domain cannot fill the plan.
 *
 * A posting that names Kubernetes once makes every Kubernetes question its own requirement,
 * and ranking alone then hands back a cluster drill with the role's own core pushed under
 * the limit. Capping each domain keeps the list spanning the posting instead of sorting
 * itself by whichever domain the bank happens to have most questions in.
 */
export function spreadByDomain(ranked: RankedQuestion[], perDomain: number): RankedQuestion[] {
  const used = new Map<string, number>();
  return ranked.filter((entry) => {
    const count = used.get(entry.question.domain) ?? 0;
    if (count >= perDomain) return false;
    used.set(entry.question.domain, count + 1);
    return true;
  });
}

export function buildPrepPlan(
  questions: Question[],
  profile: JobProfile,
  options: { levels?: string[]; stretchDomains?: string[]; limit?: number; perDomain?: number } = {},
): PrepPlan {
  const levels = options.levels ?? targetLevels(profile.level);
  const named = new Set(profile.mentions.map((m) => m.domain));

  const core = spreadByDomain(
    rank(questions, profile, levels).filter((r) => r.score > 0),
    options.perDomain ?? 4,
  );
  // Two per stretch domain rather than the top four overall: one domain's whole backlog
  // crowding out the others turns a widening exercise into a second core plan.
  const stretch = options.stretchDomains?.length
    ? options.stretchDomains.flatMap((domain) =>
        rank(
          questions.filter((q) => q.domain === domain),
          profile,
          levels,
        ).slice(0, 2),
      )
    : [];

  // A requirement nothing in the bank covers is the authoring backlog, not a scheduling
  // detail: it is the only part of the plan that says what to write next.
  const covered = new Set(questions.map((q) => q.domain));
  const gaps = [...named]
    .filter((domain) => !covered.has(domain))
    .map((domain) => ({ domain, technologies: technologiesFor(profile.mentions, domain) }))
    .sort((a, b) => a.domain.localeCompare(b.domain));

  return {
    profile,
    levels,
    core: options.limit ? core.slice(0, options.limit) : core,
    stretch,
    gaps,
  };
}
