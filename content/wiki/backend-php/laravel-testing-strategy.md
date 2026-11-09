---
slug: laravel-testing-strategy
title: Testing Laravel applications
lang: en
domain: backend-php
topic: testing
tech:
  name: Laravel
  version_range: ">=11"
levels: [middle, senior]
summary: >-
  Feature tests exercise the HTTP layer and the database, unit tests isolate pure logic, and a regression test must fail before the fix; RefreshDatabase and DatabaseTransactions are the two database strategies.
prerequisites: []
related: [laravel-service-container, laravel-queues-and-workers]
sources:
  - title: "Laravel — Testing"
    url: https://laravel.com/docs/11.x/testing
    kind: official-docs
  - title: "PHPUnit — Documentation"
    url: https://docs.phpunit.de/en/11.5/
    kind: official-docs
review_status: draft
---

## Feature tests

A feature test in Laravel makes an HTTP request (get, postJson) or calls a job, and
asserts on the response, the database state, and side effects. The vacancy's standard is
explicit: a bug fix comes with a test that fails before the fix. The workflow is
reproduce, write the failing test, make it green, hand off to QA with steps.

## RefreshDatabase versus transactions

RefreshDatabase migrates the test database for the whole run and wraps each test in a
transaction that is rolled back, giving a clean schema per test. DatabaseTransactions
assumes the schema already exists and only wraps in a transaction — faster, but it does
not handle tests that commit their own transactions or talk to a separate process.
DatabaseMigrations runs migrations per test and is the slowest. The choice is a
speed-versus-isolation trade-off worth naming.

## Testing jobs and HTTP

Jobs are tested by dispatching and asserting they were pushed (Queue::fake()) and by
executing the job class directly against the database. HTTP integrations are tested with
Http::fake() to stub third-party calls and assert the exact payload sent. Mocking is
for the boundary, not for the class under test: mock the Stripe client, not the invoice
service. Tests that only prove mocks were called prove nothing about behaviour.
