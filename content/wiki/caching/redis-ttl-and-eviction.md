---
slug: redis-ttl-and-eviction
title: TTL design and eviction policy in Redis
lang: en
domain: caching
topic: eviction
tech:
  name: Redis
  version_range: ">=8"
levels: [middle, senior, staff]
summary: >-
  A TTL is a promise about staleness, not a cleanup mechanism; eviction is what happens
  when the promise cannot be kept because memory ran out. Designing both before the
  first incident is the difference between a cache and a memory leak with low latency.
prerequisites: [redis-data-structures]
related: [cache-aside-write-through-write-behind, cache-stampede, cache-penetration-and-avalanche]
sources:
  - title: "Redis — Key eviction"
    url: https://redis.io/docs/latest/develop/reference/eviction/
    kind: official-docs
  - title: "Redis — SET command"
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
  - title: "Redis Open Source 8.10 release notes"
    url: https://raw.githubusercontent.com/redis/redis/8.10/00-RELEASENOTES
    kind: release-notes
review_status: draft
---

## TTL is a policy, not a timeout

Every cached key needs a stated answer to "how stale may this be". If there is no answer,
there is no TTL, and the cache is a second database that grows forever. The TTL is chosen by
the data owner, not by the caching layer: a permission change may tolerate five seconds, a
product description a day.

Two mistakes are common. A TTL so long that an invalidation bug is invisible for weeks. A TTL
so short that the cache barely helps and the origin sees regular bursts at every expiry. Both
are design decisions that should be visible in a table, not scattered as magic numbers.

Redis expires keys lazily on access and actively with a background sampler, so a key past its
TTL can still occupy memory until it is sampled or read. Expiration is not a scheduler.

## Eviction policies

`maxmemory` sets the ceiling; `maxmemory-policy` sets what happens at it. From the Redis
documentation:

- `noeviction` — writes that would allocate more memory fail with an error; reads still
  work. This is the correct policy when the dataset must not be silently dropped, and the
  wrong one for a pure cache, where it turns a memory problem into a write outage.
- `allkeys-lru` — evict the least recently used keys. The standard cache policy.
- `allkeys-lfu` — evict the least frequently used keys, which protects a hot key that had
  one quiet period and is better for skewed access.
- `allkeys-random` — evict at random.
- `allkeys-lrm` — evict the least recently modified, added in Redis 8.
- `volatile-*` variants — restrict eviction to keys that have an expiration. If no key
  has a TTL, a volatile policy behaves like `noeviction` and writes start failing.

For a cache, `allkeys-lru` or `allkeys-lfu`. For a store that must not lose data,
`noeviction` plus monitoring, because eviction is data loss.

## Jitter, hot keys and the memory wall

Keys written by the same batch job share an expiry, and when they expire together the origin
sees the whole set arrive at once. Add jitter: `base_ttl + random(0, jitter)`. This is the
cheapest defence and the one most often missing.

A single hot key does not benefit from jitter, because there is only one of it. It benefits
from longer TTLs, local in-process caching in front of Redis, or replication of the key into
several shards with the reader picking one.

Leave headroom under `maxmemory` for replication buffers and for the allocator's
fragmentation; a Redis at the limit with a replica that reconnects will evict aggressively
exactly when the replica needs the data most.

## Scenario behaviour is worth stating

- **Cache-aside with eviction** is correct: a lost key is a miss and a rebuild.
- **A counter or a lock with `allkeys-lru`** is wrong: eviction deletes the lock and two
  holders exist. Locks need `noeviction` or a different store.
- **A session store with eviction** is a deliberate logout for some users under memory
  pressure. That may be acceptable, but it should be a stated decision, not a surprise.

## Failure modes

No TTLs on cache keys. `volatile-lru` with keys that have no expiration, giving
`noeviction` semantics by accident. `maxmemory` configured without monitoring so the
first signal is write errors. TTLs synchronised across a batch of keys. And a cache used as
the only copy of data that cannot be rebuilt.
