---
slug: postgres-zero-downtime-migrations
title: Zero-downtime migrations in PostgreSQL
lang: en
domain: data
topic: migrations
tech:
  name: PostgreSQL
  version_range: ">=16"
levels: [senior, staff]
summary: >-
  Most migration outages are lock queues, not bad SQL. The expand-contract pattern keeps
  every step backwards-compatible, and lock_timeout plus a retry loop is what turns a
  migration from an event into a routine deploy.
prerequisites: [postgres-mvcc-isolation-and-locking]
related: [postgres-partitioning-and-retention, postgres-ledger-design]
sources:
  - title: "PostgreSQL 18 — ALTER TABLE"
    url: https://www.postgresql.org/docs/18/sql-altertable.html
    kind: official-docs
  - title: "PostgreSQL 18 — Explicit Locking"
    url: https://www.postgresql.org/docs/18/explicit-locking.html
    kind: official-docs
  - title: "PostgreSQL 18 — CREATE INDEX (CONCURRENTLY)"
    url: https://www.postgresql.org/docs/18/sql-createindex.html
    kind: official-docs
review_status: draft
---

## What takes the lock

`ALTER TABLE` requests `ACCESS EXCLUSIVE` unless a subform says otherwise, and it does so
at the start of the statement. The danger is not the duration of the migration but the wait:
an `ACCESS EXCLUSIVE` request queues behind any in-flight query, and every subsequent
query — including plain reads — queues behind it. A migration that would take 200 ms can
stall a table for minutes because it waited behind a slow report.

The defensive settings are `lock_timeout` and `statement_timeout` on the migration
connection, with a retry loop. Failing fast and retrying later is how the migration gets
applied without an outage.

Operations and their locks:

- `ADD COLUMN` with no default, or with a non-volatile default: metadata-only, fast.
  A volatile default requires a rewrite on older versions; in PostgreSQL 11 and later a
  non-volatile default is stored in the catalog and not rewritten per row.
- `SET NOT NULL`: a full table scan under `ACCESS EXCLUSIVE` unless a matching
  `NOT VALID` check constraint was validated first.
- `CREATE INDEX`: blocks writes for the duration. `CREATE INDEX CONCURRENTLY` does two
  scans and waits for concurrent transactions, but does not lock out writes.
- `ADD CONSTRAINT ... NOT VALID` then `VALIDATE CONSTRAINT`: the add is fast and the
  validate takes a weaker lock.
- `ALTER COLUMN TYPE`: usually a rewrite; sometimes a metadata change when the type is
  binary-coercible.

## Expand, migrate, contract

The pattern that keeps old and new application versions running against one database:

1. **Expand.** Add the new nullable column, table or index. No application change yet. Both
   versions of the code work.
2. **Migrate.** Backfill in batches, and write to both the old and new shape for a period so
   no data is missed while the backfill runs.
3. **Switch reads** to the new shape, deploy, and observe.
4. **Contract.** Drop the old column, add the `NOT NULL` and uniqueness constraints, and
   remove the dual-write code.

Each step is separately deployable and separately revertible. The rule is never to combine
expand and contract in one release: a rollback then has nowhere to go.

## Backfills without a lock

A single `UPDATE` over ten million rows holds row locks, writes a huge amount of WAL and
bloats the table. Batch instead:

`@sql
UPDATE items SET new_col = f(old_col)
WHERE id IN (
  SELECT id FROM items WHERE new_col IS NULL ORDER BY id LIMIT 1000
);
`@

Run batches with a short sleep, watch replication lag, and make the job resumable by keying
off rows that are still `NULL`. Backfill while the new column is being written by the live
application, so the two paths converge rather than the backfill chasing writes.

For a constraint, add it `NOT VALID` and validate in a separate step; for an index,
`CONCURRENTLY`; for a unique constraint, build a unique index concurrently first and then
attach it, so a failure does not leave an invalid index behind.

## Rolling back

Roll back per step. If a backfill is half-done, the application still reads the old shape, so
the half-done work is invisible. If the `NOT NULL` constraint has been applied, dropping it
is cheap. The failure that cannot be rolled back is a destructive contract step shipped in
the same release as the expand — there is no old column to return to.

## Failure modes

A migration applied inside the deploy transaction on a hot table, holding `ACCESS
EXCLUSIVE` for its duration. `CREATE INDEX` without `CONCURRENTLY` on a live table.
`SET NOT NULL` without a validated constraint first. An unbounded backfill. And a
migration harness that runs all pending migrations in one transaction, which makes a
lock-timeout retry impossible.
