---
slug: nodejs-event-loop-and-latency
title: The Node.js event loop and why blocking shows up as tail latency
lang: en
domain: backend-node
topic: runtime
tech:
  name: Node.js
  version_range: ">=24"
levels: [senior, staff]
summary: >-
  One thread per process runs all JavaScript, and libuv moves I/O off it. A synchronous
  stretch of work does not just slow the request that caused it: it suspends every timer,
  promise and socket callback queued behind it, so the symptom is a p99 cliff.
prerequisites: []
related: [nodejs-worker-threads-and-cluster, nodejs-streams-and-backpressure, nodejs-memory-gc-and-leaks]
sources:
  - title: "Node.js — The event loop, timers, and process.nextTick()"
    url: https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick
    kind: official-docs
  - title: "Node.js — Don't block the event loop (or the worker pool)"
    url: https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop
    kind: official-docs
  - title: "Node.js CLI — UV_THREADPOOL_SIZE"
    url: https://nodejs.org/api/cli.html
    kind: official-docs
review_status: draft
---

## The loop in phases

Each turn of the loop visits a fixed set of phases in order: timers, pending callbacks,
poll (where most I/O callbacks run and where the loop parks when there is nothing to do),
check, and close callbacks. Between phases Node drains the microtask queues: all
process.nextTick callbacks first, then promise reactions.

Two consequences matter in an interview. First, a promise callback cannot run while a
synchronous block is executing — the queue is drained only when the current stack returns
to the loop. Second, the poll phase is where the loop waits, so anything that keeps the
stack busy past that point pushes every other callback later in wall-clock time.

## Blocking is a latency bug, not a throughput bug

A handler that parses a 40 MB JSON body, runs a catastrophic-backtracking regex, or sorts
a million rows still returns 200 for the one request that caused it. What it also does is
stop the loop from starting the next phase for every other connection held by that process.
That is why the p50 can look healthy while p99 collapses: the average request rarely meets
the blow-up path, but the requests that arrive during it wait the whole time.

The honest framing is queueing, not "Node is single-threaded so it is slow". One core
processes one callback at a time; the question is always how long the longest callback
holds it.

## The libuv threadpool

File system calls, DNS lookups, and some crypto and zlib operations are handed to a libuv
threadpool rather than the loop. Its default size is four, configurable with the
UV_THREADPOOL_SIZE environment variable, and the pool is shared by every subsystem that
uses it.

This produces a second, easily misdiagnosed failure: if four requests are waiting on slow
DNS or bcrypt work, the fifth file-system callback is not blocked by the loop at all — it
is queued behind work in the pool. The loop looks idle, event-loop lag is clean, and
latency is still terrible. Raising the pool size helps until the real constraint (CPU,
memory, the database pool) is reached.

## Telling the two apart

Measure the loop: perf_hooks exposes monitorEventLoopDelay and PerformanceObserver, which
report how late timers actually fire. Watch the pool: log timings around DNS, fs and crypto
calls, and compare against a pool-sized concurrency limit. Then look at the profile:
--cpu-prof or the inspector's profiler attributes time to JavaScript frames, so a frame
sitting at the top of the flame graph for hundreds of milliseconds is a blocking candidate.

The distinction decides the fix. Loop blocked means move work off the thread — partition
it, do it in a worker thread, or stop doing it per request. Pool saturated means the work
is genuinely asynchronous already and the fix is capacity, caching, or fewer slow calls.

## Timers and ordering traps

setTimeout with a zero delay is clamped, and its ordering against setImmediate depends on
whether the loop was already inside a poll phase when the call was made. process.nextTick
callbacks run before promise callbacks, and a recursive nextTick loop starves I/O
entirely. None of these are trivia: they are the reason a "fix" that awaits a promise
inside a tight loop can still block.

## What a senior answer adds

Partition long work before optimising the runtime: a loop over ten thousand items should
yield, batch, or move to a worker. Do not raise UV_THREADPOOL_SIZE before knowing what
else shares the pool. And instrument the symptom that users see — event-loop lag and
tail latency on the process — rather than the CPU average, which stays comfortable while
requests queue.

## Failure modes

Diagnosing "the event loop is blocked" when the real problem is threadpool starvation.
Adding worker threads to I/O-bound code, which the official guidance says does not help.
Treating one process as if it had many cores, then discovering that replicating it is the
cheaper fix. And leaving synchronous logging, JSON or crypto on the request path because
it was fast in development with one client.
