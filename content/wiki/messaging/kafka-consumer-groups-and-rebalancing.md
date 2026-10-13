---
slug: kafka-consumer-groups-and-rebalancing
title: Kafka consumer groups and the rebalance protocol
lang: en
domain: messaging
topic: consumers
tech:
  name: Apache Kafka
  version_range: ">=4.0"
levels: [senior, staff]
summary: >-
  A consumer group assigns each partition to exactly one consumer. The classic protocol
  rebalances by stopping the world; the new KIP-848 protocol made it incremental and
  server-side, and in 4.3 the client default is still classic.
prerequisites: [kafka-partitioning-and-ordering]
related: [kafka-dead-letter-handling, outbox-idempotency-and-sagas]
sources:
  - title: "Apache Kafka 4.3 — Consumer Rebalance Protocol"
    url: https://kafka.apache.org/43/operations/consumer-rebalance-protocol/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Consumer and Share Consumer Configs"
    url: https://kafka.apache.org/43/configuration/consumer-configs/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Design"
    url: https://kafka.apache.org/43/design/design/
    kind: official-docs
review_status: draft
---

## Groups, partitions and assignment

Consumers that share a `group.id` divide the topic's partitions among themselves. A
partition is assigned to exactly one consumer in the group at a time, which is what gives
per-partition ordering and what caps group parallelism at the partition count. A consumer with
no partition is idle; a partition with no consumer has lag.

The rebalance is the process of redistributing partitions when membership changes. During it,
partitions stop being consumed, which is why rebalance duration is a latency and duplicate
metric rather than an administrative detail.

## Why the classic protocol is expensive

In the classic protocol the group coordinator is on a broker but the assignment is computed
client-side by the group leader consumer, and every rebalance is a global barrier: all members
revoke their partitions, the leader computes a new assignment, and everyone receives it. Even
a cooperative rebalancing variant still requires a round of revocation across the group.

Two configurations drive the failure modes. `max.poll.interval.ms` bounds the time between
polls — a consumer whose processing takes longer is considered dead and removed, triggering a
rebalance that hands its partitions to someone else, which can then also time out. And
`session.timeout.ms` with `heartbeat.interval.ms` detects a dead consumer in the classic
protocol.

A rebalance storm is a distributed feedback loop: a slow consumer triggers a rebalance, which
increases the load on the remaining consumers, which makes another one slow. The observable
symptom is a group whose lag grows while rebalances happen repeatedly, and the fix is
usually to reduce the processing time per poll or to increase the poll interval deliberately,
not to restart consumers.

## The new consumer rebalance protocol

KIP-848 changes the design. Assignment is computed **server-side** by the group coordinator,
and rebalancing is **incremental**: a member learns only about the partitions it gains or
loses, and there is no global synchronization barrier. Group members no longer need to be the
leader that computes assignments, and the protocol scales better with group size.

Apache Kafka 4.0 made it generally available for production workloads. The new protocol also
uses server-side assignors, with the client-side range and sticky assignors mapping to
server-side equivalents.

Two details matter for a 2026 answer. The config is `group.protocol`, with values
`classic` and `consumer`, and in Kafka 4.3 the **default is still `classic`** for the
Java consumer. So "KIP-848 is GA" and "your consumers use it" are different statements.
Also, some classic settings such as `session.timeout.ms` and `heartbeat.interval.ms` do
not apply under the new protocol; the coordinator uses its own liveness tracking.

## Choosing and migrating

New clusters should use `group.protocol=consumer` where the client supports it. Migration is
a rolling restart per group: the protocol is set by the consumers, and a group whose members
disagree is a group in transition, so the rollout should be a deliberate restart of the whole
group rather than a slow rolling change that leaves it split.

The operational reason to care is rebalance time. An incremental rebalance that moves two
partitions out of two hundred is a pause of a few partitions; a classic one stops all of them.
On a large group, that difference is the difference between a blip and a lag spike.

## Failure modes

A consumer doing long synchronous work inside the poll loop, so it exceeds
`max.poll.interval.ms` and is evicted repeatedly. Assuming the new protocol is active
because the broker is 4.x. A group whose members are on mixed protocols for days. Partition
count fixed while consumer count grows, so half the consumers are idle. And committing offsets
before the work is done, which trades duplicates for message loss.
