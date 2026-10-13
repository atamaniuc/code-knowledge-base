---
slug: nodejs-streams-and-backpressure
title: Streams and backpressure in Node.js
lang: en
domain: backend-node
topic: runtime
tech:
  name: Node.js
  version_range: ">=24"
levels: [senior, staff]
summary: >-
  A stream is a pipeline with a high-water mark, and the interesting behaviour is what
  happens when the consumer is slower than the producer. Backpressure is the mechanism
  that turns an out-of-memory incident into latency.
prerequisites: [nodejs-event-loop-and-latency]
related: [nodejs-memory-gc-and-leaks, rate-limiting-and-backpressure]
sources:
  - title: "Node.js — Stream"
    url: https://nodejs.org/api/stream.html
    kind: official-docs
  - title: "Node.js — Backpressuring in streams"
    url: https://nodejs.org/en/learn/modules/backpressuring-in-streams
    kind: official-docs
review_status: draft
---

## Pressure, in one sentence

A writable stream has a highWaterMark, and write() returns false once its internal buffer
is at or above that mark. A correct producer stops writing until the drain event fires.
That is the entire mechanism, and skipping it is what produces multi-gigabyte RSS on a
service whose input is a 200 MB upload.

## What the API gives you

pipeline() connects a source to a destination, propagates errors, and cleans up all the
streams when any stage ends — pipe() does none of the cleanup and leaks the source on
error. async iteration with for await reads a stream chunk by chunk and applies the same
pressure. Readable.from() wraps an iterable so a generator can be a source, which is the
clean way to stream a database cursor into a response body.

## Where applications actually break

- Reading an entire body into memory before validating it. The size limit has to be
  enforced by the parser, not by a check after the buffer exists.
- Streaming a cursor into a response without handling client disconnect; the cursor keeps
  reading into a socket that is gone.
- objectMode buffers, where the high-water mark counts objects rather than bytes, so
  1,000 tiny objects and 1,000 large ones behave very differently.
- Compression or encryption stages inserted without measuring the buffered amount at each
  stage — the slowest stage determines memory, not the network.
- Logging every chunk, which moves the bottleneck to the logger.

## Measuring it honestly

Watch writableLength and readableLength against their high-water marks, RSS of the
process, and the age of the oldest buffered chunk. A pipeline that is healthy holds a
bounded buffer; a pipeline without backpressure holds everything it has been handed.
Node also reports external memory — Buffer allocations live outside the V8 heap, so a
stream leak can hide from heap metrics and appear in RSS.

## What a senior answer adds

Backpressure is a contract, not a feature you enable. Once the consumer is slower than the
producer, the system must either slow the producer, drop work with an explicit policy, or
fail the request at a documented limit. Choosing which of those applies is the design
decision; the stream API only implements the first.

## Failure modes

Calling pipe() and assuming errors propagate. Setting a huge high-water mark to "improve
throughput", which is buffering by another name. Mixing sync writes into a stream pipeline
and blocking the loop. And treating an upload endpoint as trustworthy because the
Content-Length header says it is small.
