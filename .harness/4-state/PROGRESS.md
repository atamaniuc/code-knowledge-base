# PROGRESS

State carried between sessions. Read this first; update it before you stop.

## Now

**Phase 0, writing the wedge domain.** `agentic` is the differentiator: LLM appears 41
times across 173 stack-scoped postings, and structured preparation for it barely exists.

- Content: 9 articles, 10 questions, 3 DSA entities. Target 691 questions.
- Harness lives in `.harness/`, five folders by subsystem, each with a plain-language README.
- `agentic` covers evaluation, injection, judging, cost and latency, loop design,
  long context versus retrieval, and structured output.
- `make check`: passing (84 tests, content valid). CI green.
- `make drill ARGS="--include-drafts"` and the Chrome extension both work today.
- Extension: `make extension ARGS="--include-drafts"`, then load `apps/extension/dist` unpacked.
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

_Last updated: 2026-09-06_
