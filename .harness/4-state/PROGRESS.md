# PROGRESS

State carried between sessions. Read this first; update it before you stop.

## Now

**Phase 0, writing the wedge domain.** `agentic` is the differentiator: LLM appears 41
times across 173 stack-scoped postings, and structured preparation for it barely exists.

- Content: **100 articles, 115 questions**, 3 DSA entities, all `review_status: draft`
  (the gates promote; nobody writes a promoted status by hand). The bank now covers the
  posting's whole stack rather than one wedge: Node runtime and NestJS 12 and Hono,
  Kubernetes/Helm/AWS/Docker/CI, PostgreSQL 18/Redis 8/Kafka 4, gRPC/GraphQL/REST, SRE-grade
  observability, architecture and resiliency, agentic systems including MCP 2026-07-28 and
  skills, a fintech domain (ledgers, idempotency, reconciliation, payments, KYC vocabulary)
  and staff-level behaviour. Version facts for October 2026 are in
  `.pipeline/fact-sheet-2026-10.md` with the command that produced each one.
- The harness is [Harnessimo](https://github.com/atamaniuc/Harnessimo), a dependency rather
  than scripts kept here; `.harness/` holds this project's own rules, state and feedback map,
  and `harnessimo.config.json` says which checks are enforced (`make harness-doctor` prints
  it).
- `make check`: passing (26 files, 249 tests, 4 skipped without a plan; content valid; every
  harness gate). The validator now reports an unparseable file instead of dying on it, with
  the line and the fix — one bad file used to hide the state of the whole tree.
- `make prep ARGS="<job-url> [--out=<file>]"` turns a posting into a rehearsal plan:
  requirement emphasis from the closed gazetteer, the band to rehearse, a ranked core plan,
  stretch domains the posting omits, and the gaps that are the authoring backlog. The posting
  is always an argument; no URL is stored in the repository.
- Extension: `make extension ARGS="--include-drafts --plan=<file>"`, then load
  `apps/extension/dist` unpacked. Bundle **schema 2** (`docs/extension-bundle.md`) ships the
  whole bank — questions, the wiki they cite, the domain registry — plus the plan for one
  posting. The panel is a keyboard-first tool: Drill (two-stage, graded, stats and streak),
  Bank (filters, search, show answer, drill this), Posting (emphasis, ordered plan, gaps) and a
  wiki reader, light and dark.
- The panel now also: keeps its text size between openings (A- / A+ or - / +, five steps in
  `prefs.ts`), restores the session it was hidden on (view, question, committed answer,
  filters, expanded card, open article, scroll), navigates back and forward over those places
  (`history.ts`, alt-arrows), goes fullscreen or falls back to a panel tab, and translates a
  selection through a small popup at the cursor.
- **Translate is the only thing that leaves the device.** It is isolated in `translate.ts`
  with both free Google endpoints (clients5 first; the gtx one answers 429 under load) and the
  manifest grants exactly those two origins — `make check` asserts the permission list, that
  no other remote host appears in the built `panel.js`, and that the bundle read is still the
  only literal `fetch`. Verified end to end in Chrome: a selected phrase came back in Cyrillic.
- The toolbar icon is real PNGs, drawn by `make icons` (`scripts/make-icons.ts`): a blue
  rounded square with IP, so the art is reproducible and the bytes we ship are in the repo.
- pnpm pin is 12.11.2: pnpm 11 publishes no `darwin-x64` engine binary, so `make setup` failed
  on Intel macOS before any install ran.
- Blockers: none. Nothing is waiting on a human. The whole bank is draft and unreviewed —
  `.harness/1-instructions/CONSTRAINTS.md` #1 still stands, and `--include-drafts` is how a
  session reaches it.


## Done

- `init-workspace` — pnpm workspace on Node 24, `make check` as the single gate
- `init-schema` — Zod schemas for wiki, questions, DSA concepts/patterns/tasks
- `init-validator` — cross-file rules with proven negative tests
- `init-agent-errors` — validation failures reported as what / why / fix
- `init-harness-contract` — cold start scripted and passing from a fresh clone
- `harness-enforcement` — harness owns state transitions; CI re-verifies every passing claim
- `drill-sm2` — SM-2 scheduling, review store on node:sqlite, selection, interactive session
- `evaluator-golden-set` — coverage to level, golden set true by construction
- `vacancy-frequency-map` — live postings from Jobicy and Arbeitnow, weights written to domains.yaml

## Next

1. `verifier-source-grounding` — the gate that replaces human fact-checking and removes
   `--include-drafts` from the daily loop.
2. More `agentic`: fine-tuning versus RAG versus prompting, agent memory across sessions,
   hallucination and grounding.
3. Extension follow-ups: search over the wiki, the LeetCode overlay, vacancy capture.



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

_Last updated: 2026-10-13_
