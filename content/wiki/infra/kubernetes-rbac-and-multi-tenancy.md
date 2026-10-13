---
slug: kubernetes-rbac-and-multi-tenancy
title: Kubernetes RBAC and multi-tenancy
lang: en
domain: infra
topic: kubernetes
tech:
  name: Kubernetes
  version_range: ">=1.34"
levels: [senior, staff]
summary: >-
  RBAC grants verbs on resources, and its mistakes are almost never about
  forgetting a rule. They are about cluster-scoped resources, wildcards, and
  secret access that quietly turns a namespaced role into cluster-wide reach.
prerequisites: [kubernetes-workload-objects]
related: [kubernetes-ingress-and-gateway-api, aws-iam-least-privilege]
sources:
  - title: "Kubernetes: RBAC Authorization"
    url: https://kubernetes.io/docs/reference/access-authn-authz/rbac/
    kind: official-docs
  - title: "Kubernetes: Multi-tenancy"
    url: https://kubernetes.io/docs/concepts/security/multi-tenancy/
    kind: official-docs
review_status: draft
---

## The authorization model

RBAC is additive and allow-only. A Role is a set of rules scoped to a namespace; a
ClusterRole is cluster-scoped. A RoleBinding grants a Role or ClusterRole inside one
namespace; a ClusterRoleBinding grants a ClusterRole across the whole cluster. There are no
deny rules, so the security posture is the union of every binding that matches, and
subtracting a permission means removing a grant, not adding a prohibition.

Rules name API groups, resources and verbs. The trap is that the resource model is not flat:
pods, pods/log and pods/exec are separate resources, and a rule on deployments does not
imply a rule on their pods. A binding that grants get on secrets plus create on pods is
effectively cluster-admin in that namespace, because the pod can mount any secret there.

## Least privilege in practice

The first rule is to bind to the narrowest resource and verb that works, and to name
resources rather than using wildcards. A wildcard resource list combined with a wildcard
verb list is the common accidental admin grant; it appears in tutorials because it is
short.

The second rule is that privilege escalates through the workloads. Anyone who can create a
pod, a Deployment or a CronJob in a namespace can run code as any ServiceAccount in that
namespace, and can mount any Secret in it. Anyone who can create a ServiceAccount plus a
binding can grant themselves more. So namespace administration is a high-trust role, and a
review that only looks at who can read secrets is looking at the wrong half.

The third is aggregation and reuse. ClusterRoles can aggregate other ClusterRoles by label,
which is how the built-in roles compose, and it is also how a well-intentioned label can
silently widen a grant. Audit the aggregated result, not the source.

For humans, the practical pattern is just-in-time access with short-lived credentials and an
audit trail, rather than long-lived per-person kubeconfigs with broad bindings. For
workloads, one ServiceAccount per workload, and no use of the default ServiceAccount.

## Tenancy models

Multi-tenancy in Kubernetes is a spectrum, and the interview wants the spectrum named.

Soft multi-tenancy puts tenants in namespaces with RBAC, resource quotas and LimitRanges to
bound what they can consume. It assumes tenants are not actively hostile, and it is the
right default for internal teams.

Hard multi-tenancy assumes an attacker is inside a tenant. Namespaces alone are not an
isolation boundary: nodes, the kubelet API, and cluster-scoped resources are shared. The
tools are separate clusters, separate node pools with taints, sandboxed runtimes, network
policy that defaults to deny, and admission control that prevents the escapes.

Cluster-scoped resources are the recurring leak. CustomResourceDefinitions, PersistentVolumes,
StorageClasses, Namespaces themselves, and admission webhooks are all cluster-scoped, and a
tenant that can create a CRD can often create a controller that reads everything. A tenancy
design that only counts namespaced RBAC is incomplete.

## Hard isolation

If the requirement is genuine isolation, the honest answer is one cluster per tenant, or at
least dedicated nodes with the control plane's trust boundary drawn around them.
Namespaces with RBAC are a management boundary; they are not a security boundary against a
determined tenant.

The cost of separate clusters is operational: upgrades, add-ons and policy have to be
fleet-managed, and the platform team's job becomes tooling rather than cluster
administration. That trade — isolation for fleet complexity — is the actual decision, and
whoever presents it as a free choice has not run a multi-tenant cluster.
