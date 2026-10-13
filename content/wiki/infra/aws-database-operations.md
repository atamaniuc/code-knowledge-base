---
slug: aws-database-operations
title: "RDS and Aurora: failover, scaling and day-two operations"
lang: en
domain: infra
topic: aws
tech:
  name: AWS
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  RDS is a managed database instance; Aurora is a managed storage layer with a
  writer and readers on top. The operational questions are the same for both:
  what happens on failover, how connections survive it, and how scaling changes
  the failure modes.
prerequisites: [aws-iam-least-privilege]
related: [aws-cost-and-right-sizing, aws-s3-access-patterns]
sources:
  - title: "Amazon RDS: Configuring and managing a Multi-AZ deployment"
    url: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html
    kind: official-docs
  - title: "Amazon Aurora: High availability for Amazon Aurora"
    url: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Concepts.AuroraHighAvailability.html
    kind: official-docs
review_status: draft
---

## RDS is a managed instance

RDS runs a database engine on an instance AWS manages. You choose the engine and version,
the instance class, the storage, and the parameter group; AWS handles patching, backups and
the instance lifecycle. It is the right default for a relational workload that does not
need Aurora's storage model, and its mental model is a single primary with replicas.

The operational surface you still own: connection management, query and index design,
parameter tuning, backup retention and restore drills, and the maintenance window. RDS does
not make a schema change safe and does not make a bad query fast.

## Aurora is a managed storage layer

Aurora separates compute from storage. The cluster has a shared, distributed storage volume
that is replicated across three Availability Zones, and one writer instance plus up to
fifteen read replicas over that volume. Because replicas read the same storage rather than
replaying a log onto their own copy, replica lag is much lower than a traditional
asynchronous replica, and adding a reader does not require copying the dataset.

That changes the scaling story. Read scaling is adding readers behind the reader endpoint;
the writer does not have to be split. Aurora Serverless v2 adjusts capacity in fine-grained
increments for variable load, which is the answer to a workload that is idle at night
without provisioning for the peak.

It also changes the cost story. You pay for storage, I/O on some configurations, and
instances. A read-heavy workload on many readers can cost more than the equivalent RDS
read replicas; the trade is latency and failover behaviour, and it should be stated as a
trade.

## Failover and multi-AZ

Multi-AZ deployments provide a standby in a different Availability Zone and fail over to it
automatically when the primary fails. For Aurora, failover promotes a reader; the cluster
endpoint's DNS record is repointed at the new writer. This is automatic but not instant,
and the important engineering is what the application does during it.

Connections break on failover. A client with a long-lived connection pool must detect the
failure, discard the stale connections and reconnect; without that, the database has failed
over and the application has not noticed. DNS caching extends the outage, so a short TTL
and a re-resolve on connect failure matter. This is where RDS Proxy helps: it pools
connections, can hold client connections through a failover, and reduces the connection
churn that a fleet of serverless functions would otherwise cause.

A failover that has never been tested is a plan, not a capability. The test is to force a
failover in a staging environment with production-like clients and measure both the time to
a working write and the error rate during it.

## Scaling and maintenance

Read scaling goes to replicas and to caching; write scaling goes up, then to partitioning.
Aurora supports vertical scaling with a brief interruption and horizontal read scaling with
readers. Neither fixes a write-bound hot spot, and that is where the answer moves to
sharding or a different access pattern.

Maintenance windows and version upgrades are the other recurring operation. Major version
upgrades are not in-place by default in every case; blue-green deployment creates a staging
copy, lets you test it, and switches over with a controlled downtime, which is the honest
way to do a risky engine upgrade. Minor versions can be applied during a maintenance window
with a failover.

The staff-level point is the interaction with the rest of the system: the database's
recovery time is a term in the application's availability budget, and connection
management, retry policy and migration compatibility are what convert a managed failover
into an unnoticeable event. Backup restore drills belong on the same list: an untested
restore is a belief, not a backup.
