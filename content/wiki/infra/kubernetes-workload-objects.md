---
slug: kubernetes-workload-objects
title: Kubernetes workload objects and when each is right
lang: en
domain: infra
topic: kubernetes
tech:
  name: Kubernetes
  version_range: ">=1.34"
levels: [middle, senior, staff]
summary: >-
  Deployment, StatefulSet, DaemonSet, Job and CronJob are not interchangeable
  packaging. Each makes a different promise about identity, ordering and
  lifetime, and the wrong choice is usually discovered during a failover rather
  than at deploy time.
prerequisites: []
related: [kubernetes-scheduling-and-eviction, kubernetes-autoscaling]
sources:
  - title: "Kubernetes: Deployments"
    url: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
    kind: official-docs
  - title: "Kubernetes: StatefulSets"
    url: https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/
    kind: official-docs
  - title: "Kubernetes: DaemonSet"
    url: https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/
    kind: official-docs
  - title: "Kubernetes: Jobs"
    url: https://kubernetes.io/docs/concepts/workloads/controllers/job/
    kind: official-docs
  - title: "Kubernetes: CronJob"
    url: https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/
    kind: official-docs
review_status: draft
---

## The object is a contract about identity and lifecycle

Teams talk about the controller choice as packaging. It is a contract: which pods are
interchangeable, whether a pod has a stable name, whether start order matters, and whether
the workload ever finishes. The controller enforces that contract, so the wrong object
does not fail at apply time. It fails during a rolling update, a node loss, or the first
time two replicas disagree about who owns the data.

The interview question underneath all of them is the same: what does this process need to
be told about its own identity?

## Stateless replicas: Deployment

A Deployment owns a ReplicaSet and gives rolling updates, revision history and rollback.
Pods are interchangeable, names are random, and any pod can serve any request. Everything
that keeps no local state belongs here.

What a Deployment does not promise: ordering, stable network identity, or exclusive access
to a volume. If the design needs any of those, the Deployment is the wrong object and no
amount of init-container plumbing fixes it.

The two knobs that matter under pressure are maxSurge and maxUnavailable. Together they
decide how much extra capacity a rollout may buy and how much serving capacity it may
remove. maxUnavailable: 0 with a surge of one is the safe default for a service with
healthy readiness probes; both at zero deadlocks the rollout.

## Stable identity: StatefulSet

A StatefulSet gives each replica an ordinal name and a stable DNS entry, and with
volumeClaimTemplates a PersistentVolumeClaim per replica that is re-attached after a
reschedule. Creation and deletion are ordered by default; podManagementPolicy: Parallel is
the escape hatch when ordering is genuinely unnecessary.

This is the object for anything that participates in quorum, replication or per-instance
sharding, where a peer must be reachable by a name that does not change when it restarts.
The cost is operational: scale-down leaves the PVC behind, recovery is not symmetric with
a Deployment, and a stuck ordinal blocks the next one. Say that cost out loud in an
interview, because it is the difference between having read the docs and having run one.

## One per node: DaemonSet

A DaemonSet runs one pod on every eligible node, or on the subset selected by node
affinity and tolerations. Its unit of scale is the node, not the request rate: log
shippers, CNI agents, CSI node plugins and node-level metrics agents.

The common mistake is using a DaemonSet for an application and then fighting the scheduler
to keep it off control-plane and spot nodes. If the desired count tracks node count, it is
a DaemonSet. If it tracks traffic, it is not.

## Run to completion: Job and CronJob

A Job runs pods until a required number of successful completions. completions and
parallelism express fan-out; backoffLimit and activeDeadlineSeconds bound failure and
runtime, and without the deadline a wedged Job retries forever.

A CronJob schedules Jobs. concurrencyPolicy decides whether a slow run overlaps the next
one, and startingDeadlineSeconds decides how late a missed schedule may still fire. Treat
each run as a Job with a deadline: a batch that can overrun its schedule needs
concurrencyPolicy: Forbid or an external lock, not optimism.

## Choosing under pressure

Three questions, in order. Does a pod's identity matter to its peers? Then StatefulSet.
Does one pod belong on every node? Then DaemonSet. Does the work finish? Then Job or
CronJob. Everything else is a Deployment.

The follow-up an interviewer will ask is what breaks when you get it wrong. A Deployment
wrapping a primary database gives you two writers. A StatefulSet around a stateless API
gives you slow rollouts and orphaned volumes nobody wants to delete. A CronJob without a
concurrency policy gives you two nightly reconciliations writing the same rows.
