---
slug: laravel-eloquent-relations-and-eager-loading
title: Eloquent relations and the N+1 problem
lang: en
domain: backend-php
topic: eloquent
tech:
  name: Laravel
  version_range: ">=11"
levels: [middle, senior]
summary: >-
  Eloquent models express relations as methods, and loading a relation lazily per row turns one query into hundreds; eager loading and lazy-loading prevention are the two controls.
prerequisites: []
related: [laravel-testing-strategy, laravel-multitenancy-patterns]
sources:
  - title: "Laravel — Eloquent Relationships"
    url: https://laravel.com/docs/11.x/eloquent-relationships
    kind: official-docs
  - title: "Laravel — Eloquent ORM"
    url: https://laravel.com/docs/11.x/eloquent
    kind: official-docs
review_status: draft
---

## Relation types

Eloquent expresses relations as methods on the model: hasMany, belongsTo,
belongsToMany (pivot tables), hasOne, morphMany (polymorphic, one table for many
parent types). A relation method returns a query builder, so it can be constrained,
counted, or eager-loaded. With about 550 models and 1000 migrations, the relations are the
map of the data model — reading them tells you how tenants, invoices and payments connect.

## The N+1 problem

If a page lists 200 invoices and the view calls invoice->company->name, Eloquent runs
one query for the invoices and one more query per invoice for the company: 201 queries.
That is the N+1 problem, and it is the single most common cause of a slow page in a
multi-tenant Laravel app.

## Eager loading and lazy loading

The fix is to load relations up front: Invoice::with('company')->get() runs two queries
regardless of row count. with also accepts nested relations (company.owner) and
per-relation constraints. loadMissing fills a relation only when it is not already
loaded.

Model::preventLazyLoading() turns every accidental lazy load in development into an
exception, so the bug fails the request while it is being written instead of showing up in
production as 201 queries. The exception message names the relation, which is the fastest
possible route to the fix.
