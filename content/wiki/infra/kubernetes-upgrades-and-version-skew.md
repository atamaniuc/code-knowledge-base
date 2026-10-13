---
slug: kubernetes-upgrades-and-version-skew
title: Cluster upgrades and version skew
lang: en
domain: infra
topic: kubernetes
tech:
  name: Kubernetes
  version_range: ">=1.34"
levels: [senior, staff]
summary: >-
  Kubernetes supports three minor release branches and enforces a skew policy
  between components. Upgrades are routine when the order is respected, and
  outages come from upgrading the control plane and the nodes as if they were one
  thing.
prerequisites: [kubernetes-workload-objects, kubernetes-scheduling-and-eviction]
related: [helm-charts-and-releases, kubernetes-rbac-and-multi-tenancy]
sources:
  - title: "Kubernetes: Version Skew Policy"
    url: https://kubernetes.io/releases/version-skew-policy/
    kind: official-docs
  - title: "Kubernetes Releases"
    url: https://kubernetes.io/releases/
    kind: official-docs
review_status: draft
---

## Supported release window

The Kubernetes project maintains release branches for the three most recent minor
releases. As of October 2026 the supported minors are 1.37, 1.36 and 1.35, with 1.37.1 as
the latest patch. Each branch receives roughly a year of patch support, so a cluster on a
minor that has fallen out of the window is not receiving security fixes, and that is the
sentence to open with when a team says it upgrades "when convenient".

One upgrade per minor is the supported path. Jumping two minors at once is not supported,
which turns a neglected cluster into a multi-week project rather than a maintenance
window.

## Version skew rules

Skew is the set of component version combinations the project tests and supports. The rules
that matter:

kubelet must not be newer than the API server. A node running a newer kubelet than the
control plane is unsupported and is the one direction that is never allowed.

kubelet may be up to three minor versions older than the API server. So a 1.37 API server
supports kubelets at 1.37, 1.36, 1.35 and 1.34. That is the window that makes an
in-place node upgrade possible at all: you upgrade the control plane first, and nodes catch
up while old kubelets are still supported.

Other control-plane components have narrower windows, and in a highly available control
plane, skew between API server instances narrows the allowances further. The practical
consequence is that a rolling in-place upgrade should move the control plane as one unit,
then the nodes, and not interleave the two.

## Upgrade order

The order that survives contact with production: read the release notes for removals and
deprecations, check every add-on and controller against the target version, upgrade the
control plane first, then node pools one at a time, then verify.

Two checks catch most surprises. Deprecated API usage: a removed API version makes a
workload fail to apply, and an admission plugin or a policy engine can surface that before
the upgrade rather than during it. Add-on compatibility: ingress controllers, CSI drivers,
CNI plugins and operators each have their own supported Kubernetes range, and the platform's
compatibility matrix is really the intersection of all of them.

Node pools are upgraded by draining nodes. That makes the PodDisruptionBudget discussion
from scheduling and eviction an upgrade prerequisite rather than a nice-to-have: a PDB that
blocks eviction blocks the upgrade, and a PDB that is ignored during maintenance is not
providing the availability it claims.

## Making an upgrade boring

The goal is not a fast upgrade; it is an upgrade nobody has to think about.

Define the supported window in writing and automate the patch cadence, because the failure
mode is not a botched upgrade, it is a cluster that quietly aged out of support. Keep the
control plane and node versions close so the skew budget is not spent all at once.

Run the upgrade in a non-production cluster first, with the same add-ons and the same
admission policies. Upgrade node pools surfacely and watch the golden signals during each
drain, so a bad node image is caught on the first pool rather than the last.

And rehearse the rollback, knowing that control-plane rollback is not really supported. The
honest framing is that the control plane upgrade is a one-way door, and the mitigation is
staging and add-on compatibility, not a plan to undo it.
