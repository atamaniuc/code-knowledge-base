---
slug: postgres-partitioning-and-retention
title: Partitioning and retention in PostgreSQL
lang: en
domain: data
topic: partitioning
tech:
  name: PostgreSQL
  version_range: ">=16"
levels: [senior, staff]
summary: >-
  Partitioning is a retention and maintenance strategy, not a performance switch. It
  turns dropping old data into a metadata operation and isolates vacuum per partition,
  and in exchange the partition key becomes part of every query and every unique key.
prerequisites: [postgres-query-plans-and-indexing]
related: [postgres-zero-downtime-migrations, postgres-ledger-design]
sources:
  - title: "PostgreSQL 18 — Table Partitioning"
    url: https://www.postgresql.org/docs/18/ddl-partitioning.html
    kind: official-docs
  - title: "PostgreSQL 18 — ALTER TABLE"
    url: https://www.postgresql.org/docs/18/sql-altertable.html
    kind: official-docs
  - title: "PostgreSQL 18 — Routine Vacuuming"
    url: https://www.postgresql.org/docs/18/routine-vacuuming.html
    kind: official-docs
review_status: draft
---

## When partitioning earns its keep

Partitioning costs complexity: every query must carry the partition key to prune, every
unique constraint must include it, and the operational surface becomes one relation per
partition. It earns that cost in three situations.

1. **Retention.** Old data is dropped, not archived forever. `DROP TABLE` on a whole
   partition, or `ALTER TABLE ... DETACH PARTITION`, is far cheaper than a bulk delete and
   avoids the vacuum overhead a large `DELETE` leaves behind.
2. **Maintenance isolation.** Autovacuum and `ANALYZE` run per partition, so a hot recent
   partition can be tuned without touching cold ones.
3. **Very large tables with a natural range predicate.** When every important query filters
   on the same time or tenant column, pruning removes most of the relation from the plan.

A table with a few million rows and ad-hoc queries does not need any of this. Reaching for
partitioning first is a common senior answer that a staff answer should recognise as
premature.

## Declarative partitioning

`@sql
CREATE TABLE events (id bigint, tenant_id int, created_at timestamptz NOT NULL)
  PARTITION BY RANGE (created_at);
CREATE TABLE events_2026_10 PARTITION OF events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
`@

Range partitioning on time is the default shape. List partitioning is for a bounded set of
tenants or regions; hash partitioning spreads writes when there is no natural range but
destroys pruning by time.

The parent table holds no rows. A primary key or unique constraint on a partitioned table
must include the partition key, because an index can only be unique within one partition.
That constraint is the thing candidates forget: `PRIMARY KEY (id)` on a table partitioned
by `created_at` is rejected, and the fix — `PRIMARY KEY (id, created_at)` — leaks the
partition key into every foreign key that references it.

## Retention as a metadata operation

Create next month's partition in advance, on a schedule. Drop or detach partitions past the
retention horizon. `DETACH PARTITION CONCURRENTLY` (available since PostgreSQL 14)
detaches without holding a strong lock for the duration, which matters when the partition is
large. Then either drop it or move it to cheap storage.

Retention must be automatic. A partition creation job that is a runbook, not a scheduled
task, produces the classic outage: inserts on the first of the month fail because there is
no partition for the new range. A default partition avoids the failure mode but concentrates
every misrouted row in one place, and detaching the default later requires a full scan.

## Partition pruning

The planner prunes partitions at plan time when the predicate is on the partition key with a
constant, and at run time when the value comes from a parameter or a subquery. Pruning fails
silently when the predicate is wrapped in a function the planner cannot fold or when the
types do not match, and a query that should hit one partition scans all of them.

Check with `EXPLAIN` that the plan names the partitions you expect. A pruned plan shows
one or two relations; an unpruned one shows dozens under an `Append` node.

## Operational costs

More partitions means more relations, more locks, more catalog entries and more planning
time. A table partitioned by day with five years of retention is 1,825 partitions, and
planning a query that cannot prune becomes visibly slow. Partition by month, not by day,
unless the volume genuinely requires it. Indexes are per-partition unless created on the
parent, and creating an index on the parent takes a lock on every child.

Foreign keys into a partitioned table and between partitioned tables work but change shape,
and `ON CONFLICT` requires the conflict target to include the partition key.

## Failure modes

Partitioning a table that never drops data. A missing future partition breaking inserts at
the month boundary. A unique constraint that silently cannot be created because it omits the
partition key. Queries whose predicates never prune, scanning every partition. And a default
partition used as the retention mechanism, which means nothing is ever actually dropped.
