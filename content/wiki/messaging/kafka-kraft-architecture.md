---
slug: kafka-kraft-architecture
title: Kafka 4 KRaft and what removing ZooKeeper changed
lang: en
domain: messaging
topic: architecture
tech:
  name: Apache Kafka
  version_range: ">=4.0"
levels: [senior, staff]
summary: >-
  Kafka 4 is KRaft-only: ZooKeeper was removed, metadata is a replicated log, and a
  controller quorum decides leadership. The everyday difference is operational — fewer
  moving parts — and the interview question is whether the candidate can say what
  actually changed rather than that ZooKeeper is deprecated.
prerequisites: []
related: [kafka-partitioning-and-ordering, kafka-consumer-groups-and-rebalancing]
sources:
  - title: "Apache Kafka 4.3 — KRaft"
    url: https://kafka.apache.org/43/operations/kraft/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Design"
    url: https://kafka.apache.org/43/design/design/
    kind: official-docs
review_status: draft
---

## What KRaft replaces

Before KRaft, a Kafka cluster stored its metadata — topics, partitions, leaders, ACLs,
configs, ISR — in ZooKeeper, and an elected controller broker pushed changes from there into
the brokers. Two systems, two failure domains, two consistency models, and a class of bug
where brokers and ZooKeeper disagreed about who led a partition.

KRaft moves metadata into Kafka itself: the controllers form a Raft quorum and store metadata
in a replicated log. The controller that is the Raft leader is the active controller and
writes the metadata log; brokers replicate that log rather than being told about changes.

Apache Kafka 4.0 removed ZooKeeper support entirely. A 4.x cluster is KRaft by definition, and
"should we use ZooKeeper or KRaft" is no longer a question — it is a fact about which major
version you are on.

## The controller quorum

The quorum is a Raft group of controller nodes. Its size is chosen for fault tolerance the
same way a broker replication factor is: three controllers tolerate one failure, five
tolerate two. The controllers do not serve client traffic; they can be colocated with brokers
in small clusters and separated in large ones.

Nodes need to find the quorum. With a dynamic quorum, you set
`controller.quorum.bootstrap.servers` and the membership is stored in the metadata log, so
controllers can be added and removed. With the older static configuration you list all voters
in `controller.quorum.voters` and changing membership means editing config on every node.

Apache Kafka 4.1 added the ability to upgrade a running cluster from a static controller
configuration to a dynamic one, which is the migration path for clusters created on 4.0.

## Metadata as a log

Because metadata is a log, it is snapshotted and replayed like a topic. That brings three
practical consequences.

- **Faster controller failover.** A standby controller has been replaying the same log, so
  promotion does not require loading state from an external system.
- **Bounded metadata.** The log is snapshotted, so a cluster with millions of partitions does
  not need a metadata store that grows without limit.
- **One ordering.** Topic creation, leader election and config changes are records in the same
  log, so the "broker and ZooKeeper disagree" failure mode is gone.

The bootstrap command reflects this. Formatting storage writes metadata into
`metadata.log.dir`, and a single-node cluster can be bootstrapped with
`kafka-storage.sh format --standalone`.

## Upgrades and operations

In-place upgrades from a ZooKeeper-based cluster go through the migration path in the 3.x
line before reaching 4.x; there is no supported jump from ZooKeeper mode to 4.0 in one step.
That is why "we upgraded to Kafka 4" is worth a follow-up question about how.

Operationally, KRaft removes a process to run, monitor, back up and version-match, and it
removes the need to keep ZooKeeper's security configuration in step with Kafka's. It adds the
requirement that the controller quorum itself be monitored: a controller quorum that has lost
its majority stops accepting metadata changes even while data-plane traffic continues, which
is a partial outage that looks like "I cannot create a topic" rather than "the cluster is
down".

## Failure modes

A controller quorum sized below the failure tolerance the cluster claims. Static
`controller.quorum.voters` left in place so controllers cannot be replaced without a
config rollout. Monitoring brokers but not controllers, so a quorum with no majority is
discovered by an application that cannot produce. And an upgrade that skips the migration
path and expects the cluster to boot.
