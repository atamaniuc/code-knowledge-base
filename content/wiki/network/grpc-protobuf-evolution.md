---
slug: grpc-protobuf-evolution
title: Evolving a protobuf contract across a rollout window
lang: en
domain: network
topic: api-design
tech:
  name: gRPC
  version_range: ">=1.60"
levels: [senior, staff]
summary: >-
  Field numbers are the wire contract and names are not, so a rename is wire-compatible and
  source-breaking at the same time. The deployment is the hard part: old and new run
  together, so both must accept both.
prerequisites: [api-contract-evolution]
related: [nestjs-microservice-transports, api-pagination-and-error-models]
sources:
  - title: "Protocol Buffers — Language guide (proto3)"
    url: https://protobuf.dev/programming-guides/proto3/
    kind: official-docs
  - title: "gRPC — Deadlines"
    url: https://grpc.io/docs/guides/deadlines/
    kind: official-docs
  - title: "gRPC — Guides"
    url: https://grpc.io/docs/guides/
    kind: official-docs
review_status: draft
---

## The wire format is the contract

A protobuf field is identified on the wire by its number and wire type; the name exists
only in generated code. Renaming a field is therefore safe for an old peer that reads the
bytes and breaks every source file that referenced the generated name — a code and rollout
problem rather than a data problem. Reusing a retired field number is the dangerous change,
because an old message still in flight will be decoded as the new type. Deleting a field
means reserving its number and its name.

Removing a field from a response is subtler than it looks: a peer that still reads it sees
the default value, which is indistinguishable from a legitimate zero unless the field is
marked optional and presence is checked.

## proto3 cardinality and the missing required

proto3 has no required fields; a singular scalar is either optional-with-presence or
implicitly defaulted. Adding "a new mandatory input" is therefore additive at the schema
level, and the requirement moves into the application: the server validates it and returns a
documented error code. Believing the schema enforces requirement is how a service ends up
treating missing and empty as the same thing.

## The rollout window is the real problem

During a deploy, both versions run at once. The discipline that works is three steps, each
separately deployable: add the new field or method and teach every server to accept both
old and new; deploy clients that send the new shape; only then retire the old path. A
one-shot rename with generated code regenerated on both sides in the same release fails for
whichever instance deploys second.

Two consequences to state explicitly. Unknown fields are preserved by default, so an old
server can round-trip data it does not understand — useful, and not a substitute for the
two-step deploy. And a protobuf change cannot be verified from the schema alone, so
per-client version telemetry is the only evidence that the old path is unused.

## When the change is not additive

Add a method rather than changing the meaning of an existing one. A new RPC or a new
message version alongside the old gives each side a migration path, and the old one is
deprecated and observed. Changing a field's type or semantics in place has no safe rollout.

## Deadlines and streaming

gRPC deadlines are absolute, propagate to the server, and surface as DEADLINE_EXCEEDED when
the client gives up; a server should stop work it can no longer deliver. Streaming RPCs are
for genuinely streamed payloads and long-lived flows, not for avoiding pagination — a
bidirectional stream used as a chatty CRUD channel keeps state, ordering and reconnection
complexity that unary calls do not have.

## Failure modes

Assuming a version bump makes a change safe. Reusing a field number after deletion. Adding a
field to a request and treating its absence as an error without saying so in the schema.
Regenerating both sides in one release and ignoring skew. And using a stream where a page
token would do.
