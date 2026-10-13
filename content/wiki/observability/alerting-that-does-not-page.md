---
slug: alerting-that-does-not-page
title: Alerting that does not page for noise
lang: en
domain: observability
topic: sre
tech:
  name: Prometheus
  version_range: ">=3.0"
levels: [senior, staff]
summary: >-
  A page is a request to a human to stop what they are doing. Every page should
  correspond to a user-visible symptom, need an action, and have an owner; if it
  fails any of those tests it belongs in a ticket or a dashboard, not a phone.
prerequisites: [slos-and-error-budgets, prometheus-and-promql]
related: [incident-response-and-postmortems, opentelemetry-collector-and-conventions]
sources:
  - title: "The Site Reliability Workbook: Alerting on SLOs"
    url: https://sre.google/workbook/alerting-on-slos/
    kind: book
  - title: "Site Reliability Engineering: Managing Incidents"
    url: https://sre.google/sre-book/managing-incidents/
    kind: book
review_status: draft
---

## Page on symptoms

The distinction that improves on-call more than any other: alert on symptoms, not causes. A
symptom is bad latency or failed requests as the user experiences them. A cause is high CPU,
a full disk, a crashed pod.

Causes are important, but a cause that is not yet affecting users is a ticket or a
dashboard. Alerting on it wakes someone up to watch a graph, and the human becomes the
mitigation. The exception is a cause with a known, imminent, user-visible consequence and a
clear action, and that exception should be rare and named.

The corollary is that a signal nobody can act on should not exist as an alert. A metric
that is interesting but actionless is a dashboard panel.

## Every page needs an action

A page passes the test if a reasonable responder knows what to do first. If the answer is
"look at the dashboard and think", the page is not ready. Concretely, each alert should
carry: what is broken in user terms, what to check first, the runbook link, and who owns it.

Severity should encode the response, not the emotion. Page for something that needs a human
now, ticket for something that needs a human this week, log for something that needs
analysis later. If everything is critical, nothing is, and the on-call rotation learns to
ignore the pager.

The other gate is ownership. An alert routed to a team that does not own the dependency is
an alert that gets muted. Shared-dependency failures are usually the load balancer's symptom
and someone else's cause; the alert belongs where the action is.

## Routing and grouping

An alerting pipeline has stages, and each one can destroy signal. The alert rule decides
what fires; grouping decides what arrives together; inhibition decides what is suppressed
because something else is already firing; routing decides who is woken; silences suppress
during planned work.

Grouping is the difference between one page and two hundred. A rack failure produces a
hundred alerts, and they should arrive as one notification with a hundred lines. But
grouping too aggressively hides a second, unrelated failure inside the first, so the usual
grouping key is service plus cluster, with time-based grouping for the burst.

Inhibition is the sophisticated half: when the whole cluster is down, the per-service alerts
should be suppressed in favour of the one that says the cluster is down. Alert fatigue is
the failure mode this exists to prevent.

## Reviewing noise

An on-call rotation should review its pages as data. Two numbers matter: how many pages per
shift, and what fraction led to an action. A page that led to no action is a defect in the
alerting, and the fix is to change the rule, not to tell the responder to be more
discerning.

The loop that works: every page reviewed in the postmortem or the weekly on-call review,
the noisy rule fixed, and the change recorded. Alerts that are muted during a project tend
not to come back, so a silence should have an expiry and an owner.

The staff-level version of this is that alert quality is a product decision with a cost:
every unnecessary page is a person's sleep and, eventually, their attention when a real page
arrives. Treating the pager as a scarce resource is what keeps it working.
