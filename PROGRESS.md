# PROGRESS

State carried between sessions. Read this first; update it before you stop.

## Now

**Phase 0.0 is complete.** Its gate — cold start — was verified by cloning the repository
into an empty directory and running `make setup && make check` with no verbal explanation.

- `make check`: passing (tsc clean, 24 tests, content valid)
- Blockers: `vacancy-frequency-map` is blocked on a human decision, see below

## Done

- `init-workspace` — pnpm workspace on Node 24, `make check` as the single gate
- `init-schema` — Zod schemas for wiki, questions, DSA concepts/patterns/tasks
- `init-validator` — cross-file rules with proven negative tests
- `init-agent-errors` — validation failures reported as what / why / fix
- `init-harness-contract` — AGENTS.md, CONSTRAINTS.md, feature_list.json, cold start verified

## Next

1. `vacancy-frequency-map` — must run before any bulk authoring; it sets depth per domain.
   Blocked until a ToS-clear source is chosen. Prefer official APIs, RSS or manual export
   over scraping: this is a commercial product, so the legal footing has to hold.
2. `rag-fts-backend` — chunk the wiki by heading, SQLite FTS5 with domain and topic filters.
3. `drill-sm2` — the trainer loop, so the content can be used while the rest is built.

`rag-fts-backend` and `drill-sm2` are not blocked and can start immediately; the frequency
map only gates *which domains get authored first*, not the machinery.

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
