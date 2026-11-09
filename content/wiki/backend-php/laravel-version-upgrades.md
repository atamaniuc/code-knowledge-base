---
slug: laravel-version-upgrades
title: Upgrading a large Laravel application
lang: en
domain: backend-php
topic: upgrades
tech:
  name: Laravel
  version_range: ">=11"
levels: [senior]
summary: >-
  A large Laravel 7 codebase moving to 11 upgrades one major version at a time with the upgrade guides, automation like Laravel Shift, and a strict rule: additive migrations and never rewriting what works.
prerequisites: []
related: [laravel-service-container, laravel-testing-strategy]
sources:
  - title: "Laravel — Upgrade Guide"
    url: https://laravel.com/docs/11.x/upgrade
    kind: official-docs
  - title: "Laravel Shift"
    url: https://laravelshift.com/
    kind: article
review_status: draft
---

## Upgrade path

Laravel's policy is one major version at a time: 7 to 8, 8 to 9, and so on up to 11, with
the official upgrade guide for each hop. Jumping several versions at once mixes breaking
changes into one undebuggable diff. Each hop ends with the test suite green and the app
deployed before the next begins.

## What breaks

The known breakpoints: PHP version requirements rise, facades and helpers are removed or
moved, the HTTP kernel shrinks in Laravel 11, model date serialization changes, and
dependency versions (PHPUnit, Symfony components) move with the framework. The upgrade
guides list every breaking change; the discipline is reading them, not discovering
breakage in production.

## Automation and safety

Laravel Shift automates the mechanical parts of an upgrade — namespace changes, config
shifts, dependency bumps — and opens a pull request with a human review checklist. On a
codebase with 1000 migrations and 550 models, automation removes the mechanical work and
leaves the judgement calls: which deprecated APIs are load-bearing, and which tests are
actually asserting the old behaviour.

The rules the vacancy states map directly: prefer additive migrations, run dry runs and
read-only checks first, improve what you touch, and do not rewrite what you do not have to.
