---
slug: github-actions-oidc-deployments
title: GitHub Actions deployments with OIDC, caching and environments
lang: en
domain: infra
topic: ci-cd
tech:
  name: GitHub Actions
  version_range: ">=2025"
levels: [middle, senior, staff]
summary: >-
  A deployment pipeline is an identity, a cache, a gate and a release strategy.
  OIDC removes long-lived cloud keys, environment protection rules are the gate,
  and trunk-based release with an immutable artifact is what makes rollback a
  redeploy rather than a rebuild.
prerequisites: [container-images-and-supply-chain]
related: [aws-iam-least-privilege, helm-charts-and-releases]
sources:
  - title: "GitHub Docs: Configuring OpenID Connect in Amazon Web Services"
    url: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
    kind: official-docs
  - title: "GitHub Docs: Using environments for deployment"
    url: https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment
    kind: official-docs
  - title: "GitHub Docs: Caching dependencies to speed up workflows"
    url: https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows
    kind: official-docs
review_status: draft
---

## OIDC instead of keys

The default way to let a workflow touch a cloud account used to be a long-lived access key
stored as a repository secret. It is the wrong default: the key does not expire, it is
copied into every fork and every log, and rotating it is a manual project.

OpenID Connect replaces it. The workflow declares id-token: write and can request a
short-lived OIDC token from GitHub's provider. AWS is configured with an IAM OIDC identity
provider that trusts that issuer, and an IAM role whose trust policy accepts the token. The
workflow job then exchanges the token for temporary AWS credentials, and no secret is
stored anywhere.

This is the same federation pattern as IAM roles for service accounts, applied to CI. The
identity is the workflow's, it is short-lived, and it is auditable.

## The job's identity

The security of the whole arrangement is the trust policy's condition on the token's
subject claim. The subject encodes the repository, and either the git ref or the environment
the job runs in: a branch, a tag, a pull request, or an environment name.

The mistake is a wildcard. A trust policy of repo:ORG/REPO:* accepts a token from any
branch, any tag and any environment, so a feature branch — or a pull request from a fork
that can trigger a workflow — can assume the production role. Scope the subject to the
branch or, better, to a named environment, and scope the role to what that deployment
actually needs.

The audience claim should also be checked, and the role's permissions should be deployment
permissions, not account administration. The workflow's own permissions block is the other
half: id-token: write is required for the exchange, and contents: read is usually all the
rest of the job needs. Default token permissions should be set to read-only at the
repository level so a new workflow is not silently over-privileged.

## Caching and matrices

Caching exists to avoid repeating work that has not changed. The key is the cache identity:
typically the runner operating system plus a hash of the lockfile. When the lockfile
changes, the key changes and the cache is rebuilt; restore-keys give a fallback match so a
dependency update reuses part of the previous cache instead of starting cold.

Three rules. Caches are scoped to a branch and are evicted under a size limit, so a cache is
an optimisation and never a source of truth. Secrets must never be cached. And the most
valuable cache for a container build is not the package manager but the image layers: a
registry-backed layer cache in the build step makes the difference between a two-minute and
a fifteen-minute pipeline.

A matrix runs the same job across combinations of parameters — versions, platforms,
regions. fail-fast controls whether one failure cancels the rest, and max-parallel bounds
resource use. A matrix built from JSON produced by a previous job is the pattern for
dynamic targets. Concurrency groups are the complement: they cancel a superseded run on the
same ref so a queue of pushes does not deploy three stale versions in order.

## Environments and protection

An environment is a named deployment target with its own secrets and protection rules.
Required reviewers, a wait timer and branch restrictions turn a job into a gated one: the
workflow pauses, and a human approves before the deploy proceeds. Deployment history is the
audit record of who deployed what, when.

Environments compose with OIDC in the way that matters: a production role that trusts only
the environment subject, and an environment that requires reviewers, means the credential
and the human gate protect the same boundary. Either alone is weaker.

The limitation to know: environment protection gates the job, not the code. If the deploy
step rebuilds from a branch after approval, the approved artifact and the deployed artifact
are different things. That is the argument for building once and promoting the artifact.

## Trunk-based release and rollback

Trunk-based development keeps branches short — hours to a day — and merges to main
frequently. Deploys come from main, and work that is not ready to be visible ships behind
a feature flag rather than on a branch that lives for weeks. Short-lived branches are what
keep merge conflicts small and keep the pipeline's main path exercised.

The release discipline that makes rollback real: build the artifact once, tag it with an
immutable version or digest, and promote that same artifact through dev, staging and
production. Never rebuild for production, because a rebuild is a different artifact with
different dependency resolution, and "we rolled back" then means "we deployed something we
have never tested".

Rollback is then redeploying the previous digest — fast, boring, and independent of the
build system. A feature flag flip is faster still when the problem is one feature rather
than the release. And the constraint that is easy to forget: the database schema has to be
backward compatible with the previous application version, which is why migrations expand
and then contract in separate releases rather than renaming a column in place.
