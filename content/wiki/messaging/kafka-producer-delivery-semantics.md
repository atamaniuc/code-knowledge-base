---
slug: kafka-producer-delivery-semantics
title: Kafka producer acks, idempotence and transactions
lang: en
domain: messaging
topic: delivery
tech:
  name: Apache Kafka
  version_range: ">=4.0"
levels: [senior, staff]
summary: >-
  acks decides how many replicas must acknowledge; idempotence decides whether a retry
  can duplicate; transactions decide whether a set of writes and offsets commits
  together. They are three separate dials and conflation of them is the usual wrong
  answer.
prerequisites: [kafka-partitioning-and-ordering]
related: [outbox-idempotency-and-sagas, kafka-consumer-groups-and-rebalancing]
sources:
  - title: "Apache Kafka 4.3 — Producer Configs"
    url: https://kafka.apache.org/43/configuration/producer-configs/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Topic Configs (min.insync.replicas)"
    url: https://kafka.apache.org/43/configuration/topic-configs/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Design (message delivery semantics)"
    url: https://kafka.apache.org/43/design/design/
    kind: official-docs
review_status: draft
---

## acks

`acks` controls how many replicas must have written a record before the producer considers
the send successful.

- `acks=0`: fire and forget. The producer does not wait; a broker failure loses the record
  silently. Only for data whose loss is genuinely irrelevant.
- `acks=1`: the leader has written it. If the leader dies before followers replicate, the
  record is lost even though the producer was told it succeeded.
- `acks=all` (or `-1`): every in-sync replica has acknowledged.

`acks=all` alone is not durability. It is durability together with
`min.insync.replicas`, which is a topic configuration: with a replication factor of three
and `min.insync.replicas=2`, a write succeeds when two replicas hold it, and the producer
sees an error rather than silent loss when only one is available. Without it, `acks=all`
with a single remaining in-sync replica is exactly `acks=1`.

The pair is the thing to say together. A candidate who says `acks=all` and stops has said
half of the durability configuration.

## Idempotence

A producer that retries can append the same record twice: the broker wrote it, the
acknowledgement was lost, the producer retried. `enable.idempotence=true` makes the broker
deduplicate by producer id and sequence number, so a retry does not duplicate.

It requires `acks=all` and `max.in.flight.requests.per.connection <= 5`, and it also
fixes ordering under retry: without it, a batch that fails and is retried can land after a
later batch that succeeded, reordering records. The Kafka documentation states that allowing
retries with idempotence off and more than one in-flight request can change ordering for
exactly this reason.

Idempotence is per producer session and per partition. It does not deduplicate across a
producer restart, and it does not deduplicate two different producers writing the same logical
event. That is what a business idempotency key or a transactional outbox is for.

## Transactions

Kafka transactions make a set of produced records and a set of consumer offsets commit
atomically. A stream processor reads from one topic, writes to another, and commits its input
offsets in the same transaction, which gives exactly-once processing *within Kafka*.

The consumer side requires `isolation.level=read_committed`, so it does not see records from
aborted or uncommitted transactions. The default is `read_uncommitted`, which means a
consumer that changes nothing reads records that may be rolled back.

Transactions have a cost: they add a transaction coordinator, a timeout to tune, and a marker
written to each participating partition, which hurts consumers scanning partitions. They solve
the Kafka-to-Kafka case. They do not make a database write and a Kafka produce atomic — that
is still the dual-write problem, solved by an outbox.

## Delivery timeout and batching

`delivery.timeout.ms` bounds the total time a record may spend being retried; when it
expires the send fails. It must be larger than the sum of `request.timeout.ms` and
`linger.ms`, or the producer errors before it can retry. Retries are bounded by
`retries`, which defaults to a large value and interacts with the delivery timeout.

Throughput comes from batching: `linger.ms` waits a little to fill a batch and
`batch.size` caps it. Raising linger to a few milliseconds can multiply throughput at the
cost of a few milliseconds of latency, which is a trade worth stating explicitly rather than
tuning blindly.

## What exactly-once means

Exactly-once delivery over a network does not exist; what exists is exactly-once processing,
built from at-least-once delivery plus idempotent effects. In Kafka, transactions plus
`read_committed` deliver exactly-once for a pipeline whose every step is Kafka. The moment a
step is an HTTP call to a payment provider or an insert into PostgreSQL, the guarantee must be
re-established there — a unique constraint, an idempotency key, a conditional update.

An answer that claims end-to-end exactly-once without saying how the non-Kafka step
deduplicates is the answer an interviewer will follow up on.

## Failure modes

`acks=all` with `min.insync.replicas=1` and a belief in durability. Idempotence off with
retries on, followed by a mystery ordering bug. `read_uncommitted` consumers reading aborted
transaction records. A transaction timeout shorter than the processing step. And a dual write
to a database and a topic, with a transaction used as if it covered both.
