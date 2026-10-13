---
slug: nodejs-esm-cjs-and-type-stripping
title: ESM, CommonJS and type stripping in 2026
lang: en
domain: backend-node
topic: runtime
tech:
  name: Node.js
  version_range: ">=24"
levels: [senior, staff]
summary: >-
  New code is ES modules and the old boundary is now bridgeable — require(esm) works —
  but interop still has sharp edges. Node also executes TypeScript by erasing types, with
  no type checking and no non-erasable syntax, which removes a build step and not a
  compiler.
prerequisites: []
related: [nodejs-testing-and-diagnostics, nestjs-configuration-and-validation]
sources:
  - title: "Node.js — TypeScript"
    url: https://nodejs.org/api/typescript.html
    kind: official-docs
  - title: "Node.js — Modules: ECMAScript modules"
    url: https://nodejs.org/api/esm.html
    kind: official-docs
  - title: "Node.js — Previous releases and LTS schedule"
    url: https://nodejs.org/en/about/previous-releases
    kind: official-docs
review_status: draft
---

## Where the ecosystem landed

ES modules are the default for new code, and Node supports loading ES modules from
CommonJS through the require(esm) interop path, which is the detail that makes a gradual
migration realistic. Extensions and the package.json type field still decide how a file
is interpreted: .mjs is always ESM, .cjs is always CommonJS, and .js follows the nearest
type field.

In a repository, this argues for one module system per package and for a boundary that
states which side it is on. Mixed systems inside one package produce exactly the class of
bug that is expensive to reproduce.

## The interop edges that still bite

- A CommonJS module imported into ESM gets a default export that is the module.exports
  value; named exports are detected statically and can be incomplete for dynamic
  assignments.
- __dirname, __filename and require do not exist in ESM; they are reconstructed from
  import.meta.url.
- The dual-package hazard: a dependency loaded as both ESM and CommonJS becomes two module
  instances with two singletons and two caches.
- Top-level await is available in ESM, so module evaluation can now fail or hang — the
  error moves from first request to process start.

## Type stripping

Node runs .ts files by stripping types; there is no type checking and no transform beyond
erasure. That restricts the syntax to what can be erased: enums, namespaces with runtime
code, parameter properties, and import aliases are not erasable, and the tsconfig flag
erasableSyntaxOnly makes the compiler reject them before Node does. Type checking remains
the compiler's job, run separately, and the build step that disappears is the transpile,
not the check.

The practical shape for a service: run tsc --noEmit in CI and in the editor, run
node directly in development and in production, and keep the two from drifting by making
the compiler enforce erasable syntax.

## Release lines in 2026

Node 24, codenamed Krypton, is the active LTS line and the safe production target; Node 26
is the Current line and enters LTS in October 2026. The difference is not features but
support: LTS receives backported fixes on a published schedule, Current moves. A service
should pin one line, upgrade deliberately, and treat a new major as a change with tests,
not as a dependency bump. The repository pins its own line in .nvmrc for the same reason.

## What a senior answer adds

Migration is a boundary problem, not a syntax problem. Identify the packages that must stay
CommonJS, move leaf packages inward, keep one instance of any stateful dependency, and make
the module format visible in CI rather than discovered in production.

## Failure modes

Running .ts directly and believing the types were checked. Leaving a mixed package where a
dependency is instantiated twice. Reaching for a loader chain to fix interop that a package
boundary would fix. And upgrading to a Current release in production because it has a lower
version number and newer syntax.
