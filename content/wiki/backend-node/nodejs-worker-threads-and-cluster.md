---
slug: nodejs-worker-threads-and-cluster
title: worker_threads, cluster, and where CPU-bound work belongs
lang: en
domain: backend-node
topic: runtime
tech:
  name: Node.js
  version_range: ">=24"
levels: [senior, staff]
summary: >-
  worker_threads exist for CPU-bound JavaScript; the docs are explicit that they do not
  help much with I/O. cluster and container replicas scale a whole process across cores.
  Choosing the wrong one turns a design problem into an infrastructure bill.
prerequisites: [nodejs-event-loop-and-latency]
related: [nodejs-memory-gc-and-leaks, nestjs-microservice-transports]
sources:
  - title: "Node.js — worker_threads"
    url: https://nodejs.org/api/worker_threads.html
    kind: official-docs
  - title: "Node.js — cluster"
    url: https://nodejs.org/api/cluster.html
    kind: official-docs
review_status: draft
---

## Threads, processes, and when either helps

worker_threads run JavaScript on additional threads inside one process. The documentation
is direct about the use case: workers are for CPU-intensive operations and do not help
much with I/O-intensive work, because the built-in asynchronous I/O is already more
efficient than moving it to a worker.

cluster forks worker processes that share a server port. On all platforms except Windows
the default distribution is round-robin: the primary accepts connections and hands them
out, which avoids one process accepting a burst while others idle. Each worker has its own
heap, its own event loop, and its own copy of module state.

## Choosing between them

- CPU-bound JavaScript that must stay in the process (image transforms, parsing, a
  simulation) belongs in a worker thread pool sized to the cores actually available.
- A CPU-bound workload that is not latency-sensitive, or that can live as its own unit,
  is often better as a separate service — it scales independently and cannot starve the
  API's loop.
- More concurrent I/O connections do not need threads. They need fewer, faster
  dependencies, or more replicas.

cluster is a deployment convenience, not a concurrency primitive: you get one more core's
worth of event loops and crash isolation, at the cost of N heaps. In containers, running
one process per container and letting the platform replicate is usually simpler and gives
the scheduler better information.

## What workers do not share

A worker receives data by structured clone, or by transferring an ArrayBuffer, not by
sharing live objects. SharedArrayBuffer plus Atomics is the real shared-memory path.
There is no shared connection pool, no shared cache, no shared object graph — so a worker
pool must be given its own resources and its own backpressure.

## The costs that decide the design

Every message crosses a serialization boundary and is copied. A per-request worker spawn
is slower than the work it offloads; a long-lived pool with a bounded queue is the shape
that works. The queue needs a limit and a timeout, or the pool becomes an unbounded memory
buffer — the exact failure it was introduced to prevent. Memory multiplies: N workers may
mean N copies of large read-only data, which is where SharedArrayBuffer earns its
complexity.

## What to instrument

Event-loop lag per process tells you whether the API thread is still healthy. The worker
queue depth and wait time tell you whether CPU work is the bottleneck or the pool is too
small. Heap and RSS per worker tell you whether the copies are affordable. Without those
three, "we added workers" is an unfalsifiable claim.

## Failure modes

Using worker_threads for database or HTTP fan-out, where they add overhead and no
concurrency. Spawning a worker per request. Setting a worker count from the host's core
count without respecting container CPU limits, so every replica throttles. And assuming
cluster makes an in-process cache consistent, when it only gives every process its own
stale copy.
