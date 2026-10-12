# PROGRESS

State carried between sessions. Read this first; update it before you stop.

## Now

**Phase 0, writing the wedge domain.** `agentic` is the differentiator: LLM appears 41
times across 173 stack-scoped postings, and structured preparation for it barely exists.

- Content: 16 articles, 19 questions, 3 DSA entities. Target 691 questions. The nine new
  questions and seven new articles came from the posting pipeline below, all at
  `review_status: draft`: NestJS service boundaries, microservice boundaries, API contract
  evolution, outbox/idempotency/saga, a PostgreSQL ledger, MCP tool integration, agent
  skills — plus questions for each.
- The harness is [Harnessimo](https://github.com/atamaniuc/Harnessimo), a dependency rather
  than scripts kept here; `.harness/` holds this project's own rules, state and feedback map,
  and `harnessimo.config.json` says which checks are enforced (`make harness-doctor` prints
  it). New here as of this session: proof markers, work tracks with handoffs, the task gate,
  a clean-state check and a limit on AGENTS.md's length.
- `agentic` covers evaluation, injection, judging, cost and latency, loop design,
  long context versus retrieval, and structured output.
- `make check`: passing (120 tests, content valid, every harness gate). CI green.
- `make prep ARGS="<job-url>"` turns a posting into a rehearsal plan: requirement emphasis
  from the gazetteer, a ranked core plan, stretch domains the posting omits, and the gaps
  that are the authoring backlog. Verified against
  `https://itentio.com/job/senior-node-js-engineer/`.
- Extension: `make extension ARGS="--include-drafts"`, then load `apps/extension/dist`
  unpacked. The panel now drills: the bundle carries `review_status` (the shared selector
  starts a session only from promoted content, so a bundle without it rendered an empty panel
  however many questions it held), and the empty states match the CLI's.
- pnpm pin moved to 12.11.2: pnpm 11 publishes no `darwin-x64` engine binary, so `make setup`
  failed on Intel macOS before any install ran.
- Blockers: none. Nothing is waiting on a human.


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

_Last updated: 2026-10-12_
