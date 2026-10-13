---
slug: cache-penetration-and-avalanche
title: Cache penetration, avalanche and stampede
lang: en
domain: caching
topic: failure-modes
tech:
  name: Redis
  version_range: ">=8"
levels: [middle, senior, staff]
summary: >-
  Three different failure modes share one symptom — the origin falls over — and are
  routinely confused. Penetration is misses for keys that do not exist, avalanche is
  many keys expiring at once, stampede is one key recomputed by everyone.
prerequisites: [redis-ttl-and-eviction]
related: [cache-stampede, cache-aside-write-through-write-behind]
sources:
  - title: "Redis — SET command"
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
  - title: "Redis — Key eviction"
    url: https://redis.io/docs/latest/develop/reference/eviction/
    kind: official-docs
  - title: "Redis — Data types (probabilistic types)"
    url: https://redis.io/docs/latest/develop/data-types/
    kind: official-docs
review_status: draft
---

## Penetration

Requests arrive for keys that do not exist in the datasource either — a deleted user, an
enumerated id, an attack scanning the id space. Every request misses the cache and hits the
database, and the cache never warms because there is nothing to cache.

Three defences, in increasing strength:

- **Cache the negative result.** Store a sentinel with a short TTL. The key becomes a hit and
  the database is protected for the length of the TTL. The cost is memory for keys that may
  never be requested again, and the need to invalidate the sentinel when the row is created.
- **Validate before querying.** Reject malformed or impossible ids at the edge — a UUID that
  is not a UUID, an id outside the range, a request without authorization.
- **A Bloom filter.** A filter loaded with every existing key answers "definitely not
  present" without touching the datasource. A false positive means a miss that reaches the
  database, which is a bounded cost; a false negative is impossible, so a present key is
  never wrongly rejected. It is the cheapest protection against an adversarial scan.

Penetration is the only one of the three that is usually adversarial, and the answer should
say so instead of treating an attack as a cache inefficiency.

## Avalanche

A large fraction of the cache expires or is lost at once. The usual causes are a batch job
that populates a whole namespace with the same TTL, a restart or failover that empties a
shard, and a synchronised warm-up.

The defences are structural. Jitter every TTL. Warm the cache deliberately after a restart,
with concurrency limits, rather than letting live traffic do it. Use a multi-level cache so a
lost Redis is not a lost cache. And for a shard failure, make the client fall back to the
origin with a concurrency limiter rather than letting every request through — the origin's
capacity, not the cache's, decides whether the system survives.

## Stampede is the third one

One hot key expires and every concurrent request recomputes it. The burst scales with
concurrency at the moment of expiry, not with average traffic, which is why it stays
invisible under test. The mitigations — single-flight with a lease, probabilistic early
recomputation, stale-while-revalidate — are a separate article, and a candidate who merges
stampede and avalanche has not yet separated one key from many.

## Defences that compose

A practical stack: validate at the edge, Bloom filter for existence, negative caching with a
short TTL, TTL jitter everywhere, single-flight on rebuild, stale-while-revalidate for data
that tolerates it, and a concurrency limit on the path from cache to database. Each layer
independently degrades rather than failing closed.

What is assessed is whether the candidate orders these by cost and picks the two or three
that match the data. Listing all seven as equally applicable is a catalogue, not a design.

## Failure modes

Negative caching with no TTL, so a deleted-then-created entity is invisible forever. A Bloom
filter that is never rebuilt after its dataset grows, so it starts returning false negatives
— which is the one thing it must not do. A warm-up job that runs with unlimited concurrency
and recreates the avalanche it was meant to prevent. And treating a stampede as an avalanche
by widening every TTL, which fixes nothing.
