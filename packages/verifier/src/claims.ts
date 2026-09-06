/**
 * Splits an article body into the statements a gate has to ground.
 *
 * Deterministic on purpose. Asking a model which sentences are claims puts model
 * judgement upstream of the check that is supposed to constrain model judgement, and the
 * failure would be invisible: claims quietly dropped from the list are claims that pass
 * by never being examined.
 */

export interface Claim {
  /** Position in the body, used to point a failure at the right place. */
  index: number;
  /** Heading path the claim sits under, so a failure names a section. */
  section: string;
  text: string;
}

/** Openers that make a sentence guidance or narration rather than an assertion of fact. */
const NON_FACTUAL =
  /^(this|that|these|those|it|here|there|the (question|answer|interview|candidate|section|point)|a (candidate|senior|staff))\b/i;

const IMPERATIVE =
  /^(say|state|name|give|avoid|do not|don't|start|open|close|finish|mention|keep|prefer|use|write|ask|answer|explain|split|describe)\b/i;

/** Sentences that are too short to carry a checkable assertion. */
const MIN_WORDS = 6;

const stripMarkdown = (s: string) =>
  s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1");

function sentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractClaims(markdown: string): Claim[] {
  const claims: Claim[] = [];
  let section = "(intro)";
  let index = 0;

  for (const block of stripMarkdown(markdown).split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const heading = /^#{2,6}\s+(.*)$/.exec(trimmed);
    if (heading) {
      section = heading[1]?.trim() ?? section;
      continue;
    }
    // Lists are usually enumerations of the surrounding claim rather than claims themselves.
    if (/^[-*|>]/.test(trimmed)) continue;

    for (const sentence of sentences(trimmed.replace(/\n/g, " "))) {
      if (sentence.split(/\s+/).length < MIN_WORDS) continue;
      if (sentence.endsWith("?")) continue;
      if (NON_FACTUAL.test(sentence)) continue;
      if (IMPERATIVE.test(sentence)) continue;
      claims.push({ index: index++, section, text: sentence });
    }
  }
  return claims;
}
