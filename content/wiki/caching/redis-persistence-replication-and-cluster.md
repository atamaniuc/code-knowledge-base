---
slug: redis-persistence-replication-and-cluster
title: Redis persistence, replication and cluster topology
lang: en
domain: caching
topic: operations
tech:
  name: Redis
  version_range: ">=8"
levels: [senior, staff]
summary: >-
  Redis durability is a dial, not a property: the choice between RDB snapshots, AOF and
  no persistence decides how much data a crash may lose. Replication is asynchronous by
  default, so failover is about availability, not about keeping every acknowledged write.
prerequisites: [redis-data-structures]
related: [redis-ttl-and-eviction, redis-distributed-locks]
sources:
  - title: "Redis — Persistence"
    url: https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/
    kind: official-docs
  - title: "Redis — Replication"
    url: https://redis.io/docs/latest/operate/oss_and_stack/management/replication/
    kind: official-docs
  - title: "Redis — Cluster specification"
    url: https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/
    kind: official-docs
  - title: "Redis — Scale with Redis Cluster"
    url: https://redis.io/docs/latest/operate/oss_and_stack/management/scaling/
    kind: official-docs
review_status: draft
---

## RDB and AOF

**RDB** writes point-in-time snapshots at configured intervals. The file is compact and fast
to load, and a crash loses everything since the last snapshot.

**AOF** appends every write operation and replays it on startup. It is closer to a real log:
finer durability, a larger file, and a rewrite process that compacts history.

They can be combined, and production stacks usually do: AOF for the recovery point and RDB
for fast restarts and backups. What matters in an answer is naming the loss window rather
than the format.

## fsync policy is the durability dial

`appendfsync always` fsyncs on every write batch: very slow, very safe. `everysec`
fsyncs once a second and may lose up to a second of writes on a disaster. `no` leaves
flushing to the operating system and loses an unbounded amount.

The default is `everysec`, and that one second is the number to say out loud when someone
proposes using Redis as a system of record. It is a fine default for a cache and a
questionable one for a lock or a counter that must not reset.

## Replication and failover

Replication is asynchronous by default: the primary does not wait for replicas to
acknowledge before replying, which is why it is fast and why a failover can lose recent
writes. `WAIT` can block until a number of replicas acknowledge, at the cost of latency
and availability; it makes the loss window smaller, not zero.

A replica can serve reads, which introduces the standard async-replica hazard: read your
own write is not guaranteed. Route read-after-write traffic to the primary or accept that the
user may not see their own update.

Promotion is decided by a sentinel process or by the cluster's own election. Failover takes
time — seconds, not milliseconds — and any client without retry and reconnect logic will
surface it as errors. Idempotent operations plus client-side retry turn a failover into a
latency spike.

## Cluster topology

Redis Cluster shards the keyspace into 16384 hash slots and assigns slot ranges to nodes.
Every key maps to a slot by CRC16 of the key modulo 16384. The client must be cluster-aware:
it asks which node owns a slot and redirects on `MOVED` and `ASK`.

Two consequences shape application design. Multi-key operations must keep all keys in one
slot, which is what hash tags (`{user:42}:profile`) exist for. And transactions and Lua
scripts cannot span slots, so a design that assumed one Redis instance may not survive the
move to a cluster.

Cluster is for capacity and availability at a scale a single node cannot hold. A single node
with a replica and sentinel is simpler, has no cross-slot limitations, and is what most
products should run until memory forces the question. Choosing cluster because a blog post
recommended it is a cost without a benefit.

## What Redis is not

Redis is not a durable system of record unless you have designed for the loss window and
accepted it. It is not a general-purpose queue unless you use streams and accept the memory
bound. It is not fully consistent across replicas, and a read from a replica is a read from
the past. The useful framing in an interview is to say what the data's recovery story is,
because that is what decides which of these properties is acceptable.

## Failure modes

No persistence at all on data that is described as important. `appendfsync no` with a
write-behind design, which is unacknowledged data loss. Reads routed to replicas for
read-after-write flows. A cluster introduced while the application still runs multi-key
operations across slots. And a failover that has never been rehearsed, so the first one is
also the first test.
