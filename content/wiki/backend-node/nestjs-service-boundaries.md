---
slug: nestjs-service-boundaries
title: NestJS modules and the boundary they draw
lang: en
domain: backend-node
topic: architecture
tech:
  name: NestJS
  version_range: ">=11"
levels: [senior, staff]
summary: >-
  A NestJS module is a compile-time boundary, not a deployment boundary. The two are
  routinely confused, and the confusion is what produces services that cannot be split
  later because every module reaches into another module's tables.
prerequisites: []
related: [microservice-boundaries, api-contract-evolution]
sources:
  - title: "NestJS — Modules"
    url: https://docs.nestjs.com/modules
    kind: official-docs
  - title: "NestJS — Microservices"
    url: https://docs.nestjs.com/microservices/basics
    kind: official-docs
review_status: draft
---

## Modules are the boundary you can enforce

A module declares what it owns and what it exports. Anything not exported is invisible to
the rest of the application, enforcement is at compile time, and no review comment is
needed to keep it that way. That is the cheapest boundary in the system, and it is why the
first answer to a scale problem is usually a better module graph rather than another
service.

The failure is a module that exports its repository. Once another module holds an entity's
repository or its ORM entity, both modules now share a table, migrations must be coordinated
by hand, and the boundary exists only in the folder tree.

## What belongs inside one service

One service should own one set of invariants that must change together. Ask what has to be
true at the same time: a payment and its ledger entry, a supplier and its lifecycle state.
Those belong behind one boundary with one transaction. Things that only need to be
*eventually* consistent — the analytics copy, the search index, the notification — do not
belong there, and putting them there is what makes the transaction slow.

Data ownership is the load-bearing part. If two services write one table, they are one
service with a network hop in the middle, and no amount of DTO discipline fixes it.

## Transport is a deployment decision

NestJS lets the same handlers be served over HTTP, gRPC or a message broker by changing the
transport adapter. That is genuinely useful and also a trap: it makes "we could split this
later" feel free, while the thing that actually determines whether a split is possible is
whether the data ownership is already clean. A monolith with clean module ownership splits in
days; one with shared repositories does not split at all.

Use gRPC between internal services where you control both sides — typed contracts, streaming,
and code generation that keeps clients honest — and HTTP/JSON on the public edge where
caching, intermediaries and client diversity matter.

## Where the framework stops helping

NestJS gives structure to modules, injection and transport. It does not give you:

- **Idempotency.** A retried call runs twice. The provider decides what a duplicate
  request means, and it has to be decided per operation.
- **Transactional consistency across services.** Two writes in two services are two
  transactions; the second one can fail after the first committed.
- **Backpressure.** A queue in front of a bounded worker pool is application design, not
  a framework feature.
- **Timeout and retry policy.** Retries without a deadline are how a slow dependency
  becomes an outage.

## Failure modes

Injecting a repository from another module (the boundary becomes decorative). Putting
business rules in guards or interceptors, where nothing can call them in a test. Using the
request-scoped provider for something that should be application-scoped, then paying a new
instance per request. And the common one: catching an exception in an interceptor and
returning 200, which makes every downstream retry policy wrong.
