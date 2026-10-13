---
slug: incident-response-and-postmortems
title: Incident response and blameless postmortems
lang: en
domain: observability
topic: sre
tech:
  name: SRE practices
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Incident response is a process for making decisions with incomplete information:
  one commander, one communicator, mitigation before root cause, and a written
  record afterwards that changes the system rather than the people.
prerequisites: [alerting-that-does-not-page]
related: [slos-and-error-budgets, tracing-and-sampling]
sources:
  - title: "Site Reliability Engineering: Managing Incidents"
    url: https://sre.google/sre-book/managing-incidents/
    kind: book
  - title: "Site Reliability Engineering: Postmortem Culture"
    url: https://sre.google/sre-book/postmortem-culture/
    kind: book
review_status: draft
---

## Roles during an incident

An incident is a coordination problem before it is a technical one. The structure that
works separates the roles explicitly: an incident commander who owns the decision and the
timeline, a communications lead who owns the audience, and the operations people who own
the fix. On a small team one person may hold two roles, but naming them still matters,
because the failure mode is a room where nobody is deciding and everybody is debugging.

The commander's job is not to be the best debugger in the room. It is to keep the response
moving: declare the incident, set the severity, assign work, decide when to escalate, and
decide when it is over. That is why a commander with less context than the specialists can
still be the right person.

The corollary is that the person who fixes the problem is not necessarily the person who
runs the response, and the two should not both be the on-call engineer with no backup.

## Communicate before you understand

The instinct is to wait for a diagnosis before telling anyone. That instinct is wrong. The
first update should be short and honest: we are aware, this is the impact, here is the next
update time. A stakeholder who is told nothing invents an explanation, and the explanation
is usually worse.

Cadence beats accuracy. A regular update — every fifteen or thirty minutes — with a known
next-update time is what keeps an incident from generating a second incident in the
stakeholder channel. The update should say impact in user terms, what is being done, and
the next update time; it does not need a root cause.

## Mitigate before you fix

The goal of the first phase is to stop the bleeding, not to understand the wound. Rollback,
feature-flag off, failover, scale up, drain the bad region — whichever action restores the
user-visible signal fastest. Root-cause work continues after the signal is restored.

This is where the release discipline from CI/CD pays off: a rollback path that is a redeploy
of the previous artifact is available in minutes, while a fix-forward path needs an
investigation, a change and a build. Deciding which to take is a judgement call, and the
default should be rollback unless the previous version is also broken.

The dangerous moment is the end. Declaring an incident over requires evidence that the
signal is healthy, not that the change was applied; the last step is a verification window
long enough to see the metrics return to baseline, and an explicit statement of what would
make the team re-declare.

## The blameless postmortem

A postmortem is a document written after the incident that records what happened, why it
was possible, how it was detected and how it was resolved. Blameless is not a courtesy: it
is the condition for accurate data. If the document will be used to punish someone, the
next one will omit the action that triggered the incident, and the organisation loses
exactly the information it needs.

The structure that produces useful content: impact in user terms and in error-budget terms,
a timestamped timeline, the contributing factors, what went well, and the action items.
Contributing factors rather than a single root cause, because most incidents are a
combination of a change, a latent weakness and a detection gap.

The timeline should be reconstructed from evidence — alerts, deploy logs, traces, chat —
not memory. Memory assigns causes to the wrong moments, and the timeline is where the
detection gap usually becomes obvious.

## Action items

The output of a postmortem is a small number of action items with owners and dates, tracked
like any other work. The failure mode is a list of twenty vague improvements that nobody
does, which teaches the organisation that postmortems are theatre.

Classify the actions by which gap they close. Prevention removes the latent weakness.
Detection shortens the time to notice; this is often the highest-value category, because the
incident's duration is usually dominated by discovery and diagnosis rather than the fix.
Mitigation shortens the time to recover. Process fixes the coordination gap.

Prioritise detection and mitigation over prevention when the same cause is likely to recur
in another form, and prefer actions that are checkable — a test, a canary, an alert with a
runbook — over actions that are promises to be careful.
