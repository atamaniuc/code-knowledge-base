/**
 * The content bundle, and the reader that turns `content.json` into it.
 *
 * The bundle is data the extension ships itself; nothing here fetches. Parsing is
 * deliberately forgiving about shape and strict about structure: a field the panel can
 * live without gets a default, but a file that is not a bundle at all throws, so the
 * panel can say "this is broken" instead of rendering an empty bank.
 *
 * Schema 2 adds the wiki and the rehearsal plan to the question bank. The reader
 * normalises a few things rather than making the rest of the UI care:
 *   - domains may be ids (legacy) or {id,title,description} records;
 *   - a plan is accepted either in the trimmed bundler shape or in the raw prep shape
 *     (profile + core[].question + reasons), because both ended up on disk during the
 *     transition and the failure mode otherwise is a blank Posting tab, not an error.
 */

export interface ExpectedBullet {
  text: string;
  level: string;
  weight: number;
}

export interface WikiRef {
  slug: string;
  anchor: string;
}

export interface Question {
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
  expected: ExpectedBullet[];
  followUps: string[];
  mistakes: string[];
  minutes: number;
  difficulty: number;
  reviewStatus: string;
  wikiRefs: WikiRef[];
}

export interface WikiArticle {
  slug: string;
  title: string;
  domain: string;
  topic: string;
  levels: string[];
  summary: string;
  body: string;
}

export interface DomainInfo {
  id: string;
  title: string;
  description: string;
}

export interface PlanSource {
  title: string;
  url: string;
  level: string;
  capturedAt: string;
}

export interface PlanEmphasis {
  domain: string;
  required: string[];
  optional: string[];
}

export interface PlanEntry {
  id: string;
  slug: string;
  domain: string;
  levels: string[];
  reason: string;
}

export interface PlanGap {
  domain: string;
  technologies: string[];
}

export interface Plan {
  source: PlanSource;
  levels: string[];
  emphasis: PlanEmphasis[];
  core: PlanEntry[];
  stretch: PlanEntry[];
  gaps: PlanGap[];
}

export interface Bundle {
  schema: number;
  generatedAt: string;
  questions: Question[];
  wiki: WikiArticle[];
  domains: DomainInfo[];
  levels: string[];
  plan: Plan | null;
}

/** Raised when `content.json` is not a bundle at all. */
export class BundleError extends Error {
  override readonly name = "BundleError";
}

export const LEVEL_ORDER = ["junior", "middle", "senior", "staff", "head"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const records = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const str = (value: unknown, fallback = ""): string => (typeof value === "string" && value.length > 0 ? value : fallback);

const num = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

const optionalStr = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined);

/** `head-of-development` reads better than the raw id when no title was bundled. */
export function humanize(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function readQuestion(raw: Record<string, unknown>, index: number): Question {
  const id = str(raw.id, "q".concat(String(index)));
  return {
    id,
    slug: str(raw.slug, id),
    domain: str(raw.domain, "unknown"),
    topic: str(raw.topic),
    subtopic: optionalStr(raw.subtopic),
    levels: strings(raw.levels),
    tracks: strings(raw.tracks),
    tech: optionalStr(raw.tech) ?? null,
    question: str(raw.question),
    probes: str(raw.probes),
    answerStrategy: optionalStr(raw.answerStrategy ?? raw.answer_strategy),
    expected: records(raw.expected).map((bullet) => ({
      text: str(bullet.text),
      level: str(bullet.level, str(bullet.min_level, "any")),
      weight: num(bullet.weight, 1),
    })),
    followUps: strings(raw.followUps ?? raw.follow_ups),
    mistakes: strings(raw.mistakes ?? raw.common_mistakes),
    minutes: num(raw.minutes ?? raw.estimated_minutes),
    difficulty: num(raw.difficulty),
    reviewStatus: str(raw.reviewStatus, str(raw.review_status, "draft")),
    wikiRefs: records(raw.wikiRefs ?? raw.wiki_refs).map((ref) => ({ slug: str(ref.slug), anchor: str(ref.anchor) })),
  };
}

function readArticle(raw: Record<string, unknown>): WikiArticle {
  return {
    slug: str(raw.slug),
    title: str(raw.title, str(raw.slug)),
    domain: str(raw.domain),
    topic: str(raw.topic),
    levels: strings(raw.levels),
    summary: str(raw.summary),
    body: str(raw.body),
  };
}

function readDomains(raw: unknown): DomainInfo[] {
  const out: DomainInfo[] = [];
  for (const domain of Array.isArray(raw) ? raw : []) {
    if (typeof domain === "string" && domain.length > 0) {
      out.push({ id: domain, title: humanize(domain), description: "" });
      continue;
    }
    if (isRecord(domain)) {
      const id = str(domain.id);
      if (!id) continue;
      out.push({ id, title: str(domain.title, humanize(id)), description: str(domain.description) });
    }
  }
  return out;
}

function readEmphasis(raw: unknown, profile: Record<string, unknown>): PlanEmphasis[] {
  const explicit = records(raw);
  if (explicit.length > 0) {
    return explicit
      .map((item) => ({ domain: str(item.domain), required: strings(item.required), optional: strings(item.optional) }))
      .filter((item) => item.domain.length > 0);
  }
  // Raw prep plan: mentions carry the strength, one entry per technology.
  const byDomain = new Map<string, PlanEmphasis>();
  for (const mention of records(profile.mentions)) {
    const domain = str(mention.domain);
    if (!domain) continue;
    const bucket = byDomain.get(domain) ?? { domain, required: [], optional: [] };
    const canonical = str(mention.canonical);
    if (canonical) (mention.strength === "required" ? bucket.required : bucket.optional).push(canonical);
    byDomain.set(domain, bucket);
  }
  return [...byDomain.values()].sort(
    (a, b) => b.required.length - a.required.length || a.domain.localeCompare(b.domain),
  );
}

function readPlanEntries(raw: unknown, questions: Question[]): PlanEntry[] {
  const out: PlanEntry[] = [];
  for (const entry of records(raw)) {
    const nested = isRecord(entry.question) ? entry.question : undefined;
    const source = nested ?? entry;
    const id = str(source.id, str(entry.id));
    const slug = str(source.slug, str(entry.slug));
    const known = questions.find((q) => (id && q.id === id) || (slug && q.slug === slug));
    const reason = str(entry.reason, strings(entry.reasons).join("; "));
    const domain = str(source.domain, known?.domain ?? "");
    const levels = strings(source.levels).length > 0 ? strings(source.levels) : (known?.levels ?? []);
    if (!id && !slug && !domain) continue;
    out.push({ id: known?.id ?? id, slug: known?.slug ?? slug, domain, levels, reason });
  }
  return out;
}

function readPlan(raw: unknown, questions: Question[]): Plan | null {
  if (!isRecord(raw)) return null;
  const profile = isRecord(raw.source) ? raw.source : isRecord(raw.profile) ? raw.profile : {};
  return {
    source: {
      title: str(profile.title, "A posting"),
      url: str(profile.url),
      level: str(profile.level),
      // `source.capturedAt` is where the bundler contract puts it; the raw prep file has
      // `captured_at` at the top level, and the profile never carries it.
      capturedAt: str(raw.capturedAt, str(raw.captured_at, str(profile.capturedAt, str(profile.captured_at)))),
    },
    levels: strings(raw.levels),
    emphasis: readEmphasis(raw.emphasis, profile),
    core: readPlanEntries(raw.core, questions),
    stretch: readPlanEntries(raw.stretch, questions),
    gaps: records(raw.gaps).map((gap) => ({ domain: str(gap.domain), technologies: strings(gap.technologies) })),
  };
}

function deriveLevels(questions: Question[]): string[] {
  const seen = new Set(questions.flatMap((q) => q.levels));
  return LEVEL_ORDER.filter((level) => seen.has(level));
}

export function parseBundle(raw: unknown): Bundle {
  if (!isRecord(raw)) throw new BundleError("content.json is not a JSON object");
  if (!Array.isArray(raw.questions)) throw new BundleError("content.json has no questions[] — it is not a content bundle");
  const questions = raw.questions.filter(isRecord).map(readQuestion);
  return {
    schema: num(raw.schema, 1),
    generatedAt: str(raw.generatedAt),
    questions,
    wiki: records(raw.wiki).map(readArticle),
    domains: readDomains(raw.domains),
    levels: strings(raw.levels).length > 0 ? strings(raw.levels) : deriveLevels(questions),
    plan: readPlan(raw.plan, questions),
  };
}

/** Domain title for a chip, falling back to the id when the bundle carried no registry. */
export function domainTitle(domains: DomainInfo[], id: string): string {
  return domains.find((d) => d.id === id)?.title ?? humanize(id);
}

export function articleBySlug(bundle: Bundle, slug: string): WikiArticle | undefined {
  return bundle.wiki.find((article) => article.slug === slug);
}

/** The subset of a question the shared selector reads; typed for `nextUp`. */
export interface SelectorQuestion {
  id: string;
  slug: string;
  domain: string;
  levels: string[];
  probes: string;
  question: string;
  tech: string | null;
  review_status: string;
}

export function toSelectorPool(questions: Question[]): SelectorQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    slug: q.slug,
    domain: q.domain,
    levels: q.levels,
    probes: q.probes,
    question: q.question,
    tech: q.tech,
    review_status: q.reviewStatus,
  }));
}
