---
slug: postgres-mvcc-isolation-and-locking
title: MVCC, isolation levels and locking in PostgreSQL
lang: en
domain: data
topic: concurrency
tech:
  name: PostgreSQL
  version_range: ">=16"
levels: [senior, staff]
summary: >-
  PostgreSQL gives readers a snapshot and writers a new row version, so reads never
  block writes. Everything surprising follows from that: what each isolation level
  hides, why a check-then-write races, and why vacuum is part of concurrency work.
prerequisites: [postgres-schema-design-and-normalisation]
related: [postgres-ledger-design, postgres-connection-pooling]
sources:
  - title: "PostgreSQL 18 — Transaction Isolation"
    url: https://www.postgresql.org/docs/18/transaction-iso.html
    kind: official-docs
  - title: "PostgreSQL 18 — Explicit Locking"
    url: https://www.postgresql.org/docs/18/explicit-locking.html
    kind: official-docs
  - title: "PostgreSQL 18 — Routine Vacuuming"
    url: https://www.postgresql.org/docs/18/routine-vacuuming.html
    kind: official-docs
review_status: draft
---

## MVCC in one paragraph

An `UPDATE` writes a new row version and marks the old one dead; a `DELETE` marks a
version dead. A reader's snapshot decides which versions are visible, so a `SELECT` never
blocks an `INSERT` and never waits for a commit. The cost is that dead versions accumulate
and must be reclaimed by `VACUUM`, and that a long-running transaction holds a snapshot
that keeps dead rows alive.

That last property is the usual cause of "the database grew and nobody wrote anything": one
idle-in-transaction connection with a transaction open for hours prevents cleanup of
everything written since it started.

## Isolation levels

PostgreSQL implements three distinct behaviours; the fourth SQL level is aliased.

- **Read Committed** (the default): each statement takes a fresh snapshot. Two statements in
  one transaction can see different data. An `UPDATE ... WHERE` re-evaluates the predicate
  against the latest committed version of a row it is about to change, which is why updating
  a row another transaction changed waits rather than failing.
- **Repeatable Read**: one snapshot for the whole transaction. A write to a row changed since
  the snapshot fails with a serialization error rather than silently overwriting. This is
  the level that turns a lost update into an error.
- **Serializable**: Repeatable Read plus predicate locking, which detects when a concurrent
  write would have changed the result of a read this transaction made. It does not block
  readers; it aborts one of the conflicting transactions, so the application must retry.

PostgreSQL's Read Committed already prevents dirty reads and phantoms, which surprises
people who learned the standard's table on another engine.

## Check-then-write is the recurring bug

`@sql
SELECT balance FROM accounts WHERE id = 1;   -- 100
-- application decides 100 >= 50
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
`@

Under Read Committed two concurrent requests both read 100 and both subtract, and the
balance goes to 0 instead of 50. There are three honest fixes:

1. Make it one statement: `UPDATE accounts SET balance = balance - 50 WHERE id = 1 AND
   balance >= 50`, then treat zero rows affected as insufficient funds.
2. Lock the row explicitly with `SELECT ... FOR UPDATE` before reading, so the second
   transaction waits.
3. Run at Serializable and retry the aborted transaction.

The wrong fix is to move the check into the application and hope, or to raise the isolation
level and not implement retries.

## Row locks, table locks and deadlocks

`SELECT ... FOR UPDATE` locks the selected rows; `FOR NO KEY UPDATE` and `FOR SHARE`
take weaker ones. `FOR UPDATE SKIP LOCKED` is the queue pattern: workers claim rows
without waiting, which is how a jobs table is consumed safely by many processes.

Two transactions that lock the same rows in different orders will, under enough
concurrency, deadlock; PostgreSQL detects the cycle after `deadlock_timeout` and aborts
one. The design fix is a deterministic lock order, not a longer timeout.

DDL takes table-level locks. `ALTER TABLE` normally requests `ACCESS EXCLUSIVE`, which
conflicts with everything. A lock queue is a queue: a single long `ACCESS EXCLUSIVE`
request blocks every later read even though reads do not conflict with each other. That is
why migrations need `lock_timeout` and a retry, not a bigger window.

## Vacuum is part of the answer

Autovacuum reclaims dead versions and maintains the visibility map that makes index-only
scans possible. Configure it per table for hot tables rather than globally, watch
`pg_stat_user_tables.n_tup_upd` against `last_autovacuum`, and remember that
`VACUUM FULL` takes an `ACCESS EXCLUSIVE` lock — on a large table prefer a
copy-and-swap rewrite or an online repack tool.

## Failure modes

Read Committed plus check-then-write. A retry loop around a Serializable transaction that
does not reset application state before retrying. Long idle transactions holding back
vacuum. Migrations without `lock_timeout`, so one slow query stalls the deploy. And
`SELECT ... FOR UPDATE` over a range that turns row-level contention into a table-level
problem.
