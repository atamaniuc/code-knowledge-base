---
slug: aws-cost-and-right-sizing
title: AWS cost, right-sizing and Graviton
lang: en
domain: infra
topic: aws
tech:
  name: AWS
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  The bill is mostly compute, storage, data transfer and the hidden items nobody
  models. Right-size from observed usage before committing, treat Graviton as a
  benchmarked migration rather than a switch, and cover the steady baseline with
  commitments while the peak stays on demand.
prerequisites: [aws-compute-selection, aws-s3-access-patterns]
related: [kubernetes-autoscaling, aws-database-operations]
sources:
  - title: "AWS Graviton Processors"
    url: https://aws.amazon.com/ec2/graviton/
    kind: official-docs
  - title: "Amazon ECS: Architect for AWS Fargate"
    url: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html
    kind: official-docs
review_status: draft
---

## Where the bill comes from

The visible line is compute. The lines that surprise people are data transfer out, NAT
gateway processing, cross-Availability-Zone traffic, idle load balancers, and observability
ingestion. A container platform can spend a meaningful fraction of its bill on NAT gateway
and cross-AZ chatter while everyone debates instance families.

Cost work starts with allocation, not with a discount. Tags on every resource, a tag policy
that enforces the ones that matter, and a cost report per team or product turn a single
number into an incentive. Then unit economics: cost per order, per active user, per
thousand requests. A total that grows with the business is not a problem; a unit cost that
grows is.

## Right-sizing

The default failure is over-provisioning for safety and never revisiting it. Right-sizing
uses observed utilisation: CPU at the p95 and p99, memory working set rather than the
high-water mark of a leak, and the request rate the instance actually serves.

Match the family to the shape. Compute-optimised for CPU-bound services, memory-optimised
for caches and JVMs, burstable for low-average workloads with occasional spikes — and know
that burstable instances have a credit model, so a workload that bursts continuously is
paying either performance or surprise.

Container platforms get this from the metrics they already have: requests and limits versus
actual usage, the Vertical Pod Autoscaler's recommendations, and the gap between requested
capacity and used capacity across the cluster. That gap is often the single largest
easy win.

## Graviton

Graviton is AWS's Arm-based processor line, offered across instance families and positioned
with better price-performance than comparable x86 instances. For a container platform the
migration cost is mostly in the images: a multi-architecture build produces an arm64 variant
and the scheduler picks it, so the platform work is one build change.

The work that is not free: native dependencies must build or be available for arm64, some
third-party agents and licensed software ship x86 only, and performance must be measured
rather than assumed. A benchmark on the same traffic and the same workload is what justifies
the move; a synthetic microbenchmark is how a migration gets approved and then reverted.

The honest staff answer names the sequence: build multi-arch, run one non-critical service
on Graviton, compare cost and latency at real load, then migrate family by family. The
capacity planning is the same either way; only the instruction set changes.

## Commitment

Commitments trade flexibility for price. Savings Plans and Reserved Instances discount a
committed level of usage; Spot capacity is much cheaper but can be reclaimed, so it belongs
on interruption-tolerant work — batch, stateless workers with graceful shutdown, and
anything that can be retried.

The ordering matters. Right-size first, then commit, because a commitment to the wrong
instance family or the wrong region is a bill you pay whether or not you use it. Cover the
steady baseline with commitments and let the peak stay on demand, then watch two numbers:
commitment utilisation, which means you bought capacity you are not using, and coverage,
which means you are paying on-demand prices for a predictable floor.

Fargate and Lambda shift the model rather than removing cost: you stop paying for idle
instances and start paying per task-second or per request, which is cheaper for spiky
workloads and more expensive for sustained high utilisation. The crossover is the decision,
and it is a measurement, not an opinion.
