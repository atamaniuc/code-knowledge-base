---
slug: kubernetes-scheduling-and-eviction
title: Kubernetes scheduling, requests, limits and eviction
lang: en
domain: infra
topic: kubernetes
tech:
  name: Kubernetes
  version_range: ">=1.34"
levels: [middle, senior, staff]
summary: >-
  Requests feed the scheduler, limits feed the kernel, and QoS decides who dies
  first when a node runs out of memory. Confusing the two is the most common
  source of mysterious throttling and OOM kills in production clusters.
prerequisites: [kubernetes-workload-objects]
related: [kubernetes-autoscaling, kubernetes-upgrades-and-version-skew]
sources:
  - title: "Kubernetes: Pod Quality of Service Classes"
    url: https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/
    kind: official-docs
  - title: "Kubernetes: Node-pressure eviction"
    url: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
    kind: official-docs
  - title: "Kubernetes: Pod priority and preemption"
    url: https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/
    kind: official-docs
  - title: "Kubernetes: Specifying a Disruption Budget"
    url: https://kubernetes.io/docs/tasks/run-application/configure-pdb/
    kind: official-docs
review_status: draft
---

## Requests are for the scheduler, limits are for the kernel

A request is the amount the scheduler reserves when it decides where a pod fits. A limit is
the ceiling the kernel enforces at runtime. They are read by different components and they
fail in different ways.

CPU is compressible. A container that exceeds its CPU limit is throttled: it keeps running,
slower, and the symptom is latency rather than a restart. Memory is not compressible. A
container that exceeds its memory limit is killed by the kernel OOM killer, and a node
that runs out of memory starts evicting pods. That asymmetry is the single most useful
sentence in this topic, and it explains why a CPU limit is a performance decision while a
memory limit is an availability decision.

There is also a scheduling consequence. Requests are reserved capacity, so the sum of
requests across a node is the node's real utilisation from the scheduler's point of view.
Lowballing requests to pack more pods onto a node is not a trick; it is a bet that the pods
will not all use what they were asked for at the same time, and the node makes you pay when
they do.

## QoS classes

Kubernetes derives a QoS class from the shape of requests and limits.

Guaranteed requires every container to set requests equal to limits for both CPU and
memory. Burstable is everything else that sets at least one request. BestEffort means no
requests or limits at all.

QoS is the eviction priority order under node pressure: BestEffort evicted first, then
Burstable, then Guaranteed as the last to go. It is not a performance guarantee, and it is
not a scheduling hint. Its only job is to answer who dies first, and it is worth saying
that plainly because candidates often describe Guaranteed as a performance tier.

## Node pressure eviction and priority

The kubelet reclaims node resources when memory, disk or PID pressure crosses its
thresholds, evicting pods by QoS and by usage above requests. This is involuntary
disruption and no PodDisruptionBudget protects against it.

Pod priority and preemption are the other half: the scheduler may evict lower-priority
pods to make room for a higher-priority one. That is a cluster-level policy, not a
per-team preference, and it is the mechanism that keeps a critical control-plane workload
schedulable on a cluster full of best-effort batch.

The application-side rules that follow: set memory requests from the observed working set
rather than from a guess; set memory limits above the worst acceptable working set, or omit
the limit and rely on the request; and never use requests as a throughput dial, because
they do not control how fast anything runs.

## Disruption budgets

Voluntary disruption — node drains, cluster upgrades, descheduler runs — is bounded by a
PodDisruptionBudget. Involuntary disruption is not. A PDB of minAvailable equal to the
replica count is the classic self-inflicted outage: it blocks every drain forever, and the
cluster upgrade stalls at two in the morning with no obvious culprit.

The senior habit is to reason about capacity, not just count: a PDB says how many pods may
be down, and someone has to check that the remaining replicas can carry the traffic. A
budget that is safe at peak is not necessarily safe at 60 percent of peak.
