---
slug: nestjs-configuration-and-validation
title: Configuration and validation in a NestJS service
lang: en
domain: backend-node
topic: framework
tech:
  name: NestJS
  version_range: ">=12"
levels: [senior, staff]
summary: >-
  Configuration is an input like any other and should fail at startup rather than on the
  first request. Validation belongs at the transport boundary, with the schema and the
  error shape chosen deliberately — class-validator DTOs or a Standard Schema validator.
prerequisites: [nestjs-request-lifecycle-and-scopes]
related: [nestjs-testing-a-nest-application, nodejs-esm-cjs-and-type-stripping]
sources:
  - title: "NestJS — Configuration"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/application/configuration.md
    kind: official-docs
  - title: "NestJS — Validation"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/application/validation.md
    kind: official-docs
review_status: draft
---

## Configuration as a validated boundary

@nestjs/config loads environment variables and configuration files and exposes a
ConfigService. Its validationSchema option applies to environment variables, and the
documentation notes that configuration files are not validated automatically and that
transformations belong in a factory. That asymmetry is worth stating out loud in an
interview: the schema protects the environment, not the YAML someone commits.

The shape that works is a typed configuration object, validated once during module
initialisation, injected where it is used, and never read from process.env inside business
code. A provider that reads process.env at call time is a provider that cannot be tested
without mutating global state.

## Fail fast at startup

A missing database URL or an unparseable port should stop the process before it accepts
traffic. The alternative — a lazy read that throws on the first request that needs it — is
an outage discovered by a user, on a replica that passed its health check. Validation at
boot turns a production incident into a deploy failure, which is the cheapest possible
place to fail.

The corollary is that configuration errors must not be recoverable-looking. A default of
"localhost" for a production database host is a configuration bug that will pass every
test and fail on the first scale-out.

## Validation at the edge

Nest ships two validation pipes. ValidationPipe validates classes decorated with
class-validator rules; StandardSchemaValidationPipe validates schemas written with a
Standard Schema implementation such as Zod, Valibot or ArkType. Both throw a BadRequest
with a structured body, and both can be configured to strip unknown properties or reject
them outright.

Whitelisting unknown properties is a security control, not tidiness: without it, a client
can set fields the DTO never declared and a careless spread into an entity writes them.
Rejecting on unknown keys is the stricter setting and is worth the client friction on
write endpoints.

Validation belongs at the transport boundary because that is where untrusted input enters.
The domain service can then assume valid, typed inputs, and its invariants are about
business rules rather than about whether a string was a UUID. A service that re-validates
what the pipe already validated is usually a service that is called from two places with
different guarantees.

## Error shapes

The pipe's error body is part of the API contract. Decide once whether the client sees the
validator's messages, a normalised problem document, or both, and make every other error in
the service use the same shape. A 400 that looks different depending on which layer
rejected the request is a client-side branching problem the API handed to its consumers.

## Failure modes

Reading process.env throughout the codebase and calling it configuration management.
Validating configuration files with a schema that only covers environment variables, then
trusting the files. Turning off whitelisting to unblock a client. Duplicating validation
in the handler and letting the two rule sets drift. And returning raw validator messages
that leak internal field names or SQL fragments.
