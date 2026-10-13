---
slug: postgres-schema-design-and-normalisation
title: PostgreSQL schema design and when to denormalise
lang: en
domain: data
topic: schema-design
tech:
  name: PostgreSQL
  version_range: ">=16"
levels: [middle, senior, staff]
summary: >-
  Normalisation is a tool for making an invariant impossible to violate, not a rule to
  be maximised. The senior decision is which invariants the database enforces, which
  duplication is deliberate, and which read is allowed to be fast at the cost of a
  write.
prerequisites: []
related: [postgres-ledger-design, postgres-query-plans-and-indexing]
sources:
  - title: "PostgreSQL 18 — Constraints"
    url: https://www.postgresql.org/docs/18/ddl-constraints.html
    kind: official-docs
  - title: "PostgreSQL 18 — JSON Types"
    url: https://www.postgresql.org/docs/18/datatype-json.html
    kind: official-docs
  - title: "PostgreSQL 18 — Release Notes"
    url: https://www.postgresql.org/docs/18/release-18.html
    kind: release-notes
review_status: draft
---

## Normalise until the invariant is enforced

Normal form is a means, and the end is that a class of bad state cannot be represented.
Third normal form removes update anomalies because one fact lives in one place; the reason
to reach it is that two copies of a fact can disagree, and nothing in the database stops
them.

The question to ask of every table is not "is this normalised" but "which invariant does
this shape make impossible". If the answer is none, the shape is decoration.

## Constraints are the design

A schema that relies on the application to enforce its rules is a schema with no rules.
PostgreSQL can express most of them: `NOT NULL` and `CHECK` for the value domain,
`UNIQUE` for identity, `FOREIGN KEY` for referential integrity, and `EXCLUDE` for
"no two rows may overlap" — a booking table, a reservation window, an effective-dated
price.

Use the strongest constraint that fits, and check whether it can be added without a long
lock. A `CHECK` added as `NOT VALID` and then `VALIDATE CONSTRAINT` does not block
reads or writes of unrelated rows, which is how a rule gets enforced on a billion-row table
without a maintenance window.

## Where denormalisation pays

Three cases where a duplicated or precomputed value is the right answer:

- **A read model.** A balance, a count, a last-event timestamp recomputed on every read
  gets slower linearly and is read far more than it is written. Maintain it in the same
  transaction as the fact, and reconcile it.
- **A shape that avoids a join on the hot path.** Copying a display name onto an order
  freezes the value at the time of the order, which is usually the semantically correct
  behaviour rather than an accident.
- **A materialised view or summary table** for reporting, refreshed on a schedule, so the
  transactional table is never scanned by an analyst.

Each of the three needs an owner for staleness: who reads it, how stale it may be, and what
detects drift. A denormalised column with no reconciliation story is a bug with a delivery
date.

## Types that carry their own constraints

The column type is the cheapest constraint. `numeric` for money, never `float`;
`timestamptz` rather than a naive `timestamp`; a lookup table or a checked domain rather
than a free string. PostgreSQL 18 adds `uuidv7()`, which generates timestamp-ordered
UUIDs — a random v4 primary key inserts into the middle of the B-tree and fragments it,
while a time-ordered key appends.

`jsonb` is not a substitute for a schema. It is right for genuinely open attributes that
arrive from outside and are read whole; it is wrong for fields you query, constrain or
join, because every one of those becomes an expression index or a GIN index and the
database can no longer enforce the shape. A `jsonb` column whose keys are known is a table
that has not been written yet.

## The cost of every index

Every index is a second write and a second thing to keep correct under concurrency. A
write-heavy table with eight indexes pays eight times on every insert before it serves a
single read. Add the index the access path needs, not the one that looks tidy, and check
with `EXPLAIN (ANALYZE, BUFFERS)` that it is the one the planner picks.

## Failure modes

A balance column with no ledger behind it. A `jsonb` blob that duplicates relational
fields and drifts from them. Enforcing "one active subscription per user" in application
code, where two concurrent requests both pass the check. `float` money. And a table whose
constraints exist only in a migration file nobody reruns.
