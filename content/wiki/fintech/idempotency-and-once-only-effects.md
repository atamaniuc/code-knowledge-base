---
slug: idempotency-and-once-only-effects
title: Idempotency keys and making an effect once-only
lang: en
domain: fintech
topic: reliability
tech:
  name: Payment APIs
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Exactly-once delivery does not exist, so the guarantee has to be built at the effect:
  a key that identifies the intent, stored atomically with the result, so a retry returns
  the first answer instead of moving money a second time.
prerequisites: [double-entry-ledgers]
related: [double-entry-ledgers, reconciliation-and-drift, payment-lifecycle]
sources:
  - title: "Stripe — Idempotent requests"
    url: https://docs.stripe.com/api/idempotent_requests
    kind: official-docs
  - title: "Stripe — Advanced error handling"
    url: https://docs.stripe.com/error-low-level
    kind: official-docs
review_status: draft
---

## The problem in one sentence

A client sends a payment request, the connection drops before the response arrives, and the
client does not know whether the payment happened. Retrying may charge twice; not retrying
may leave a customer who thinks they paid with no charge at all. Every payment system
lives with this, and every interview about money waits for the candidate to raise it
unprompted.

The framing to use: you cannot make the network reliable, so you make the operation
repeatable. Idempotency is a property of the effect, not of the transport.

## Idempotency keys

The client generates a key that identifies the intent of the request — a UUID with enough
entropy to avoid collisions — and sends it with every attempt. The server, on first
receipt, records the key together with the response it produced. On a repeat, it returns
the stored response rather than executing again. Stripe's API works this way with an
Idempotency-Key header, recommends V4 UUIDs, caps the key at 255 characters, and warns
against putting personal data in the key because the key is stored and logged.

Two refinements matter. The key must be scoped to the caller, or one client can collide
with another's key. And the stored record should include a fingerprint of the request
parameters: Stripe compares incoming parameters to the original and errors if they differ,
which turns a misused key into a loud failure instead of a silent wrong answer. A reused
key with different parameters is almost always a client bug, and detecting it is cheap.

## Where the guarantee has to live

The key table and the effect must commit in the same transaction. If the payment is
recorded and the key row is not, the retry charges again. If the key row is committed and
the effect is not, the customer is told the payment succeeded when it did not. This is the
part candidates skip: they describe the lookup-and-return pattern and not the atomicity
that makes it correct.

The mechanism is a unique constraint on the idempotency key inside the same database
transaction that writes the ledger entries, with the insert of the key row racing to be the
one that wins. The loser of the race reads the stored result. Where the effect is a call to
an external provider, the same discipline applies one level down, and the provider's own
idempotency key is what makes the outbound call safe to retry.

## The window, and why money needs a longer one

Keys cannot be kept forever at full detail, so they expire. Stripe's v1 API prunes keys
after at least 24 hours, and a new request is generated if a pruned key is reused. That is
a reasonable default for an API whose retries happen in seconds, and the window is exactly
the guarantee.

For money movement the window is a design decision, not a default. A payout that may be
retried by an operator on Monday for a Friday batch needs the key to live as long as the
operation might be retried. The honest answer is to size the retention by the retry
horizon of the client, and to say what happens at the edge: after the window, the key is a
new request.

## The ambiguous timeout

The interesting case is not the immediate retry but the one after a timeout, where the
first attempt may still be executing. Two rules help. Make the operation safe to retry
rather than trying to detect whether it happened, and make the read path able to answer
the question — a client that can query by its own key or by the business reference can
learn the outcome instead of guessing.

The interview-grade follow-up is what to do while the first attempt is still in flight. A
second attempt with the same key should either wait or return the in-progress state, not
start a parallel execution. The key row is the lock.

## The same problem one layer down

HTTP is where the question is usually asked, but the guarantee is needed everywhere an
effect crosses a boundary. A message consumer that processes payments will see duplicates
because at-least-once delivery is the only delivery that exists at scale; the consumer's
deduplication key is the same idea. A worker that calls a provider and dies before
recording success must be able to re-run without duplicating, which is why the outbox
pattern writes the intent and the side effect atomically.

The clean mental model: every step that can be retried needs an identity, and the identity
is stored with the outcome.

## What a staff answer adds

A statement of the blast radius: which operations are idempotent, which are not, and how
the non-idempotent ones are contained. An audit of the retry paths — load balancers,
client SDKs, queue redeliveries, cron jobs — because a retry added somewhere harmless can
duplicate an effect somewhere else. Key retention chosen from the retry horizon and
documented. And reconciliation as the backstop, because a system that assumes its
idempotency is perfect has no way to learn that it is not.
