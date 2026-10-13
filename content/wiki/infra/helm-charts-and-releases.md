---
slug: helm-charts-and-releases
title: Helm 4 charts and the release lifecycle
lang: en
domain: infra
topic: kubernetes
tech:
  name: Helm
  version_range: ">=4.0"
levels: [middle, senior, staff]
summary: >-
  Helm packages Kubernetes manifests into a versioned chart and tracks what it
  installed as a release. Helm 4 is the current major line and brings server-side
  apply, a redesigned plugin system and content-based caching; Helm 3 is in its
  support tail.
prerequisites: [kubernetes-workload-objects]
related: [github-actions-oidc-deployments, kubernetes-upgrades-and-version-skew]
sources:
  - title: "Helm 4 Released"
    url: https://helm.sh/blog/helm-4-released/
    kind: release-notes
  - title: "Helm: Charts"
    url: https://helm.sh/docs/topics/charts/
    kind: official-docs
review_status: draft
---

## What a chart is

A chart is a directory of templated Kubernetes manifests plus a Chart.yaml that names it
and versions it, and a values file that parameterises it. The API version field in
Chart.yaml is required and must match what the Helm client supports; charts written for
Helm 3 are apiVersion: v2, and Helm 4 adds support for additional chart API versions over
time. A chart that renders is not the same as a chart that installs: the cluster is what
validates the objects, which is why dry-run output alone is not evidence.

Chart version and appVersion are different fields. Chart version is the version of the
packaging, appVersion is the version of the thing inside. Teams that conflate them end up
unable to ship a manifest fix without pretending the application changed.

## Helm 4 changes the engine

Helm 4.0.0 was released on 12 November 2025, the first major version in six years. The
changes that matter operationally:

Server-side apply is now supported, which means Helm can delegate field ownership to the
API server instead of computing a three-way merge on the client. That changes conflict
behaviour meaningfully on resources another controller also writes.

The plugin system was redesigned and supports WebAssembly plugins, and post-renderers are
now plugins rather than a single hook. Improved resource watching uses kstatus to decide
whether a release is actually ready. There is local content-based caching, logging via
slog, and reproducible chart archives.

The transition matters for a version claim. Helm 3 is in its support tail: bug fixes ended
in July 2026 and security fixes end in November 2026, with no feature backports other than
Kubernetes client library updates. Recommending Helm 3 today is recommending a line that
is out of bug-fix support.

## Release lifecycle

A release is Helm's record of one chart rendered with one values set, installed into one
namespace. install creates it, upgrade replaces it, rollback returns to a prior revision,
and uninstall removes it. Helm keeps a release history, which is what makes rollback
possible and also what accumulates: the history is stored in the cluster, and unbounded
history is a slow leak. maxHistory is the knob.

Two failure modes dominate. A failed upgrade can leave a release in a stuck state where
subsequent operations refuse to proceed; Helm provides rollback and the option to force,
and knowing the difference between "the release state says failed" and "the resources are
actually wrong" is the operational skill. The second is that Helm's idea of success is
resource readiness, not application health. A chart can deploy a Deployment whose pods are
crash-looping and report a successful release, because kstatus tracks rollout status, not
whether the process inside works. That is what a post-deploy smoke test is for.

## Values and templating discipline

Values are the chart's public API, so treat them that way: document them, keep defaults
that are safe rather than convenient, and avoid a values file that is really a copy of the
manifests with indirection. Templates that branch on environment names are a smell;
diffing rendered output per environment and keeping the difference in values is the
discipline.

helm template renders locally without touching the cluster and is the fastest review tool.
helm diff, from a plugin, shows what an upgrade would change; a platform team without some
form of rendered-diff review is approving YAML they have not seen.

## When Helm is the wrong tool

Helm is a good package manager and a mediocre deployment orchestrator. It does not wait for
application health, it does not do progressive delivery, and its rollback restores
manifests rather than state. For clusters that are themselves defined as code, a GitOps
controller or a typed configuration language may own the whole lifecycle better, with Helm
reduced to rendering charts.

The honest answer for a senior interview: use Helm for what it is good at — packaging,
versioning and a release record — and put progressive delivery, health verification and
drift detection somewhere that owns them explicitly.
