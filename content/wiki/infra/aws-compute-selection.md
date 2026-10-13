---
slug: aws-compute-selection
title: "EKS, ECS, Fargate or Lambda: choosing compute for a workload"
lang: en
domain: infra
topic: aws
tech:
  name: AWS
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  The four options are not a maturity ladder. EKS gives you the Kubernetes API,
  ECS a simpler AWS-native orchestrator, Fargate removes the nodes, and Lambda
  removes the servers. The workload's shape picks the winner before cost does.
prerequisites: []
related: [aws-iam-least-privilege, aws-cost-and-right-sizing, container-images-and-supply-chain]
sources:
  - title: "Amazon EKS User Guide: What is Amazon EKS?"
    url: https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html
    kind: official-docs
  - title: "Amazon ECS Developer Guide: What is Amazon ECS?"
    url: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html
    kind: official-docs
  - title: "AWS Fargate for Amazon ECS"
    url: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html
    kind: official-docs
  - title: "AWS Lambda Developer Guide: What is AWS Lambda?"
    url: https://docs.aws.amazon.com/lambda/latest/dg/welcome.html
    kind: official-docs
review_status: draft
---

## The four options

Amazon EKS is a managed Kubernetes control plane. You get the Kubernetes API, the
ecosystem of operators and CRDs, and portability of manifests and skills; you own the
cluster as a system, including node pools, add-ons and upgrades.

Amazon ECS is an AWS-native container orchestrator. It is a smaller surface than
Kubernetes: task definitions, services, capacity providers, and first-class integration
with IAM, load balancers and CloudWatch. It is the right answer when the organisation does
not need the Kubernetes API and does not want to operate it.

AWS Fargate is a compute engine, not an orchestrator: it runs ECS tasks or EKS pods
without EC2 instances to provision or patch. You specify CPU and memory per task, and each
task gets its own isolation boundary.

AWS Lambda is serverless functions: an event triggers an execution, you pay per request and
duration, and the platform scales to zero and out again. There is no host to manage and no
long-running process to keep.

## Where the workload's shape decides

Start from the runtime contract, not from fashion.

Long-lived connections decide a lot. A service holding WebSockets, server-sent events or
streaming gRPC does not fit a function that must finish; it fits a container. So does
anything that keeps an in-memory cache or a connection pool warm.

State and local disk decide more. Lambda has ephemeral storage and no stable identity.
Fargate tasks are ephemeral and cannot run privileged or daemon-style workloads. Anything
that needs a persistent local volume, a stable network name, or a cluster-scoped agent
points at EKS or ECS on EC2.

Burst shape decides the economics. A workload that is idle most of the day and spikes is a
good serverless candidate, because scale-to-zero is real money. A workload at sustained
high utilisation is usually cheaper on provisioned compute, because per-request pricing
has a crossover.

Platform economics decide the last mile. One service on ECS is less machinery than one
service on EKS. Forty services that share a service mesh, a policy engine, an ingress
layer and a deployment pipeline are exactly what a Kubernetes platform is for; on ECS that
platform tooling is built again, differently.

## Serverless trade-offs

Lambda imposes real constraints and naming them is what separates a senior answer from
enthusiasm. Execution time is bounded, so a job that might run long belongs on a queue with
chunked work rather than in one invocation. Concurrency is bounded at the account and
function level; a downstream database that can serve fifty connections will be exhausted by
a function that scales to a thousand, which is what RDS Proxy and connection pooling are
for. Cold starts add latency on the first request after idle, and provisioned concurrency
is the mitigation that also removes the cost advantage at steady state.

Observability and testing change shape too: distributed tracing becomes the only way to see
a request across functions, and local end-to-end testing is harder than running a container.
None of these are disqualifying; they are the reasons the choice is a design decision
rather than a default.

## A worked decision

Take a queue-draining image-processing worker with spiky load. If each unit of work fits
comfortably inside the function timeout and the processing library runs in the runtime,
Lambda is the cheapest correct answer: it scales with queue depth, costs nothing when idle,
and needs no orchestrator. If the unit of work is long, memory-hungry or needs a system
library the runtime lacks, a container on Fargate or EKS with a queue-depth autoscaler is
the answer, and the queue, not the compute, is the buffer.

Take a multi-tenant API of forty services with shared mTLS, shared policy and a single
ingress layer. EKS is the answer, not because Kubernetes is better but because the shared
platform is the requirement and Kubernetes already has the extension points.

The interview point is the order: contract, then burst shape, then platform economics, then
cost. A candidate who opens with a price comparison has skipped the constraints that
actually eliminate options.
