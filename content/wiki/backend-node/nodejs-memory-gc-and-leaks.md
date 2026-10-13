---
slug: nodejs-memory-gc-and-leaks
title: Memory, garbage collection and hunting a leak in Node.js
lang: en
domain: backend-node
topic: runtime
tech:
  name: Node.js
  version_range: ">=24"
levels: [senior, staff]
summary: >-
  V8 splits the heap into a young and an old generation and collects them with very
  different costs. A leak is usually not a forgotten reference but an unbounded structure
  someone called a cache, and the fix is a bound rather than a garbage collector.
prerequisites: [nodejs-event-loop-and-latency]
related: [nodejs-streams-and-backpressure, nodejs-worker-threads-and-cluster]
sources:
  - title: "Node.js — Understanding and tuning memory"
    url: https://nodejs.org/en/learn/diagnostics/memory/understanding-and-tuning-memory
    kind: official-docs
  - title: "Node.js — Using heap snapshots"
    url: https://nodejs.org/en/learn/diagnostics/memory/using-heap-snapshot
    kind: official-docs
  - title: "Node.js CLI — --max-old-space-size"
    url: https://nodejs.org/api/cli.html
    kind: official-docs
review_status: draft
---

## The heap in two generations

New allocations land in the new space, which is collected by a fast scavenge that copies
survivors. Objects that survive several scavenges are promoted to the old space, which is
collected by a major collection that is far more expensive. That asymmetry is the whole
tuning story: allocation rate is cheap until objects start surviving, and then the same
allocation rate buys much larger pauses.

Node's default old-space size is derived rather than unlimited, and --max-old-space-size
sets it explicitly. Buffers and other external memory live outside the V8 heap, so RSS can
climb while heapUsed looks flat — a stream or native-module leak hides there.

## What actually leaks in a service

- A Map or Set used as a cache with no eviction and a key derived from user input.
- Listeners added to a long-lived emitter per request; the emitter is one object, the
  closures retain everything they captured.
- setInterval callbacks holding a request context, so a finished request is never
  collectable.
- Module-level state that grows monotonically: metrics labels per tenant, promises kept
  "for debugging", an array of recent errors that is never trimmed.
- AsyncLocalStorage context captured into something that lives longer than the request.
- A queue between two internal stages with no bound, which is a leak by design.

Note the shape: almost every real leak is an ownership bug, and the fix is a bound — an
LRU, a maximum size, a TTL — not a GC flag.

## Hunting one in production

Take a heap snapshot, do work, take a second snapshot, and diff by retained size rather
than shallow size; the object count that grows monotonically between snapshots is the
candidate. Allocation sampling in the inspector points at the call site instead. If the
process is being killed by the container rather than throwing a heap error, the first fix
is a memory limit plus metrics, because an OOM kill tells you nothing about why.

Measuring RSS alone is misleading in both directions: it includes external and shared
memory, and it does not shrink promptly after a collection.

## GC pressure is a latency cost

Major collections stop JavaScript briefly, so a service whose old space churns spends its
p99 in the collector. The usual cause is per-request allocation of large short-lived
objects that get promoted — buffers concatenated instead of streamed, a whole result set
materialised to return one page, JSON round-tripped for a deep copy. Reducing allocation
often improves latency more than any GC tuning.

## What a senior answer adds

Bound every structure that can be keyed by external input, and make the bound visible in
a metric. Choose a restart policy that treats memory exhaustion as a crash, not as a
degraded mode that quietly serves wrong answers. And check whether the leak is in the
process at all — a queue with no consumer and a database cursor left open look identical
from the outside.

## Failure modes

Raising --max-old-space-size to stop the restarts, which buys time and hides the growth.
Blame in a global cache without checking whether the objects are actually reachable from
it. Confusing external Buffer memory with the V8 heap and looking for the leak in the
wrong snapshot. And treating a leak as a one-off bug when the same pattern appears in
every cache in the codebase.
