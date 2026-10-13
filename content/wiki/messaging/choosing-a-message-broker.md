---
slug: choosing-a-message-broker
title: Choosing between Kafka, RabbitMQ, SQS, NATS and Temporal
lang: en
domain: messaging
topic: selection
tech:
  name: Message brokers
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  The broker follows from the flow: is it a stream to replay, a task queue to drain, a
  managed queue with no operations, a lightweight request/reply fabric, or a multi-step
  workflow with durable timers. Naming the flow first is the whole answer.
prerequisites: [kafka-partitioning-and-ordering]
related: [outbox-idempotency-and-sagas, kafka-dead-letter-handling]
sources:
  - title: "Apache Kafka 4.3 — Design"
    url: https://kafka.apache.org/43/design/design/
    kind: official-docs
  - title: "RabbitMQ 4.3 — Queues"
    url: https://www.rabbitmq.com/docs/queues
    kind: official-docs
  - title: "Amazon SQS Developer Guide"
    url: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html
    kind: official-docs
  - title: "NATS JetStream"
    url: https://docs.nats.io/nats-concepts/jetstream
    kind: official-docs
  - title: "Temporal Workflow Execution"
    url: https://docs.temporal.io/workflow-execution
    kind: official-docs
review_status: draft
---

## The flow decides

Candidates lose this question by listing broker features. The answer that lands names the
flow's properties — replay, ordering, fan-out, durability, delay, workflow length, managed
versus self-hosted — and derives the choice.

| Flow | Broker |
|---|---|
| Event stream many consumers replay independently | Kafka |
| Task queue with per-message ack and routing | RabbitMQ |
| Managed queue, no cluster to run, AWS-native | SQS |
| Low-latency messaging, request/reply, edge, IoT | NATS |
| Multi-day workflow with timers, retries, compensations | Temporal |

## Kafka

A partitioned, replayable log. Its defining properties are retention, per-partition ordering
and independent consumer groups reading the same data. It is the right choice for an event
backbone, for change-data capture, and for anything where a new consumer must be able to
replay history. It is the wrong choice for a simple work queue: per-message priority, delayed
delivery and selective acknowledgement are all awkward, and running Kafka is a real
operational commitment.

## RabbitMQ

The classic message queue: exchanges route to queues, a consumer acks a message and it is
removed. Quorum queues give replication and durability. It is the right choice when the
semantics you need are queue semantics — competing consumers, routing keys, per-message TTL,
dead-lettering, priority — and when the message is a task rather than an event. It does not
give replay: once acknowledged, the message is gone.

## SQS

A managed queue with the operational cost moved to AWS. Standard queues are at-least-once with
best-effort ordering; FIFO queues offer exactly-once processing and ordering within a message
group, with lower throughput. The visibility timeout is the core mechanic: a received message
is hidden, not removed, and reappears if the consumer fails to delete it before the timeout.
Choose it when the workload is AWS-native and the team does not want to run a broker. The
trade is a fixed feature set, no replay, and a retention limit.

## NATS

A lightweight messaging system with core publish/subscribe and JetStream for persistence,
replay and consumer semantics. The appeal is latency and operational simplicity, including
edge and embedded deployments. Choose it when the problem is fast request/reply or fan-out
across services and the data volumes do not demand a partitioned log. It is a smaller
ecosystem than Kafka for connectors and streaming tooling.

## Temporal

Not a broker: a durable execution engine. A workflow is code with durable state, timers,
retries and compensation, and its event history is the source of truth. Choose it when the
problem is a business process spanning services and days — a funding flow, an onboarding, a
saga with a failure terminal — because implementing that on a queue means rebuilding durable
timers, retries and state reconstruction. It is the wrong tool for high-throughput data
movement; it is the right tool for a process a human may have to inspect.

## A worked choice

"An order is placed; inventory must be reserved, payment captured, and a confirmation sent,
and a failure halfway must be explainable." Step back from the brokers: the flow has multiple
steps, external calls, long waits for provider confirmation, and a terminal state a human may
own. That is Temporal's shape. Kafka carries the resulting domain events to analytics and
downstream services, because those consumers need replay. Producer-side, the outbox pattern
bridges the database transaction and the topic. The answer that names all three roles — process
engine, event backbone, transactional bridge — is the staff answer, because it is a design
rather than a product pick.

## Failure modes

Choosing Kafka because it is the most impressive option, then implementing delays, priority
and selective acknowledgement on top of it. Choosing SQS for a multi-day workflow and
discovering timers are not a feature. Running a self-hosted broker when the workload is one
queue and no one wants to be on call for it. And treating the broker choice as the hard part
when the actual hard part is the outbox and the idempotent consumer.
