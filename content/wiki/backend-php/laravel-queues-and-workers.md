---
slug: laravel-queues-and-workers
title: Laravel queues, workers and SQS
lang: en
domain: backend-php
topic: queues
tech:
  name: Laravel
  version_range: ">=11"
levels: [middle, senior]
summary: >-
  Queues move slow work out of the request: a job is pushed, a worker pulls it, and SQS adds a visibility timeout that must be coordinated with the job's own timeout and retries.
prerequisites: []
related: [laravel-service-container, laravel-testing-strategy]
sources:
  - title: "Laravel — Queues"
    url: https://laravel.com/docs/11.x/queues
    kind: official-docs
  - title: "AWS — Visibility timeout"
    url: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
    kind: official-docs
review_status: draft
---

## Jobs and workers

A job is a class with a handle() method; dispatch() pushes it onto a queue. A worker
is a long-running process that pulls jobs and executes them. The point is latency and
retries: an HTTP request should not wait for a webhook to a slow third party, and a failed
call should be retried with backoff instead of lost.

## SQS specifics

With the SQS driver, Laravel polls the queue with long polling (ReceiveMessage waits up to
20 seconds). When a message is received, SQS hides it from other consumers for the
visibility timeout. If the worker does not delete the message before that timeout expires,
SQS makes it visible again and another worker may process it again.

The rule is: visibility timeout must be longer than the longest job time, or a slow job
will be delivered twice. Laravel's queue timeout is the local guard, and the visibility
timeout is the remote one — both must be set with the same upper bound in mind.

## Retries, timeouts and failed jobs

Jobs can set tries, timeout, backoff and a retry-until window. A job that
exceeds timeout is killed by the worker and released back to the queue, so a
non-idempotent job without a dedupe key will run again and possibly double-apply. Failed
jobs land in the failed-jobs table, where queue:failed and queue:retry operate.

The design answers every queue question: make the job idempotent, set the visibility
timeout above the real worst case, and use a dead-letter queue for messages that can never
succeed.
