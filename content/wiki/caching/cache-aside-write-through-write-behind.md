---
slug: cache-aside-write-through-write-behind
title: Cache-aside, write-through and write-behind
lang: en
domain: caching
topic: write-strategies
tech:
  name: Redis
  version_range: ">=8"
levels: [middle, senior, staff]
summary: >-
  The read strategy is easy; the write strategy is where correctness lives. Cache-aside
  leaves a window where the cache and the database disagree, write-through removes it at
  the cost of latency, and write-behind moves the latency to a durability question.
prerequisites: []
related: [redis-ttl-and-eviction, cache-penetration-and-avalanche, cache-stampede]
sources:
  - title: "Redis — Data types"
    url: https://redis.io/docs/latest/develop/data-types/
    kind: official-docs
  - title: "Redis — SET command (NX, EX, KEEPTTL)"
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
  - title: "Redis Open Source 8.10 release notes"
    url: https://raw.githubusercontent.com/redis/redis/8.10/00-RELEASENOTES
    kind: release-notes
review_status: draft
---

## Cache-aside is the default

The application reads the cache, misses, reads the database, writes the cache, returns. On
write the application updates the database and invalidates the cache. It is simple, it works
when Redis is down because every path falls back to the database, and it is the right
default.

Its weakness is the invalidation window. A read that misses can race a write: the reader
fetches the old value, the writer commits and deletes the key, then the reader writes the
stale value back. That version stays until its TTL expires.

The standard mitigation is ordering: update the database first, then delete the cache, and
give the cache a TTL so a lost invalidation is bounded rather than permanent. Deleting
rather than updating on write also avoids writing a value the next reader will not use.

## Write-through

Every write goes to the database and to the cache in the same request. Reads are always hot,
and there is no invalidation window in the happy path. The cost is added write latency — two
systems in the request — and a cache that holds every value ever written, including ones
that are never read again.

Write-through is right when the write rate is low relative to reads and read latency is the
product. It is wrong when writes are the throughput bottleneck: you have made the slowest
path slower.

The two operations are still not atomic. Write to the database and then the cache fails: the
cache is stale until TTL. Write the cache and the database fails: the cache holds a value
that does not exist. Either order needs a compensating idea — TTL, or invalidate on the
error path — and the answer should say which.

## Write-behind

The write goes to the cache and is flushed to the database asynchronously, often batched.
Write latency becomes cache latency and the database sees a smoother load. The price is a
window in which acknowledged writes exist only in memory: if Redis loses power with
`appendfsync no`, the writes are gone, and the user was told they succeeded.

Write-behind is defensible only when the data can be reconstructed or when Redis persistence
is configured so that the loss window is genuinely zero, which it is not by default. Say what
the recovery story is: idempotent flush with a sequence number, or a durable log between the
two. Without one, it is a data-loss design wearing a performance costume.

## Invalidation is the hard part

There are two honest answers. Time-based invalidation accepts bounded staleness and costs one
TTL per key. Event-based invalidation deletes the key when the underlying data changes,
which is correct but requires knowing every writer — including the migration script, the
admin tool and the CDC consumer.

A versioned key sidesteps deletion: key the cache entry on a version or content hash so a new
version is a different key and the old one expires. The cost is key churn and the need for a
way to compute the version without reading the value.

## Choosing a write strategy

Cache-aside with TTL suits read-heavy data that tolerates seconds of staleness: product
catalogues, profiles, feature configs. Write-through suits small, frequently read, low-write
data: session metadata, entitlements. Write-behind suits high-volume writes that are cheap to
lose or reconstruct: view counts, analytics events, metrics. Write-behind for a payment
record is a defect, and the interviewer is listening for that judgement rather than for the
pattern name.

## Failure modes

Invalidating before committing, so a reader refills with pre-write data. Caching a value with
no TTL, so an invalidation bug is permanent. Two writers, one updating the cache and one
deleting it. And a write-behind queue whose depth is not a monitored metric, so the first
sign of trouble is missing data.
