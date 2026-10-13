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
make setup                                # dependencies and the pre-commit hook
make check                                # lint + tests + content validation + harness gates
make drill ARGS="--include-drafts"        # a practice session in the terminal
make prep ARGS="<job-url>"                # parse a posting into a rehearsal plan for it
make extension ARGS="--include-drafts"    # build the unpacked Chrome extension
```

`make prep` is the only command that reads the network: it fetches one posting, extracts
the stack with the same closed gazetteer the vacancy map uses, and prints what the posting
emphasises, which questions in the bank cover it, and which of its requirements nothing
covers yet. <!-- proof: make prep -->

Pass `--out` and the plan is archived as data, which the extension can be built with: the
posting is an argument to both commands and is never a URL stored in this repository.

```bash
make prep ARGS="<job-url> --out=.pipeline/prep/role.json"
make extension ARGS="--include-drafts --plan=.pipeline/prep/role.json"
```

The toolchain is pinned rather than assumed: Node >= 24 in `.nvmrc`, and pnpm v12 or newer
in `package.json#packageManager`. `make setup` installs with that exact version and is the
only install step. The floor is real — pnpm 11 ships no `darwin-x64` engine binary, so a pin
to it fails on an Intel Mac before any install runs. <!-- proof: package.json -->

### Loading the extension

`make extension ARGS="--include-drafts"` writes the unpacked extension to
`apps/extension/dist`; without `ARGS` the bundle carries no questions, because nothing in
`content/` is published yet. Then:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → `apps/extension/dist`.
4. Click the toolbar icon; it opens the side panel.

The panel has four surfaces: **Drill** (question and probes first, expected answer only after
you commit, graded 0-5, with today's progress and a streak), **Bank** (every question,
filtered by domain, level and technology, with search), **Posting** (a parsed posting — what
it emphasises, its ordered plan, and what nothing in the bank covers yet) and the **wiki** the
citations point at, so a missed bullet ends in the section that explains it. A build without
`--plan` has no Posting surface and says so.

The toolbar icon is the brand mark itself — a blue rounded square with `IP`, drawn as real PNGs
by `make icons` (`scripts/make-icons.ts`) rather than imported as art.

The header carries back and forward through the session, text size (A− / A+, or `-` / `+`:
five steps that scale every text in the panel, remembered between openings), and fullscreen.
A side panel cannot fill the screen itself — Chrome accepts `requestFullscreen()` there and
then never answers it — so fullscreen opens the panel in a window of its own that does, and the
button in that window leaves it again. The panel remembers where you stopped — view, question,
filters, scroll — because a side panel is destroyed when it is hidden and reopened when the
toolbar icon is clicked again. Select any text and a small **Translate → RU** popup appears at
the cursor: that click is the only thing in the extension that leaves the device, and the
manifest grants exactly the two Google Translate origins for it.

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
  tech-aliases.yaml  the closed gazetteer the posting pipeline reads
packages/         schema, scheduling, evaluator, rag, pipeline, verifier
apps/             drill (CLI), extension (Chrome MV3)
.harness/         how work is governed here — start at .harness/README.md
specs/            live work tracks and their handoffs
docs/             topical documents: the plan, the content schema, the review protocol,
                  the extension bundle contract
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

Phase 0, and the bank now covers a whole role rather than a single wedge: **100 articles and
115 questions** across seventeen domains, all `review_status: draft`, aimed at senior and
staff interviews, plus the three DSA entity types. The depth follows a real senior Node.js +
platform posting — Node, NestJS and Hono, Kubernetes, Kafka, AWS, PostgreSQL, Redis, gRPC —
and keeps the `agentic` wedge (MCP 2026-07-28, agent skills, agent evaluation) and a fintech
domain: ledgers, idempotency, reconciliation, payments. The target is 691 questions, ordered
by market weight.

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
