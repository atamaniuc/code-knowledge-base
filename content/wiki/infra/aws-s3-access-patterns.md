---
slug: aws-s3-access-patterns
title: Amazon S3 access patterns, performance and cost
lang: en
domain: infra
topic: aws
tech:
  name: AWS
  version_range: ">=2024"
levels: [middle, senior, staff]
summary: >-
  S3 is strongly consistent, effectively unbounded, and priced by storage,
  requests and egress. Design for prefix-level request rate, grant access with
  presigned URLs or policies rather than public buckets, and let lifecycle rules
  move data instead of storing hot data cold forever.
prerequisites: [aws-iam-least-privilege]
related: [aws-cost-and-right-sizing, aws-event-driven-messaging]
sources:
  - title: "Amazon S3 User Guide: What is Amazon S3?"
    url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
    kind: official-docs
  - title: "Amazon S3: Best practices design patterns - optimizing performance"
    url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html
    kind: official-docs
review_status: draft
---

## Consistency and durability

S3 provides strong read-after-write consistency for PUT and DELETE of objects in all AWS
Regions, for new objects, overwrites and deletes. The old model — list and overwrite
eventually consistent — is no longer something to design around, and saying so is a
currency marker: a candidate who adds a consistency workaround for a problem S3 no longer
has is answering from old material.

Durability is designed for eleven nines across the service, which is a service-level
property rather than a guarantee about one object. The practical implication is that the
rare data-loss event is an accidental delete or an application bug, which is why versioning
plus MFA delete or a bucket policy is the mitigation, not durability engineering.

## Request rate and prefixes

S3 scales by prefix. The documented baseline is at least 3,500 PUT, COPY, POST or DELETE
requests per second and 5,500 GET or HEAD requests per second per partitioned prefix, with
no limit on the number of prefixes in a bucket. Read and write performance can be increased
by parallelising across prefixes: ten prefixes used for parallel reads can reach roughly
55,000 read requests per second in the documented example.

Two consequences. Partitioning on a natural key — tenant, date, shard — is enough, and the
old advice about random hash prefixes is obsolete because S3 partitions automatically. And
a workload that is genuinely above the per-prefix rate needs a partitioning key chosen for
the access pattern, not a retry loop.

For large objects, multipart upload is the mechanism for both throughput and resumability,
and byte-range GETs let a consumer parallelise a single large read. Both matter for
analytics and backup workloads more than for user-facing traffic.

## Access control

The default posture is that a bucket is private, Block Public Access is on, and access is
granted by identity policy, bucket policy, or a presigned URL. A public bucket is a
decision, not a default, and the combination of Block Public Access plus a policy condition
on the source VPC endpoint is what keeps internal traffic internal.

Presigned URLs are the right way to hand a specific object to a client without giving it
credentials: the URL encodes the permission, the object and an expiry. The common mistake
is an expiry measured in days for a URL that leaks into a log, and the mitigation is a
short expiry plus CloudFront signed URLs or cookies when the content is a distribution
rather than an object.

Encryption is on by default with SSE-S3; SSE-KMS adds key control and an audit trail at the
cost of KMS requests on every object operation, which becomes visible at high request
rates. A bucket policy that requires TLS and a specific key is how a regulated workload
states that requirement in code.

## Lifecycle and cost

The bill has three components: storage by class, requests, and data transfer out. Levers
follow directly.

Storage class and lifecycle: Intelligent-Tiering for data whose access pattern is unknown,
explicit transitions to infrequent-access and archive classes for data whose pattern is
known, and expiration for data that should not exist forever. Every lifecycle rule should
also abort incomplete multipart uploads, because those parts are billable and invisible.

Request cost: listing and small-object churn are request-priced. An application that lists
a prefix per request is paying for a design problem; an inventory report or a manifest
object is cheaper.

Egress: data transfer out of AWS is the expensive direction. CloudFront or a same-region
consumer changes the number, and a VPC gateway endpoint removes NAT gateway charges for
in-region S3 traffic, which is often the largest hidden line item in a container platform.
