# PROGRESS

State carried between sessions. Read this first; update it before you stop.

## Now

**Phase 0.0 — initialization.** Closing `init-harness-contract`, the last item of the phase.

- Commit: initial, not yet pushed
- `make check`: passing (tsc clean, 24 tests, content valid)
- Blockers: none

## Done

- `init-workspace` — pnpm workspace on Node 24, `make check` as the single gate
- `init-schema` — Zod schemas for wiki, questions, DSA concepts/patterns/tasks
- `init-validator` — cross-file rules with proven negative tests
- `init-agent-errors` — validation failures reported as what / why / fix

## Next

1. Push the initial commit to `origin` (private repo already created).
2. `vacancy-frequency-map` — must run before any bulk authoring; it sets depth per domain.
   Check the ToS of djinni / DOU / LinkedIn before writing an ingester; prefer official
   APIs, RSS or manual export over scraping.
3. `rag-fts-backend` — chunk the wiki by heading, SQLite FTS5 with filters.

## Open questions for the human

- Which vacancy source is ToS-clear to ingest? This blocks `vacancy-frequency-map`,
  and that item blocks the authoring order for every domain.
- Target level to calibrate content against: senior, or senior-to-staff?

## Seeded content

One real item per entity type, all at `review_status: draft`, kept so every loader path
is exercised by `make check`:

- `content/wiki/caching/cache-stampede.md`
- `content/questions/caching/cache-stampede-mitigation.yaml`
- `content/dsa/concepts/big-o-basics.yaml`
- `content/dsa/patterns/sliding-window.yaml`
- `content/dsa/tasks/longest-substring-without-repeating-characters.yaml`

None are reviewed. Nothing here has been fact-checked by a human yet (CONSTRAINTS #1).

_Last updated: 2026-09-06_
