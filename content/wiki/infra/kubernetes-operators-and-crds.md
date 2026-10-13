---
slug: kubernetes-operators-and-crds
title: Kubernetes operators and custom resources
lang: en
domain: infra
topic: kubernetes
tech:
  name: Kubernetes
  version_range: ">=1.34"
levels: [senior, staff]
summary: >-
  A custom resource is data; an operator is the controller that reconciles it.
  Most teams need the data and a small controller, not a platform. Operators earn
  their cost when they encode operational knowledge a human would otherwise have
  to remember at three in the morning.
prerequisites: [kubernetes-workload-objects]
related: [kubernetes-upgrades-and-version-skew, kubernetes-rbac-and-multi-tenancy]
sources:
  - title: "Kubernetes: Operator pattern"
    url: https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
    kind: official-docs
  - title: "Kubernetes: Custom Resources"
    url: https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/
    kind: official-docs
review_status: draft
---

## What a custom resource is not

A CustomResourceDefinition extends the API with a new kind. It stores data and gives you
kubectl, watch, RBAC and the API server's validation for that kind. It does not do anything.
A CRD with no controller is configuration that nothing reads, which is a surprisingly
common state: the YAML applies, the pipeline is green, and the feature is absent.

The distinction to state first in an interview: the CRD is the interface, the controller is
the behaviour. Designing the CRD without knowing what reconciles it is how you get an API
nobody can implement.

## The controller loop

A controller watches desired state and makes the world match. The pattern is
reconciliation, not events: watch a resource, compare spec to observed state, take the
action that closes the gap, record the outcome in status. Reconciliation is level-triggered
and idempotent, so a missed event is not a lost operation.

Three properties make an operator safe to run.

Idempotency: every reconcile can run again after a crash, so an action that creates a cloud
resource must first check whether it already exists.

Status as the contract: the operator reports observed state and conditions in status, and
users and other controllers read that rather than guessing. A custom resource with no
status is an operator that cannot be monitored.

Ownership: resources the operator creates get ownerReferences or labels that make the
relationship explicit, so garbage collection and adoption are deterministic. Without it,
deleting the custom resource leaves cloud resources billing forever — the classic operator
incident.

The controller-runtime library and the operator SDK are the usual scaffolds; the important
part is not the framework but the reconcile contract above.

## When an operator earns its cost

An operator is a service you now run forever. It needs RBAC, monitoring, upgrades, a
compatible CRD versioning story, and someone on call when it wedges. It is worth that cost
when one of three things is true.

The operational knowledge is genuinely complex and repeated: provisioning a database with
backups, failover, credentials and network rules is a sequence a human gets wrong.

The thing being managed has a lifecycle the platform must react to: an operator can
resize, fail over and repair, where a static manifest cannot.

The interface is the product: a platform team that wants to offer "a database" to
application teams may reasonably make that a custom resource rather than a ticket.

If none of those hold, a Helm chart, a plain manifest, or a Terraform module is cheaper,
more debuggable and does not add a controller to the blast radius.

## Failure modes

The first is a controller that cannot make progress but keeps retrying: an infinite
reconcile loop that burns API server capacity and generates no useful state. Rate-limited
work queues and exponential backoff are the mitigation; a hot loop is a cluster-wide
incident, not a local bug.

The second is CRD upgrades. The CRD is cluster-scoped and its schema has to remain
compatible with every stored object. Removing a field or changing a type breaks existing
resources, and conversion webhooks are the escape hatch when versions must coexist. A
mature operator ships conversion, not just a new version.

The third is the operator itself becoming a single point of failure: one replica, no
leader election, and a reconcile that needs a human. The operator is production code, and
it gets the same treatment as any other service.
