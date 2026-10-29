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

**Why:** the artifacts existed but nothing enforced them. `.harness/1-instructions/CONSTRAINTS.md` claimed CI
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

Each rule in `.harness/1-instructions/CONSTRAINTS.md` now says whether a command fails on it or whether it is
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
  and `.harness/1-instructions/CONSTRAINTS.md` says so instead of implying a check exists.

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
currency, and a held-out grounding check. Full design in `.harness/1-instructions/autonomy.md`.

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

`packages/evaluator/`, `.harness/1-instructions/autonomy.md`, `content/sources.yaml`, `.github/workflows/`
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

`.harness/1-instructions/definition-of-done.md` states both; `packages/harness/src/readiness.ts` enforces the
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

---

## 2026-09-06 — Harness artifacts consolidated into .harness/ by subsystem

Five folders matching the five parts of a harness: instructions, tools, environment, state,
feedback. Each carries a README written for someone with no context, using the kitchen
comparison the source material uses because it is genuinely the clearest way in.

**Why not everything:** `AGENTS.md` and `Makefile` stay in the project root. Every agent
tool looks for `AGENTS.md` there, and moving it would trade discoverability for tidiness.
`AGENTS.md` routes to `.harness/README.md` instead.

**Why this is worth the churn:** the harness was correct and scattered — rules in one file,
the queue in another, enforcement in a third, and nothing explaining how they relate. A
newcomer had to reconstruct the design from artifacts. Now the folder structure states it.

Cold start re-run after the move and passes, which is the check that matters here: if the
reorganisation had broken a path, a fresh clone would stop working.

---

## 2026-09-06 — The grounding gate asks a model to quote, not to judge

`packages/verifier` implements G1. Claims are extracted deterministically, sources are
fetched and cached, and a model is asked to locate a supporting passage and copy it. The
quote is then checked against the fetched text.

**Why quote rather than judge:** "is this claim correct" invites the model to answer from
memory, which is the exact failure the gate exists to prevent. "Find me the sentence that
says this" cannot be satisfied from memory, and the answer is checkable.

**Why the quote is re-checked:** without that step the gate accepts a fabricated span,
which is the same failure one level up. A grounder that invents a quote now fails.

**Why claim extraction is deterministic:** letting a model decide which sentences are
claims puts model judgement upstream of the check meant to constrain it, and the failure
would be silent — a claim dropped from the list passes by never being examined.

**Why every claim must ground, with no percentage threshold:** the claims that fail to
ground are the ones most likely to be wrong, so a threshold ships exactly the wrong ones.

**Sources are cached** because a verdict has to be re-checkable against the text that was
actually read. A source that changes between the check and the audit would make an honest
verdict look wrong and a dishonest one look fine.

**Fails closed everywhere:** unparseable reply, missing source index, dead link. A gate
that errors open is not a gate.

---

## 2026-09-07 — The harness is a dependency, not scripts kept in this repository

`harness.ts`, `locked-surfaces.sh`, `cold-start.sh` and `packages/harness` are deleted.
Their rules live in [Harnessimo](https://github.com/atamaniuc/Harnessimo), installed as a
dev dependency and configured in `harnessimo.config.json`.

**Why:** a copied check is a fork the day after it is copied, and this repository has
already paid for that once — the `.harness/` reorganisation moved `cold-start.sh` and left
the queue item verifying it pointing at the old path, so CI was red on every push until
someone read the log. One implementation with one set of tests removes that failure mode.

**What this repository gains, having had none of it:** proof markers tying every claim in
`AGENTS.md` to a real command, an index of live work tracks with handoffs, a gate on ticked
task boxes, a clean-state check, and a limit on the instruction file's length.

**What was checked before deleting anything:** the shared implementation was run against
this repository and reproduced what the local scripts enforced. Adoption never trades a
check away; where the shared one could not express something, the repository would have
kept its own.

**Consequence, accepted:** the twelve `readiness` unit tests here are gone, because the
rules they covered are tested in Harnessimo instead. The count in this repository drops;
the coverage does not.

---

## 2026-10-13 — The bank ships in the extension, and a posting is an argument

The bundle grew from a question list to the whole product: every question the gates allow,
the wiki articles they cite, the domain registry, and — when one was parsed — the rehearsal
plan for a single posting. `docs/extension-bundle.md` is the contract. The posting URL is
passed to `make prep` and then to `make extension --plan=`; no URL is stored in the
repository, because a repository that stores one becomes about that posting.

**Why the wiki ships rather than links.** A question's feedback cites a section: "read
this". A citation that needs the network contradicts the offline promise the extension
makes, and a side panel that cannot answer the follow-up is not a study tool.

**Why the plan carries identities, not questions.** A copy of a question inside a plan
drifts from the bank the first time either is edited, and the drift is invisible — the drill
still runs, on a question that is no longer the one reviewed. The bundler instead resolves
every plan entry against the questions that shipped and drops what does not resolve, with a
warning, so an empty plan session cannot be silently authored.

**Why drafts are remapped at bundle time.** `review_status: draft` is correct in the
repository and fatal in the panel: the shared selector refuses a session on unpromoted
content, so the first shipped bundle rendered "Nothing due" over ten questions. `--include-drafts`
now means the same thing on both surfaces, and the empty states say which of the three ways
the bank ran dry.


---

## 2026-10-13 — The panel's text scale belongs to the root, and its fullscreen is a window

Two defects that came back from using the panel, both of the same kind: a test exercised the
code path but not the environment the code runs in.

**Text size.** `--font-size` was set on `body`, and every rule that stated its own size in
`px` kept it — the chips, the probes box and the wiki body did not move when A+ was pressed.
The root now carries the variable and every rule states its size in `rem`. `panel-css.test.ts`
fails on a `px` font-size and fails on a body that does not inherit `1rem`; it was shown
failing before it was trusted.

**Fullscreen.** From a side panel `requestFullscreen()` returns a promise that never settles —
no `fullscreenchange`, no `fullscreenerror`, nothing on screen (Chrome 155) — so `await`ing
it made the button dead in the panel while it worked in a tab, which is how the first version
was "verified". `fullscreen.ts` decides from the context instead: a side panel has no
`chrome.tabs.getCurrent()`, so it opens the panel in a popup window and puts that window into
fullscreen (`windows.create` ignores `state: "fullscreen"`, so it takes a second call), and a
second press focuses the window already open rather than opening another.

**Why it matters beyond the two bugs:** "verified in Chrome" was true and useless — the
difference between a side panel and a tab is the whole feature. Reproduce in the surface the
user has, and assert the invariant rather than the intent.

---

## 2026-10-29 — A saved posting ships its plan, and one domain cannot fill the plan

**The Posting tab was empty by default.** A plan only existed when somebody happened to run
`make prep` against a URL, so the tab explained itself rather than the vacancy — the one
surface whose whole purpose is "this is the job you are preparing for" needed a command run
first. A posting saved to `content/postings/<slug>.md` now carries its plan beside it and the
bundler bakes that plan with no flag. Two plans is an ambiguity it refuses rather than
resolves by date: a Posting tab describing the wrong vacancy is worse than a build that stops.

**Why a file and not a stored URL.** A URL expires, changes behind you, and puts the network in
the middle of a rebuild — the repository's promise everywhere else is that content rebuilds
offline. The saved posting is the same bytes the plan was derived from, and `make prep` reads
it directly. A plan built from a URL still ships that URL; a saved posting records none, and the
panel renders the field as text rather than a link.

**Why the core plan has a per-domain cap.** Ranking alone made a posting that names Kubernetes
once hand back a cluster drill: every Kubernetes question inherited "infra is a stated
requirement", and the role's own core fell under the limit. Four per domain keeps the plan
spanning the posting. The cap is a ceiling, not a quota — three of 24 slots went unused in the
generated plan before review, which is the honest shape of a small bank.

**Known limit, left alone deliberately.** The gazetteer maps TypeScript and JavaScript to
`frontend` (`content/tech-aliases.yaml`), a domain the bank has not written yet, so this
posting's Gaps card names them as uncovered although `backend-node` has 13 questions in the
same language. Moving a language into a domain is a vocabulary decision that changes what every
posting reports; it belongs to a human, not to this session.


---

## 2026-10-29 — vitest 5, and the extension's tests become their own TypeScript project

**What the bump exposed.** Dependabot opened #1 as `@vitest/mocker 3.2.7 → 5.0.3` but the diff
is `vitest ^3.2.4 → ^5.0.3` — two majors of the runner — and both CI jobs died at
`tsc --noEmit` before a single test ran. The cause is not the runner's API: vitest 3's own
`dist/index.d.ts` carried a reference to `@types/node`, so the extension's test files got node
types for free. vitest 5 does not, and `apps/extension/tsconfig.json` had `types: []` on
purpose — it exists so `src` cannot reach `process`, `Buffer` or `node:fs` in a document that
runs in a side panel. The tests, which read the built `dist/` from disk, were only ever
typechecked by accident.

**The shape now.** `apps/extension/tsconfig.json` covers `src` only and keeps `types: []`;
`apps/extension/tsconfig.test.json` extends it, includes `test`, and adds `node`. `pnpm run lint`
runs both, so the two invariants are checked separately: a bogus type error in a test file and
a `process` reference in `src` were each shown failing before the split was trusted.

**Why the bump landed on main instead of merging #1.** The branch is 19 commits behind and its
lockfile is three weeks old; merging it would put a major upgrade of the test runner in as an
automated diff with no commit message that says why the config moved. The upgrade and the
reason it needed code changes are one commit on main, and #1 is closed as superseded with a
pointer to it. The dependabot config stays honest either way: it will not reopen a range that
is already satisfied.

**Numbers.** 319 tests pass on vitest 5.0.5, and the suite got faster rather than slower —
6.5 s to 3.8 s locally, because the runner spawns one worker per file with less startup.

