# Handoff — 0001 Shared harness adoption

## Context

This repository grew a harness of its own: a queue that owns state transitions, a
locked-surface check, a cold-start test, and a Definition of Ready in
`packages/harness/src/readiness.ts`. A sibling repository (`ledger-lens`) independently
grew the other half: proof markers tying documented claims to real tests and commands, an
index of live work tracks, and a gate on ticked task boxes.

Both halves now live in one place — [Harnessimo](https://github.com/atamaniuc/harnessimo) —
so each repository gains what it was missing and neither maintains its own copy of a rule.
A copied check is a fork the day after it is copied, which this repository has already
experienced once: the `.harness/` reorganisation moved `cold-start.sh` and left the queue
item that verifies it pointing at the old path, and CI failed on every push until someone
read the log.

## What to load

- This file, then `harnessimo.config.json` in the repository root — it already translates
  every check this project enforces today.
- `Makefile`, `.github/workflows/ci.yml` — the two places that call the vendored tools.
- `.harness/2-tools/{harness.ts,locked-surfaces.sh,cold-start.sh}` and
  `packages/harness/src/readiness.ts` — the four files the shared package replaces.

**What NOT to load:** `content/`, `packages/schema`, `packages/verifier`, `apps/`. This
lane touches the harness layer and its CI wiring only. The content pipeline is large and
reading it will consume the session's budget without changing anything here.

## State

**Landed:** `harnessimo.config.json`, the work-track index and its log, and proof markers in
`AGENTS.md`. Those three are the half this repository did not have, and they need nothing
installed — the shared CLI reads the config, and until the package is a dependency the
checks can be run with `node /path/to/harness/bin/harness.mjs check`.

**Not landed:** the switch itself. `Makefile` and CI still call the vendored scripts, and
`package.json` has no dependency on the package yet, because the package was not yet
installable when this lane started (`github:atamaniuc/harnessimo` needs the repository to
exist and, ideally, a tag to pin).

## Decisions taken

- **A dependency, not vendored files.** Do not reintroduce a sync script; that keeps the
  copies and adds a ritual for refreshing them.
- **Adoption never trades a check away.** Everything `locked-surfaces.sh` and
  `cold-start.sh` enforce today is expressed in `harnessimo.config.json`; check that claim
  before deleting either file, and keep whatever the config cannot express.
- **The queue file stays where it is** (`.harness/4-state/feature_list.json`) with its
  existing states, including `awaiting_gates` for content. The shared queue supports a
  per-kind terminal state exactly so this repository does not have to change its model.

## First step

Add the dependency (`pnpm add -D github:atamaniuc/harnessimo#v0.1.0`), then run
`pnpm exec harnessimo doctor` and compare its output against what `make check` and CI run
today, line by line, and write the comparison into this file. Delete nothing until that is
written down.
