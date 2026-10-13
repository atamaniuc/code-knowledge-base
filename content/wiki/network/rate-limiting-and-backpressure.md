---
slug: rate-limiting-and-backpressure
title: Rate limiting, backpressure and staying up under load
lang: en
domain: network
topic: resilience
tech:
  name: HTTP APIs
  version_range: ">=2022"
levels: [senior, staff]
summary: >-
  A rate limit protects a shared resource from one client; backpressure tells every client
  to slow down. Getting to a stable system needs limits, an honest 429 with Retry-After,
  bounded queues and a shedding policy that is chosen before the incident.
prerequisites: []
related: [api-pagination-and-error-models, resiliency-timeouts-retries-and-bulkheads]
sources:
  - title: "RFC 9110 — HTTP Semantics (Retry-After, 429)"
    url: https://www.rfc-editor.org/rfc/rfc9110.html
    kind: rfc
  - title: "RateLimit header fields for HTTP (IETF draft)"
    url: https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
    kind: spec
  - title: "Google SRE Book — Handling overload"
    url: https://sre.google/sre-book/handling-overload/
    kind: book
  - title: "AWS Architecture Blog — Exponential backoff and jitter"
    url: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    kind: article
review_status: draft
---

## Rate limits and concurrency limits are different tools

A rate limit bounds requests per unit of time for a key — tenant, API key, IP. A concurrency
limit bounds how many requests are in flight against a dependency, and it is usually the one
that protects the database. A service can be well under its request rate limit and still
saturate a connection pool, because the queue is the real system.

The arithmetic that makes this concrete is Little's law: concurrency equals arrival rate
times latency. When latency rises, either the arrival rate must fall or concurrency grows
unbounded. A rate limit without a concurrency limit converts a latency problem into a
memory problem.

## Algorithms and what they cost

- **Fixed window** counts per calendar interval and is cheap, but allows a double burst
  across the boundary.
- **Sliding window / log** smooths the boundary at the cost of more state per key.
- **Token bucket** allows a burst up to the bucket size and refills at a steady rate, which
  matches how clients actually behave.
- **Leaky bucket** enforces a smooth output rate, which is what you want in front of a
  fragile dependency.

Distributed counting needs a shared store; the accuracy of the limit is a trade against the
latency and availability of that store. A per-instance counter is simpler and enforces
roughly limit-times-replicas, which is a decision to make explicitly rather than discover.

## Telling clients the truth

A rejected request should be 429 with Retry-After, and the response should expose the
quota policy — the IETF RateLimit header draft exists precisely so clients can avoid being
throttled rather than discover it. Silent dropping, or a 200 with an error body, removes
the client's ability to back off.

429 is the server asking for cooperation. If the client ignores it and nothing else protects
the system, the limit was advisory.

## Backpressure and load shedding

Backpressure is the end-to-end property: bounded queues at every stage, a caller that
actually waits when the queue is full, and a failure mode that is a fast rejection rather
than a slow collapse. The SRE guidance is to shed by criticality — health checks and the
control plane keep working while the least critical traffic fails — and to do it at the
cheapest point, at the edge, before the work is done.

Client-side throttling is the other half, and it is what retry budgets are for: a service
that retries without a budget turns a dependency's bad minute into an hour. The combination
that works is bounded retries, exponential backoff with jitter, and a cap on the fraction of
traffic that may be retried.

## Failure modes

Rate limiting by IP for authenticated traffic, so a shared office is throttled while an
attacker rotates addresses. Returning 429 without Retry-After. Retrying on a non-idempotent
operation. Retrying immediately on every layer, which multiplies load exactly when the
dependency is weakest. And adding a queue with no bound to "smooth" traffic, which is a
memory leak with a schedule.
