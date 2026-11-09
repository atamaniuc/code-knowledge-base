---
slug: postgres-concurrency-isolation-locks
title: PostgreSQL concurrency — isolation levels, locks, races, deadlocks
lang: en
domain: backend-php
topic: concurrency
tech:
  name: PostgreSQL
  version_range: ">=14"
levels: [senior]
summary: >-
  Two requests changing the same row at the same time need one of three defenses: a stronger
  isolation level, a row lock taken before the change, or a version check at write time.
  This article covers PostgreSQL isolation levels and anomalies, FOR UPDATE and SKIP LOCKED,
  optimistic version columns, race conditions such as the lost update, deadlock handling, and
  Redis distributed locks for invariants that span workers rather than the database.
prerequisites: [laravel-transactional-outbox-inbox]
related: [laravel-queues-and-workers, stripe-nue-billing-in-laravel]
sources:
  - title: "PostgreSQL — Transaction Isolation"
    url: https://www.postgresql.org/docs/current/transaction-iso.html
    kind: official-docs
  - title: "PostgreSQL — Explicit Locking"
    url: https://www.postgresql.org/docs/current/explicit-locking.html
    kind: official-docs
  - title: "Laravel — Pessimistic Locking"
    url: https://laravel.com/docs/11.x/queries#pessimistic-locking
    kind: official-docs
  - title: "Laravel — Atomic Locks"
    url: https://laravel.com/docs/11.x/cache#atomic-locks
    kind: official-docs
  - title: "Redis — SET"
    url: https://redis.io/docs/latest/commands/set/
    kind: official-docs
review_status: draft
---

## Isolation levels and anomalies

A transaction is a batch of statements that either all commit or all roll back; isolation
controls how much of another transaction's uncommitted work this one can see. The anomalies
that isolation levels exist to prevent:

| Anomaly | What happens | Example |
|---|---|---|
| Dirty read | Reading another transaction's uncommitted change | A changes a price, B reads it, A rolls back — B saw a price that never existed |
| Non-repeatable read | The same SELECT returns different rows inside one transaction | A reads status "draft", B commits "paid", A reads again and sees "paid" |
| Phantom read | New rows appear that match an earlier condition | A counts 10 unpaid invoices, B inserts one, A counts 11 |
| Lost update | Two read-modify-write cycles, one overwrites the other | A and B both read balance 100; A writes 150, B writes 130 — A's change is lost |
| Write skew | Two transactions read overlapping data and write disjoint rows, breaking an invariant | Two doctors on the same shift both leave on call, each seeing "the other one stays" |

PostgreSQL levels:

| Level | Prevents | Still allows | Use for |
|---|---|---|---|
| READ COMMITTED (default) | dirty reads | non-repeatable reads, phantoms, lost updates | the 95% of ordinary operations |
| REPEATABLE READ | dirty, non-repeatable, phantoms | write skew | reports and consistent snapshots |
| SERIALIZABLE | all anomalies | nothing — conflicts abort with SQLSTATE 40001 | money invariants |

Three facts that interviews probe. PostgreSQL's default is READ COMMITTED
(`SHOW default_transaction_isolation;` returns "read committed"). PostgreSQL never
allows dirty reads, even though a READ UNCOMMITTED level exists as an alias for READ
COMMITTED. REPEATABLE READ is built on snapshots, which is why phantoms do not occur at
that level; SERIALIZABLE is Serializable Snapshot Isolation, which aborts a conflicting
transaction with `ERROR: could not serialize access due to concurrent update`
(SQLSTATE 40001) — the application retries the whole transaction.

## Pessimistic locking

Pessimistic locking assumes a conflict will happen and locks the row before working on it.
The four PostgreSQL variants:

- `SELECT ... FOR UPDATE` — exclusive row lock. A second FOR UPDATE on the same row
  waits until the first transaction ends. A plain SELECT does not wait: MVCC serves it the
  last committed version.
- `SELECT ... FOR SHARE` — shared lock; several readers may hold it, FOR UPDATE may not.
- `SKIP LOCKED` — skip already-locked rows instead of waiting; the standard queue
  pattern, used by an outbox relay to drain rows with several workers.
- `NOWAIT` — fail immediately instead of waiting.

The canonical Laravel use is a double webhook. The second worker must not mark the invoice
paid again:

```php
DB::transaction(function () use ($invoiceId) {
    $invoice = Invoice::whereKey($invoiceId)->lockForUpdate()->first();

    if ($invoice->status === 'paid') {
        return; // duplicate webhook: the row is already paid
    }

    $invoice->markPaid();
});
```

`lockForUpdate()` emits FOR UPDATE and `sharedLock()` emits FOR SHARE. The lock is
held until the transaction ends, so the rule is: keep the transaction short, and never make
an HTTP call or send an email inside it.

## Optimistic locking

Optimistic locking assumes conflicts are rare, locks nothing, and instead checks at write
time that the row is still the one that was read. The implementation is a version column
(or a comparison on updated_at):

```sql
UPDATE invoices
SET status = 'paid', version = version + 1
WHERE id = 123 AND version = 7;
-- zero updated rows means someone changed the row after our read
```

In Laravel the same check is written by hand:

```php
$updated = Invoice::whereKey($id)
    ->where('version', $seenVersion)
    ->update([
        'status'  => 'paid',
        'version' => DB::raw('version + 1'),
    ]);

if ($updated === 0) {
    throw new OptimisticLockException('Row changed, re-read and retry');
}
```

Pessimistic locking blocks and waits; optimistic locking does not block, but the loser gets
an error and retries. Optimistic suits rare conflicts such as form edits; pessimistic suits
expected conflicts such as a duplicate webhook or a balance debit.

## Race conditions and lost updates

The lost update is the race condition that bites payment code: two requests read the same
value, both compute a new one, and the second write overwrites the first. The fix depends
on the shape of the write:

- Counters must be atomic: `UPDATE counters SET value = value + 1`, never
  read-then-write.
- A debit must be conditional: `UPDATE accounts SET balance = balance - 30 WHERE id = ? AND balance >= 30`,
  checking the updated row count.
- A state transition needs the current state under a lock: FOR UPDATE plus a re-check of
  the status, as in the double-pay example above.

The database-backed queue is the same problem at worker scale: several workers polling one
table use FOR UPDATE SKIP LOCKED so each claims a distinct batch instead of fighting over
the same row. On SQS the analog is the visibility timeout plus an idempotent consumer.

## Deadlocks

A deadlock is a cycle of waiting locks: transaction A locks row 1 and wants row 2, while
transaction B locks row 2 and wants row 1. Neither can proceed. PostgreSQL detects the cycle
after `deadlock_timeout` (default 1 second) and aborts one of the transactions with
SQLSTATE 40P01 `deadlock detected`. The surviving transaction proceeds normally.

The mitigations are mechanical: lock rows in a consistent order everywhere (by id, for
example), keep transactions short, and retry the aborted transaction — Laravel's
`DB::transaction(fn () => ..., 3)` re-runs the closure up to three times. The retry
must wrap the whole transaction, because the aborted transaction's work was rolled back.

## Distributed Redis locks

Row locks coordinate work inside one database. When the invariant spans several workers and
no single row expresses it — only one worker may run the Nue sync, the report rebuild, or a
rate-limited email — the lock lives in Redis:

`SET job:invoice:123 owner-abc NX PX 30000`

- `NX` — set only if the key does not exist, i.e. "claim";
- `PX 30000` — a 30-second TTL so a crashed worker's lock releases itself;
- `owner-abc` — a random owner token so no other worker can release this lock.

Release must be token-checked and atomic, which means a Lua script:

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

Laravel packages this as `Cache::lock('invoice:' . $invoiceId, 30)->get(function () { ... })`,
which releases the lock even when the callback throws; `->block(5, $callback)` waits up
to five seconds. The danger is a TTL shorter than the work: the lock expires, a second worker
enters, and now two workers run at once. So the TTL must be generous, and money must be
protected by idempotency on top. The stronger defense is a fencing token — a monotonically
increasing number issued with the lock and checked at write time, so a stale owner cannot
write. Redlock across several Redis instances is a debated topic and does not give hard
guarantees in the general case; one Redis with a TTL covers almost every real task.

## Choosing a strategy

| Situation | Tool |
|---|---|
| Change a row and prevent an overwrite | `SELECT ... FOR UPDATE` / `lockForUpdate()` |
| Rare conflicts, form edits | optimistic lock on a version column |
| Database-backed queue drain | `FOR UPDATE SKIP LOCKED` |
| Exactly one worker may run a task | Redis `Cache::lock()` with TTL |
| Money invariant where an error is expensive | SERIALIZABLE plus retry on 40001 |
| Transaction aborted by a deadlock | `DB::transaction(fn () => ..., 3)` |
| Duplicate webhook | idempotency plus a status re-check under FOR UPDATE |

The vacancy-shaped answer chains them: the Stripe webhook is deduplicated by the inbox, the
handler then takes FOR UPDATE and re-checks the invoice status, the outbox relay drains with
SKIP LOCKED, and the Nue sync stays idempotent by external_id — so a duplicate, a race or a
retry at any hop degrades to a no-op instead of a double effect.
