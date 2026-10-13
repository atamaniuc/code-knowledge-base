---
slug: kafka-dead-letter-handling
title: Dead-letter handling on Kafka
lang: en
domain: messaging
topic: reliability
tech:
  name: Apache Kafka
  version_range: ">=4.0"
levels: [senior, staff]
summary: >-
  One poison message stops a partition, and a partition is a whole throughput lane. The
  design is a bounded retry ladder with a dead-letter topic at the end, plus the boring
  part everyone skips: someone reads the dead-letter topic.
prerequisites: [kafka-consumer-groups-and-rebalancing]
related: [outbox-idempotency-and-sagas, kafka-retention-compaction-and-tiered-storage]
sources:
  - title: "Apache Kafka 4.3 — Consumer Rebalance Protocol"
    url: https://kafka.apache.org/43/operations/consumer-rebalance-protocol/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Design"
    url: https://kafka.apache.org/43/design/design/
    kind: official-docs
  - title: "RabbitMQ — Queues and dead lettering"
    url: https://www.rabbitmq.com/docs/queues
    kind: official-docs
review_status: draft
---

## Kafka has no dead-letter queue

Unlike RabbitMQ, where dead-lettering is a queue feature, Kafka has no built-in dead-letter
mechanism. A consumer that cannot process a record has three options: retry it forever, skip
it, or publish it somewhere else itself. "Kafka dead-letter topic" is a pattern, not a
configuration, and saying so is the first useful sentence in an answer.

The cost of getting it wrong is specific. A consumer that throws inside the poll loop and
does not commit keeps re-reading the same record and never advances: the partition is blocked,
and every other record behind it is delayed indefinitely. Because a partition is a whole lane
of the topic, one malformed message can stall a tenant's entire stream.

Kafka's own retry mechanism makes this worse rather than better. A deserialisation error is
not retried by the broker; a processing error that returns without committing is retried
immediately and forever, producing a hot loop that consumes CPU and logs.

## The retry ladder

The pattern that works:

1. **Retry in place, briefly.** Failures that are transient — a timeout, a connection reset —
   should be retried a small number of times with backoff inside the consumer. If the retry
   succeeds, nothing else happens. If it clamps the partition for seconds, the retry belongs
   in a topic, not in the poll loop.
2. **Retry topics with delays.** Publish the failed record to `orders.retry.5s`, consumed by
   the same handler with a longer pause. Two or three tiers — five seconds, one minute, ten
   minutes — cover most transient downstream outages without a scheduler.
3. **Dead-letter topic.** After the ladder is exhausted, publish to `orders.dlq` with the
   original record and enough metadata to replay it.

A retry topic is a copy, not a move, unless the consumer commits the original offset after
publishing. Getting that wrong is duplicate processing or lost records, and it is the part to
state explicitly.

## What goes in the DLQ envelope

The original payload alone is not enough to act on. The envelope should carry:

- the original topic, partition and offset, so a replay can be idempotent and a support
  engineer can find the record;
- the consumer group and the handler name, because a record may fail in one handler and
  succeed in another;
- the exception class and message, truncated, and the first stack frame;
- the attempt count and timestamps of the first and last attempt;
- a correlation id or trace id from the original request.

The envelope is a schema of its own, and it evolves like any other. Add a schema registration
for it rather than treating it as a JSON blob.

## Operating the dead-letter topic

The failure mode of every DLQ design is that the topic exists, fills with records and nobody
looks. The operating requirements are unglamorous and they are the answer's real content:

- **Alert on DLQ depth and rate**, not on the consumer's error metric alone. A DLQ that grows
  between zero and one forever is normal; one that grows monotonically is an incident.
- **Retention must exceed the response time.** A DLQ with seven-day retention and a weekly
  triage process loses the evidence it was built to keep. Set the retention to match the
  process, or the process to match the retention.
- **A replay path.** Fixing the bug is half; replaying the dead letters idempotently, in order
  per key, without duplicating the ones already handled, is the other half.
- **A cap and a circuit breaker.** If a downstream is down, every record can land in the DLQ
  and turn a recoverable outage into a large replay problem. Pause the consumer instead, or
  fail fast at the source, when the error rate crosses a threshold.

## Failure modes

Throwing inside the poll loop so the partition never advances. Retrying inside the consumer
with unbounded retries and long sleeps. A DLQ nobody monitors. A DLQ with retention shorter
than the triage cycle. Replaying dead letters with a non-idempotent handler. And a DLQ that
holds records from many topics with no envelope identifying their origin, so replay is
guesswork.
