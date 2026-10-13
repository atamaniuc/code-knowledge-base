---
slug: resiliency-timeouts-retries-and-bulkheads
title: "Resiliency: timeouts, retries with jitter, circuit breakers and bulkheads"
lang: en
domain: architecture
topic: distributed-systems
tech:
  name: Distributed systems
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  A remote call without a deadline is an outage waiting for a slow dependency. Retries must
  be bounded, jittered and idempotent; a circuit breaker fails fast; a bulkhead stops one
  dependency from consuming the whole process.
prerequisites: [microservice-boundaries]
related: [rate-limiting-and-backpressure, consistency-models-and-business-tolerance]
sources:
  - title: "gRPC — Deadlines"
    url: https://grpc.io/docs/guides/deadlines/
    kind: official-docs
  - title: "AWS Architecture Blog — Exponential backoff and jitter"
    url: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
    kind: article
  - title: "Google SRE Book — Handling overload"
    url: https://sre.google/sre-book/handling-overload/
    kind: book
review_status: draft
---

## Timeouts come first

Every outbound call needs a deadline, and the deadline must be shorter than the caller's own
remaining budget. A service that waits indefinitely on a dependency holds a connection,
a thread or an event-loop slot, and the failure spreads upward as a queue rather than as an
error. Deadline propagation — passing the remaining budget down the call chain — is what
stops a slow leaf from exhausting every layer above it.

The number itself should come from an SLO: if the request budget is 800 ms and the call is
one of three, the deadline is derived, not guessed. A default timeout of thirty seconds on
an internal call is effectively no timeout.

## Retries, done carefully

- Retry only idempotent operations, or operations protected by an idempotency key.
- Use exponential backoff with jitter. Without jitter, every client retries in lockstep and
  the dependency sees a synchronised spike exactly when it is recovering.
- Bound the attempts and the total time, and enforce a retry budget as a fraction of
  traffic so retries cannot multiply load.
- Retry at one layer. Retries at the client, the gateway and the service multiply, so three
  attempts become twenty-seven.
- Do not retry a request that has already partially succeeded unless the effect is
  idempotent by construction.

## Circuit breakers

A breaker trips after a threshold of failures and fails fast for a cooling period, then
lets a trial request through. Its value is not that it fixes the dependency but that it
stops the caller from spending its own capacity waiting on something that is down — and it
gives the dependency room to recover.

It is not a substitute for a timeout. A breaker without a deadline waits on the failing call
before counting the failure. And a breaker that opens on a per-instance counter without
shared state protects only the instance that noticed.

## Bulkheads

Isolate resources per dependency: a separate connection pool, a separate concurrency limit,
a separate queue. One slow dependency then degrades one path rather than the whole process.
The common failure this prevents is a shared thread or connection pool where the unhealthy
dependency consumes every slot and healthy calls queue behind it.

The cost is that capacity is partitioned and cannot be borrowed, so the limits need to
reflect real traffic shares rather than round numbers.

## Load shedding as the last line

When the system is genuinely over capacity, the choice is between slow failure for everyone
and fast rejection for some. The SRE guidance is to shed by criticality: keep health checks
and the control plane, degrade the least important work first, and return a retry signal
rather than a timeout. Load shedding is a designed behaviour, not a symptom.

## Failure modes

Retries without jitter, or without a budget. A retry on a non-idempotent operation. Timeouts
set per call site and inconsistent across the chain. A circuit breaker evaluated after the
slow call. Shared pools for unrelated dependencies. And a queue introduced to smooth a
spike with no bound and no shedding policy.
