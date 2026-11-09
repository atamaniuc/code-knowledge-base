---
slug: laravel-service-container
title: Laravel service container and dependency injection
lang: en
domain: backend-php
topic: container
tech:
  name: Laravel
  version_range: ">=11"
levels: [middle, senior]
summary: >-
  The container is Laravel's dependency resolver: it builds objects, injects constructor arguments, and lets application code bind interfaces to implementations without touching every call site.
prerequisites: []
related: [laravel-testing-strategy]
sources:
  - title: "Laravel — Service Container"
    url: https://laravel.com/docs/11.x/container
    kind: official-docs
  - title: "Laravel — Service Providers"
    url: https://laravel.com/docs/11.x/providers
    kind: official-docs
review_status: draft
---

## What the container does

Every Laravel application boots with a service container: a registry that knows how to
build objects. When a controller's constructor type-hints an interface, the container
resolves it from bindings registered in service providers. The developer never writes
new InvoiceService() in a controller; the framework hands the controller a ready-made,
fully injected instance.

The practical payoff is testability. A class that receives its dependencies through the
constructor can be given fakes in a unit test, and swapped implementations in production
without editing the class.

## Binding interfaces to implementations

A binding says "when someone asks for this interface, build this class":

    $this->app->bind(PaymentGateway::class, StripeGateway::class);

A singleton binding returns the same instance for the request or the process. Contextual
binding goes further: the same interface can resolve to different classes depending on the
consumer. Bindings live in service providers, which are registered in
bootstrap/providers.php in Laravel 11.

## When to reach for the container

The container is the default for controllers, jobs, commands and middleware. Use it
directly for: interfaces with more than one implementation, value objects built from
request context, and expensive objects that should be built once. Do not use it as a
service locator inside business code — calling app(SomeClass::class) in the middle of a
domain service hides the dependency instead of declaring it, and makes the class impossible
to test without the framework.
