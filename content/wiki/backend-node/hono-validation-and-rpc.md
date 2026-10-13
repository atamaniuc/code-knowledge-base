---
slug: hono-validation-and-rpc
title: Validation and the typed RPC client in Hono
lang: en
domain: backend-node
topic: framework
tech:
  name: Hono
  version_range: ">=4.13"
levels: [senior, staff]
summary: >-
  zValidator validates a request part against a Zod schema and hands the handler typed
  data. hc infers request and response types from the app definition, which removes codegen
  for first-party clients and does nothing for anyone else.
prerequisites: [hono-runtime-agnostic-handlers]
related: [nestjs-configuration-and-validation, api-contract-evolution]
sources:
  - title: "Hono — Validation"
    url: https://hono.dev/docs/guides/validation
    kind: official-docs
  - title: "Hono — RPC"
    url: https://hono.dev/docs/guides/rpc
    kind: official-docs
review_status: draft
---

## Validation at the route

The zod validator middleware takes a target — json, form, query, param, header, cookie — a
schema and an optional hook, and the handler reads the parsed result through c.req.valid().
Invalid input produces a 400 before the handler runs, and the handler's type reflects the
schema rather than the raw request.

That is the same boundary discipline as any framework: validation is a property of the
transport edge, and the domain code receives a typed value. The difference from a
class-based framework is that the schema is the single source of truth for both the runtime
check and the TypeScript type, so they cannot drift — the classic failure being a DTO and
its validation decorators disagreeing.

The error body the validator returns is part of the contract. If external clients consume
the API, normalise it to the same error model as the rest of the service rather than
shipping the validator's internal format.

## The typed RPC client

hc takes the app's exported type and produces a client whose paths and payloads are checked
at compile time. For a first-party TypeScript consumer — a web front end in the same
repository — this eliminates a code generator and an OpenAPI document that nobody updates.
Changing a route's response type breaks the client at build time, which is exactly the
compile-time safety a codegen client provides, without the pipeline.

Its limits are worth stating precisely. The types are erased at runtime, so the client
validates nothing it sends. The types travel as a TypeScript import, which means the
consumer needs the server's type graph and a build that can handle it. The client is
TypeScript-only, so mobile, Go or a partner integration still needs a real specification.

## RPC, OpenAPI, or both

The rule that holds: infer types for clients you build and deploy together; publish an
OpenAPI or protobuf contract for clients you do not control. A public API with an inferred
TS client only is an API whose contract is invisible to half its consumers.

## Error handling

Handlers return c.json(body, status) and set status explicitly; errors thrown inside a
handler are caught by an error handler configured on the app. The important design decision
is the same as anywhere: one machine-readable error shape with stable codes, produced in
one place, so a client can branch on the code rather than parse a message.

## Failure modes

Validating the body but not the query string, then trusting a query parameter in a database
call. Treating the inferred client as a contract for external consumers. Letting each route
invent its own error shape because the framework makes c.json easy. And putting validation
in the handler after the domain logic already ran.
