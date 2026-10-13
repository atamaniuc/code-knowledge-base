---
slug: consistency-models-and-business-tolerance
title: Consistency models, and what the business can tolerate
lang: en
domain: architecture
topic: distributed-systems
tech:
  name: Distributed systems
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Strong consistency is a cost, not a virtue. The useful skill is naming which invariants
  need it, which reads need read-your-writes, and what the business actually loses inside
  the eventual-consistency window.
prerequisites: [microservice-boundaries]
related: [cqrs-and-event-sourcing-costs, resiliency-timeouts-retries-and-bulkheads]
sources:
  - title: "Jepsen — Consistency models"
    url: https://jepsen.io/consistency
    kind: article
  - title: "Pattern: Saga"
    url: https://microservices.io/patterns/data/saga.html
    kind: article
  - title: "Pattern: Transactional outbox"
    url: https://microservices.io/patterns/data/transactional-outbox.html
    kind: article
review_status: draft
---

## The spectrum, briefly

Linearizable reads and writes behave as if there were one copy and one operation at a time.
Causal consistency preserves cause and effect but not a global order. Read-your-writes
guarantees a client sees its own update. Monotonic reads guarantee a client never goes
backwards in time. Eventual consistency only promises that replicas converge if writes stop.

The names matter less than the mapping: each is a promise about what a client can observe,
and each is bought with latency, availability or coordination.

## Choose by invariant, not by preference

Money movement, inventory reservation and uniqueness constraints need a strong boundary —
one aggregate, one transaction, one primary. A search index, a feed, a recommendation and an
analytics copy do not; they need eventual consistency with a lag metric and a reconciliation
path.

The interview answer separates three questions: what must be atomically true, what a client
must see immediately after its own write, and what may be stale for a bounded time with a
visible indicator.

## Eventual consistency is a product decision

The window is not an implementation detail. A user who transfers money and then does not see
the new balance will file a support ticket even if the ledger is correct. The technical
answers — read-your-writes on the writing session, a version token the read side waits on, a
"processing" state in the UI — are all ways of hiding the window from the user; none of them
removes the window from the system.

What the business must decide: how long the window may be, what the user sees inside it,
what happens when a projection lags past the SLA, and how inconsistencies are detected and
repaired. An architecture that makes the window smaller but does not name it has not
answered the question.

## Mechanisms worth naming

- **Read-your-writes** by routing the writer's subsequent reads to the primary, or by
  tracking a version and waiting for the replica to catch up.
- **Idempotent consumers** so a redelivered event does not double-apply, and a dedupe store
  keyed by event id.
- **Outbox** so the database change and the publication are atomic, with a relay that
  retries; the alternative is publishing inside a transaction and losing events on rollback
  or publishing after commit and losing them on a crash.
- **Reconciliation** as a job that compares the derived state to the source of truth and
  repairs drift, because a projection will drift eventually.
- **Turn-around-time and staleness metrics**, so the window is observable rather than
  assumed.

## Failure modes

Claiming strong consistency while reading from a replica. Choosing eventual consistency for
an invariant that cannot tolerate it — a uniqueness check that admits duplicates under
concurrent writes. Publishing events after commit with no outbox and calling the lost events
rare. Adding a read model with no lag metric, so nobody knows it is hours behind. And
treating "eventually consistent" as a licence to skip reconciliation.
