---
slug: talking-about-a-decision-that-failed
title: Talking about a decision that failed
lang: en
domain: softskills
topic: ownership
levels: [middle, senior, staff, head]
summary: >-
  Asked in almost every senior-and-above loop. The interviewer is not collecting
  failures, they are testing whether you can hold responsibility and extract a
  transferable lesson without either deflecting or performing guilt.
prerequisites: []
related: []
sources:
  - title: "Site Reliability Engineering — Postmortem Culture: Learning from Failure"
    url: https://sre.google/sre-book/postmortem-culture/
    kind: book
  - title: "Blameless PostMortems and a Just Culture — Etsy Code as Craft"
    url: https://www.etsy.com/codeascraft/blameless-postmortems/
    kind: article
review_status: draft
---

## What is actually being tested

Three things, in this order.

**Whether you own a real decision.** Not a bug you fixed, not something a manager
imposed on you. A choice you made, with authority to make it, that turned out to be
wrong. Candidates who cannot produce one are usually protecting themselves, and the
interviewer reads it that way.

**Whether the lesson transfers.** "I learned to test more" is not a lesson, it is a
platitude. "I learned that a migration without a reversible step is a decision to
accept downtime, so I now ask what the rollback looks like before I ask what the
schema looks like" is a lesson, because it changes what you do next time.

**Whether you can be blameless about yourself.** The postmortem literature makes the
point about systems: a culture that punishes individuals gets fewer reports, not
fewer failures. The same applies to how you narrate your own mistake. Excessive
self-flagellation reads as poor judgement about severity, exactly like deflection
does — both suggest you cannot assess impact accurately.

## Structure that works

State the decision and the context that made it reasonable at the time. This matters:
a decision that was obviously wrong when you made it is a story about carelessness,
not about judgement.

Say what went wrong and how you found out. How you found out is informative — from a
user, from an alert, from a colleague — because it says something about the feedback
loops you had built.

Say what it cost, in terms the interviewer can size: hours of downtime, a delayed
launch, a quarter of engineering time. Vagueness here reads as never having measured it.

Say what you changed. Not "I was more careful" — a mechanism. A check that now runs, a
step added to a review, a default changed.

Keep the whole thing under two minutes. Length is itself a signal: a candidate who
needs six minutes has not thought about the story, only lived it.

## How the answer changes with seniority

At **senior** level a technical decision is enough: an architecture that did not
survive contact with load, a dependency chosen for the wrong reason.

At **staff** and above, a purely technical failure is a weak answer. The expectation
is a decision that affected other people — a direction you set for a team, a
standard you pushed that turned out to be wrong for half the codebase, a hire or a
reorganisation. The fix is expected to be systemic rather than personal: something
about how decisions of that kind get made, not about how you personally now behave.

At **head of development** level the strongest version involves a decision you had
to reverse publicly, because reversing your own stated direction in front of the
people who followed it is the actual skill being probed.

## Common failure modes

The humblebrag — "I cared too much about quality and shipped late". Interviewers
have heard it, and it converts the question into a test of self-awareness that you
have just failed.

The trivial failure, sized so small that nothing was at stake. It answers the letter
of the question and signals that you are unwilling to answer the substance.

The shared failure, where the story quietly becomes about what the team did. If the
pronouns drift from "I" to "we" as the story approaches the mistake, that drift is
noticed.
