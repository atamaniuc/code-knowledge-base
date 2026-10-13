---
slug: nestjs-request-lifecycle-and-scopes
title: The NestJS request lifecycle and injection scopes
lang: en
domain: backend-node
topic: framework
tech:
  name: NestJS
  version_range: ">=12"
levels: [senior, staff]
summary: >-
  Nest runs middleware, guards, interceptors, pipes and the handler in a documented order,
  and each has one job. Injection scope decides how long a provider lives; making a
  provider request-scoped changes the lifetime of everything that injects it.
prerequisites: [nestjs-service-boundaries]
related: [nestjs-configuration-and-validation, nestjs-microservice-transports]
sources:
  - title: "NestJS — Request lifecycle"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/faq/request-lifecycle.md
    kind: official-docs
  - title: "NestJS — Provider scopes"
    url: https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/fundamentals/provider-scopes.md
    kind: official-docs
review_status: draft
---

## Modules, providers and the default scope

A module declares providers, and by default a provider is a singleton shared by every
request in the process. That default is the right one: a database pool, a client, a cache
are all things you want one of, and Nest's documentation is explicit that almost
everything is shared across incoming requests because Node does not have a
stateless-thread-per-request model.

The single-instance default is also the reason a provider must not hold request state in a
field. Two concurrent requests mutating the same injected object is the classic bug that
looks like an intermittent data mix-up.

## Injection scopes

- **DEFAULT** — one instance for the application.
- **REQUEST** — a new instance per request, created per request and garbage-collected
  afterwards.
- **TRANSIENT** — a new instance per consumer.

Request scope propagates: a singleton controller that injects a request-scoped provider
becomes request-scoped itself, because its own instance now depends on the request. The
documentation is blunt that request-scoped providers affect performance, since an instance
is created for each request. Durable providers exist for the event-driven case where a
consumer process handles a stream of messages and the per-message context must still be
resolvable.

The senior move is to keep request context in a per-request object passed explicitly, or
in AsyncLocalStorage, and keep providers singleton unless a per-request instance is
genuinely required.

## The request lifecycle order

Middleware runs first, then guards, then interceptors on the way in, then pipes, then the
route handler, then interceptors on the way out, and exception filters handle anything
that was thrown. Globals run before controller-level components, which run before
route-level ones, within each stage.

Two details earn follow-up credit. An exception skips the rest of the lifecycle and goes
straight to the filter, so an exception caught with try/catch inside a handler never
reaches an exception filter. And a guard runs before pipes, so a request that will be
rejected for authorization reasons is not validated first.

## Where business logic must not live

Guards answer "may this request proceed" and get an ExecutionContext, so they can see the
handler. Interceptors wrap the call and are the right place for cross-cutting concerns:
timing, logging, mapping a result shape, retrying an idempotent read. Pipes transform and
validate input. None of them should contain a rule about the domain.

The reason is not purity. Logic in an interceptor cannot be called from a test without
constructing an HTTP request, cannot participate in the handler's transaction, and runs
for every route it is bound to, including the ones added next quarter by someone who never
read it. A pricing rule in an interceptor is a pricing rule that applies to the health
check.

## Global versus local composition

Registering a global guard or pipe is a decision that applies to routes that do not exist
yet. That is desirable for authentication and validation and dangerous for anything with
business semantics. Prefer explicit binding per controller or route when the purpose is not
uniformly applicable, and keep the global set small enough to enumerate.

## Failure modes

Injecting a request-scoped provider into a singleton controller and paying a new instance
per request without noticing. Putting authorization decisions in a pipe or validation in a
guard, so the lifecycle order silently does the wrong thing. Catching an exception in an
interceptor and returning a success response, which makes every client retry policy wrong.
And storing request-specific data on a singleton provider.
