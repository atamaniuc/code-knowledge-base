---
slug: aws-iam-least-privilege
title: AWS IAM least privilege, roles for pods and credential hygiene
lang: en
domain: infra
topic: aws
tech:
  name: AWS
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Least privilege is a process, not a policy document: start from denied, grant
  the narrowest action on the narrowest resource, and remove long-lived keys.
  For pods, the mechanism is an IAM role bound to a Kubernetes service account.
prerequisites: [aws-compute-selection]
related: [kubernetes-rbac-and-multi-tenancy, github-actions-oidc-deployments]
sources:
  - title: "Amazon EKS: IAM roles for service accounts"
    url: https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html
    kind: official-docs
  - title: "AWS Lambda: Defining function permissions with an execution role"
    url: https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html
    kind: official-docs
review_status: draft
---

## Principals and roles

An IAM principal is something that can make an AWS API call: a user, a role, a federated
identity, or an AWS service. The first hygiene rule is that humans and workloads assume
roles and receive temporary credentials from STS; long-lived access keys are the thing that
leaks into a repository, a CI log or a laptop backup.

A role has two policies that are often confused. The trust policy says who may assume it.
The permission policy says what the role may then do. Both are part of least privilege: a
perfectly scoped permission policy does not help if anyone in the account can assume the
role.

Resource-based policies are the other half of the model. An S3 bucket policy or a KMS key
policy can grant access independently of identity-based policies, which means an effective
permission is the union of identity policy, resource policy, permissions boundary, and
organisation policy. Reading only the IAM role in a review is how an over-grant stays
invisible.

## Roles for pods

A pod running on EKS should never hold static AWS credentials in an environment variable or
a mounted file. The supported mechanism is IAM roles for service accounts: an IAM role
whose trust policy federates the cluster's OIDC provider, and a Kubernetes ServiceAccount
annotated with that role's ARN. The AWS SDK in the pod then obtains temporary credentials
automatically.

The trust policy is scoped by condition, and the condition is the security boundary:
namespace and service account name. A trust policy that trusts the provider without
restricting those lets any pod in the cluster assume the role, which is the same as giving
every workload the permission.

For Lambda, the analogous object is the execution role. The function assumes it, and its
permissions are what the function's code can do — which is why the execution role should
not be a managed policy with wildcards.

## Least privilege in practice

Least privilege is written backwards from a wildcard. The process that works: start with
the managed policy or wildcard that lets the thing function, turn on CloudTrail, observe
which actions are actually called, then cut the policy to those actions and scope each to
the specific resource ARNs. IAM Access Analyzer can generate a policy from observed
activity, which turns that exercise from archaeology into review.

Scope resources, not just actions. s3:GetObject on star is a different risk from
s3:GetObject on one bucket prefix; dynamodb:Query on one table is different from on star.
Add conditions where the service supports them — a source VPC endpoint, a required MFA, a
source account — and remember that a condition on an action that is not called is
decoration.

For cross-account access and services acting on your behalf, the confused deputy problem is
the thing to name: a third party that can be induced to use its permissions on your
resources. The mitigations are an external ID in the trust policy for third-party access,
and source ARN or source account conditions for service principals.

## Boundaries and guardrails

No single policy can express least privilege across an organisation, so AWS provides
ceilings. A permissions boundary sets the maximum permissions an identity can have: the
effective permission is the intersection of the identity policy and the boundary, so a
developer allowed to create roles cannot exceed the boundary. Service control policies at
the organisation level do the same above the account, and are the mechanism that stops a
new account from having a region or a service the organisation has decided against.

The practical platform pattern: a role per workload, a boundary per team or environment, an
SCP per organisation unit, and an Access Analyzer finding on anything public. Then treat
policy as code, because a console edit is an untracked permission and the review happens in
the pull request or not at all.
