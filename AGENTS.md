# AGENTS.md

Routing file. Keep it under 200 lines — details belong in `docs/`, next to the code they govern.

## What this is

A preparation system for senior/staff fullstack + platform interviews. The product is
the content: a wiki that is the source of truth for facts, questions derived from it,
and a DSA track built around the naive-to-optimal transition.

Phase 0 builds a CLI trainer used personally. Phase 1 packages the same `content/` as a
Chrome extension plus a static site. Content is decoupled from delivery, so the surface
can change without a rewrite.

Full plan: `docs/plan.md` — phases, gates, and the reasoning behind each decision.

## How to run

```
make setup      # install dependencies (pnpm, Node >= 24)
make check      # lint + test + validate — the gate for every unit of work
make validate   # content only, fastest feedback while authoring
```

There is no server and no database to provision. Everything runs locally.

## How to verify

`make check` is the only gate that matters. It runs three levels:

1. **Static** — `tsc --noEmit` over the workspace.
2. **Behaviour** — the vitest suite, including negative tests proving the validator
   actually rejects bad content.
3. **Content** — schema plus cross-file rules: dangling wiki refs, unknown domains,
   unattributed reviews, non-commercial provenance, placeholder markers.

An item is done when its own `verification` command from `feature_list.json` passes.
Not when the code looks right.

## Layout

```
content/          source of truth, independent of any application
  wiki/           Markdown + frontmatter; facts live here first
  questions/      YAML, derived from wiki sections via wiki_refs
  dsa/            concepts (complexity), patterns, tasks
  domains.yaml    domain tree and weights
  sources.yaml    external sources and licenses — human-edited only
  tech-aliases.yaml  gazetteer for vacancy parsing
packages/schema/  Zod schemas, loader, validator, agent-facing error messages
docs/             topical rules, 50-150 lines each
feature_list.json work queue; each item carries its verification command
PROGRESS.md       state between sessions
DECISIONS.md      what was decided, why, what was rejected
```

## Session protocol

**Start:** read `PROGRESS.md`, then `DECISIONS.md`, then run `make check` to confirm the
tree is consistent before touching anything.

**End:** update `PROGRESS.md`, run `make check`, commit. The pre-commit hook is the fast
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

## Working rules

- **WIP = 1.** One item in `active` at a time. Enforced by `harness-activate`.
- **Do not add items** to `feature_list.json`. Scope belongs to the human.
- **Do not set `review_status: reviewed`.** Ever. See `CONSTRAINTS.md`.
- **Stop when the review queue is full.** More than 15 items awaiting human review pauses
  generation until they are drained — the bottleneck is review, not authoring. Enforced.
- **Verify before refactoring.** Correctness first, style after.

Hard constraints: `CONSTRAINTS.md`. Read it before writing content.

## Topical docs

- `docs/content-schema.md` — the entities, their fields, and why the shapes are what they are
- `docs/review-protocol.md` — what a human review checks, and how repeat findings become checks
- `docs/plan.md` — the full plan: phases, gates, what was cut and why
