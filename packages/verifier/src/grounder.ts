import type { Grounder, Grounding, SourceDocument } from "./gate.js";
import type { Claim } from "./claims.js";

/**
 * A grounder backed by a language model, using the operator's own key.
 *
 * The model is asked to locate a passage, not to judge whether the claim is true. The
 * difference matters: "is this correct" invites it to answer from memory, which is the
 * failure this gate exists to prevent. It must quote, and the quote is checked against the
 * document afterwards, so a fabricated span fails rather than passing.
 */
export interface ModelClient {
  complete(prompt: string): Promise<string>;
}

const PROMPT = (claim: string, sources: SourceDocument[]) =>
  `You are checking whether a claim is supported by documents that were fetched for this purpose.

Do not use your own knowledge. Answer only from the documents below.

CLAIM:
${claim}

DOCUMENTS:
${sources.map((s, i) => `[${i}] ${s.url}\n${s.text.slice(0, 12000)}`).join("\n\n")}

Reply with JSON only:
{"grounded": true, "source": <index>, "span": "<exact sentence copied from the document>"}
or
{"grounded": false, "reason": "<what the documents do not say>"}

The span must be copied character for character from the document. If you cannot find one, answer false.`;

/** Normalises whitespace and case so a quote is compared on content, not formatting. */
const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function modelGrounder(client: ModelClient): Grounder {
  return async (claim: Claim, sources: SourceDocument[]): Promise<Grounding> => {
    let parsed: { grounded?: boolean; source?: number; span?: string; reason?: string };
    try {
      const raw = await client.complete(PROMPT(claim.text, sources));
      parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    } catch {
      return { claim, grounded: false, note: "the grounder returned something unparseable" };
    }

    if (!parsed.grounded || !parsed.span) {
      return { claim, grounded: false, note: parsed.reason ?? "no supporting passage was found" };
    }

    // Verify the quote exists. Without this the gate accepts a fabricated span, which is
    // the same failure it was built to catch, one level up.
    const source = sources[parsed.source ?? 0];
    if (!source || !normalise(source.text).includes(normalise(parsed.span))) {
      return {
        claim,
        grounded: false,
        note: "the quoted passage does not appear in the cited document",
      };
    }

    return { claim, grounded: true, span: parsed.span, sourceUrl: source.url };
  };
}
