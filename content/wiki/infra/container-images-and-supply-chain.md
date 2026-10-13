---
slug: container-images-and-supply-chain
title: Container images, BuildKit and image supply chain
lang: en
domain: infra
topic: containers
tech:
  name: Docker
  version_range: ">=24"
levels: [middle, senior, staff]
summary: >-
  Image design is a caching problem, an attack-surface problem and a provenance
  problem. Multi-stage builds and distroless bases shrink the last two, layer
  ordering decides the first, and signing plus provenance is what lets a cluster
  admit only what you built.
prerequisites: [kubernetes-workload-objects]
related: [github-actions-oidc-deployments, aws-compute-selection]
sources:
  - title: "Docker: Multi-stage builds"
    url: https://docs.docker.com/build/building/multi-stage/
    kind: official-docs
  - title: "GoogleContainerTools/distroless"
    url: https://github.com/GoogleContainerTools/distroless
    kind: official-docs
  - title: "Sigstore: Quickstart with Cosign"
    url: https://docs.sigstore.dev/quickstart/quickstart-cosign/
    kind: official-docs
  - title: "SLSA v1.0 levels"
    url: https://slsa.dev/spec/v1.0/levels
    kind: spec
review_status: draft
---

## Layers and caching

An image is a stack of layers, and each instruction that changes the filesystem creates one.
The build cache matches layers by content: if a layer's inputs are unchanged, it is reused.
That single fact drives most image design.

Order instructions from least to most volatile. Dependencies first, application source
last, so editing a file does not invalidate the dependency install. A copy of the whole
source directory before the install step is the classic mistake: every commit invalidates
the expensive layer, and the build gets slower exactly when the team is iterating fastest.

Layer count is not the goal; layer stability is. Combining unrelated steps that change
together is fine, and squashing to a single layer destroys the cache granularity that made
builds fast in the first place.

## Multi-stage builds

A multi-stage build uses several FROM stages in one Dockerfile and copies only the
artifacts forward. The compiler, package manager, source and test tooling stay in the build
stage; the final image contains the built artifact and its runtime dependencies.

The benefits are not only size. A smaller runtime image has fewer installed packages, so
fewer CVEs and a shorter patch list. It also removes the build toolchain from the runtime,
which removes a class of attack — a shell, a compiler and a package manager inside a
container are exactly what an attacker wants next.

The pattern is a builder stage, then a minimal runtime base, with a non-root user, and a
final copy of the artifact. A compiled Go or Rust binary can use an empty or scratch base
because it is statically linked; an interpreted runtime needs its interpreter and libraries,
which is where a distroless base fits.

## Distroless and minimal bases

Distroless images contain the application runtime and its dependencies but not a package
manager, shell or the general-purpose operating system userland. They exist for the
security and size reasons above, and they are the default recommendation for a language
runtime image that does not need to be debugged interactively inside the container.

The trade-off is exactly what was removed. No shell means kubectl exec into a shell fails,
which changes debugging to ephemeral containers and distroless debug variants. Some
applications expect a writable system location or a CA bundle that is no longer present;
the fix is to copy what is needed, deliberately, rather than to abandon the minimal base.

Alpine is the other common answer. It is small but uses musl rather than glibc, and native
dependencies compiled against glibc can fail subtly or refuse to load. The rule is to match
the builder and the runtime, or to build statically; mixing them because both are "small"
is how a container passes tests and crashes on start.

## BuildKit

BuildKit is the modern build engine with better caching, parallelism and cache export. Its
relevant features for a platform team: parallel stage execution, a cache that can be
imported and exported through a registry so CI jobs share it, secret mounts so build
secrets are not baked into layers, and multi-platform builds for amd64 and arm64 from one
invocation.

Secrets deserve emphasis. Copying a token into a layer and deleting it in a later
instruction does not remove it: the layer still contains the value, and anyone who can pull
the image can recover it. BuildKit secret mounts make the secret available at build time
without writing it to a layer, and that is the only correct pattern.

Multi-platform matters the moment Graviton or Apple silicon is in the picture: one build
produces an image with a manifest list, and the scheduler picks the right architecture.
Doing that with emulation is correct but slow, which is the argument for native arm64
runners.

## Supply chain

Building an image is not the same as knowing what is in it or who built it.

An SBOM records the packages and versions in the image, which is what makes "are we
affected by this CVE" answerable in minutes rather than days. Scanning finds known
vulnerabilities in those packages; it does not find your own bugs, and a clean scan is not
a security proof.

Signing ties an image digest to an identity. Sigstore's cosign signs an image with a key or
with a workload identity, and verification at admission means a cluster runs only images
whose signature it trusts. Because signatures attach to digests, an admission policy that
checks the signature of the pulled image also pins the content — a tag that moves no longer
matters.

Provenance records how the image was built. SLSA defines levels: Build L2 requires a hosted
build platform with signed provenance, Build L3 requires hardened builds, and each level is
a statement about what a consumer can assume. The practical version of all this in a
pipeline is: build in CI, produce an SBOM, sign with a workload identity rather than a
stored key, attach provenance, and verify at deploy time. Pin base images by digest, not by
tag, because latest is not a version.
