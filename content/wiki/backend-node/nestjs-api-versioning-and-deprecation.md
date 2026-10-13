---
slug: nestjs-api-versioning-and-deprecation
title: API versioning in NestJS, and why routing is the easy half
lang: en
domain: backend-node
topic: api-design
tech:
  name: NestJS
  version_range: ">=12"
levels: [senior, staff]
summary: >-
  Nest can select a version from the URI, a header, the media type, or custom logic, and
  VERSION_NEUTRAL exempts a route. That mechanism is the small part; the work is the
  deprecation policy and the telemetry that proves who still calls the old version.
prerequisites: [nestjs-request-lifecycle-and-scopes]
related: [api-contract-evolution, nestjs-configuration-and-validation]
sources:
  - title: "NestJS — Versioning"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/http/versioning.md
    kind: official-docs
  - title: "RFC 9110 — HTTP Semantics"
    url: https://www.rfc-editor.org/rfc/rfc9110.html
    kind: rfc
review_status: draft
---

## Four ways to select a version

Nest supports URI versioning, where the version is part of the path and is the default;
header versioning, where a custom request header carries it; media-type versioning, where
the version rides in the Accept header; and custom versioning, where a function decides.
Versioning is enabled application-wide with a versioning type and options, and individual
controllers or routes can override the version or be marked VERSION_NEUTRAL so they answer
regardless of what the client sends.

The interesting choice is not which type but where the version is observable. A URI
version is visible in access logs, dashboards and rate-limit rules with no extra work; a
header is invisible until someone remembers to log it. That difference decides how
expensive the deprecation will be.

## Versioning is not deprecation

Declaring v2 answers "how do I serve both". It does not answer "how do I stop serving v1",
which is the part that costs engineering time forever. The work is: an additive v2 that
does not fork the whole resource model, per-version request telemetry with a client
identifier, a dated sunset with a documented behaviour at the date, and a migration guide
that a customer can follow without talking to you.

VERSION_NEUTRAL is a useful tool for routes that genuinely do not change, such as health
checks and unversioned metadata. It is not a way to avoid versioning the resource that
changed.

## One version per contract, not one per transport

An HTTP URI version, a gRPC package or method version, and a message schema version are
three separate contracts with three separate consumers. Rolling them under a single
"platform v2" makes an unrelated change look like a breaking one and couples clients that
had nothing to do with each other. Version each boundary on its own schedule.

## What goes in the deprecation policy

- Which changes require a new version (shape, nullability, error semantics, retry safety)
  and which are additive.
- How long a version is supported, measured from the announcement, not from the deploy.
- How usage is measured, per client, and who is contacted when usage is non-zero at the
  deadline.
- What the old version returns after sunset: a documented error, not a silent removal.

## Failure modes

Enabling URI versioning and treating the work as done while both versions are maintained
with no sunset date. Versioning only the URL while error bodies and pagination semantics
change underneath it. Marking a changed route VERSION_NEUTRAL so the change reaches every
client. And measuring usage per endpoint rather than per client, which cannot answer the
only question that matters at sunset — who breaks.
