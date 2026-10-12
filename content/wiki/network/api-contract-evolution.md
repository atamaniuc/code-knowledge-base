---
slug: api-contract-evolution
title: Evolving an API contract without breaking clients
lang: en
domain: network
topic: api-design
tech:
  name: HTTP APIs
  version_range: ">=2022"
levels: [senior, staff]
summary: >-
  An API contract is what clients can rely on, and it includes behaviour the OpenAPI file
  does not describe: error shapes, retry semantics, ordering and idempotency. Versioning is
  the fallback; additive change and tolerant clients are the plan.
prerequisites: []
related: [microservice-boundaries]
sources:
  - title: "RFC 9110 — HTTP Semantics"
    url: https://www.rfc-editor.org/rfc/rfc9110.html
    kind: rfc
  - title: "Stripe — Idempotent requests"
    url: https://docs.stripe.com/api/idempotent_requests
    kind: official-docs
review_status: draft
---

## The contract is larger than the schema

The OpenAPI document describes shapes. Clients also depend on: which fields may disappear,
what a 4xx body looks like, whether a retry is safe, whether pagination order is stable, and
whether the service returns 200 with a rate-limit warning. Every one of those has broken a
client in production.

Write the compatibility rules down, and make the pipeline check them — schema diffing for
the shapes, contract tests for the behaviour. A rule that is not checked is a preference.

## Prefer additive change

Adding an optional field, an enum member or a new endpoint is compatible. Making a field
required, narrowing an enum, changing a type or a null-ness, or reordering a list with
unstable tie-breaks is not. The cheapest way to never do the second list is to make clients
tolerant: ignore unknown fields, treat an absent optional field as absent rather than as
default, and never switch behaviour on the number of fields returned.

Where a breaking change is genuinely needed, expand and contract: add the new field or
endpoint, migrate the clients you can observe, then remove the old one after a deprecation
window with usage telemetry proving nobody is calling it.

## Versioning strategies

- **URI versioning** (`/v2/...`) is honest, cacheable and easy to route. It also forks the
  resource identity and tempts an organisation into maintaining two systems.
- **Header or media-type versioning** keeps one URL and is harder to see in logs and
  dashboards; debugging a version-skew incident gets worse.
- **Date-pinned versions** (Stripe's model) pin behaviour per account, which decouples
  client upgrades from server deploys at the cost of testing every supported pin.

Any of these works. None of them is a substitute for a deprecation policy with a date, a
signal, and a way to see who is still on the old path.

## Retries and idempotency belong in the contract

Clients retry. Network failures are ambiguous — the request may have been applied and the
response lost — so an operation that is not safe to repeat must accept an idempotency key,
store the first result against it, and return that same result for the repeat. Deduplicate by
key, never by payload hash: two legitimate identical requests exist (two identical
transfers), and hashing them away is a bug that only shows up in production.

Document which methods are idempotent, and where you rely on that, so client retry policy
can be written rather than guessed.

## Errors and pagination are the contract's ugliest corners

Return a machine-readable error code alongside the human message, keep it stable, and never
change an error from retryable to terminal without a version. For lists, choose cursor
pagination when the underlying collection changes while it is being read; offset pagination
silently drops and duplicates rows under concurrent writes.
