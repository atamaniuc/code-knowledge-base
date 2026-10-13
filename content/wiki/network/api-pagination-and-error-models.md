---
slug: api-pagination-and-error-models
title: Pagination and error models clients can branch on
lang: en
domain: network
topic: api-design
tech:
  name: HTTP APIs
  version_range: ">=2022"
levels: [senior, staff]
summary: >-
  Offset pagination silently drops and duplicates rows while a collection is being written;
  a keyset cursor with a unique tie-breaker is stable. Errors are the other half of the
  contract: a stable machine-readable code, not a message to parse.
prerequisites: []
related: [api-contract-evolution, rest-resource-modelling-and-idempotency, rate-limiting-and-backpressure]
sources:
  - title: "RFC 9457 — Problem Details for HTTP APIs"
    url: https://www.rfc-editor.org/rfc/rfc9457.html
    kind: rfc
  - title: "RFC 9110 — HTTP Semantics"
    url: https://www.rfc-editor.org/rfc/rfc9110.html
    kind: rfc
review_status: draft
---

## Offset pagination is a lie under writes

LIMIT 50 OFFSET 100 asks the database for the hundred-and-first row of whatever the
collection looks like now. Insert a row near the front between two page requests and the
client sees an item twice; delete one and an item is never seen. The bug appears only in
production, only on large collections, and only under concurrent writes — which is exactly
when a client pages through the whole set.

Offset is still fine for a bounded, mostly static admin list. It is not fine as the default
for a feed.

## Cursor pagination that is actually stable

Order the collection by a key that is unique and immutable — created_at plus id, or a
monotonic sequence — and encode "the last row I saw" into an opaque cursor. The next page
is WHERE (created_at, id) > (last.created_at, last.id) ORDER BY created_at, id LIMIT n.
The tie-breaker is not optional: timestamps collide, and without id the page boundary
repeats or skips rows.

The cursor should be opaque and versioned, so the encoding can change without breaking
clients. It cannot be used to jump to page 37; if a product requirement needs page numbers,
it is a separate endpoint over a snapshot, and the snapshot has to expire.

## What the response should carry

A page of data plus a token for the next page, and an explicit end-of-list signal. Total
counts are expensive and are wrong the moment the next write lands; if the UI needs one,
compute it separately, label it approximate, and do not make it a precondition of paging.
Returning has_more and a next cursor lets a client page without ever knowing the total.

## An error model a client can branch on

RFC 9457 defines a problem detail document with a type, title, status, detail and
instance, served as application/problem+json. The valuable part is not the media type but
the discipline: one shape, produced in one place, with a stable code the client branches on.
A client should never parse a human-readable message to decide whether to retry.

What the model needs in practice:

- A stable, enumerated code, distinct from the HTTP status, because two 409s can mean
  very different things.
- An explicit retryability signal, so a client does not guess from the status class.
- A correlation id the client can quote in a support ticket, and which appears in the
  server trace.
- Field-level detail for validation failures, in a documented structure.
- No internal detail: no stack traces, no SQL, no upstream host names.

The status code still matters — 4xx is the client's fault and generally not retryable,
5xx is the server's and usually is — but the code and the retry signal are what make the
client's behaviour deterministic.

## Failure modes

Shipping offset pagination because it was one line. Cursor pagination without a unique
tie-breaker. Returning a total count that is recomputed per page and locking the collection
to do it. Different error shapes from validation, authorization and the domain layer. And
exposing an upstream error verbatim because it was convenient.
