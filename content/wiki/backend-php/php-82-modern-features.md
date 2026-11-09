---
slug: php-82-modern-features
title: Modern PHP 8.2+ features used in Laravel code
lang: en
domain: backend-php
topic: language
tech:
  name: PHP
  version_range: ">=8.2"
levels: [middle, senior]
summary: >-
  Readonly classes freeze value objects, enums replace string statuses with a closed set, fibers allow cooperative concurrency, and 8.3 adds typed class constants and json_validate.
prerequisites: []
related: [laravel-service-container]
sources:
  - title: "PHP — Readonly properties"
    url: https://www.php.net/manual/en/language.oop5.properties.php
    kind: official-docs
  - title: "PHP — Enumerations"
    url: https://www.php.net/manual/en/language.enumerations.php
    kind: official-docs
  - title: "PHP — Fibers"
    url: https://www.php.net/manual/en/language.fibers.php
    kind: official-docs
review_status: draft
---

## Readonly

readonly properties can be written exactly once, from inside the class scope; PHP 8.2
added readonly class, which marks every property readonly. A money value object or a DTO
becomes immutable by construction: after creation its state cannot drift. This is the
cheapest way to get value-object semantics without writing boilerplate.

## Enums

PHP 8.1 enums are a closed set of named cases, optionally backed by a string or int.
InvoiceStatus::Paid replaces the string "paid" scattered across the codebase: the type
system now rejects a typo, and match expressions over the enum are exhaustive. In a
billing system this is the difference between a status that is one of five values and a
status that is any string a developer happens to write.

## Fibers

Fibers are cooperative concurrency: a function can suspend and resume without blocking the
whole process. Application code rarely uses Fibers directly — frameworks and async
runtimes (ReactPHP, Amp, FrankenPHP's worker mode) build on them. The interview-relevant
point is knowing the execution model: php-fpm is request-per-process, while long-lived
workers keep state and need Fibers or an event loop for concurrent I/O.

## Typed properties and null safety

Typed properties, constructor property promotion, match, nullsafe operator
(order?->customer?->name), and named arguments are all available in PHP 8. PHP 8.3
added typed class constants and json_validate(). A Laravel 7 codebase moving to 11
gains all of these, and the migration is the moment to introduce them where they remove a
class of bug.
