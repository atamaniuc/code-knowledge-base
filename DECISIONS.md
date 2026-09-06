# DECISIONS

What was decided, why, and what was rejected. Append; do not rewrite history.

---

## 2026-09-06 — Wiki is the source of truth, questions derive from it

Questions reference wiki sections through `wiki_refs`; facts live in articles first.

**Why:** freshness is the hardest promise in the product. Maintaining ~180 articles is
tractable; maintaining 660 independent questions is not. Updating an article flags
everything derived from it.

**Rejected:** questions as standalone units with their own facts — guarantees the article
and the answer drift apart.

---

## 2026-09-06 — `reviewed` is a human-only status, enforced in CI

Agents author at `draft`. The validator rejects `reviewed` without `reviewed_at` and
`reviewed_by`.

**Why:** review is the only thing separating this product from text a chatbot generates
for free. An agent promoting its own output is self-approval and voids the premise.

**Rejected:** letting the fact-check node promote — same context, same blind spots.

---

## 2026-09-06 — DSA modelled as three entities, not as questions

`concept` (complexity foundation), `pattern` (~20 canonical), `task` (curated, linked out).

**Why:** DSA is practice, not Q&A. The teaching unit is the transition from naive to
optimal, so a task carries both approaches plus the key insight between them.

**Rejected:** building a judge. LeetCode already is one; the value is curation.

---

## 2026-09-06 — A task's optimal approach must beat naive on time, or match time with less space

Enforced by a schema refinement over ranked complexity classes.

**Why:** identical costs mean the task teaches no transition.

**Corrected during implementation:** the first rule also forbade space regressions, which
rejected Two Sum — O(n^2)/O(1) to O(n)/O(n). Trading space for time is the canonical DSA
transition, so a space regression is allowed whenever time improves. A unit test caught it.

---

## 2026-09-06 — Validation failures are written for an agent, not for a compiler

`packages/schema/src/explain.ts` maps issue paths to what / why / fix.

**Why:** "invalid schema" makes the next session guess. "Split into 3-5 bullets with
min_level, because the evaluator scores coverage per bullet" does not.

---

## 2026-09-06 — Nx is a topic in the question bank, not a tool in this repository

**Why:** a four-package workspace does not repay Nx's configuration surface.

---

## 2026-09-06 — The plan lives in the repository, not in a tool directory

`docs/plan.md`, referenced from `AGENTS.md`.

**Why:** `AGENTS.md` pointed at `~/.claude/plans/`, outside the repository. Anything not in
the repository does not exist for a cold session, and the path is specific to one machine
and one tool — so the cold-start guarantee only held by accident, on this laptop.

**Rejected:** a symlink. It would not survive a clone.

---

## 2026-09-06 — The harness owns state; CI re-runs every passing claim

`scripts/harness.ts` is the only thing that writes `state` and `evidence`.
`harness check --reverify` re-runs the verification of every item claiming to pass, and CI
runs it on every push.

**Why:** the artifacts existed but nothing enforced them. `CONSTRAINTS.md` claimed CI
enforcement while no CI existed, and item state was being edited by hand — the exact
failure the feature-list primitive is designed to prevent. Re-verification is what makes a
hand-written `passing` detectable instead of trusted.

**Proven:** an item flipped to `passing` with invented evidence passes the invariant check
and fails re-verification.

**Rejected:** trusting the evidence string. It is written by whoever edits the file.

---

## 2026-09-06 — Verification runs with stdin closed and a hard timeout

**Why:** two defects surfaced while testing the harness on itself.

`make` exports command-line variables to sub-makes, so `ARGS=--reverify` was inherited by
an item whose verification calls `make harness-check`, and the run recursed until killed.
Fixed with a `HARNESS_REVERIFY` environment guard that degrades a nested call to a plain
invariant check.

Separately, `execSync` inherited an open stdin, so a command that stops to ask a question
would block the loop forever. Verification now runs with stdin closed and a ten-minute
timeout; exceeding it is a failure with a stated cause, not a hang.

**Why it matters beyond the bug:** a loop that can hang silently has no stop condition, and
a harness without a stop condition is not a harness.

---

## 2026-09-06 — Enforcement is labelled per constraint

Each rule in `CONSTRAINTS.md` now says whether a command fails on it or whether it is
caught in review. Four of the fifteen are review-only and say so.

**Why:** claiming enforcement that does not exist is worse than claiming none — it stops
anyone from looking for the missing check.

---

## 2026-09-06 — Default branch renamed master to main

**Why:** the CI workflow triggered on `main` while the branch was `master`, so CI never ran
once. "Enforced by CI" was false for a second time, from a different cause — which is the
argument for verifying that a mechanism fired, not that it was configured.

Renamed rather than pointing the workflow at `master`: `main` is the conventional default
and the repository was four commits old, private, with no other branches or open pull
requests.

---

## 2026-09-06 — Harness components deliberately not built yet

Recorded so their absence reads as a decision rather than an oversight.

- **Throughput log (generated vs reviewed) and per-item traces.** They measure the review
  bottleneck, and there is nothing to measure until authoring starts. Build with the first
  domain.
- **Loop runner and the authoring graph** (research, author, fact-check with veto,
  generate-questions, validate). The graph exists on paper; wiring it before there is a
  single reviewed article would be building a conveyor with nothing on it.
- **Module quality grades and a scripted cleanup.** One package does not need a grading
  table. Revisit at three or four.
- **Docker or a devcontainer.** `.nvmrc` plus a committed lockfile already reproduces the
  environment, and cold start proves it from a clean clone. A container would add a build
  step and hide a class of drift rather than fix it.
- **A secret scanner.** `.gitignore` covers the obvious case; the rule stays review-only
  and `CONSTRAINTS.md` says so instead of implying a check exists.

---

## 2026-09-06 — The static site is a landing page and a checkout, nothing else

The whole product lives in the extension. The site exists because Chrome Web Store has no
built-in payments, so the checkout has to live somewhere, and because a store listing on
its own converts poorly.

**Accepted consequence:** with no content pages, SEO stops being a channel. Distribution
rests on Chrome Web Store organics and on the LeetCode overlay being shareable enough to
drive installs and reviews, which are the only ranking inputs the store has.

**Reversible:** content is already structured and decoupled from delivery, so publishing
the wiki statically later is a day of work rather than a rewrite. Kept as the fallback if
organics fall short.

---

## 2026-09-06 — Questions carry `probes` and `answer_strategy`, not just scoring bullets

Prompted by Hexlet/ru-interview-questions being offered as a realistic model for what the
content should look like. Its answers are shaped as "what they are assessing" plus "how to
answer", which the schema could not express at all.

- **`probes`** (required) — what the interviewer is actually testing. Often not the facts
  in the answer. An author who cannot state it has not understood the question well enough
  to ask it, so requiring the field is a quality gate, not bookkeeping.
- **`answer_strategy`** (optional) — how to deliver the answer out loud. Optional because a
  narrow factual question does not need it and an open or behavioural one is nearly
  useless without it.

**Why it matters commercially:** `expected_answer` bullets serve the evaluator; these two
serve the candidate. They are the difference between a reference work and interview
preparation, and they are what a chatbot does not hand you in structured, reviewable form.

**Note on the source:** the repository is AGPL-3.0, so no text from it enters `content/`.
It is a model for shape and depth only.

---

## 2026-09-06 — Soft skills added as a behavioural domain; tech becomes conditional

Behavioural questions have no technology to version, no frontend/backend track, and their
sources are books rather than RFCs. Rather than special-casing a domain name, the registry
gained `requires_tech`: the cross-file rule requires `tech` where the domain declares it
and rejects it where the domain does not, so a behavioural question that secretly depends
on a version is caught as misfiled.

Weighted toward staff and head interviews, where these rounds decide the outcome more
often than the technical ones.

---

## 2026-09-06 — The harness is trimmed to the fast path locally

The pre-commit hook now runs content validation and harness invariants only, about two
seconds. Typecheck, tests, re-verification and cold start run in CI.

**Why:** the hook was running the full suite on every commit, including documentation-only
ones. A gate that makes every commit slow gets bypassed with `--no-verify`, and a bypassed
gate enforces nothing. Enforcement belongs where waiting is free.

The queue is for items worth a session; small fixes go straight in. Ceremony that costs
more than the error it prevents is not discipline, it is overhead.

---

## 2026-09-06 — Review storage uses node:sqlite, not better-sqlite3

Node 24 ships SQLite, so there is no native module to build, nothing to approve in pnpm,
and no prebuild to mismatch. The API is still experimental, so every call to it sits
behind `ReviewStore` in one file; replacing it stays contained if it changes.

---

## 2026-09-06 — SM-2 ease is floored at 1.3

Plain SM-2 lets ease decay without limit, which drives a chronically hard item into a
daily loop that crowds out the rest of the queue. Anki's floor is the standard fix and is
applied for the same reason.

---

## 2026-09-06 — The trainer refuses unreviewed content unless asked

`--include-drafts` exists because nothing is reviewed yet in phase 0 and the point of that
phase is to prepare with what there is. It is never the default and it warns, so drilling
against an unverified answer is deliberate rather than accidental.

---

## 2026-09-06 — Human review is replaced by evidence-gated automatic promotion

The system must self-improve without a human in the loop. `human_review` is gone; content
promotes through five gates that run unsupervised: source grounding against fetched
documents, adversarial falsification by an independent model, corpus consistency, version
currency, and a held-out grounding check. Full design in `docs/autonomy.md`.

The premise that made review valuable still has to hold — that this beats what a chatbot
generates free. It now holds through grounding rather than through a person: a claim ships
because a span was located in a fetched document, not because a model found it plausible.

**What this costs:** a hard guarantee over what a human read becomes a statistical one
over everything. Errors will ship. Mitigations are demotion on dispute, usage signal,
sampling audit, and full traces — not a claim that it does not happen.

**What stays human:** the gates themselves, the editable-surface list, licence clearance,
and the decision to abandon a direction.

---

## 2026-09-06 — Locked surfaces are enforced in CI, with the limit stated

`packages/evaluator/`, `docs/autonomy.md`, `content/sources.yaml`, `.github/workflows/`
and the check itself may not be touched by a commit carrying the agent trailer.

**Why:** a loop optimises whatever signal it is given. Every documented reward hack broke
this invariant — agents removed the instrumentation their checker depended on. Constraints
stated in prompt text get optimised away, so this one is not in prompt text.

**Limit, not hidden:** this is drift detection, not a sandbox. It assumes commits pass
through CI, and a loop with push access that strips its own trailer defeats it. Closing
that gap means filesystem-level read-only paths in the run environment.

`.locked-baseline` exempts commits at or before the point enforcement was introduced,
because the commit that creates a locked path necessarily touches it. Moving that baseline
forward is expanding the editable surface, which is a human decision.

---

## 2026-09-06 — Level derivation requires the bullets a level introduces

A level is claimed only when both the cumulative set at or below it and the bullets it
introduces clear the threshold.

**Why:** with the cumulative rule alone, a light high-level bullet — two weight units out
of twenty-five in the cache-stampede question — could be skipped entirely and the ratio
would still pass. Depth would have been awarded for never demonstrating it.

---

## 2026-09-06 — Two decisions taken rather than escalated

**Vacancy source: the hh.ru public API.** Documented, free, no scraping, so the ToS
question that was blocking `vacancy-frequency-map` is closed. Adzuna's public API is the
fallback for geography hh.ru does not cover.

**Calibration: senior, with staff as the secondary target.** `min_level` on bullets is set
against a senior bar, with staff bullets marking what distinguishes the level above. Head
appears only where a question genuinely has a head-level answer, as in the soft-skills seed.

---

## 2026-09-06 — The wedge is AI-in-production interview prep

The revenue goal is roughly $2,000 a year — about a hundred sales at $20-25. That target
argues against breadth: a hundred buyers come from one thing done better than anyone else,
not from covering sixteen domains adequately.

`agentic` is that thing, and the market data rather than taste says so. LLM appears 41
times across 173 stack-scoped postings, fourth by weight behind frontend, infra and
backend. Meanwhile structured preparation for it barely exists: the free repositories
predate it, and the paid courses teach building with LLMs rather than being interviewed
about them.

It is also the one domain where being first is possible. Nobody has authority on React
interview questions; the field is thirty years old and saturated. Nobody has authority on
"how do you evaluate a RAG pipeline in an interview" yet.

**What changes:** `agentic` gets depth well past its 7.2% weight — that weight measures
how often it is asked, not how badly it is served. Everything else gets enough coverage to
be credible for a full interview loop, which is what the user needs personally anyway.

**What this does not change:** the other domains still get written. A product that only
covers AI questions is not an interview-prep product, and the user needs the breadth for
his own loops.

---

## 2026-09-06 — Definition of Ready and Done are rules, not an agreement

`docs/definition-of-done.md` states both; `packages/harness/src/readiness.ts` enforces the
decidable parts. Ready is checked when an item is started, Done when it is closed.

**Why enforce Ready at all:** the expensive failure is starting work whose success cannot
be decided, because that is only discovered at the end, when the work is done and
unfalsifiable. The check that earns its keep is the outcome-versus-activity one — "add
validation" is complete when you stop typing, and an item phrased that way cannot be
closed honestly.

**Deliberately excluded:** coverage thresholds, which measure lines executed rather than
behaviour verified; per-item human review, removed by the autonomy design; and estimates,
since work in progress is capped at one item and duration is information rather than a
commitment.

