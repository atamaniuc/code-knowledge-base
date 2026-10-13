---
slug: influencing-saying-no-and-migration
title: Saying no, influencing without authority, and driving a migration
lang: en
domain: softskills
topic: leadership
levels: [senior, staff, head]
summary: >-
  Three situations where nothing in the job description gives you the authority: refusing a
  roadmap item, changing minds you do not manage, and removing something other teams still
  depend on. The technique is the same in all three — evidence, a named cost, and a path
  that respects the other party's constraints.
prerequisites: []
related: [talking-about-a-decision-that-failed, mentoring-and-code-review]
sources:
  - title: "Software Engineering at Google — Deprecation"
    url: https://abseil.io/resources/swe-book/html/ch15.html
    kind: book
  - title: "Google — How to do a code review"
    url: https://google.github.io/eng-practices/review/reviewer/
    kind: official-docs
review_status: draft
---

## The problem without authority

Influence without authority is the working condition of a staff engineer. You own outcomes
that depend on people who do not report to you, and the currency is credibility: being
right often enough, saying so with evidence, and making it cheap for people to agree with
you.

The interview question is usually phrased as a story request, and what is being scored is
whether you treat the other party as a rational actor with constraints rather than as an
obstacle. A candidate whose influence technique is escalation has described a failure of
influence and called it process.

## Saying no with evidence

No is a decision with a cost, and it is only defensible when the cost is named. The strong
structure for refusing a roadmap item is: here is what you are asking for, here is what it
would take, here is what would not get done instead, and here is the smallest version that
delivers the outcome you actually want.

Bring numbers to the parts that can be counted — the engineering weeks, the opportunity
cost measured in the things that get deferred, the operational burden of a new surface, the
incidents in the last quarter traceable to this area. Bring evidence for the diagnosis: a
measured error budget burn, a support ticket trend, a rate of change failures.

Then offer the alternative. A refusal that leaves the requester with nothing is a refusal
that will be overruled by the next escalation, and often should be. The staff move is to
separate the goal from the proposed solution: the goal is usually legitimate, and the
solution is often one of several.

There is also the case where you turn out to be wrong. Saying yes after the evidence
changes, visibly and without loss of face, is what makes the earlier no credible. Influence
is a repeated game.

## Driving a migration across teams

Migration is where influence meets engineering discipline. The lesson from deprecation
practice inside a large codebase is that removing a system is a project in its own right,
and that poorly executed deprecation can cost more than tolerating the old system.

The moves that make it succeed are mostly unglamorous. Find the users before you announce
the plan, by instrumenting the old surface rather than asking who uses it — nobody knows.
Provide a migration path, not a deadline: a compatible layer, a codemod, a documented
before-and-after, and support for the teams doing the work.

Make the cost visible and falling. A dashboard that shows remaining callers, with team
ownership, gives every stakeholder the same facts and creates gentle peer pressure without
escalation. Publish the timeline and the exceptions process, because a migration with no
exception path produces adversaries, while one with an owned, time-boxed exception process
produces allies.

Finish it. The most common failure is the long tail: 95 percent migrated, the last five
percent running for years and keeping the old system alive. Deleting the old code is the
outcome that matters, and it should be on the plan from day one, with a named owner and a
date.

## What a staff answer adds

Treating a negotiation as a search for the other party's real constraint, and asking about
it rather than assuming it. Writing the decision down — a short document with the options,
the trade-offs and the recommendation — because asynchronous influence scales and hallway
influence does not. Building a coalition before the meeting where the decision is made, so
the meeting ratifies rather than debates. And accepting that some noes are not winning, in
which case the professional move is to disagree, commit, and make the chosen path work
while keeping the evidence that will inform the next decision.
