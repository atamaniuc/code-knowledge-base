---
slug: slos-and-error-budgets
title: SLOs and error budgets
lang: en
domain: observability
topic: sre
tech:
  name: Prometheus
  version_range: ">=3.0"
levels: [senior, staff]
summary: >-
  An SLO is a target for a user-visible signal over a window, and the error
  budget is the failure it permits. The budget is the useful part: it turns
  reliability from an argument about feelings into a number that decides when to
  ship and when to stop.
prerequisites: [prometheus-and-promql]
related: [alerting-that-does-not-page, incident-response-and-postmortems]
sources:
  - title: "The Site Reliability Workbook: Alerting on SLOs"
    url: https://sre.google/workbook/alerting-on-slos/
    kind: book
review_status: draft
---

## Start with the user-visible signal

An SLO begins with a service-level indicator: a measurement of something a user experiences.
Good indicators are request success rate, request latency, and freshness or correctness of
data. Bad indicators are CPU utilisation, pod count or queue depth — those are causes, and
an SLO is about effects.

The first question is whose experience. A batch consumer, an interactive user and an API
client all define success differently, and one SLO for all of them is usually the wrong
measurement for two of them. Pick the journey, then measure it at the boundary the user
crosses: the load balancer or the edge, not the service's internal RPC.

## Defining the SLO

An SLO is an SLI, a target, and a window. For example: 99.9 percent of successful requests,
measured at the gateway, over a rolling 30 days.

The choices inside that sentence are the design.

The target forces a conversation about cost. Each additional nine multiplies the effort,
and a target set higher than the service's dependencies can support is unachievable — if
the payment provider is 99.9 percent available, a checkout SLO of 99.99 percent is a
fiction.

The window changes behaviour. A rolling 30-day window is stable and slow to react; a
calendar month resets and creates a rush or a freeze at the boundary. A fast burn over a
short window detects an acute outage, and a slow burn over a long window detects a chronic
degradation; that is why the alerting design uses both.

Latency SLOs should be stated as a threshold, not an average: the proportion of requests
faster than 300 milliseconds. An average latency can be met while the tail is unusable.

## Error budget policy

The error budget is 100 percent minus the target: a 99.9 percent SLO over 30 days permits
about 43 minutes of full outage, or a larger amount of partial failure. Its value is not the
number but the pre-agreed response.

The policy is written before the incident, because during it nobody negotiates well. The
usual shape: while budget remains, the team ships features at normal velocity; when the
budget is exhausted, feature work pauses and reliability work takes priority until the
budget recovers. Escalation to a named owner when the budget is at risk.

That policy is what makes an SLO meaningful rather than decorative. Without a consequence,
the target is a dashboard nobody obeys, and the first time it is breached the response is a
meeting.

## Burn-rate alerting

Alerting on "the error budget is exhausted" is too slow: it fires after the damage is done.
Alerting on "the error rate is above X right now" is too noisy, because a single bad minute
crosses any fixed threshold.

Burn rate is the rate at which the budget is consumed relative to the SLO. A burn rate of 1
consumes the budget exactly over the window; a burn rate of 14.4 consumes a 30-day budget in
about two days. The alerting design uses a fast, high-burn condition to page for an acute
outage, and a slow, low-burn condition to open a ticket for a chronic problem, each with two
windows so that a brief spike does not page while a sustained burn does.

That multi-window, multi-burn-rate shape is what the SRE Workbook describes, and the reason
it works is precision and recall at the same time: it pages early on real problems and stays
quiet on noise. The two windows are usually a long window for the burn calculation and a
short window that must also be burning, so an already-recovered incident does not keep
paging.
