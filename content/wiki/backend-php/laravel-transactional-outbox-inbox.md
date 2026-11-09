---
slug: laravel-transactional-outbox-inbox
title: Transactional outbox and inbox in Laravel
lang: en
domain: backend-php
topic: messaging
tech:
  name: Laravel
  version_range: ">=11"
levels: [senior]
summary: >-
  A database commit and a queue publish cannot be one atomic operation. The outbox writes
  the event in the same transaction for a relay to publish later; the inbox deduplicates
  incoming messages by a unique external id before business logic runs.
prerequisites: [laravel-queues-and-workers]
related: [stripe-nue-billing-in-laravel, laravel-queues-and-workers]
sources:
  - title: "Laravel — Database transactions"
    url: https://laravel.com/docs/11.x/database
    kind: official-docs
  - title: "Pattern: Transactional outbox"
    url: https://microservices.io/patterns/data/transactional-outbox.html
    kind: article
  - title: "Pattern: Idempotent consumer"
    url: https://microservices.io/patterns/communication-style/idempotent-consumer.html
    kind: article
review_status: draft
---

## The dual-write problem

A handler that must both update PostgreSQL and publish an event to SQS is performing two
writes to two different stores, and no distributed transaction spans them. If the process
dies after the commit but before the publish, the event is lost; if it publishes before the
commit and the commit rolls back, the event describes a state that never existed. This is
the dual-write problem, and it is the reason webhooks and queued events in a billing system
need an explicit pattern rather than a publish call after save().

## Transactional outbox

The outbox moves the problem into the database. In the same transaction that changes the
invoice, the handler inserts a row into an outbox table: event_id, type, payload, sent_at
null. The transaction makes the business change and the event durable together — either
both exist or neither does. A separate relay process polls unsent rows, publishes each
payload to the queue, and marks the row sent. The relay selects rows with FOR UPDATE SKIP
LOCKED so several workers can drain the table without stealing each other's rows.

The relay is the only component that talks to the queue, and its publish is retried until
the row is marked sent. At-least-once delivery means the publish may repeat, so consumers
still have to be idempotent — the outbox guarantees the event is not lost, not that it is
delivered exactly once.

## Transactional inbox and idempotency

The inbox is the receiving mirror. An incoming webhook or queue message is first persisted
to an inbox table with a unique key on the provider's external id — Stripe event id,
QuickBooks entity id, an Idempotency-Key. The insert is the deduplication gate: if the row
already exists, the message is a duplicate and processing stops before any side effect.
With Postgres this is a single INSERT ... ON CONFLICT DO NOTHING followed by a row-count
check.

The same principle covers outgoing calls: Stripe's Idempotency-Key makes a retried request
return the original result instead of charging twice. And because SQS is at-least-once,
every queued job must carry its own idempotency — a unique constraint, a status guard, or
both — so a redelivery is a no-op rather than a double effect.

## Outbox plus inbox in one flow

The vacancy's Stripe-to-Nue pipeline is one flow with both patterns. The Stripe webhook
lands in the inbox and is deduplicated by event id; the handler marks the invoice paid and
writes the InvoicePaid event to the outbox in one transaction; the relay publishes to SQS;
the Nue sync consumer applies the change idempotently by external_id. Every hop tolerates a
duplicate because each hop owns its deduplication key.

## Failure modes

Publishing in business code and calling it done. A relay without SKIP LOCKED that double
publishes under concurrency. An inbox without a unique key, so two identical webhooks both
reach the handler. And the belief that retries replace idempotency — retries without
idempotency are how a failed job doubles an invoice total.
