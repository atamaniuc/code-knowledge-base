---
slug: kafka-partitioning-and-ordering
title: Kafka topics, partitions and key choice
lang: en
domain: messaging
topic: partitioning
tech:
  name: Apache Kafka
  version_range: ">=4.0"
levels: [middle, senior, staff]
summary: >-
  A partition is the unit of parallelism, ordering and storage in Kafka, and the key
  decides which partition a record lands in. Every ordering guarantee is per partition,
  so key choice is the decision that a design either gets right or discovers in an
  incident.
prerequisites: [kafka-kraft-architecture]
related: [kafka-consumer-groups-and-rebalancing, outbox-idempotency-and-sagas]
sources:
  - title: "Apache Kafka 4.3 — Design"
    url: https://kafka.apache.org/43/design/design/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Topic Configs"
    url: https://kafka.apache.org/43/configuration/topic-configs/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Consumer and Share Consumer Configs"
    url: https://kafka.apache.org/43/configuration/consumer-configs/
    kind: official-docs
review_status: draft
---

## The partition is the unit

Everything in Kafka scales by partition: throughput, parallelism, the placement of data on
disk, and the ordering guarantee. A topic with N partitions can be consumed by at most N
consumers in one group; a partition lives on one broker in one directory and its size is
bounded by that disk.

The consequence is that two requirements pull in opposite directions. More partitions mean
more parallelism and more open files, more replication work, longer leader elections and
slower metadata operations. Fewer partitions mean a head-of-line bottleneck and a hot disk.
The answer is a number derived from target throughput per partition, not a default.

## Key choice

A record without a key is distributed round-robin (or by sticky partitioner) and gets no
ordering. A record with a key is hashed to a partition, and all records with that key are
ordered relative to each other.

So the key must be the entity whose events must not be reordered — an account, an order, a
device, a tenant. The correct pattern is to ask what the consumer does with the stream: if it
maintains per-account state, key by account; if it joins events from two entities, it needs
either co-partitioning (same key, same partition count) or a state store.

The classic mistake is keying by something that is unique per record, such as a request id,
which spreads evenly and orders nothing. The second mistake is trying to get global ordering
by using no key and one partition, which caps throughput at a single consumer.

## Ordering guarantees, stated precisely

Kafka guarantees order within a partition, and provides that a consumer reads a partition in
offset order. It does not guarantee order across partitions, and it does not preserve producer
order to a partition if retries are enabled without idempotence or if more than one batch is
in flight. That is the mechanical reason `enable.idempotence` matters: it is what keeps the
order of records the producer sent equal to the order they were appended.

Rebalancing interrupts even per-key ordering handling, because a partition moves between
consumers and the new owner may re-read records another consumer already processed. Ordering
plus at-least-once gives duplicates across a rebalance, which is why the consumer must be
idempotent regardless of key choice.

## Counting partitions

A back-of-the-envelope that holds up in an interview: target throughput divided by what one
partition can carry on the slowest broker, rounded up, then multiplied by a headroom factor.
A partition on a modern broker carries tens of megabytes per second; the number to defend is
your own measured one.

Partition counts can be increased but never decreased, and increasing them changes the
mapping from key to partition, which breaks per-key ordering for keys already in flight. That
asymmetry is why the number is worth arguing about before launch: choose a multiple of the
consumer count you expect, add some headroom, and accept that keys will move if you ever grow
it.

Other practical limits: each partition is a set of segment files, so partition count
multiplies open file handles; each replica consumes network bandwidth; and controller
metadata grows with partitions, because each one has a leader election record.

## Hot partitions and skew

Hashing a low-cardinality key produces skew: a tenant with 40% of the traffic puts 40% on one
partition. The fixes are structural — composite keys (`tenant:shard`) that spread one hot
tenant while keeping each shard ordered, or a two-stage design where a hot key is split and
its ordering requirement is solved downstream.

A partition whose lag grows while others are idle is a skew symptom, not a broker problem.
The metric to watch is per-partition lag, not topic-wide lag, because topic-wide lag averages
away exactly the failure that matters.

## Failure modes

No key, then a complaint about out-of-order events. A unique key, giving even distribution and
no ordering. One partition for global order, then a throughput wall. Increasing partitions
without checking what it does to keyed ordering. And a partition count chosen from a blog
post rather than from measured per-partition throughput.
