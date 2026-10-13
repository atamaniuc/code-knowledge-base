---
slug: postgres-logical-replication-and-read-models
title: Logical replication and building read models
lang: en
domain: data
topic: replication
tech:
  name: PostgreSQL
  version_range: ">=16"
levels: [senior, staff]
summary: >-
  Logical replication ships decoded row changes, so a subscriber can project them into a
  different schema, a different engine or a read model. It is a pipeline with at-least-once
  semantics, which means the projection has to be idempotent.
prerequisites: [postgres-mvcc-isolation-and-locking]
related: [outbox-idempotency-and-sagas, postgres-ledger-design]
sources:
  - title: "PostgreSQL 18 — Logical Replication"
    url: https://www.postgresql.org/docs/18/logical-replication.html
    kind: official-docs
  - title: "PostgreSQL 18 — Transaction Isolation"
    url: https://www.postgresql.org/docs/18/transaction-iso.html
    kind: official-docs
review_status: draft
---

## Logical versus physical

Physical replication copies WAL blocks and produces an identical cluster — same major
version, same everything. Logical replication decodes WAL into row-level changes and applies
them through ordinary SQL, so the subscriber can have a different schema, different indexes,
extra tables, or be a different system entirely.

The price of that freedom is that the subscriber applies writes, and writes can conflict. A
logical subscriber is a replica that can diverge.

## Publications and subscriptions

Publish a set of tables on the source:

`@sql
CREATE PUBLICATION orders_pub FOR TABLE orders, order_items;
`@

and subscribe on the target:

`@sql
CREATE SUBSCRIPTION orders_sub
  CONNECTION 'host=primary dbname=app'
  PUBLICATION orders_pub;
`@

Initial sync copies each table's existing rows, then streaming continues from that point.
The usual production pattern is to create the tables empty on the subscriber, let the
initial sync run, and only then create the indexes and constraints — applying them after the
bulk copy is far faster and avoids maintaining them per row.

Row filters and column lists narrow what travels, which is how a subscriber avoids receiving
a table's sensitive columns. A `REPLICA IDENTITY` must be set so updates and deletes carry
enough information to locate the row; without a primary key the default identity is
insufficient and updates fail.

## Read models and projections

A read model is a table shaped for one query, fed by a change stream. The publisher sends
row changes; the projection applies them to its own schema. Three properties decide whether
it works.

- **Idempotency.** If the subscriber restarts mid-batch it may reapply a change. The
  projection must be an upsert keyed by the source primary key, or a conditional update
  guarded by a version, not an insert that duplicates.
- **Ordering.** Changes for one row arrive in commit order; changes across independent
  transactions are not a total order you can rely on for cross-row invariants. A projection
  that aggregates several rows must recompute rather than increment.
- **Lag as a product decision.** The subscriber is behind by milliseconds, seconds or hours.
  Whatever reads it must state how stale it may be, and the answer differs for a dashboard
  and for a payment authorisation.

## Conflicts and failure handling

Conflicts happen when the subscriber already contains a conflicting row — a duplicate key, a
missing referenced row, an update to a row that does not exist. The subscription can be
configured to error out, skip the change, or apply it anyway; erroring is the honest default
because the alternatives hide divergence.

The recovery moves are to find and fix the conflicting rows, then advance the subscription
past the failing transaction. A subscription whose conflict counter is climbing silently is
a read model that is quietly wrong.

## Operational reality

A logical replication slot retains WAL until the subscriber confirms it. An idle or broken
subscriber therefore fills the publisher's disk. Monitor slot lag and disk use, and drop
unused slots deliberately rather than discovering them during an incident.

Schema changes on the published table must be applied to the subscriber too; a column added
upstream is not replicated in its DDL form. Keep a migration order: subscriber first for
additive changes, publisher first for destructive ones.

## Failure modes

A projection that inserts rather than upserts, so a restart duplicates rows. A read model
with no stated staleness bound, read by code that needs current data. An abandoned
replication slot consuming the primary's disk. And a subscriber used as a failover target
without ever having been promoted and tested.
