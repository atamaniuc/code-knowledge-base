---
slug: mentoring-and-code-review
title: Mentoring and code review as standard-setting
lang: en
domain: softskills
topic: leadership
levels: [senior, staff, head]
summary: >-
  Review is the most frequent teaching act in an engineering team, and the standard it
  enforces is the standard the team will have. The staff question is whether you review to
  fix this change or to make the next change better without you.
prerequisites: []
related: [talking-about-a-decision-that-failed, influencing-saying-no-and-migration]
sources:
  - title: "Google — How to do a code review"
    url: https://google.github.io/eng-practices/review/reviewer/
    kind: official-docs
review_status: draft
---

## Two different jobs

Reviewing a change and developing a person look like the same activity and are not. The
first asks whether this change is correct, safe and maintainable. The second asks what the
author will do differently next time. A review that only does the first produces clean code
and a team that needs you on every pull request.

Interviews for senior roles probe the second, because the first is table stakes. A candidate
who can only describe finding bugs is describing a linter with opinions.

## Review as standard-setting

The standard a reviewer enforces, consistently, becomes the team's standard. That makes
review a leadership instrument, and it comes with obligations: apply the same bar to
everyone including the most senior engineer, and write the reason for a comment rather than
only the demand. A comment that says this is wrong teaches nothing; a comment that says why
it is wrong teaches a rule that transfers.

Consistency matters more than strictness. A team that alternates between rubber-stamping
and blocking on style loses trust in the process, and the predictable failure follows:
authors route around review.

The standard should be about substance — correctness, security, data handling, tests,
operability, the size of the change — and the mechanical parts should be automated so that
review time is spent on things a machine cannot judge. A reviewer arguing about formatting
in the comments when a formatter exists is spending the team's most expensive attention on
the cheapest decision.

## Feedback that lands

Three habits make feedback land, and they are what a behavioural interviewer listens for.

Separate the person from the change. The subject of the sentence is the code, not the
author.

Distinguish blocking from non-blocking. Say which comments must be addressed and which are
opinions, or the author will guess and guess wrong. A short note that something is a
preference prevents a rewrite that was never required.

Ask a question when you are not sure. A reviewer who writes a question invites an
explanation and often learns that they were missing context; a reviewer who writes an
accusation gets defensiveness instead.

And give the reasoning about priority: a change that is correct but could be cleaner is
usually worth merging and improving later, while a change with a security hole or no tests
is not. The judgement about which is which is the senior skill.

## Growing people, not fixing code

A mentor's output is a person who needs less help. That means calibrating the level of
abstraction of feedback to the person: a junior author may need the pattern named and an
example, while a senior author needs the boundary case and the trade-off.

It also means letting people own the outcome. Reviewing every line of someone's work before
it ships is not mentoring, it is doing their job more slowly. The stronger move is to agree
on the design first, then review the implementation against it.

And it means tracking whether the same feedback recurs. If a person makes the same mistake
for the third time, the problem is not that they need the comment again; it is that the
lesson has not been made concrete — a checklist, a test, an example in the codebase.

## The uncomfortable conversations

The behavioural questions usually arrive here: telling someone their work is not at the
level, managing a strong engineer whose collaboration is poor, disagreeing with a peer.
The strong structure is the same: the specific observation, its impact, what you want
instead, and the commitment to follow up. Vagueness is unkind, because it leaves the person
unable to change.

## What a staff answer adds

A system rather than personal effort: written standards, an onboarding path, review
rotation so that knowledge is not concentrated, and a way for the team to improve its own
review practice. A distinction between coaching and gatekeeping, and the awareness that
being the only reviewer is a bus factor problem, not a quality guarantee. And evidence that
the mentoring worked — someone you reviewed who later caught an issue you missed, or a
standard that persisted after you moved to another team.
