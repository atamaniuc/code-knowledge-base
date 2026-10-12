---
slug: postgres-ledger-design
title: Designing a ledger schema in PostgreSQL
lang: en
domain: data
topic: schema-design
tech:
  name: PostgreSQL
  version_range: ">=16"
levels: [senior, staff]
summary: >-
  A ledger is an append-only table with invariants the database itself enforces, plus a read
  model shaped for the queries that actually run. The mistakes are making the balance a
  column and letting a report query scan the hot table.
prerequisites: []
related: [outbox-idempotency-and-sagas, microservice-boundaries]
sources:
  - title: "PostgreSQL — Indexes"
    url: https://www.postgresql.org/docs/current/indexes.html
    kind: official-docs
  - title: "PostgreSQL — Transaction isolation"
    url: https://www.postgresql.org/docs/current/transaction-iso.html
    kind: official-docs
review_status: draft
---

## Append, never update

A ledger entry is a fact about something that happened, so the table is insert-only and a
correction is another entry that reverses the first. That gives an audit trail for free,
makes the history reconstructible, and removes the lost-update race that comes with
read-modify-write on a balance column.

Enforce the invariants where they cannot be bypassed. A deferred constraint trigger can check
that an account's entries sum to the balance the transaction claims, and that every
transaction's debits equal its credits — inside the transaction, so a violation rolls the
whole thing back. Application-level checks are advisory; the database is the last line.

Money is an integer in minor units. A float balance is a defect, not a rounding detail.

## Balances are a read model

Summing the ledger on every read is correct and gets slower every day. Keep a balance that is
updated in the same transaction as the entry — one row per account, the contention point is
per account rather than per table — and treat it as a cache with a reconciliation job that
recomputes from entries and alerts when they disagree. The reconciliation is not optional;
it is what turns a drift bug into a detected bug.

## Index on the access path, not on everything

The queries are known: entries for an account in a time window, entries for a transaction,
and a statement of the last N. Those want, respectively, a composite index on
(account_id, created_at), an index on transaction_id, and the same composite index used with
a descending scan. Every additional index is a tax on writes, and this table is write-heavy.

Use EXPLAIN (ANALYZE, BUFFERS) with realistic row counts rather than intuition. A composite
index whose leading column is the low-cardinality one is the classic accidental full scan.

## Isolation and locking

PostgreSQL's default is read committed: each statement sees a snapshot, so a check in one
statement and an insert in the next can interleave. SERIALIZABLE costs retries but catches
exactly this class; for money movement a common middle path is keeping the contested state
in one row and locking it (SELECT ... FOR UPDATE) or using an atomic conditional UPDATE ...
WHERE balance_version = expected, then retrying on zero rows affected.

Any of these is defensible; using read committed and hoping is not.

## Migrations on a live table

Adding an index without CONCURRENTLY, or a column with a volatile default, takes an
ACCESS EXCLUSIVE lock and stops writes. Order instead: add nullable column, backfill in
batches, add the constraint as NOT VALID then VALIDATE CONSTRAINT, create indexes
CONCURRENTLY, and only then require the column in the application. Every step is separately
deployable and separately revertible.

Partitioning by month is worth it when the retention story is "keep two years of statements"
— it makes dropping old data a metadata operation instead of a delete storm.

## Failure modes

A mutable balance with no ledger behind it. Deduplicating payments by amount and timestamp.
Reporting queries hitting the transactional table during business hours. Migrations applied
in one transaction on a table with billions of rows. And a reconciliation job that has never
been run against deliberately corrupted data, so nobody knows whether it would catch the
drift it exists to find.
