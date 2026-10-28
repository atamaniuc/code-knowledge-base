# Content schema

Why the entities are shaped the way they are. The authoritative definitions are the Zod
schemas in `packages/schema/src/`; this explains the reasoning behind them.

## Wiki article

`content/wiki/{domain}/{slug}.md` — YAML frontmatter plus a Markdown body.

The wiki is the source of truth for facts. Questions are derived from it and point back
at it, so an article update propagates to everything built on it.

- `tech.version_range` is a field, not prose. Versions are the part of an answer that goes
  stale, and a field can be queried, filtered and flagged; a sentence cannot.
- `prerequisites` forms the learning-order graph. It is what turns a weakness map into a
  study plan, so a dangling entry is a validation error rather than a warning.
- `sources` requires at least one entry. A claim with no official source cannot be
  re-verified when the version moves.
- Body sections use `##` headings because headings are the chunk boundary for retrieval
  and the anchor target for `wiki_refs`. Write sections that stand alone.

## Question

`content/questions/{domain}/{slug}.yaml`.

- `probes` states what the interviewer is actually assessing, and it is required. This is
  frequently not the facts in the answer: an opening question may be probing whether the
  choice of career was deliberate, a design question whether trade-offs get named at all.
  An author who cannot say what is being tested has not understood the question well
  enough to ask it.
- `expected_answer` is an array of bullets, each with `weight` and `min_level`, minimum
  two. This is the single most important shape in the schema: the evaluator scores
  coverage per bullet and derives a level from which bullets were hit. A prose answer
  cannot be scored reproducibly, and one bullet cannot separate middle from senior.
- `answer_strategy` is coaching on delivery — the order to say things in, what to open
  with, what to keep short. Optional, because a narrow factual question does not need it;
  an open or behavioural one is nearly useless without it. This is the field that makes
  the difference between a reference work and interview preparation, and it is what a
  chatbot does not hand you in structured, reviewable form.
- `wiki_refs` points at an article and a heading anchor. When a bullet is missed, the
  evaluator cites that section — feedback becomes "read this", not "you were wrong".
- `related_questions` carries the cross-domain links that `system-design` scenarios walk.
  Those links are what distinguishes a staff answer from a senior one.
- `follow_ups` are the starred questions: what an interviewer asks after a correct answer.
- `provenance` is present only on imported items and is checked against the license
  registry.

## Interview brief

`content/interview/{slug}.yaml` — one file per target: a posting, its take-home, the
interview that follows.

- A brief is **not** a bank question. The bank answers "do you know this topic"; a brief
  answers "will they ask this, and what are they listening for". That is why it carries a
  `target` (role, company, domain, stack) and `stages` rather than a domain and levels.
- `groups[].side` is `technical` or `domain` — the technology you have to defend, and the
  business you have to understand. One axis, because a candidate rehearses them differently.
- `likelihood` has two rungs, not five. A five-point probability is a number an author
  invents; the only ordering decision that matters is what to answer before there is time
  for the rest.
- `asks` is the same idea as `probes` on a question: an author who cannot say what the
  interviewer is checking cannot say how to prepare for it.
- `answer` is an ordered list of spoken points, minimum two. One bullet is a fact to
  recognise, and recognition is exactly what the interview does not test.
- `groups[].wiki_refs` points at the articles to reread when an answer will not come out.
  They resolve against the wiki like any other reference, so the brief is never the only
  place a fact lives.
- Every Russian term travels with its English equivalent in parentheses — `резерв
  (reservation)`, `частичное погашение (partial repayment)`, `уровень изоляции (isolation
  level)`. The interview is in English, so the wording is part of what is being rehearsed:
  knowing the mechanism in Russian and not being able to name it in English is the same as
  not knowing it. A gloss is introduced once per answer and never inside a parenthetical or a
  quoted reason code, because those are the author's text talking to itself.
- `tags` is the second axis: groups say *where in the interview* a question sits, tags say
  *what it is about*. Idempotency is spread across six groups, and rehearsing it means
  collecting those answers rather than re-reading the assignment section around each one. The
  vocabulary is **closed** (`INTERVIEW_TAG_IDS`) for the same reason as the technology
  gazetteer — an open vocabulary grows a near-duplicate per author, and a filter that misses
  answers "nothing here" with confidence. Every question carries at least one tag, and the
  titles live next to the ids so a new tag cannot exist without the word to draw.
- Question ids are **global keys**, not labels: the panel expands a question by id and the
  history stack remembers it, so a duplicate anywhere in `content/interview/` is a
  validation error rather than a cosmetic repeat.

## DSA

Three entities, because DSA is practice rather than Q&A.

**`concept`** — the complexity foundation, studied first. `recognition_rules` maps a code
shape to the complexity it implies, which is the trainable half: reading O(n^2) off a
`includes()` call inside a loop is a skill, the definition of Big O is not.

**`pattern`** — one of ~20. `recognition_cues` describes what in a problem statement
should make you reach for it. Recognition is what is actually tested under time pressure.

**`task`** — a curated problem linked out to LeetCode. Both `naive_approach` and
`optimal_approach` are required, plus the `key_insight` between them, because **the
transition is the teaching unit**. An interviewer expects to hear "here is the O(n^2)
brute force, now I speed it up to O(n) like this" — a bare optimal solution does not
rehearse that.

`naive_approach.breaks_at` must name the input size where it fails and the work that
repeats. "It is slow" teaches nothing.

A schema refinement enforces that the optimal approach beats naive on time, or matches
time with less space. Trading space for time is allowed — that is the canonical
transition. Identical costs are not: the task would teach no transition.

## Registries

- `domains.yaml` — the domain tree. `market_weight` is recomputed from the vacancy
  frequency map and decides depth per domain; `target_questions` is a provisional guess
  until then.
- `sources.yaml` — external sources and licenses. **Human-edited only.** A source without
  `commercial_ok` poisons content in a product that is meant to be sold, and CI refuses
  any item whose provenance points at one.
- `tech-aliases.yaml` — the gazetteer for vacancy parsing: canonical technology to
  aliases, including Cyrillic transliterations. A closed vocabulary beats a small model
  here — deterministic, instant, and it never invents a technology absent from the posting.

## Review status

`imported` → `draft` → `reviewed` → `verified`.

Only `reviewed` and above reach a trainer session or a public surface. `reviewed` requires
`reviewed_at` and `reviewed_by`; an unattributed review is indistinguishable from
self-approval and is rejected by the validator.
