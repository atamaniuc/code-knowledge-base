---
slug: laravel-multitenancy-patterns
title: Multi-tenant Laravel on one shared database
lang: en
domain: backend-php
topic: multitenancy
tech:
  name: Laravel
  version_range: ">=11"
levels: [senior]
summary: >-
  One database, every row belongs to a company: the tenant filter must be enforced by the model layer, injected by middleware, and optionally double-fenced by PostgreSQL row-level security.
prerequisites: []
related: [laravel-middleware-and-bootstrap, laravel-eloquent-relations-and-eager-loading]
sources:
  - title: "Laravel — Global Scopes"
    url: https://laravel.com/docs/11.x/eloquent#global-scopes
    kind: official-docs
  - title: "PostgreSQL — Row Security Policies"
    url: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
    kind: official-docs
review_status: draft
---

## Shared database with tenant scoping

The platform is multi-tenant: one shared database where every row belongs to a company,
and the application code keeps tenants apart. The schema carries a company_id (or
tenant id) column on tenant-owned tables, and every query must be scoped to the current
tenant. This is the "shared database, shared schema" model: cheapest to operate, and the
most dangerous if a query forgets the filter.

## Global scopes and middleware

The Laravel idiom is a global scope: a trait applied to tenant-owned models adds
where company_id = current_company_id to every query the model makes, including
relations. The current tenant id is resolved per request by middleware — from the
authenticated user, the subdomain, or an explicit header — and stored where the scope can
read it.

The discipline is: new models must opt in to the trait, and queries that bypass scopes
(withoutGlobalScope) must be rare, named, and reviewed. A code review checklist that asks
"is every query scoped to the company?" is the second fence.

## Row-level security as a second fence

PostgreSQL row-level security (RLS) can enforce the tenant filter at the database: a
policy rejects reads and writes that do not match the tenant, even if application code
forgets. It is not a replacement for scopes — error messages are worse and migrations get
more complex — but as a second fence it turns a cross-tenant leak into a database error
instead of a data breach.
