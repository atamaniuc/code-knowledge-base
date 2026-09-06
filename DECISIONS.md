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
