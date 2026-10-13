---
slug: redis-data-structures
title: Choosing a Redis data structure
lang: en
domain: caching
topic: data-structures
tech:
  name: Redis
  version_range: ">=8"
levels: [middle, senior, staff]
summary: >-
  A Redis command is cheap; the round trips around it are not. Choosing the structure
  that answers the question in one operation is most of the performance work, and the
  wrong choice usually shows up as N+1 round trips or a value that has to be parsed
  and rewritten.
prerequisites: []
related: [redis-ttl-and-eviction, cache-aside-write-through-write-behind]
sources:
  - title: "Redis — Data types"
    url: https://redis.io/docs/latest/develop/data-types/
    kind: official-docs
  - title: "Redis — SET command"
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
  - title: "Redis Open Source 8.10 release notes"
    url: https://raw.githubusercontent.com/redis/redis/8.10/00-RELEASENOTES
    kind: release-notes
review_status: draft
---

## The question is the access pattern

The structure follows from four questions: what is the unit you read and write, do you need
ordering or ranking, do you need set membership or intersection, and does the whole value
have to be rewritten on update.

A JSON document stored as a string answers "give me the whole object" perfectly and answers
"increment one field" terribly, because that is read-modify-write with a race. The same data
in a hash makes the field update atomic and one round trip.

## Strings, counters and bitmaps

A string holds bytes, and Redis treats a few of them specially. `INCR` on a string key is
an atomic counter, which is the basis of rate limiting and of any shared tally. A large
string is not automatically a bad choice: a serialised object read whole and written whole
is often the right call.

Bitmaps encode a boolean per user per day in one key, and `BITCOUNT` answers "how many
active users today" without moving any data. The cost is that the key is sized by the
highest offset used, so a sparse id space wastes memory.

## Hashes and JSON

A hash is a small object with field-level access: `HSET` one field, `HINCRBY` another,
read the whole thing with `HGETALL`. Under a few thousand fields it is compact. Use it for
counters per entity, feature flags per tenant, and any object where a single field changes
often.

Since Redis 8, JSON is a native type available in open source, which changes the trade for
nested documents: fields can be read and written by path without rewriting the document.
The decision between hash and JSON is whether the shape is flat and small (hash) or nested
and partially updated (JSON).

## Sets, sorted sets and rank

A set answers membership and set algebra: `SISMEMBER` for "has this user seen it",
`SINTER` for "users who match both segments". A sorted set is a set with a score, and it
answers ranked queries in logarithmic time: leaderboards with `ZADD` and `ZRANGE`, but
also time-ordered feeds with the timestamp as the score, and scheduled work with the
deadline as the score.

A sorted set used as a queue with `ZPOPMIN` gives priority ordering. It is not a durable
queue: the items are in memory and the pop is destructive, so anything that must survive a
restart belongs in a stream or a real broker.

## Streams and probabilistic types

A stream is an append-only log with consumer groups, acknowledgements and replay within the
retained range. It is the right structure when several consumers must each see every event
and the history matters.

The probabilistic types — HyperLogLog, Bloom filter, count-min sketch, t-digest — trade
exactness for a fixed small footprint. `PFADD`/`PFCOUNT` counts distinct values in
kilobytes for any cardinality, with a small error; a Bloom filter answers "definitely not
present" and is the cheapest cache-penetration defence there is. Reaching for exactness
where an approximation is enough is a common middle-level answer.

## Choosing under memory pressure

Count the bytes before choosing. A set of member ids is far larger than a Bloom filter or a
bitmap of the same cardinality. A hash of a million fields is not a hash any more, it is a
database. For every structure ask what happens at ten times the current size, and set
`maxmemory` and an eviction policy before that question is answered by an incident.

## Failure modes

Storing a document in a string and rewriting it on every field update. One key per user for
a global counter. Using a sorted set as a durable job queue. Keys with no TTL and no eviction
policy, so memory grows until writes fail. And a `KEYS` scan in a request path, which is a
full keyspace walk where `SCAN` or a dedicated index would do.
