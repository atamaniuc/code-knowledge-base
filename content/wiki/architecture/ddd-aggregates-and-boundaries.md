---
slug: ddd-aggregates-and-boundaries
title: DDD aggregates, and where the model breaks down
lang: en
domain: architecture
topic: design
tech:
  name: Domain-driven design
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  An aggregate is a consistency boundary: the unit that changes in one transaction and
  enforces one set of invariants. Aggregates that grow to mirror the domain's nouns are the
  ones that produce lock contention and eventually-consistent accidents.
prerequisites: []
related: [hexagonal-ports-and-adapters, cqrs-and-event-sourcing-costs, modular-monolith-vs-services]
sources:
  - title: "Pattern: Database per service"
    url: https://microservices.io/patterns/data/database-per-service.html
    kind: article
  - title: "Pattern: Saga"
    url: https://microservices.io/patterns/data/saga.html
    kind: article
review_status: draft
---

## An aggregate is a transaction boundary

The aggregate is the cluster of objects that must be consistent at the end of a
transaction. One aggregate is modified per transaction; the root is the only entry point;
other aggregates are referenced by identity rather than by object reference, so loading one
does not drag in another.

That definition is operational, not philosophical. If two objects must satisfy an invariant
together, they are one aggregate. If they only need to agree eventually, they are two
aggregates and the agreement is a process.

## Designing one that survives production

- Keep it small. The unit of consistency is also the unit of locking, so a large aggregate
  serialises every write that touches it.
- Put the invariant inside the root, not in a service that manipulates it from outside.
- Refer to other aggregates by id, and resolve them when needed.
- Make the boundary explicit in the repository interface: load and save the aggregate, not
  its parts.

## Where the model breaks down

**The aggregate that grows with usage.** An order with ten thousand line items is a
consistency boundary nobody needs: the invariant is on the order header, and the lines are
append-mostly. Splitting line items into their own aggregate turns a lock into throughput,
at the cost of a total that must be computed or projected.

**Aggregates derived from the database schema.** Merging every table joined by a foreign key
produces an aggregate per report, and then every write competes with long reads. The
boundary should come from the invariant, not the join.

**Cross-aggregate invariants enforced in one transaction.** "The sum of all transfers is
zero" or "the account balance never goes below zero across accounts" cannot be enforced by
one aggregate without pulling both into one lock. The honest options are a saga with
compensations, a reservation, or a redesign that makes the invariant local.

**Bounded contexts ignored.** The same word means different things in different contexts —
a "customer" in support and a "customer" in billing are different models with different
lifecycles. Sharing one entity across contexts couples their changes and produces a
god-object.

## The consistency question is the interview

The strong answer names what must be strongly consistent, what may be eventually consistent,
and what the business loses in the window. That is a product decision expressed as an
architecture decision, and it is the difference between reciting aggregate definitions and
having designed one.

## Failure modes

One aggregate per table, or one aggregate for the whole bounded context. Enforcing a
cross-aggregate rule with a distributed transaction. Loading an aggregate to answer a read
query. And letting a service layer mutate aggregate internals, so the invariant is enforced
in two places and eventually in neither.
