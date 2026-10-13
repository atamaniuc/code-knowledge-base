---
slug: rest-resource-modelling-and-idempotency
title: REST resource modelling and idempotency that survives retries
lang: en
domain: network
topic: api-design
tech:
  name: HTTP APIs
  version_range: ">=2022"
levels: [senior, staff]
summary: >-
  Model nouns as resources and put state transitions where a retry is safe. HTTP already
  defines which methods are idempotent; the operations that are not need an idempotency
  key and a stored result, not a hope that the network is reliable.
prerequisites: []
related: [api-contract-evolution, api-pagination-and-error-models]
sources:
  - title: "RFC 9110 — HTTP Semantics (methods, idempotence)"
    url: https://www.rfc-editor.org/rfc/rfc9110.html
    kind: rfc
  - title: "Stripe — Idempotent requests"
    url: https://docs.stripe.com/api/idempotent_requests
    kind: official-docs
review_status: draft
---

## Resources, not remote procedures

A collection at /orders, an item at /orders/{id}, and sub-resources under it. The model is
worth keeping because it gives caching, conditional requests and routing for free, and
because a client can reason about which calls are safe without reading your documentation.

Actions do not fit and should not be forced. A state transition — capture, refund, retry,
archive — is usually its own sub-resource with a POST, or a state field on the resource
updated through a documented operation. What matters is that the action is named and
auditable, not that no verb appears in a URL.

## Methods and the guarantees HTTP already defines

RFC 9110 defines GET, HEAD, PUT, DELETE and the safe methods as idempotent: issuing the
same request once or several times has the same intended effect as issuing it once. POST is
not, and neither is the typical PATCH. PATCH deserves a specific warning: "apply this diff"
is not idempotent unless the patch is written to be, so a retried PATCH can double-apply a
increment.

PUT replacing a full representation is idempotent, which is why it is the right method for
a client-generated identifier: PUT /orders/{client-generated-id} is safe to retry and needs
no idempotency machinery.

## Idempotency keys for everything else

A payment, a transfer, an email — the operations that cannot be repeated need a key the
client generates and the server stores alongside the result. The first request with a key
executes and stores the response; a repeat with the same key returns the stored response
without re-executing. This is exactly the model documented by payment APIs, and it is
worth describing in those terms because the details matter:

- Deduplicate by key, never by payload hash. Two legitimate identical transfers exist.
- Scope the key to the account or tenant, and set an expiry window; keys cannot be stored
  forever, so the contract has to say how long they are honoured.
- Make the key insert and the business effect atomic — a unique constraint on the key in
  the same transaction as the effect — or two concurrent duplicates both execute.
- Store the response body and status, not just "seen".

A concurrent duplicate is the case most implementations miss: both requests check for the
key, neither finds it, both proceed. The unique constraint or a lease makes one of them
wait and return the first result.

## Conditional requests and lost updates

ETag with If-Match turns a read-modify-write into an optimistic concurrency check: the
update fails with 412 if the representation changed since it was read. For a client editing
a resource this is the difference between detecting a conflict and silently overwriting a
colleague's change. It is cheap, standard, and usually skipped.

## Failure modes

Modelling an action as a POST that is retried by the client library and executed twice.
Adding a client-side "retry with the same body" instead of an idempotency key. Storing the
key in a cache with the same TTL as the effect, so a late retry re-executes. Returning 200
for a conflicting duplicate instead of the original status. And treating GET as safe while
the implementation mutates a counter.
