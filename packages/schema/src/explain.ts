import type { $ZodIssue } from "zod/v4/core";

/**
 * Agent-oriented failure messages.
 *
 * A validator that says "invalid schema" makes an agent guess. Every message here
 * answers three things: what failed, why it matters, and what to do next.
 */
interface Remedy {
  /** Matched against the dotted issue path, e.g. "expected_answer" or "wiki_refs.0.anchor". */
  match: RegExp;
  why: string;
  fix: string;
}

const REMEDIES: Remedy[] = [
  {
    match: /^probes$/,
    why: "what the interviewer assesses is often not the facts in the answer — an opening question may be probing deliberateness, a design question whether trade-offs get named at all",
    fix: "state in one sentence what is actually being tested; if you cannot, you have not understood the question well enough to ask it",
  },
  {
    match: /^answer_strategy$/,
    why: "an open or behavioural question is nearly useless without guidance on how to deliver the answer out loud",
    fix: "describe the order to say things in — what to open with, what to keep short — or omit the field for a narrow factual question",
  },
  {
    match: /^expected_answer$/,
    why: "the evaluator scores coverage per bullet and derives a level from which bullets were hit; one bullet or none cannot distinguish middle from senior",
    fix: "split the answer into 3-5 independent bullets, each with its own `min_level` and `weight`",
  },
  {
    match: /^expected_answer\.\d+\.min_level$/,
    why: "without a level per bullet the evaluator cannot say what was missing for the next level",
    fix: "set min_level to the lowest level at which an answer is expected to contain this bullet",
  },
  {
    match: /^wiki_refs$/,
    why: "questions are derived from the wiki, and the reference is what lets the evaluator cite a section instead of just saying 'you did not know this'",
    fix: "add at least one { slug, anchor, wiki_reviewed_at } pointing at the article section this question came from; if no article covers it, write the article first",
  },
  {
    match: /^sources$/,
    why: "a claim without an official source cannot be re-verified when the technology version moves",
    fix: "add at least one source with kind official-docs, rfc, spec or release-notes",
  },
  {
    match: /^tech\.version_range$/,
    why: "versions are the part of an answer that goes stale, so they are tracked as a field rather than buried in prose",
    fix: "set an explicit range such as '>=19' or '15.x'",
  },
  {
    match: /^optimal_approach\.cost$/,
    why: "the teaching unit is the transition from naive to optimal; if both cost the same the task teaches nothing",
    fix: "either pick a genuinely worse naive approach or replace the task",
  },
  {
    match: /^naive_approach\.breaks_at$/,
    why: "'it is slow' is not learnable; a candidate must know at what input size it fails and which work repeats",
    fix: "state the input size where it TLEs and the redundant work, e.g. 'n > 10^4: recomputes the same subarray sum n times'",
  },
  {
    match: /^optimal_approach\.key_insight$/,
    why: "the single realization that unlocks the optimal solution is what is actually asked for out loud in an interview",
    fix: "state the one idea that turns the naive approach into the optimal one, in one sentence",
  },
  {
    match: /^prerequisites$/,
    why: "prerequisites form the learning-order graph that drives the study plan",
    fix: "reference existing article slugs, or leave the list empty for an entry-point article",
  },
  {
    match: /^review_status$/,
    why: "only reviewed and verified content reaches a trainer session or a public surface",
    fix: "use imported or draft while authoring; a human sets reviewed",
  },
];

export interface ExplainedIssue {
  path: string;
  what: string;
  why?: string;
  fix?: string;
}

export function explainIssue(issue: $ZodIssue): ExplainedIssue {
  const path = issue.path.join(".");
  const remedy = REMEDIES.find((r) => r.match.test(path));
  return {
    path: path || "(root)",
    what: issue.message,
    why: remedy?.why,
    fix: remedy?.fix,
  };
}

export function formatIssue(file: string, issue: $ZodIssue): string {
  const e = explainIssue(issue);
  const lines = [`${file}: ${e.path}`, `  what: ${e.what}`];
  if (e.why) lines.push(`  why:  ${e.why}`);
  if (e.fix) lines.push(`  fix:  ${e.fix}`);
  return lines.join("\n");
}
