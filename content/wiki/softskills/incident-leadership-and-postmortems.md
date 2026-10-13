---
slug: incident-leadership-and-postmortems
title: Leading an incident and writing the postmortem
lang: en
domain: softskills
topic: leadership
levels: [senior, staff, head]
summary: >-
  The interview is not asking what you fixed. It is asking whether you can take command of
  an ambiguous situation, keep other people effective, and turn the event into a change that
  makes the next one smaller.
prerequisites: []
related: [talking-about-a-decision-that-failed]
sources:
  - title: "Site Reliability Engineering — Managing Incidents"
    url: https://sre.google/sre-book/managing-incidents/
    kind: book
  - title: "Site Reliability Engineering — Postmortem Culture: Learning from Failure"
    url: https://sre.google/sre-book/postmortem-culture/
    kind: book
review_status: draft
---

## What the interviewer is testing

Not heroics. They are testing whether you can hold a structure in your head while the
situation is still moving: separate the roles, keep a timeline, communicate on a cadence,
and resist the urge to debug personally while you are the one everyone is asking.

The tell is in the first thirty seconds. A candidate who opens with the root cause has
skipped the part they were asked about. A candidate who opens with how they organised the
response, and only then what the cause turned out to be, is answering the question.

## The first ten minutes

Declare the incident and give it a channel. This sounds bureaucratic and it is the single
highest-leverage act, because it stops the discussion happening in five direct messages.

Assign roles explicitly. An incident commander who coordinates and decides, an operations
lead who runs the changes, a communications lead who talks to stakeholders and support, and
a scribe who keeps the timeline. On a small team one person may hold two, but the roles
still exist, and naming them is what stops the most senior engineer from silently becoming
the bottleneck.

Then state what you know, what you do not know, and the next check, in that order. The
first hypothesis is usually wrong; writing it down prevents the team from re-litigating it
later.

## Roles and communication

The incident commander does not debug. This is the discipline interviewers probe, because
the temptation is exactly the opposite: the person who knows the system best wants to be in
the terminal. The commander's job is to keep the loop turning — ask for status, decide
between options, protect the responders from interruption.

Communication runs on a cadence rather than on demand: a short update at a fixed interval
to a known audience, even when the update is that nothing has changed. Silence is what
makes stakeholders escalate and start their own investigations.

Mitigation before cause. Restore service, then understand. The interviewer will ask whether
you rolled back, failed over or disabled the feature before you understood why, and the
strong answer is yes, with the evidence preserved for the analysis.

## The postmortem that changes something

A postmortem is a document with a timeline, an impact statement, contributing causes,
what went well, and action items that are specific, owned and dated. The measure of quality
is not the prose; it is whether the actions reduce the probability or the impact of the
next occurrence.

Two traps. Action items that are exhortations — be more careful, add a review — change
nothing, because they name a virtue instead of a mechanism. And action items with no owner
or no date are aspirations, and everyone knows it.

A strong answer names at least one systemic change: the check that would have caught it
before a customer did, the alert that was missing, the limit that would have bounded it, or
the design that made the failure mode possible.

## Blameless is a mechanism, not a mood

Blameless does not mean nobody is accountable. It means the analysis proceeds on the
assumption that the people involved acted reasonably given what they could see, so the
conversation produces the information needed to fix the system. The moment the discussion
becomes about who should have known better, the information stops flowing and the same
failure returns with a different name.

That said, a culture where nothing is ever anyone's problem is not blameless, it is
negligent. The distinction is between blaming a person and holding a role accountable for
an action item.

## What a staff answer adds

Judgement about scope. Deciding when an incident is significant enough to declare, and when
it is not, is a skill that prevents alert fatigue on one side and silence on the other.
Delegation that grows people: handing the commander role to someone who has not done it,
with support, rather than keeping it. A follow-through loop where action items are tracked
like any other work, with a review of whether past actions actually reduced recurrence. And
the willingness to say what you would do differently in the first ten minutes, without
turning the answer into a confession.
