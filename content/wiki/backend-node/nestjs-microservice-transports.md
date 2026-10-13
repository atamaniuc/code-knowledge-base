---
slug: nestjs-microservice-transports
title: NestJS microservice transports and message patterns
lang: en
domain: backend-node
topic: architecture
tech:
  name: NestJS
  version_range: ">=12"
levels: [senior, staff]
summary: >-
  A Nest microservice is the same handler behind a different transport adapter, and most
  transporters support both request-response and event-based messaging. The transport is
  chosen by delivery semantics, not by what the framework makes easy.
prerequisites: [nestjs-service-boundaries]
related: [nestjs-request-lifecycle-and-scopes, modular-monolith-vs-services]
sources:
  - title: "NestJS — Microservices"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/microservices/basics.md
    kind: official-docs
  - title: "NestJS — gRPC transport"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/microservices/grpc.md
    kind: official-docs
review_status: draft
---

## One handler, many transports

Nest documents a microservice as an application that uses a different transport layer than
HTTP, with built-in transporters including gRPC, NATS, Kafka, RabbitMQ, Redis and MQTT. Most
support both request-response and event-based message styles, abstracted behind a client
proxy on the caller side and a handler decorator on the callee side.

That abstraction is genuinely useful for local development and testing, and it is also the
trap: it makes two systems with very different delivery semantics look interchangeable at
the call site.

## Choosing by semantics

- **gRPC** when you control both ends, need a reply, and want a typed contract — the
  natural internal request-response transport.
- **A broker** (Kafka, NATS, RabbitMQ) when the producer should not know the consumers, the
  work should survive a consumer restart, or several consumers need the same event.
- **Redis** as a transport where the operational maturity is already there and the
  delivery guarantees are understood.

The questions that decide it: does the caller need the answer, what happens if the consumer
is down, how many consumers need the message, and what ordering is required. A transport
choice made on "we already have it" answers none of them.

## Message patterns versus event patterns

A message pattern is request-response: the handler returns a value and Nest sends it back.
An event pattern is one-way: it returns nothing, and a handler that throws produces a
failed event, not an error the caller sees. Confusing the two is how a service ends up
"retrying" an event nobody is listening for.

The handler contract is deliberately thin. Nest does not add idempotency, ordering or
retry semantics on top of the transporter, so a duplicated delivery runs the handler twice
and a message that fails midway is the application's problem. Those guarantees have to be
designed: an idempotency key or a dedupe table for consumers, an outbox for producers.

## Hybrid applications

A process can serve HTTP and consume messages at the same time, which is the practical path
for migrating from a monolith: the same code answers the API and publishes or consumes the
events of a capability being extracted. It also means one process now has two failure modes
— a slow broker consumer can starve the HTTP loop through shared resources and shared
connection pools.

## What the framework will not do

- Transactional coupling between the database write and the published event. That is the
  outbox problem, and it is solved in the application.
- Backpressure. A consumer is a loop; if the handler is slower than the producer, the
  backlog grows in the broker or in memory.
- Version skew across handlers. During a rollout, old and new code both receive messages,
  so the payload must be additive and consumers tolerant.
- Poison-message handling. A message that always fails needs a retry limit and a
  dead-letter destination the team actually reads.

## Failure modes

Treating an event handler as a synchronous call and expecting the caller to see errors.
Choosing a transport for local development convenience and discovering the production
delivery guarantee is at-most-once. Publishing to a broker inside a database transaction
without an outbox. And running an HTTP server and a consumer in one process without
separating their pools or their resource limits.
