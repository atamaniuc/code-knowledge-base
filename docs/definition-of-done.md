# Definition of Ready and Definition of Done

Two checkpoints, both enforced rather than agreed. Ready is checked when an item is
started; Done when it is closed. The machine-decidable parts live in
`packages/harness/src/readiness.ts` and fail the command; the rest is stated here because
it is judgement, and judgement that is written down is at least reviewable.

## Definition of Ready

An item may be started when all of this holds.

**The behavior is an outcome, not an activity.** "The validator rejects a question with
fewer than two answer bullets" can be checked. "Add validation" is complete when you stop
typing. _Enforced._

**A verification command exists and can fail.** If nothing can fail, nothing can be
confirmed, and the item will be closed on an opinion. _Enforced._

**The kind is set.** Code closes when its command passes. Content closes when the
promotion gates pass. Conflating them is how unverified content ships. _Enforced._

**Dependencies have reached a terminal state.** Building on an unfinished dependency
produces work that gets redone when it lands. _Enforced._

**It fits in one session.** Not machine-checkable, so it is a judgement call: if you
cannot see the end of it, split it. An item that spans sessions loses its context between
them and that is exactly what the harness exists to prevent.

**The scope is settled.** No `TODO` left in the behavior. _Enforced._

## Definition of Done — code

**The verification command passed.** _Enforced._

**Evidence is recorded.** The command output is stored against the item, because CI
re-runs every passing claim and a claim with no output cannot be re-checked. _Enforced._

**No placeholders.** No `TODO`, `FIXME`, `test.skip`, `test.only`, empty branch left as an
exercise. _Enforced by `make check` for content; by review for code._

**A negative test exists where a rule was added.** A validation rule with no failing test
is an assumption, not a rule. Judgement, but the bar is not negotiable — every cross-file
rule in this repository has one.

**Locked surfaces untouched.** _Enforced by CI._

**Documentation follows a changed contract.** If the item changed a schema, a command, or
a promise the product makes, the doc that states it changed in the same commit. Judgement.

## Definition of Done — content

Content does not close on a command. It closes on the promotion gates in
`docs/autonomy.md`, all five, with stored evidence:

1. Every factual claim matched to a quoted span in a **fetched** source.
2. An independent model failed to falsify it against those sources.
3. It contradicts nothing already promoted.
4. The version range is checked against real release data.
5. It survives grounding against a source the author did not cite.

Plus the schema-level rules `make validate` enforces: `wiki_refs` resolve, `sources` is
non-empty, the technology and version are pinned where the domain requires it, and no
promoted status exists without a trace reference.

**A question additionally needs:** `probes` stating what is actually being assessed, at
least two independent expected-answer bullets with levels, and — for open or behavioural
questions — an `answer_strategy`. These are the fields that make it interview preparation
rather than a reference entry, so an item lacking them is not done, it is a draft that
validates.

## What is deliberately not in either list

**Coverage thresholds.** They measure lines executed, not behaviour verified, and a team
that has to hit one writes tests for the easy paths.

**Review by a person.** Removed on purpose; see `docs/autonomy.md`. Humans own the gates,
not the items.

**Estimates.** The queue limits work in progress to one item; how long it takes is
information, not a commitment.
