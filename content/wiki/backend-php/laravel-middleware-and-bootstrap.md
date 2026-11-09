---
slug: laravel-middleware-and-bootstrap
title: Laravel 11 middleware and bootstrap
lang: en
domain: backend-php
topic: middleware
tech:
  name: Laravel
  version_range: ">=11"
levels: [middle, senior]
summary: >-
  Laravel 11 configures the HTTP kernel in bootstrap/app.php; middleware is registered there and order is explicit, which is what a tenant resolver in front of auth depends on.
prerequisites: []
related: [laravel-multitenancy-patterns, laravel-passport-vs-jwt]
sources:
  - title: "Laravel — Middleware"
    url: https://laravel.com/docs/11.x/middleware
    kind: official-docs
  - title: "Laravel — Configuration"
    url: https://laravel.com/docs/11.x/configuration
    kind: official-docs
review_status: draft
---

## Middleware in Laravel 11

Laravel 11 replaced the long HTTP kernel class with bootstrap/app.php, where the
application is configured with a fluent builder: routing, middleware, and exception
handling are declared there. Custom middleware is registered with ->withMiddleware(),
and route middleware is attached in the routes file.

Middleware runs before and after the controller: work before next(request) is the
way in, work after is the way out. It can inspect, decorate or reject the request.

## Ordering and groups

The global middleware stack is ordered by registration, and the order is load-bearing. A
tenant resolver that reads the company from the request and sets it on the application
context must run before auth checks and before any controller code that scopes a query.
append and prepend control exactly where a middleware lands.

Middleware groups (web, api) are named stacks applied to whole route files. Aliasing
middleware keeps route files readable.

## Route middleware

Route-level middleware guards specific routes — auth, permission, tenant. Because it runs
after global middleware, it may rely on the context global middleware established. The
interview answer should show awareness of this layering: global first, then route, then
controller, and validation via FormRequest before the action body.
