---
slug: postgres-query-plans-and-indexing
title: Reading EXPLAIN (ANALYZE, BUFFERS) and choosing an index
lang: en
domain: data
topic: performance
tech:
  name: PostgreSQL
  version_range: ">=16"
levels: [middle, senior, staff]
summary: >-
  An index is a hypothesis about the access path; EXPLAIN is the experiment. The skill
  is reading estimated versus actual rows, buffer counts and loops, then deciding
  whether the problem is the index, the statistics or the query shape.
prerequisites: [postgres-schema-design-and-normalisation]
related: [postgres-partitioning-and-retention, postgres-ledger-design]
sources:
  - title: "PostgreSQL 18 — Using EXPLAIN"
    url: https://www.postgresql.org/docs/18/using-explain.html
    kind: official-docs
  - title: "PostgreSQL 18 — Indexes"
    url: https://www.postgresql.org/docs/18/indexes.html
    kind: official-docs
  - title: "PostgreSQL 18 — CREATE INDEX (CONCURRENTLY)"
    url: https://www.postgresql.org/docs/18/sql-createindex.html
    kind: official-docs
review_status: draft
---

## The plan is the answer to "why is this slow"

`EXPLAIN` without `ANALYZE` shows the planner's estimate; `EXPLAIN ANALYZE` runs the
query and shows what actually happened. The two numbers side by side are the diagnosis:
when the estimate is 10 rows and the actual is 400,000, the plan was built on a wrong
assumption and the index is not the fault — the statistics are.

`EXPLAIN (ANALYZE, BUFFERS)` adds shared buffer hits and reads per node. That is what
separates "this node is slow" from "this node is slow because it read the table from disk".
A plan that is fast on a warm development cache and slow in production is a buffers
question.

Use `ANALYZE`, `BUFFERS` and `VERBOSE` together when the shape is unclear, and
`SET enable_seqscan = off` only as a probe to see what the planner would do if forced —
never as a fix.

## Index types and what each is for

- **B-tree** is the default and the workhorse: equality, ranges, sorting, prefix matching
  with the right operator class. A composite B-tree on `(a, b)` serves `a` and
  `(a, b)` but not `b` alone.
- **Hash** is equality only and rarely worth reaching for over B-tree.
- **GIN** is for values that contain other values — array containment, `jsonb`, full-text
  vectors. It is larger and slower to update, which is the trade you accept for containment
  queries.
- **GiST** and **SP-GiST** back geometry, ranges and nearest-neighbour searches.
- **BRIN** stores min/max per block range and is tiny; it pays only where physical order
  correlates with the column, such as an append-only table inserted in timestamp order.

## Composite index ordering

The leading column should be the one used by equality predicates and present in almost
every query; range predicates go last. `(tenant_id, created_at)` serves "this tenant,
newest first" with one index scan; `(created_at, tenant_id)` forces a scan over every
tenant's rows in the window.

A composite index whose leading column has four distinct values and whose second column is
high-cardinality is the classic accidental full scan: the planner can use it, but the first
column filters almost nothing.

## What to read in the plan

Read the plan from the inside out. Watch three things:

- **Estimated versus actual rows.** A large divergence at the bottom propagates upward and
  produces nested loops that should have been hash joins. Fix with `ANALYZE`, an extended
  statistics object on correlated columns, or a rewrite.
- **loops.** A node with `loops=10000` at 0.1 ms per loop is a one-second node. Multiply.
- **Buffers.** Many `shared read` and few `shared hit` means the working set does not fit
  in `shared_buffers`. `written` on a read query means a sort or hash spilled to a
  temporary file — raise `work_mem` for that query class, not globally.

## Indexes that are not used

An index that exists and is not chosen is not helping; it is still costing writes. Common
reasons: the predicate is not sargable, so `WHERE lower(email) = ...` needs an expression
index; the types do not match, so `text = integer` defeats the index; the statistics are
stale; or the query returns so much of the table that a sequential scan is genuinely
cheaper. Check `pg_stat_user_indexes.idx_scan` before keeping an index.

Partial and covering indexes are the two levers. A partial index on the statuses that are
actually queried can be a fraction of the size, and `INCLUDE` columns let an index-only
scan answer a query without touching the heap.

## Failure modes

Adding an index for every slow query. Reading only the top line of the plan. Tuning
`work_mem` globally to hide one spilling sort. Trusting a plan taken from a development
database with a thousand rows. And an index on `(status)` alone, which has two distinct
values and will never be chosen.
