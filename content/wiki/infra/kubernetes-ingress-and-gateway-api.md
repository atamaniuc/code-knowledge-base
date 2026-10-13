---
slug: kubernetes-ingress-and-gateway-api
title: "Service, Ingress and Gateway API: north-south traffic in Kubernetes"
lang: en
domain: infra
topic: kubernetes
tech:
  name: Kubernetes
  version_range: ">=1.34"
levels: [middle, senior, staff]
summary: >-
  A Service is the stable address pods do not have. Ingress routes HTTP into the
  cluster through a controller-specific implementation. Gateway API is the
  successor that separates platform and application ownership, and v1.5 moved a
  batch of long-experimental features into the stable channel.
prerequisites: [kubernetes-workload-objects]
related: [kubernetes-rbac-and-multi-tenancy, kubernetes-upgrades-and-version-skew]
sources:
  - title: "Kubernetes: Gateway API"
    url: https://kubernetes.io/docs/concepts/services-networking/gateway/
    kind: official-docs
  - title: "Gateway API v1.5: Moving features to Stable"
    url: https://kubernetes.io/blog/2026/04/21/gateway-api-v1-5/
    kind: release-notes
review_status: draft
---

## Service is the stable address

Pods come and go, so something has to hold a name that survives their replacement. A
Service does that: a virtual IP and a DNS name, selecting pods by label and forwarding to
the ones that are ready. Readiness is the load-balancing input, which is why a wrong
readiness probe turns a rollout into an outage.

The types are a ladder of exposure. ClusterIP is reachable only inside the cluster, and it
is what most services should be. NodePort exposes a port on every node and exists mostly
as a building block. LoadBalancer asks the cloud provider for an external load balancer,
which is where per-service cloud cost starts.

Headless services — clusterIP: None — return pod addresses rather than a virtual IP, which
is what a StatefulSet's per-replica DNS depends on. That is the connection to stable
identity: the Service and the StatefulSet have to agree.

## Ingress and its controller

Ingress is a routing specification, not an implementation. It describes host and path rules
that point at Services, and a separate controller — nginx, an AWS load balancer controller,
Traefik, and many others — makes it real. Applying Ingress resources without a controller
does nothing, and this trips people who have only used managed platforms where one is
pre-installed.

The stable Ingress API is deliberately small: host and path matching to a Service. Almost
everything else an operator needs — header matching, traffic splitting, rewrites, timeouts,
authentication — lives in controller-specific annotations. That is the real weakness:
portable configuration is limited, and the annotation surface is not portable between
controllers.

Ingress still deserves a place. It has the largest ecosystem, every managed Kubernetes
provider supports it, and for one controller serving simple host and path routing it is
less machinery than the alternative.

## Gateway API

Gateway API is the successor design, and its central idea is ownership. GatewayClass is
configured by the infrastructure provider. A Gateway is instantiated by the cluster
operator and describes listeners and addresses. A Route — HTTPRoute, GRPCRoute, TLSRoute —
is owned by the application team and attaches to a Gateway. Cross-namespace references go
through ReferenceGrant, so an application cannot silently route to a Service in a namespace
it does not own.

That role separation is the design answer to a real Ingress problem: on a shared cluster,
the team that owns the load balancer and the team that owns the route need different
objects with different permissions.

Gateway API v1.5, released on 27 February 2026, promoted six previously experimental
features to the Standard channel: ListenerSet, TLSRoute, the HTTPRoute CORS filter, client
certificate validation, certificate selection for Gateway TLS origination, and
ReferenceGrant. Standard is the GA channel, so those features are now safe to depend on
without an experimental CRD install — a distinction worth stating, because a platform team
that adopted them a year earlier was running the experimental channel.

## Choosing

For a single cluster with one controller and simple routing, Ingress remains a reasonable
choice, and the ecosystem argument is real. Choose Gateway API when you need role
separation between platform and application, traffic splitting for progressive delivery,
header or query matching in the standard API, or multiple route protocols under one
Gateway.

Two honest caveats. Gateway API requires a controller that implements the version you
depend on, so the feature list is a property of your controller as much as of the API. And
both are north-south concerns; service-to-service traffic is a different question, answered
by a mesh, network policy, or not at all.
