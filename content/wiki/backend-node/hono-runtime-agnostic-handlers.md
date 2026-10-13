---
slug: hono-runtime-agnostic-handlers
title: Hono handlers across Node, Bun and Workers
lang: en
domain: backend-node
topic: framework
tech:
  name: Hono
  version_range: ">=4.13"
levels: [senior, staff]
summary: >-
  Hono is built on Web Standards, so the same handler runs on Workers, Bun, Deno and Node
  through the Node adapter. Portability is real at the request boundary and leaks wherever
  a runtime-specific API does.
prerequisites: []
related: [hono-validation-and-rpc, nodejs-streams-and-backpressure]
sources:
  - title: "Hono — Documentation"
    url: https://hono.dev/docs/
    kind: official-docs
  - title: "Hono — Node.js"
    url: https://hono.dev/docs/getting-started/nodejs
    kind: official-docs
  - title: "Hono — Routers"
    url: https://hono.dev/docs/concepts/routers
    kind: official-docs
review_status: draft
---

## Web Standards as the portability layer

Hono's handlers take a Request and return a Response, the fetch contract that Workers, Bun,
Deno and Node all implement. The documentation lists Cloudflare Workers, Fastly Compute,
Deno, Bun, Vercel, Netlify, AWS Lambda, Lambda@Edge and Node.js as targets; on Node the Node
adapter serves the application, and it works on Node versions greater than 18.

The portability is real at that boundary: routing, middleware, validation and serialization
are the same code on every runtime. It stops at the edges — runtime bindings, environment
variables, filesystem access, background tasks and connection pools are all
runtime-specific, and each is a place where "we can move it later" becomes a rewrite.

The way to keep the claim honest is to confine runtime-specific access to a small adapter
module injected into the application, so the handler sees an interface rather than
env.MY_BUCKET.

## Middleware composition

Middleware is an async function receiving the context and next, and it must await next() to
run the rest of the chain; work before that call happens on the way in and work after it on
the way out. app.use binds middleware by path and method. Because the chain is ordinary
async composition, ordering is explicit in the source rather than implied by a framework
lifecycle — which is easier to reason about and easier to get wrong when middleware is
registered in several files.

The standard set — logger, CORS, secure headers, compression, body limit, timeout — is
built in, which is the practical argument for Hono on a small service: the framework ships
the middleware most services need and nothing else.

## Routers

Hono has several routers and a SmartRouter that picks between them; RegExpRouter is
described as the fastest, TrieRouter supports every pattern, and the default choice is made
for you. This matters far less than the request-boundary design, and treating a router
benchmark as the reason to choose a framework is a warning sign in an interview.

## When Hono beats Nest or Express

Hono is the better choice when the deployment target is edge or serverless, the service is
a thin API over a few dependencies, cold start and bundle size matter, and the team values
web-standard testing. It is a poor fit for a domain with deep dependency injection,
long-lived provider lifecycles, framework-managed transactions, and many teams who need a
conventional structure to be productive — that is what Nest is for. Express remains
reasonable for small Node-only services, but it predates the Web Standard request and
response objects and carries its own middleware ecosystem's history.

The honest answer names the deployment target and the team first, and the framework second.

## Failure modes

Claiming portability while importing node:fs in a handler. Using Workers bindings directly
inside business code. Choosing Hono for an edge deployment and then adding a dependency
that only runs on Node. And assuming middleware ordering is automatic because the framework
is small.
