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

