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

