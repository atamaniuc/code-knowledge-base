---
slug: nodejs-testing-and-diagnostics
title: Testing and diagnosing a Node service with built-in tools
lang: en
domain: backend-node
topic: testing
tech:
  name: Node.js
  version_range: ">=24"
levels: [senior, staff]
summary: >-
  node:test is a stable built-in runner, the inspector exposes the live process, and
  perf_hooks reports what the event loop is actually doing. A senior answer reaches for
  these before adding telemetry agents or test frameworks.
prerequisites: [nodejs-event-loop-and-latency]
related: [nodejs-esm-cjs-and-type-stripping, nestjs-configuration-and-validation]
sources:
  - title: "Node.js — Test runner (node:test)"
    url: https://nodejs.org/api/test.html
    kind: official-docs
  - title: "Node.js — Inspector"
    url: https://nodejs.org/api/inspector.html
    kind: official-docs
  - title: "Node.js — Performance measurement APIs (perf_hooks)"
    url: https://nodejs.org/api/perf_hooks.html
    kind: official-docs
review_status: draft
---

## node:test is stable and enough

The built-in test runner provides describe/it structure, subtests, mocking, timeouts and
coverage, and is run with node --test. For a service that already has a build and a CI
pipeline, that removes a dependency and a layer of configuration; a framework is a choice,
not a requirement.

The important property is not the API but what the tests exercise: a unit test around a
function with its dependencies faked, and one integration test that owns a real database
or a real broker. Tests that mock the thing most likely to break are decoration.

## The inspector

node --inspect (or --inspect-brk to stop before the first line) opens a debugging endpoint
that a CPU profile or heap snapshot can be taken from, and inspector.Session lets a process
capture the same data programmatically — useful for taking a profile when a health check
detects a problem rather than waiting for a reproduction. For a container, this is the
argument for keeping the inspector reachable from a sidecar or a signal handler.

## perf_hooks and the numbers that matter

performance.now() gives monotonic timing; PerformanceObserver delivers entries for
resource timing and user marks; monitorEventLoopDelay turns event-loop lag into a
histogram, which is the single most useful signal for "the service is slow and CPU is
low". Combined with process.memoryUsage() and a request-scoped duration metric, that is
enough to distinguish a blocked loop, a saturated pool, and a slow dependency.

## Async context

AsyncLocalStorage carries a request id and a tenant through awaits, which makes structured
logs correlate without threading a context object through every signature. It does not
cross worker threads, and callbacks invoked by native code or by an emitter outside the
async resource lose the context. The failure is silent: logs suddenly have no request id,
and correlating them afterwards is impossible. A test that asserts the context survives
an emit path is cheap insurance.

## What to keep on in production

A request id on every log line, event-loop lag, heap used and external memory, open
handles, and the duration of every outbound dependency call. The first debugging question
is always "which of these changed", and a process that cannot answer it forces a
reproduction that may not exist.

## Failure modes

Adding a test framework before deciding what the tests must prove. Profiling in production
without a way to stop the collection. Logging statement-by-statement instead of emitting
one structured event per unit of work. And treating a green unit suite as evidence that an
integration boundary works.
