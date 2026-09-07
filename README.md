# code-knowledge-base

Interview preparation for senior and staff fullstack + platform roles, built as a content
repository first and an application second.

The product is the content: a wiki that is the source of truth for facts, questions derived
from it, and a DSA track built around the naive-to-optimal transition. Delivery is
replaceable — a terminal trainer today, a Chrome extension alongside it — because content
and delivery are separate on purpose. <!-- proof: content/domains.yaml -->

## Why this exists rather than a question bank

"Generate twenty senior React questions with answers" is free in any chat window, and the
free repositories hold the top of the search results. What a chat does not give you:

- **State over time.** SM-2 scheduling, so what you got wrong comes back when you are about
  to forget it, not when you happen to scroll past it.
  <!-- proof: packages/scheduling/test/sm2.test.ts -->
- **Calibration.** Each expected answer is split into bullets with the level they signal,
  so an answer earns *senior* or *staff* by what it covered, not by how confident it sounded.
  <!-- proof: packages/evaluator/test/assess.test.ts -->
- **What the interviewer is actually testing.** Every question carries `probes` — the thing
  being assessed, which is usually not the facts in the answer — and open or behavioural
  ones carry `answer_strategy`, how to deliver it out loud.
- **Market data instead of taste.** Topic depth follows a frequency map built from live job
  postings, not from what felt important. <!-- proof: make ingest -->
- **Claims that are checked.** Content is promoted by verification gates, not by a model
  finding it plausible: every factual claim has to be matched to a passage quoted from a
  source that was actually fetched. <!-- proof: packages/verifier/test/grounder.test.ts -->

## Quick start

```bash
make setup                                # dependencies (pnpm, Node >= 24) and the pre-commit hook
make check                                # lint + tests + content validation + harness gates
make drill ARGS="--include-drafts"        # a practice session in the terminal
make extension ARGS="--include-drafts"    # build the unpacked Chrome extension
```

Loading the extension: Chrome → `chrome://extensions` → Developer mode → Load unpacked →
`apps/extension/dist`. The toolbar icon opens the side panel.

There is no server and no database to provision, and no API key is needed to run the checks.
Everything runs locally. <!-- proof: make check -->

## Layout

```
content/          the source of truth, independent of any application
  wiki/           Markdown + frontmatter; facts live here first
  questions/      YAML, derived from wiki sections through wiki_refs
  dsa/            concepts (complexity), patterns, tasks
  domains.yaml    the domain tree and its market weights
  sources.yaml    external sources and their licences — human-edited only
packages/         schema, scheduling, evaluator, rag, pipeline, verifier
apps/             drill (CLI), extension (Chrome MV3)
.harness/         how work is governed here — start at .harness/README.md
specs/            live work tracks and their handoffs
docs/             topical documents: the plan, the content schema, the review protocol
```

## How it is verified

`make check` is the only gate that matters. It runs types, the test suite — including
negative tests proving the content validator rejects bad input — content validation across
files, and every gate declared in `harnessimo.config.json`.
<!-- proof: harnessimo.config.json -->

The harness itself is [Harnessimo](https://github.com/atamaniuc/Harnessimo)
([docs](https://atamaniuc.github.io/Harnessimo/)), a dependency
rather than scripts kept here: the work queue that owns state transitions, the locked-surface
rule, the cold-start test, proof markers, and the work-track index. `make harness-doctor`
prints what is actually enforced — and what is not.

An item is finished when its own verification command passes, and CI re-runs every passing
claim, so a state edited by hand is detected rather than trusted.

## Status

Phase 0: the wedge domain is `agentic` — AI in production — because the market data says so
and structured preparation for it barely exists. Nine articles, ten questions and the three
DSA entity types are written; the target is 691 questions across sixteen domains, ordered by
market weight.

Nothing in `content/` has been fact-checked by a human yet, which is why `--include-drafts`
exists and warns. The verification gates are what will replace that review: source grounding
ships, adversarial falsification and the rest are queued.
<!-- proof: .harness/4-state/feature_list.json -->

## Working in this repository

`AGENTS.md` is the entry point for anyone — human or agent — doing work here: how to run it,
how to verify it, the session protocol, and the hard constraints. Reasoning behind the
decisions lives in `docs/plan.md` and `.harness/4-state/DECISIONS.md`.

## Content and licences

`content/sources.yaml` records every external source and whether it may be used
commercially; content derived from a source without that clearance fails validation. The
file is human-edited by rule — licence clearance is not a decision an agent gets to make.
