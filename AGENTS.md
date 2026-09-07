# AGENTS.md

Routing file. Keep it under 200 lines — details belong in `docs/`, next to the code they govern.

## What this is

A preparation system for senior/staff fullstack + platform interviews. The product is
the content: a wiki that is the source of truth for facts, questions derived from it,
and a DSA track built around the naive-to-optimal transition.

Phase 0 builds a CLI trainer used personally. Phase 1 packages the same `content/` as a
Chrome extension plus a static site. Content is decoupled from delivery, so the surface
can change without a rewrite.

Full plan: `docs/plan.md`. How the project is governed: `.harness/README.md`.
The model behind that structure is
[Learn Harness Engineering](https://walkinglabs.github.io/learn-harness-engineering/ru/);
the checks are [`@atamaniuc/harness`](https://github.com/atamaniuc/harness)
([15-minute guide](https://github.com/atamaniuc/harness/blob/main/docs/GUIDE.ru.md)).
<!-- proof: docs/plan.md --> <!-- proof: .harness/README.md -->

## How to run

```
make setup                  # install dependencies (pnpm, Node >= 24) and the pre-commit hook
make check                  # lint + test + validate — the gate for every unit of work
make validate               # content only, fastest feedback while authoring
make drill ARGS="--help"    # practice session in the terminal
make extension ARGS="--include-drafts"   # build the unpacked extension into apps/extension/dist
make ingest                 # rebuild the topic frequency map from live job postings
```

**Loading the extension:** Chrome → `chrome://extensions` → Developer mode → Load unpacked →
`apps/extension/dist`. The toolbar icon opens the side panel.

There is no server and no database to provision. Everything runs locally.

## How to verify

`make check` is the only gate that matters. <!-- proof: make check --> It runs three levels:

1. **Static** — `tsc --noEmit` over the workspace. <!-- proof: pnpm run lint -->
2. **Behaviour** — the vitest suite, including negative tests proving the validator
   actually rejects bad content. <!-- proof: packages/schema/test/validate.test.ts -->
3. **Content** — schema plus cross-file rules: dangling wiki refs, unknown domains,
   unattributed reviews, non-commercial provenance, placeholder markers.
   <!-- proof: make validate -->

An item is done when its own `verification` command from `feature_list.json` passes.
Not when the code looks right. <!-- proof: .harness/4-state/feature_list.json -->

## Layout

```
content/          source of truth, independent of any application
  wiki/           Markdown + frontmatter; facts live here first
  questions/      YAML, derived from wiki sections via wiki_refs
  dsa/            concepts (complexity), patterns, tasks
  domains.yaml    domain tree and market weights
  sources.yaml    external sources and licenses — human-edited only
  tech-aliases.yaml  gazetteer for vacancy parsing
packages/         schema, scheduling, evaluator, rag, pipeline, harness rules
apps/             drill (CLI), extension (Chrome MV3)
.harness/         everything governing how work is done — start at .harness/README.md
  1-instructions/ CONSTRAINTS.md, definition-of-done.md, autonomy.md
  2-tools/        the queue tool, cold start, locked-surface check
  3-environment/  reproducibility and the locked-surface baseline
  4-state/        PROGRESS.md, DECISIONS.md, feature_list.json
  5-feedback/     map of the checks
docs/             topical rules, 50-150 lines each
```

## Session protocol

**Start:** read `.harness/4-state/PROGRESS.md`, then `DECISIONS.md`, then run `make check`
to confirm the tree is consistent before touching anything.

**End:** update `.harness/4-state/PROGRESS.md`, run `make check`, commit. The pre-commit hook is the fast
gate only — content validation and harness invariants, about two seconds. The full suite
runs in CI. Leave state such that the next session starts in minutes.

## Working the queue

The queue exists to stop work being started everywhere and finished nowhere. It is not
paperwork: **use it for items worth a session**, and just do small fixes and follow-ups
directly. Never edit `state` by hand — the harness owns transitions, and CI re-runs every
passing claim.

```
make harness-status               # queue, WIP, verification backlog
make harness-verify   ID=<id>     # activate if needed, run its verification, record the outcome
make harness-check ARGS=--reverify  # invariants + re-run every passing claim
make cold-start                   # fresh clone must install and verify from the repo alone
```

`harness-verify` is the only command needed for normal work; it activates the item itself.
`harness-activate` exists for claiming an item without running it yet.

## Work tracks and handoffs

A session ends and its memory is gone. The queue says which item is in flight; it does not
say where the work stopped, what was already tried, or what the next session should not
read. That is what a handoff carries.

- Live tracks are indexed in [`specs/TRACKS.md`](specs/TRACKS.md) — essence, link to its
  handoff, status, next step. **Starting work on a track means loading its handoff first.**
- A lane whose work is unfinished at session end carries `handoff.md` next to its spec:
  context, what to load *and what not to*, state, decisions taken, first step. Edited in
  place, never appended to.
- Closing a track is a distillation: the outcome in one or two sentences into
  [`specs/TRACKS-LOG.md`](specs/TRACKS-LOG.md), lasting decisions into
  `.harness/4-state/DECISIONS.md`, then the handoff is deleted. Git carries the rest.

The index is machine-checked, because a handoff that lies is worse than no handoff — the
next session trusts it. A track line with no status, or one linking a handoff that was
deleted, fails the gate. <!-- proof: specs/TRACKS.md -->

## Working rules

- **WIP = 1.** One item in `active` at a time. Enforced by `harness-activate`.
- **Do not add items** to `.harness/4-state/feature_list.json`. Scope belongs to the human.
- **Do not set `review_status: reviewed`.** Ever. See `CONSTRAINTS.md`.
- **Stop when the review queue is full.** More than 15 items awaiting human review pauses
  generation until they are drained — the bottleneck is review, not authoring. Enforced.
- **Verify before refactoring.** Correctness first, style after.

Hard constraints: `.harness/1-instructions/CONSTRAINTS.md`. Read it before writing content.

## Topical docs

- `docs/content-schema.md` — the entities, their fields, and why the shapes are what they are
- `docs/review-protocol.md` — what a human review checks, and how repeat findings become checks
- `docs/plan.md` — the full plan: phases, gates, what was cut and why
