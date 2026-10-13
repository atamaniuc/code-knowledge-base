---
slug: redis-distributed-locks
title: Distributed locks in Redis and the Redlock argument
lang: en
domain: caching
topic: coordination
tech:
  name: Redis
  version_range: ">=8"
levels: [senior, staff]
summary: >-
  A Redis lock is a lease with an expiry, not a mutual-exclusion primitive the way a
  mutex is. Whether it is safe depends on what the critical section does and whether the
  resource it guards can detect a stale holder.
prerequisites: [redis-ttl-and-eviction]
related: [redis-rate-limiting, outbox-idempotency-and-sagas]
sources:
  - title: "Redis — SET command (NX, EX)"
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
  - title: "How to do distributed locking"
    url: https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
    kind: article
  - title: "Redis Open Source 8.10 release notes"
    url: https://raw.githubusercontent.com/redis/redis/8.10/00-RELEASENOTES
    kind: release-notes
review_status: draft
---

## What a lock is for

A distributed lock is used for two different jobs that are often confused.

**Efficiency.** Prevent duplicate work — ten workers all rebuilding the same cache entry.
Losing the guarantee occasionally costs some duplicated effort, and nothing is corrupt.

**Correctness.** Prevent two processes from mutating shared state at once — two writers
updating the same account. Losing the guarantee costs data.

Redis locks are a reasonable fit for the first and a contested fit for the second, and the
interview signal is whether the candidate asks which one is being solved before answering.

## SET NX EX and the release protocol

Acquire with one atomic command: `SET lock:resource <token> NX EX <ttl>`. `NX` makes
"acquire only if absent" atomic; `EX` bounds the hold so a crashed holder does not block
the resource forever. A value without a TTL is a permanent outage waiting for a process
kill.

Release by comparing the token, not with a bare `DEL`:
`@lua
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`@
A bare `DEL` lets a holder whose lease already expired delete the lock another process now
owns, and two processes then believe they hold it.

The lease TTL must exceed the observed p99 critical section, and the critical section should
renew its lease if it can run long, with a bounded number of renewals. A lease that expires
mid-work converts mutual exclusion into a race.

## The Redlock argument

Redlock is the algorithm proposed for locking across several independent Redis masters: try
to acquire on a majority of nodes within a time bound, and consider the lock held only if
the majority succeeded quickly enough. The intent is to remove the single-node failure
domain.

Martin Kleppmann's critique has two parts that a strong candidate can state without taking a
side. First, it assumes a partially synchronous system with bounded clock drift and bounded
process pauses, while the failure it is meant to handle — a long gc pause, a slow network —
is exactly a process being delayed past its lease; the lock can expire while the holder
still believes it holds it. Second, it has no fencing token: a lock service can hand out a
monotonically increasing token that the guarded resource rejects if it has seen a newer one,
and Redlock's design does not include one.

The practical conclusion is not "never use Redis". It is that a lock without fencing cannot
make an unsynchronised resource safe, so either the resource enforces the invariant itself —
a conditional update, a unique constraint, a compare-and-swap — or the lock is being used
for efficiency, where occasional double work is acceptable.

## What to use instead, per resource

- **A row in a database**: `SELECT ... FOR UPDATE`, or `UPDATE ... WHERE version = n`
  with a retry. The database is already the arbiter, and it survives the failure modes.
- **A lease with fencing**: coordinate through a system that issues increasing tokens and
  whose consumer checks them — ZooKeeper, etcd, or a database sequence. The resource must
  honour the token, which is the part teams skip.
- **A unique constraint**: the cheapest lock, because the invariant is expressed once and
  enforced by the store. Idempotency keys and one-active-per-user rules belong here, not in
  a lock.
- **A queue with deduplication**: for "only one worker performs this job", competition on a
  partitioned stream is more robust than a lock, because a crashed worker's work is
  reassigned rather than stuck behind an expired lease.

## Failure modes

A lock with no TTL, held by a process that dies. A lock with a TTL shorter than the work,
producing two holders. Releasing with `DEL`. Using a lock for a correctness requirement
that the database could enforce directly. And a retry loop with no backoff, so contention
becomes a spin that makes the original problem worse.
