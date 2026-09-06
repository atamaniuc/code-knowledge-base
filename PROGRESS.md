# PROGRESS

State carried between sessions. Read this first; update it before you stop.

## Now

**Phase 0.0 is complete and now enforced, not just documented.**

- `make check`: passing (tsc clean, 24 tests, content valid)
- `make harness-check ARGS=--reverify`: invariants hold, all 6 passing items re-verified (~30s)
- `make cold-start`: passing, scripted and repeatable
- Pre-commit hook active via `make setup`; CI runs check, re-verification and cold start
- Blockers: `vacancy-frequency-map` is blocked on a human decision, see below

## Done

- `init-workspace` — pnpm workspace on Node 24, `make check` as the single gate
- `init-schema` — Zod schemas for wiki, questions, DSA concepts/patterns/tasks
- `init-validator` — cross-file rules with proven negative tests
- `init-agent-errors` — validation failures reported as what / why / fix
- `init-harness-contract` — cold start scripted and passing from a fresh clone
- `harness-enforcement` — harness owns state transitions; CI re-verifies every passing claim
- `drill-sm2` — SM-2 scheduling, review store on node:sqlite, selection, interactive session

## Next

1. `rag-fts-backend` — chunk the wiki by heading, SQLite FTS5 with domain and topic filters.
2. `evaluator-golden-set` — score a free answer against the bullets, against a hand-labelled set.
3. `vacancy-frequency-map` — must run before any bulk authoring; it sets depth per domain.
   Blocked until a ToS-clear source is chosen. Prefer official APIs, RSS or manual export
   over scraping: this is a commercial product, so the legal footing has to hold.

The first two are not blocked. The frequency map only gates *which domains get authored
first*, not the machinery.

`make drill` already works — `--include-drafts` while nothing is reviewed.

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
