---
slug: postgres-connection-pooling
title: Connection pooling with PgBouncer and why pool size is not concurrency
lang: en
domain: data
topic: connection-management
tech:
  name: PostgreSQL
  version_range: ">=16"
levels: [senior, staff]
summary: >-
  A PostgreSQL backend is a process; concurrency past the pool size queues rather than
  scaling. PgBouncer decouples client connections from server connections, and choosing
  transaction mode is a decision about what the application is allowed to assume.
prerequisites: [postgres-mvcc-isolation-and-locking]
related: [postgres-zero-downtime-migrations, postgres-ledger-design]
sources:
  - title: "PgBouncer — Configuration"
    url: https://www.pgbouncer.org/config.html
    kind: official-docs
  - title: "PostgreSQL 18 — Connections and Authentication (max_connections)"
    url: https://www.postgresql.org/docs/18/runtime-config-connection.html
    kind: official-docs
review_status: draft
---

## The math that matters

Each client connection is a backend process with its own memory and its own place in the
scheduler. `max_connections` defaults to about 100. Past the number of cores the database
can actually run concurrently, extra connections do not add throughput — they add context
switching, contention on shared structures and lock waits.

The useful number is not "how many requests do we serve" but "how many queries can run at
once without making each other slower". A 16-core database usually saturates somewhere near
a small multiple of 16, not at 500.

## PgBouncer pool modes

PgBouncer sits between the application and PostgreSQL and multiplexes many client
connections onto few server connections.

- **Session mode** (the default): a server connection is held for the life of the client
  connection. This preserves every session feature but pools nothing meaningful for a
  request-per-connection workload.
- **Transaction mode**: the server connection is returned to the pool when the transaction
  finishes. This is the mode that makes pooling pay, and it is the one with constraints.
- **Statement mode**: returned after each statement; multi-statement transactions are
  disallowed. Rarely usable by a real application.

`default_pool_size` is the maximum server connections per user/database pair, and
`max_client_conn` is the client-side ceiling. The two numbers are the whole design: clients
can be thousands, server connections must stay near what the database can run.

## Pool size is not concurrency

The most common mistake is sizing the pool from the application's thread count. If the
application has 200 workers and the pool size is 200, the database sees 200 concurrent
queries and every one of them slows down; the queue has simply moved from the client to the
database, where it is more expensive.

Size the pool from the database's capacity and from the shape of the work: a short
transaction-bound workload tolerates a larger pool than a reporting workload holding a
connection for seconds. Then measure wait time, not just utilisation. A pool with 100%
utilisation and a growing wait queue is not busy, it is overloaded.

## Transaction mode constraints

In transaction mode, session state does not survive between transactions. That rules out:

- **Session-level advisory locks** taken with `pg_advisory_lock` (transaction-level
  `pg_advisory_xact_lock` is fine).
- **Prepared statements** unless PgBouncer is configured with `max_prepared_statements`
  and the client protocol supports it. Many drivers prepare statements automatically, which
  is why a driver that works directly against PostgreSQL starts failing with "prepared
  statement already exists" behind the pooler.
- **`SET` session parameters**, temporary tables and `LISTEN`/`NOTIFY` used across
  transactions.
- **Server-side cursors** that outlive a transaction.

None of these is a reason to avoid transaction mode; each is a reason to know which one the
application depends on before enabling it.

## Serverless and many small clients

A serverless function that opens a connection per invocation multiply the connection problem
by the concurrency of the platform. The pooler must be reachable from the functions and must
itself scale — otherwise the pool becomes the bottleneck it was meant to remove. An
alternative is a database that speaks its own connection protocol and pools internally; the
trade is operational control and ecosystem compatibility.

## Failure modes

Pool size set to the application's maximum concurrency. Transaction mode enabled without
checking for session-level advisory locks or automatic prepared statements. One long-running
analytics query occupying a pool slot that the request path needs. And connection leak in the
application, which no pooler setting fixes.
