---
slug: tracing-and-sampling
title: Tracing, propagation and sampling
lang: en
domain: observability
topic: tracing
tech:
  name: OpenTelemetry Collector
  version_range: ">=0.162"
levels: [senior, staff]
summary: >-
  A trace is a tree of spans linked by context, and context is what makes
  distributed tracing work. Sampling decides what you keep, and the choice between
  head and tail sampling is really a choice about what questions you need to
  answer later.
prerequisites: [opentelemetry-collector-and-conventions]
related: [prometheus-and-promql, incident-response-and-postmortems]
sources:
  - title: "OpenTelemetry: Sampling"
    url: https://opentelemetry.io/docs/concepts/sampling/
    kind: official-docs
  - title: "OpenTelemetry: Collector"
    url: https://opentelemetry.io/docs/collector/
    kind: official-docs
review_status: draft
---

## What a span carries

A trace is a set of spans sharing a trace ID; each span has a span ID, a parent span ID, a
start and end time, a name, a status, and attributes. The tree is the request's shape: which
service called which, how long each step took, and where the time went.

A span without attributes is a duration. The attributes are what answer questions:
http.route, http.response.status_code, db.system, peer.service, and the resource attributes
that identify the service and version. Getting service.name and service.version right is
what lets a trace be attributed to a release; without them the trace is orphaned.

Spans should model the units of work a responder would name, not every function call. A
span per internal method produces an expensive tree that nobody reads; a span around each
outbound call, each queue publish and each database query is the level that explains latency
and failure.

## Context propagation

Tracing only works if the trace context travels with the request. The SDK injects a header
on outbound calls — W3C traceparent in the interoperable case — and extracts it on the
receiving side, linking the child span to the parent. OpenTelemetry is vendor-neutral
precisely so that the propagation header is standard rather than an agent's proprietary
format.

The breaks are predictable: a queue where the producer's context is not carried in message
attributes, a thread pool that loses the context, a background job that starts with nothing,
an HTTP client that is not instrumented, a proxy that strips unknown headers. Each break
starts a new trace, which looks like latency disappearing and volume appearing.

When a trace must be stitched across an asynchronous boundary, the answer is to put the
propagation context in the message and have the consumer extract it. That is worth saying
explicitly in an interview, because queue boundaries are where most traces become pieces.

## Head and tail sampling

Sampling decides which traces are kept, and it is a volume decision, not a storage one.

Head sampling decides at the start of the trace, usually with a probability, and the
decision is made by the first service and propagated in the trace flags. It is cheap, it
happens in the SDK, and it scales. Its problem is that it decides before knowing whether the
trace will be interesting, so a rare error trace is discarded at the same rate as a boring
one.

Tail sampling decides after the trace is complete, at the collector, where all spans are
available. It can keep every trace that errored, every trace slower than a threshold, and a
small percentage of the rest. That is what you want for debugging. The cost is that all
spans must be buffered until the trace is complete, so the collector needs memory, a
decision timeout, and enough instances to hold the data — which is why tail sampling is a
gateway-tier concern, not an agent-tier one.

Adaptive sampling adjusts the rate based on traffic volume, which keeps the cost predictable
under a spike while preserving rare events.

## Choosing a policy

The policy question is not "what percentage" but "what do I need to see and what can I
afford". A workable default: tail-sample at the gateway, keep all errors and all traces over
the latency threshold, plus a low percentage of successes for baseline analysis. If tail
sampling is not available, head-sample conservatively and rely on metrics and logs for the
rare cases.

The number to watch is not the sampling rate but the sampled volume and whether the queries
people actually run return results. A 1 percent sample that never contains a trace of the
incident is a 1 percent sample that is not doing its job, and the fix is selection, not a
higher rate.

Finally, sampling must be consistent across the trace, or the tree has holes. A head
decision propagates, and a tail decision is made once with all spans in view; mixing a
per-service head decision with a gateway tail decision produces partial traces that are
harder to debug than no trace at all.
