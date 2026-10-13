---
slug: redis-rate-limiting
title: Rate limiting with Redis
lang: en
domain: caching
topic: rate-limiting
tech:
  name: Redis
  version_range: ">=8"
levels: [middle, senior, staff]
summary: >-
  Every rate limiter is a choice between burst tolerance, fairness and memory. Redis
  makes the atomic counter easy and the distributed semantics subtly harder than they
  look.
prerequisites: [redis-data-structures]
related: [redis-distributed-locks, choosing-a-message-broker]
sources:
  - title: "Redis — INCR command"
    url: https://redis.io/docs/latest/commands/incr/
    kind: official-docs
  - title: "Redis — SET command (EX and KEEPTTL expiry options)"
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
  - title: "Redis Open Source 8.10 release notes"
    url: https://raw.githubusercontent.com/redis/redis/8.10/00-RELEASENOTES
    kind: release-notes
review_status: draft
---

## Fixed window

`INCR key` then `EXPIRE key 60 NX`: one counter per window, reset by expiry. It is one
round trip, trivially distributed, and it is what most teams ship first.

Its flaw is the boundary. With a limit of 100 per minute, a client can send 100 requests at
00:59.9 and 100 at 01:00.1 — 200 requests in 200 ms, twice the intended rate. Whether that
matters depends on what is being protected. Against a scraper, it does not; against an
expensive downstream, it does.

The response headers matter as much as the counter: return the limit, the remaining
allowance and when it resets, so a well-behaved client backs off instead of retrying blindly.
A 429 without `Retry-After` causes retry storms.

## Sliding window

A sorted set holding one entry per request, with `ZREMRANGEBYSCORE` to drop entries older
than the window and `ZCARD` to count, gives an exact sliding window. It is precise and it
costs memory proportional to the limit and the window, because every request is stored.

A sliding-window counter approximates it with two fixed windows — the previous and the
current — weighted by how far into the current window you are. It is cheaper and smooths the
boundary problem, at the cost of accepting a small approximation. The choice is memory
against precision, and the answer should name which.

## Token bucket

A bucket of capacity N refills at a constant rate; each request takes a token. It gives a
sustained rate plus a bounded burst, which is what most APIs actually want and what fixed
windows cannot express. The classic implementation is a hash with the token count and a
timestamp, refilled lazily on access, with the whole read-modify-write in a Lua script so it
is atomic.

Token bucket is the answer to reach for when the requirement is "10 per second, burst 50".
Fixed window is the answer to "no more than 1000 per hour". Naming the requirement and then
the algorithm is the senior move.

## Distributed correctness and the client-side alternative

A single Redis is a single arbiter, which is exactly what a limiter needs: the counter must
be shared or it is not a limit. A Redis Cluster shards by key, so the key must be a single
key per limiter (a tenant, an API key, an IP) and the multi-key Lua must not span slots.

The cost is a network round trip on the hot path and a dependency that, when it fails, must
be given a policy: fail-open (allow traffic) or fail-closed (reject it). Fail-open protects
availability and removes the protection; fail-closed protects the downstream and takes the
product down. State which, and make it a decision rather than a default.

Some limiters are better implemented locally: a token bucket per process, aggregated
statistically, removes the dependency and the latency. It is appropriate when the limit is a
soft fairness guarantee, and wrong when the limit is a billing or abuse control.

## Failure modes

A counter with no expiry, so a client that hits the limit once is blocked forever. `INCR`
and `EXPIRE` as two commands without a transaction, so a crash between them leaves a
counter that never resets. Keying the limiter on something the client controls, which makes
the limit optional. And a limiter that protects nothing because every expensive path is
called from a service that bypasses it.
