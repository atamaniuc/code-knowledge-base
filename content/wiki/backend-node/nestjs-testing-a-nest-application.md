---
slug: nestjs-testing-a-nest-application
title: Testing a NestJS application
lang: en
domain: backend-node
topic: testing
tech:
  name: NestJS
  version_range: ">=12"
levels: [senior, staff]
summary: >-
  The TestingModule builds a real injector, which means a test can use the same wiring the
  application uses. The judgement is which dependency is replaced: replace the expensive
  boundary, keep the code under test and its wiring real.
prerequisites: [nestjs-request-lifecycle-and-scopes]
related: [nestjs-configuration-and-validation, nodejs-testing-and-diagnostics]
sources:
  - title: "NestJS — Unit testing"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/fundamentals/unit-testing.md
    kind: official-docs
  - title: "NestJS — Request lifecycle"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/faq/request-lifecycle.md
    kind: official-docs
review_status: draft
---

## What a Nest test should own

There are two useful granularities, and they answer different questions. A unit test builds
a TestingModule with the provider under test and its collaborators replaced, and asserts
the behaviour of one unit. An end-to-end test builds the real application, sends real HTTP
or message traffic, and asserts that the pieces work together — routing, pipes, guards,
error mapping, and the database or broker integration.

A test that builds the whole application but mocks every collaborator is the worst of both:
slow, and unable to catch the wiring bug it looks like it should catch.

## Unit tests with the TestingModule

Test.createTestingModule({ providers: [...], controllers: [...] }).compile() gives a
moduleRef from which providers and controllers are resolved. Because this is the real
injector, a missing provider or a mis-scoped dependency fails the test at compile time —
which is exactly the class of bug that a hand-constructed instance with a fake misses.

## Overriding providers

overrideProvider(token).useValue(...) replaces a provider without rebuilding the module
graph, which is the clean way to substitute a repository, an outbound client or a clock.
Prefer overriding the infrastructure boundary — the thing that would make the test slow or
flaky — and keep the domain service and its wiring real.

In an e2e test the equivalent choice is the opposite: keep the HTTP layer and the database
real, replace only the third-party services outside the system boundary. Those are the
calls you cannot control and should not make in CI.

## The integration honesties

- Assert on the error body and status, not only the success path; the error model is part
  of the contract and pipes, guards and filters produce it.
- Give each test its own data or transaction; a shared fixture that tests mutate in order
  produces failures that depend on execution order.
- Test the request lifecycle where it matters — a guard that must reject before validation,
  an interceptor that must not swallow an exception — because that ordering is behaviour,
  not configuration.
- Keep a test that boots the application with production configuration validation enabled,
  so a missing variable is caught in CI.

## Failure modes

Mocking the class under test's own methods, which asserts nothing. A green unit suite with
no test that exercises the HTTP layer's error mapping. Overriding a provider with a stub
whose signature has drifted from the real one. And treating coverage percentage as the
goal rather than as a by-product of testing the boundaries that break.
