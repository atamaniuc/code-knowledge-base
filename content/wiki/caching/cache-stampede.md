---
slug: cache-stampede
title: Cache stampede
lang: en
domain: caching
topic: invalidation
tech:
  name: Redis
  version_range: ">=8"
levels: [middle, senior, staff]
summary: >-
  A cache stampede is the load spike that hits the origin when many concurrent
  requests miss the same key at once. Its size scales with concurrency at the
  moment of expiry rather than with average traffic, which is why it stays
  invisible until the system is already busy.
prerequisites: []
related: []
sources:
  - title: "Optimal Probabilistic Cache Stampede Prevention (VLDB 2015)"
    url: https://cseweb.ucsd.edu/~avattani/papers/cache_stampede.pdf
    kind: paper
  - title: "Redis SET command — NX and EX options"
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
  - title: "RFC 5861 — HTTP Cache-Control Extensions for Stale Content"
    url: https://www.rfc-editor.org/rfc/rfc5861
    kind: rfc
review_status: draft
---

## What happens

A cached key expires or is evicted. Every request that needs it now misses, and
every one of them recomputes the value against the origin. For a key served
1000 requests per second with a recompute that takes 200 ms, roughly 200
requests reach the origin before the first one finishes writing the value back.

The origin sees a burst proportional to **concurrency at the moment of expiry**,
not to average traffic. That is the property that makes stampedes surprising:
the same code behaves correctly under light load and collapses under load, and
the load level at which it collapses is the one you did not test.

Two amplifiers make it worse in practice. Keys created together tend to expire
together, so a whole family of keys stampedes at once. And a slow origin extends
the window during which new arrivals also miss, so the burst feeds itself.

## Single-flight with a lease

Let exactly one caller recompute and have the rest wait or serve stale. In Redis
this is `SET lock:<key> <token> NX EX <ttl>`: the `NX` makes acquisition atomic
and `EX` puts a bound on how long the lock can be held.

The lease TTL is the part that gets designed badly. Without it a holder that
crashes blocks the key forever. With one that is shorter than the recompute, two
callers hold the lock at the same time and the guarantee is gone. Size it above
the observed p99 recompute time, and release by comparing the token so a late
holder cannot delete someone else's lock.

Waiting callers need a policy of their own: block with a timeout, serve stale,
or fail fast. Blocking without a timeout converts a cache problem into a thread
pool exhaustion problem.

## Probabilistic early recomputation

Instead of recomputing at expiry, recompute *before* it, with a probability that
rises as the TTL runs out. The XFetch approach from the VLDB 2015 paper scales
that probability by the measured recompute time, so expensive values are
refreshed earlier than cheap ones.

The appeal is that it needs no coordination: no lock, no waiting callers, no
extra round trip. The cost is that each entry must carry its own measured
recompute duration, which means the write path has to time itself.

## Serve stale while revalidating

Keep the value past its logical expiry and return it while a background task
refreshes it. HTTP names this `stale-while-revalidate` in RFC 5861 and the same
shape works inside an application cache.

This trades correctness for availability in a specific, bounded way: readers can
observe a value that is one refresh interval out of date. That is acceptable for
a product listing and not acceptable for a permission check, and the decision
belongs to whoever owns the data, not to the caching layer.

## TTL jitter

Give related keys `base_ttl + random(0, jitter)` instead of a shared constant.
This does nothing for a single hot key, but it stops a family of keys populated
by the same batch job from expiring in the same second. It costs one line and is
the cheapest of the four, so it is usually the first thing missing when a
stampede shows up in production.
