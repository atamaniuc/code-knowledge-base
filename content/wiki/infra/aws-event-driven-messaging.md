---
slug: aws-event-driven-messaging
title: "SQS, SNS and EventBridge: queues, fan-out and DLQs"
lang: en
domain: infra
topic: aws
tech:
  name: AWS
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  SQS is a queue, SNS is publish-subscribe fan-out, and EventBridge is a routing
  bus with rules and replay. Delivery is at-least-once, so the consumer's
  idempotency and a dead-letter queue with an alarm are part of the design, not
  afterthoughts.
prerequisites: [aws-compute-selection]
related: [aws-iam-least-privilege, aws-cost-and-right-sizing]
sources:
  - title: "Amazon SQS: Using dead-letter queues"
    url: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html
    kind: official-docs
  - title: "Amazon SNS Developer Guide: What is Amazon SNS?"
    url: https://docs.aws.amazon.com/sns/latest/dg/welcome.html
    kind: official-docs
  - title: "Amazon EventBridge: What is Amazon EventBridge?"
    url: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html
    kind: official-docs
review_status: draft
---

## Queue or bus

The first design decision is whether the message has one consumer or many, and whether
routing is the producer's business.

A queue is point-to-point: one logical consumer drains it, work is distributed, and the
queue is the buffer that absorbs a burst. SQS.

Publish-subscribe is fan-out: one published event, many independent subscribers, each with
its own copy and its own failure. SNS.

An event bus adds routing to publication: the publisher does not know the consumers, rules
match on event content, and the bus supports schema discovery and replay. EventBridge.

The anti-pattern to name is using a queue between services that actually need a broadcast,
because then every new consumer requires the producer to change.

## SQS

SQS comes in two flavours and the choice is a correctness decision, not a performance one.
A standard queue gives at-least-once delivery and best-effort ordering, with very high
throughput. A FIFO queue gives deduplication and strict ordering within a message group,
with lower throughput and a requirement that each message carries a group ID.

At-least-once means every consumer must be idempotent. A message can be delivered twice
because a delete succeeded but the response was lost; the handler that charges a card must
tolerate seeing the same message again. That is a property of the consumer, not something
the queue fixes.

The visibility timeout is the other core mechanic. When a consumer receives a message, it
becomes invisible for that period; if processing finishes and the message is deleted, the
work is done; if the consumer dies, the message becomes visible again and is redelivered.
A visibility timeout shorter than the maximum processing time produces duplicates by
design, and a very long one delays recovery from a crash. Long polling reduces empty
responses and cost.

## SNS

SNS topics publish to subscriptions, which can be SQS queues, Lambda functions, HTTPS
endpoints, and more. It is the fan-out primitive: one event, many downstream systems, each
with its own queue and its own retry behaviour.

Two features matter in production. Message filtering lets a subscription receive only the
events matching a policy, so a fan-out does not force every subscriber to receive and
discard everything. Fifo topics provide ordering and deduplication for workloads that need
them, and they pair with FIFO queues.

SNS is not durable storage: a subscription that is unavailable may miss a message or have
it delivered to its own dead-letter queue, depending on configuration. A subscriber that
must not miss events should subscribe a queue, not an endpoint that processes inline.

## EventBridge

EventBridge is the strongest answer when producers and consumers should not know each
other. Producers put events on a bus; rules match on the event pattern and route to targets
in the same or another account. It adds a schema registry, archive and replay, and
scheduled rules, which makes it the natural place for cross-team and cross-account eventing.

The trade-off is that a bus is heavier than a queue and its routing is coarse: complex
workflow belongs in a workflow engine, not in a growing pile of rules. And replay is a
superpower that has to be used carefully — replaying events into a non-idempotent consumer
duplicates the effect of everything that was replayed.

## Dead letters and retries

Every queue and subscription needs a failure destination, and the destination needs an
alarm. A dead-letter queue with no alarm is a silent data-loss bucket: messages
accumulate, the consumer looks healthy, and nobody notices until reconciliation.

For SQS the mechanism is a redrive policy with a maxReceiveCount: after that many failed
receives, the message moves to the DLQ. Setting the count requires knowing what a
transient failure looks like; too low and a blip fills the DLQ, too high and a poison
message burns the queue's throughput for hours.

Retries should be exponential with jitter in the consumer, and partial batch failures
should be reported so a batch of ten messages is not entirely redelivered because one
failed. For Lambda, the on-failure destination or DLQ captures what the function could not
process after its own retries.

The operational loop that makes this real: alarm on DLQ depth, inspect the messages, fix
the consumer, then redrive the DLQ rather than deleting it. Deleting a DLQ without reading
it is discarding the incident report.
