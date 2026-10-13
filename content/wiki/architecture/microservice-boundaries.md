---
slug: microservice-boundaries
title: Drawing microservice boundaries from data ownership
lang: en
domain: architecture
topic: distributed-systems
tech:
  name: Microservices
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  A service boundary is a data-ownership decision, not a code-organisation one. The teams
  that split by technical layer get a distributed monolith; the ones that split by the
  invariants that must change together get services they can deploy on their own.
prerequisites: []
related: [nestjs-service-boundaries, consistency-models-and-business-tolerance]
sources:
  - title: "Pattern: Database per service"
    url: https://microservices.io/patterns/data/database-per-service.html
    kind: article
  - title: "Pattern: Saga"
    url: https://microservices.io/patterns/data/saga.html
    kind: article
review_status: draft
---

## Split by ownership, not by layer

The question that produces a working boundary is "what must be true at the same time?".
Money leaving an account and the ledger entry that records it are one invariant and belong
behind one transaction. A technical layer — controllers, business logic, persistence — is not
a boundary at all, because every layer needs the same data.

Once the ownership question is answered, the second question qualifies it: can this data be
*eventually* consistent with the rest of the system, and is the business willing to live in
that window? Anything that cannot tolerate the window stays in the same service.

## The bill you are paying

Splitting buys independent deployment and independent scaling. It costs:

- **A network where a function call used to be.** It can be slow, it can fail, it can
  succeed while the answer is lost.
- **Two transactions instead of one.** Partial failure is now the normal case and needs a
  compensating action or an outbox — not a rollback.
- **Operational surface.** Each service has its own deploy, dashboards, alerts, on-call
  runbook and version skew.
- **Debugging across traces rather than a stack trace.**

A senior answer names the cost before proposing the split. A staff answer says which of
these the organisation currently cannot absorb.

## When a modular monolith is the right answer

Below roughly one team's worth of independent deployment pressure, a modular monolith with
enforced module boundaries is cheaper on every axis, and it can be split later — the module
graph is the seam. Microservices are not a maturity level; they are a trade for
organisational scaling that is only worth it when two teams genuinely need to release
independently.

The tell that a split is premature: the same two people operate every service, one release
touches three of them, and the data is still in one database.

## Migrating a monolith

Strangle the edges. Route one capability at a time through the new service while the old
path stays alive, keep both writing through one source of truth until the cutover is boring,
and only then remove the old path. The dangerous step is the dual-write window; that is what
an outbox and idempotent consumers exist for.

## Failure modes

Splitting by noun because the nouns are in the domain model (a "User service" that every
other service synchronously calls, which is a database with extra latency). Sharing one
database between services and calling it "phase one" forever. Replacing a transaction with a
chain of synchronous calls, which is neither consistent nor available. And choosing the
boundaries before knowing who owns the on-call rotation.
