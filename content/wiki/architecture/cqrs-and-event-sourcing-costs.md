---
slug: cqrs-and-event-sourcing-costs
title: CQRS and event sourcing, and what they cost
lang: en
domain: architecture
topic: design
tech:
  name: Event-driven architecture
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  CQRS separates the write model from the read models; event sourcing makes the event log
  the source of truth. Both solve real problems and both add a projection lifecycle,
  eventual consistency and a schema that must be versioned forever.
prerequisites: [ddd-aggregates-and-boundaries]
related: [modular-monolith-vs-services, consistency-models-and-business-tolerance]
sources:
  - title: "Martin Fowler — CQRS"
    url: https://martinfowler.com/bliki/CQRS.html
    kind: article
  - title: "Pattern: Command Query Responsibility Segregation (CQRS)"
    url: https://microservices.io/patterns/data/cqrs.html
    kind: article
  - title: "Pattern: Event sourcing"
    url: https://microservices.io/patterns/data/event-sourcing.html
    kind: article
review_status: draft
---

## CQRS is a model split, not a database mandate

The write side handles commands, enforces invariants and produces the change. The read side
serves queries from a model shaped for reading. The two can share a database — a materialised
view, an indexed projection, even a differently normalised set of tables — and often should,
because a separate datastore is an operational commitment, not a definitional requirement.

What CQRS buys: reads stop competing with writes for the aggregate and the lock; each side
can be scaled and indexed for its own access pattern; the read model can be a denormalised
shape that would be wrong to maintain by hand.

What it costs: a propagation step between the two models, a window in which a write is not
yet visible to its own read, and a projection that can lag or fail. The client experience
question — "I saved it, why is it not in the list" — is a product decision that has to be
made, usually with read-your-writes on the writing session.

## Event sourcing is a different commitment

Event sourcing stores the sequence of domain events as the source of truth and derives
state by replay. It provides a complete audit log, temporal queries, and the ability to
build new projections from history. The costs are structural:

- **Event schema evolution is forever.** Every event ever written must remain readable;
  upcasting and versioning are permanent responsibilities.
- **Projections are a production system.** They need lag metrics, rebuild procedures,
  idempotent handlers, and a way to add a new projection over years of history.
- **Snapshots and replay time.** An aggregate with a hundred thousand events needs
  snapshotting, which introduces its own consistency questions.
- **Eventual consistency in the read model**, with all the UX and reconciliation work that
  implies.
- **Team skill.** The failure mode is a team that builds an event-sourced write side and a
  synchronous read side, keeping all the cost and none of the benefit.

## When they pay

Event sourcing pays where an audit trail is a requirement (payments, ledgers, regulated
processes), where temporal queries — "what did this look like on the day of the dispute" —
are needed, or where several projections from the same history are genuinely valuable.
CQRS alone pays where read and write shapes have diverged enough that one model is
constraining the other.

For a CRUD domain with a reporting need, a read replica and a view are cheaper on every
axis, and the honest answer says so.

## The pragmatic middle

An append-only audit table or a change-data-capture stream gives the audit and the
integration without making events the source of truth. That is often the right first step,
and it keeps the door open: if the log later becomes authoritative, the data is already
there.

## Failure modes

Adopting event sourcing for a domain whose events are really CRUD diffs. Building CQRS and
ignoring the read-your-writes problem, then adding a sleep. Treating an event as a database
row with a schema you can change. Projecting into a store with no lag metrics. And choosing
the pattern from a conference talk rather than from an audit or query requirement.
