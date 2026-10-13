---
slug: prometheus-and-promql
title: Prometheus 3, PromQL and cardinality
lang: en
domain: observability
topic: metrics
tech:
  name: Prometheus
  version_range: ">=3.0"
levels: [middle, senior, staff]
summary: >-
  Prometheus stores one time series per unique label combination, so cardinality
  is the design constraint. PromQL is the query language on top, and Prometheus 3
  added UTF-8 names and native histograms that change how the worst cardinality
  problems are solved.
prerequisites: []
related: [slos-and-error-budgets, opentelemetry-collector-and-conventions]
sources:
  - title: "Prometheus 3.0"
    url: https://prometheus.io/blog/2024/11/14/prometheus-3-0/
    kind: release-notes
  - title: "Prometheus: Metric and label naming"
    url: https://prometheus.io/docs/practices/naming/
    kind: official-docs
review_status: draft
---

## The data model is the constraint

A time series is a metric name plus a set of label key-value pairs, and every unique
combination is its own series with its own storage, memory and query cost. Labels are the
index; the values are the rows. That model is why metrics are cheap at low cardinality and
expensive at high cardinality, and it is the first thing to explain in an interview,
because every cardinality mistake follows from it.

Labels are for dimensions you group and filter by: service, method, status code class,
region, instance. They are not for values that are unique per request.

## Cardinality

Cardinality is the number of distinct series. A metric with a user ID, a session ID, a raw
URL path, a full error message or a trace ID in a label can produce millions of series from
one instrumentation line, and the damage compounds: memory in the server, scrape load,
query latency, and remote-write volume all scale with it.

The fixes, in order of preference. Remove the label — often it was added for debugging and
belongs on a log or a trace. Bound the value: status code classes rather than exact codes,
route templates rather than raw paths, a fixed set of outcomes rather than free text. Use
exemplars: a trace ID can be attached to a histogram bucket as an exemplar, which gives the
drill-down without the series explosion. Aggregate before ingestion with recording rules or
with the collector's attribute filtering. And prefer histograms to per-value gauges for
latency, because a histogram's whole point is that its bucket labels are bounded.

The tell in an interview is whether the candidate treats cardinality as a monitoring metric
of its own. tracking the number of active series per job is how you catch the next
instrumentation mistake before it takes down the monitoring stack.

## PromQL patterns

A few patterns carry most production queries.

Counters are queried with rate over a window, and the window should be at least twice the
scrape interval or the result is spiky and misleading. increase is rate times the window in
seconds. Gauges are queried directly and never passed to rate.

Latency comes from histogram_quantile over the _bucket series, summed by the labels you
care about; the quantile is an estimate over buckets, so bucket boundaries decide how
accurate it is. Averages hide the tail, which is why the p99 is usually the alert input.

sum by (label) collapses series and is also a cardinality control: an alert on a per-route
aggregate is stable where a per-pod one flaps. topk finds the worst offenders for a
dashboard, not for an alert, because the membership changes on every evaluation.

absent() is the query that catches a target that stopped reporting: an alert on a missing
series is how you learn a scraper is broken rather than learning it from a customer. And
offset lets you compare with the same period a week ago, which is often more meaningful than
a fixed threshold.

Expensive queries belong in recording rules, evaluated once and stored as a new metric. A
dashboard that recomputes a heavy query per panel per refresh is a load generator.

## Prometheus 3

Prometheus 3.0 introduced two changes that matter for design.

Metric and label names may now contain any valid UTF-8, which removes the historical
character restrictions and lets names from other systems pass through without mangling.
Naming conventions still matter for humans, so the practical rule is unchanged: name for
what the metric is, keep label values bounded, and do not encode a value into a name.

Native histograms store a high-resolution histogram in the series itself instead of
materialising a fixed bucket set as separate series. That removes the bucket-count times
series-count blow-up of classic histograms, improves quantile accuracy, and reduces storage
and scrape payload. They are the right tool for latency distributions at high cardinality;
the prerequisite is that the instrumentation and the ingestion path both support them.

The current line is 3.15.0, so a design that pins 2.x is pinning a version that has been
superseded. The migration is mostly compatible, and the evaluation to do is against
recording rules and alerting expressions, not against dashboards built by hand.
