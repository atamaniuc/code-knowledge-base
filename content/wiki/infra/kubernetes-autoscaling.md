---
slug: kubernetes-autoscaling
title: "Kubernetes autoscaling: HPA, VPA and KEDA"
lang: en
domain: infra
topic: kubernetes
tech:
  name: Kubernetes
  version_range: ">=1.34"
levels: [middle, senior, staff]
summary: >-
  HPA answers how many replicas, VPA answers how big each replica should be, and
  KEDA answers whether there is work waiting. They are complementary, and running
  two of them on the same signal for the same workload makes both wrong.
prerequisites: [kubernetes-workload-objects]
related: [kubernetes-scheduling-and-eviction, aws-cost-and-right-sizing]
sources:
  - title: "Kubernetes: Horizontal Pod Autoscaling"
    url: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
    kind: official-docs
  - title: "Kubernetes: Vertical Pod Autoscaling"
    url: https://kubernetes.io/docs/concepts/workloads/autoscaling/vertical-pod-autoscale/
    kind: official-docs
  - title: "KEDA documentation"
    url: https://keda.sh/docs/2.18/
    kind: official-docs
review_status: draft
---

## Three different questions

The three autoscalers are usually compared as if they were competitors. They are not. HPA
answers how many replicas should exist. VPA answers how large each replica's requests
should be. KEDA answers whether there is pending work and can scale a workload to zero.

Choosing starts from the signal. If the bottleneck is capacity per request, the answer is
horizontal. If the problem is that nobody knows the correct request size, the answer is
vertical. If the signal is a queue or a schedule rather than a resource, the answer is
event-driven.

## Horizontal Pod Autoscaler

The HPA computes desired replicas as the ratio of current metric to target metric, subject
to min and max, and it re-evaluates on a short interval. It is a reactive controller: it
responds to a metric, so the metric must be a leading indicator of load and the workload
must scale roughly linearly with replicas.

CPU utilisation is the default and the easiest to get wrong, because utilisation is
computed against requests. If requests are wrong, the autoscaler is wrong. A workload whose
cost per request is memory-bound, or one that serialises on a downstream database, will
not get faster by adding replicas, and the HPA will happily add them anyway.

For queue-driven work the useful signal comes from a custom or external metrics adapter.
That is where KEDA usually enters.

Two operational details decide whether the HPA looks calm or oscillates. First,
stabilisation windows: scale-down is deliberately slow, so a short traffic dip does not
remove capacity that is about to be needed again. Second, metrics readiness: new replicas
must pass readiness before they receive traffic, so the effective reaction time is the
autoscaler interval plus image pull plus startup, not the autoscaler interval alone.

## Vertical Pod Autoscaler

The VPA observes historical usage and either recommends or applies new requests and
limits. In its auto and recreate modes it changes requests on running pods, which means
restarting them; the recommender can run harmlessly in offer mode to produce advice
without touching anything.

Use it to right-size requests from real history rather than from a capacity-planning
spreadsheet. Do not position it as a latency autoscaler: vertical scaling changes the size
of a box, and in most modes it pays for that with a restart.

Running VPA and HPA on the same CPU signal for the same workload is a fight: the VPA
changes the denominator the HPA divides by. Pick one to own CPU and let the other work on
a different axis.

## KEDA and event-driven scale

KEDA is an operator that turns an external event source — queue depth, consumer lag, a
cron schedule, a database query — into a scaling decision. It creates and drives an HPA
underneath, so the cluster still has one horizontal scaling mechanism, and it can scale a
workload to zero when there is nothing to do.

That last property is the reason it exists. A queue consumer with no traffic has no reason
to hold replicas, and no resource metric will tell the HPA to keep it at zero, because
idle replicas themselves consume the CPU the HPA is watching. KEDA scales on the work, not
on the workers.

The costs are cold start and correctness. Scale-to-zero means the first message after a
quiet period waits for a pod; if that is unacceptable, minReplicaCount is the knob, and it
is also the thing to say when someone proposes it for a latency-critical path. And a
scaling decision based on queue depth needs a sane per-replica throughput estimate, or the
cluster will scale out to max and still fall behind.

## Choosing and combining

A common production combination is KEDA on queue depth for scale-out, the VPA in
recommendation-only mode to keep requests honest, and the HPA for CPU-driven request and
response services. The pattern is one autoscaler per signal, and a human who owns the
requests.

The staff-level point is that autoscaling is not a substitute for capacity. Every
autoscaler has a maximum, and when the maximum is reached the system degrades; the
interesting design work is deciding what happens then, and whether the answer is queuing,
shedding, or a page.
