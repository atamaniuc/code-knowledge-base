---
slug: hexagonal-ports-and-adapters
title: "Hexagonal architecture: ports, adapters and what it actually buys"
lang: en
domain: architecture
topic: design
tech:
  name: Hexagonal architecture
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Ports and adapters put the domain at the centre, express what it needs as interfaces, and
  implement those interfaces at the edge. Its value is testability and a swappable
  infrastructure boundary — not a folder layout and not ceremony.
prerequisites: []
related: [ddd-aggregates-and-boundaries, modular-monolith-vs-services]
sources:
  - title: "Alistair Cockburn — Hexagonal architecture (Ports & Adapters)"
    url: https://alistair.cockburn.us/hexagonal-architecture/
    kind: article
  - title: "NestJS — Modules"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/modules.md
    kind: official-docs
review_status: draft
---

## The shape

The application's core contains the domain logic and declares the ports it needs: load this
aggregate, publish this event, call this external service. Adapters implement those ports
for a technology — a Postgres repository, a Kafka publisher, an HTTP client. Dependencies
point inward: the core imports no framework, no ORM and no transport library.

The driving side (HTTP controllers, message consumers, CLI commands) also enters through a
port, so the same use case can be invoked from three transports without the core knowing.

## What it buys

- The domain is testable without a database or a broker, because its collaborators are
  interfaces and the test supplies a simple implementation.
- Infrastructure is replaceable at the boundary, which matters for a database migration or
  a change of message broker.
- The transport is not the application. Adding a gRPC endpoint or a worker does not touch
  the domain.

The second point is what makes it useful in an interview: it is a concrete answer to "how
would you test this without a database" and to "how would you move off this ORM".

## Where it goes wrong

**Ports that mirror the ORM.** A repository interface with one method per query, returning
ORM entities, is an ORM in a different folder; the core is still coupled to persistence
choices. A port should express the domain operation — save this aggregate, find by this
business key — not the SQL.

**Layers that only add mapping.** If every call passes through a DTO, a mapper, a service
and a use case that all carry the same fields, the structure is charging a tax and returning
documentation. Small services do not need four layers.

**Domain-free domain.** A core that contains only data classes and delegates all behaviour
to services has the shape without the benefit; there is no invariant to protect and the
ports have nothing to protect it from.

**An abstraction per dependency.** Ports are worth their cost where the boundary is real:
persistence, messaging, third-party services, time, randomness. Wrapping the standard
library in an interface for symmetry is ceremony.

## When it pays

It pays when there are real invariants, more than one transport or storage technology, and
a team that has to test the domain in isolation. It pays less for a thin CRUD API over one
database, where a direct repository call is honest and shorter.

## Failure modes

Treating hexagonal as a directory convention that every feature must satisfy. Introducing a
port for every dependency so that nothing is direct. Letting framework decorators into the
domain because it was faster. And keeping the interface but leaking the adapter's types
through it.
