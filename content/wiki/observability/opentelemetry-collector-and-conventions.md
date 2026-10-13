---
slug: opentelemetry-collector-and-conventions
title: The OpenTelemetry collector and semantic conventions
lang: en
domain: observability
topic: opentelemetry
tech:
  name: OpenTelemetry Collector
  version_range: ">=0.162"
levels: [middle, senior, staff]
summary: >-
  The collector is a vendor-neutral pipeline of receivers, processors and
  exporters that can run as an agent, a gateway, or both. Semantic conventions
  are what make the data portable; without them the pipeline moves bytes but not
  meaning.
prerequisites: []
related: [tracing-and-sampling, prometheus-and-promql]
sources:
  - title: "OpenTelemetry: Collector"
    url: https://opentelemetry.io/docs/collector/
    kind: official-docs
  - title: "OpenTelemetry: Semantic conventions 1.44.0"
    url: https://opentelemetry.io/docs/specs/semconv/
    kind: official-docs
review_status: draft
---

## The collector pipeline

The collector is a single binary configured with three kinds of component. Receivers accept
data — OTLP, Prometheus scrapes, host metrics, logs. Processors transform it — batching,
memory limiting, attribute filtering, tail sampling, resource detection. Exporters send it
somewhere — an OTLP backend, a vendor endpoint, object storage.

Pipelines bind these together per signal: traces, metrics and logs each have their own
pipeline, and a receiver can feed more than one. The configuration is a graph, and the
common production structure is one pipeline per signal with a batch processor, a memory
limiter and a retry-capable exporter.

Two properties make the collector worth running at all. It decouples the application from
the backend, so the vendor can change without redeploying every service, and it centralises
the transformation — sampling, redaction, enrichment — in one place instead of in every
SDK.

The operational risk is that it is now on the hot path. A collector that stops accepting
data turns observability off exactly when it is needed, so the collector needs its own
monitoring and its own capacity plan, and applications need a queue and a fallback
behaviour when the endpoint is unavailable rather than blocking on it.

## Deployment topologies

The agent pattern runs a collector on every node, usually as a DaemonSet, so the application
sends to localhost. It scales with the cluster, it is close to the data, and it is the right
place for host metrics and for the first stage of batching.

The gateway pattern runs a pool of collectors behind a load balancer, and applications or
agents send to it. It centralises credentials — the backend API key lives in one place
rather than on every node — and it is the right place for tail sampling, which needs to see
all spans of a trace before deciding.

Most production deployments use both: agents for collection and enrichment, a gateway for
sampling, credential handling and fan-out to more than one backend. The failure mode to
design against is a single collector instance serving the whole cluster; that is a
correlated failure with the incident it is supposed to help diagnose.

## Semantic conventions

Semantic conventions are the agreed names and meanings for attributes: http.request.method,
http.response.status_code, db.system, service.name, and so on. They are what makes a trace
from a Java service comparable with one from a Go service, and what lets a dashboard or an
alert query across an estate without per-service translation.

The convention that matters most is the resource: service.name, service.version and
deployment environment. Without service.name, traces are unattributed; without
service.version, a regression cannot be tied to a release. Resource attributes are set once
per process, not per span, and getting them right is the highest-value ten minutes in an
OpenTelemetry rollout.

The conventions version. As of October 2026 the semantic conventions specification is at
1.44.0, and version moves rename attributes — which means a dashboard built on a
pre-1.0 name can break when the instrumentation library updates. The mitigation is to pin
the instrumentation library version and to do renames as a reviewed change, not as a
side effect of a dependency bump.

## When not to use the collector

A collector is a service with a config, an upgrade path and a blast radius. If the estate is
three services and one backend, an SDK exporter directly to the backend is fewer moving
parts. The collector earns its place when there are many services, more than one backend,
a need for centralised sampling or redaction, or a requirement to change vendors without
touching application code.

The other honest limit: the collector moves and shapes telemetry, it does not create it.
A service that sets no resource attributes and emits no useful span structure will produce
unusable data through any pipeline.
