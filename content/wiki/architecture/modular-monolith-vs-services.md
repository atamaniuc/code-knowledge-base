---
slug: modular-monolith-vs-services
title: Modular monolith or services
lang: en
domain: architecture
topic: distributed-systems
tech:
  name: Microservices
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  A modular monolith is one deployable with enforced module boundaries; a service split
  trades in-process calls for networks, two transactions and an operational surface. The
  decision is organisational, and the seam must exist before the split is worth making.
prerequisites: [microservice-boundaries]
related: [nestjs-service-boundaries, ddd-aggregates-and-boundaries, cqrs-and-event-sourcing-costs]
sources:
  - title: "Pattern: Database per service"
    url: https://microservices.io/patterns/data/database-per-service.html
    kind: article
  - title: "Pattern: Transactional outbox"
    url: https://microservices.io/patterns/data/transactional-outbox.html
    kind: article
review_status: draft
---

## What a module boundary has to be

A module is a boundary only if it owns its data and exposes an interface. The test is
mechanical: no other module may read or write the module's tables, import its entities, or
call its internals. If two modules share a table, they are one module with two folders, and
they will ship together forever.

Compile-time enforcement is what makes the claim real. In a framework with modules, the
export list is the enforcement; in a plain codebase it is a lint rule or a dependency graph
check in CI. A boundary that relies on reviewers remembering is a preference.

The interface is the seam a future service split follows. Designing it well is the work that
makes the split cheap later; skipping it is why "we will split when we need to" does not
survive contact with the first deadline.

## What the monolith buys

- One transaction for invariants that must change together.
- Function calls instead of the network, with no partial failure and no serialization.
- One deploy, one set of dashboards, one on-call rotation.
- Refactoring across boundaries that is a rename rather than a dual-write migration.

These are not consolation prizes. They are the reason the modular monolith should be the
default until a specific pressure appears.

## What splitting buys, and what it costs

The pressure is organisational: two teams that need to release independently, a component
whose scaling profile is nothing like the rest, or a regulatory boundary. Independent
deploy, independent scaling and independent failure domains are the benefits.

The costs are well known and still underestimated: a network where a function call was,
partial failure as the normal case, two transactions instead of one, per-service deploy and
observability, version skew across a rollout, and debugging across traces instead of a
stack. A senior answer prices them; a staff answer says which of them this organisation
cannot absorb today.

## A decision rule

Split when at least two of these hold: separate teams own the change cadence, one
component needs a materially different scaling profile, a data-isolation requirement exists,
and the module boundary already holds with no shared tables. If no more than one holds, the
answer is a better module graph, not a network.

## Migrating an established monolith

Extract the capability whose data is cleanest first, so the first migration builds the
template and the confidence. Strangle it: route one capability at a time, keep both paths
alive, and make the cutover boring before deleting the old path. The dual-write window is
the part that fails, and it is why an outbox and idempotent consumers are part of the
migration rather than a refinement of it.

## Failure modes

Splitting by noun and creating a service every other service calls synchronously. Keeping
one database "for phase one" forever, which is a distributed monolith with the costs and
none of the benefits. Replacing a transaction with a chain of synchronous calls. And
choosing boundaries before knowing who will be on call for the new service.
