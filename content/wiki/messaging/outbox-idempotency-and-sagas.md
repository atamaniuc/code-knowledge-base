---
slug: outbox-idempotency-and-sagas
title: Outbox, idempotent consumers and sagas
lang: en
domain: messaging
topic: consistency
tech:
  name: Apache Kafka
  version_range: ">=4.0"
levels: [senior, staff]
summary: >-
  A service that commits to its database and then publishes to a broker is writing to two
  systems that can disagree. The outbox, idempotent consumers and compensation are the three
  pieces that make that disagreement survivable instead of invisible.
prerequisites: []
related: [microservice-boundaries, api-contract-evolution]
sources:
  - title: "Pattern: Transactional outbox"
    url: https://microservices.io/patterns/data/transactional-outbox.html
    kind: article
  - title: "Apache Kafka — Design and delivery semantics"
    url: https://kafka.apache.org/documentation/#semantics
    kind: official-docs
review_status: draft
---

## At-least-once is the only guarantee worth designing for

Brokers give you at-least-once or at-most-once. Exactly-once delivery over a network is not
on the menu: the consumer must acknowledge, the acknowledgement can be lost, and the broker
must choose between redelivering and dropping. Choose redelivery — a duplicate you can
detect is recoverable, a lost message is not — and then make every consumer idempotent.

Any claim of "exactly once" in a design answer means exactly-once *processing* built on top
of at-least-once delivery plus deduplication, and the answer should say so.

## The dual-write problem

Committing a row and then producing a message are two operations. If the process dies
between them the message is lost while the state change stands; if the produce succeeds and
the commit fails, the world is told about something that did not happen.

The transactional outbox removes the gap by writing the event into the *same* database
transaction as the state change, into an outbox table. A relay — polling or change-data
capture — publishes those rows and marks them sent. The state change and the intention to
publish now commit or fail together, and the worst case is a duplicate publish, which is the
case the consumers already handle.

Do not fix this with a distributed transaction unless you enjoy coordinating the
availability of every participant; two-phase commit across services is a career-limiting
dependency.

## Idempotent consumers

A consumer is idempotent when processing the same message twice leaves the same state. The
practical forms:

- **Deduplicate on a business key.** Record processed message ids or idempotency keys in the
  same transaction as the effect. This is the general answer and it needs a unique
  constraint, not a check-then-insert race.
- **Make the write naturally idempotent.** An absolute state assignment, an upsert keyed by
  the event, a conditional update guarded by the expected previous state.
- **Key the downstream call.** If the consumer calls a payment provider, the provider's own
  idempotency key derived from the message id is the deduplication.

Anything that increments a counter, appends without a key, or sends an email needs one of
the three, and the answer should name which.

## Ordering and partitioning

Ordering is per partition, not per topic, and the key decides the partition. Choose the
entity that must not be reordered — the account, the order, the supplier — and accept that
different entities are processed in parallel. A global ordering requirement across all keys
means a single partition, which means a single consumer, which is usually not what the
product wants.

Rebalancing pauses partitions; consumers that assume they will see every event in order
across keys will be wrong under rebalance even when the key is right.

## Saga: orchestration or choreography

A business process spanning services cannot hold a lock across them, so it is modelled as
local transactions plus compensations. Choreography — each service reacts to events — is
simple for two or three steps and becomes a flow nobody can see at five. Orchestration puts
the sequence in one explicit place with a state machine, timeouts and a visible current
step; it costs a central component and a single place to watch.

Either way the steps must be *commutative or compensated*, retries must be bounded, and the
saga needs a terminal state for "we could not finish, a human must look". A saga with no
failure terminal is a promise to loop forever.

## Failure modes

Publishing inside the transaction through the ORM's event hooks and believing it is
transactional. Outbox rows with no retention policy, growing forever. Deduplication keyed on
the payload rather than a message id. Compensations that are not idempotent themselves.
And dead-letter queues nobody reads, which is where correctness goes to be forgotten.
