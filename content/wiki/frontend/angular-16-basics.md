---
slug: angular-16-basics
title: Angular 16 basics for backend developers
lang: en
domain: frontend
topic: frontend
tech:
  name: Angular
  version_range: ">=16"
levels: [middle]
summary: >-
  Angular 16 made standalone components the default, introduced signals for fine-grained reactivity, and keeps DI via inject(); a backend developer needs enough to make a small frontend change safely.
prerequisites: []
related: []
sources:
  - title: "Angular — Standalone components"
    url: https://angular.dev/guide/standalone-components
    kind: official-docs
  - title: "Angular — Signals"
    url: https://angular.dev/guide/signals
    kind: official-docs
review_status: draft
---

## Standalone components

Angular 16 made standalone components the recommended default: a component no longer must
be declared in an NgModule; it imports its own dependencies. standalone: true plus the
component's own imports is the shape of new code. Modules still exist in older code, and
the two coexist during a migration.

## Signals and change detection

Signals are Angular's fine-grained reactivity: a signal() holds a value, computed()
derives from it, and templates that read a signal re-render only where the signal changed.
This is a preview-grade but real feature in 16 and it changes the mental model from
zone.js whole-tree change detection to dependency-tracked updates. A small fix that must
not break the frontend is easier with signals than with mutable state spread across the
component.

## What a small Laravel-side change touches

For the vacancy, the frontend is not the main focus: enough Angular and TypeScript to add
a field, wire an endpoint, and not break the build. The practical checklist: find the
component, the service calling the API (HttpClient plus interceptors for the token), the
model type, and the template binding; run the linter and the build before the PR. The
interview answer should be honest about the boundary: backend is the strength, Angular is
read-and-modify, not architecture.
