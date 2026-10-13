---
slug: schema-registry-and-evolution
title: Schema Registry and Avro/Protobuf evolution
lang: en
domain: messaging
topic: contracts
tech:
  name: Apache Kafka
  version_range: ">=4.0"
levels: [senior, staff]
summary: >-
  A schema registry turns "we agreed on the JSON shape" into a check the broker-side
  pipeline enforces. The interesting decision is the compatibility mode, because it
  encodes which deploy order your producers and consumers are allowed to use.
prerequisites: [kafka-producer-delivery-semantics]
related: [kafka-dead-letter-handling, api-contract-evolution]
sources:
  - title: "Confluent — Schema Registry overview"
    url: https://docs.confluent.io/platform/current/schema-registry/index.html
    kind: official-docs
  - title: "Confluent — Schema Evolution and Compatibility"
    url: https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html
    kind: official-docs
review_status: draft
---

## What the registry is for

A Kafka topic carries bytes. Without a registry, the contract between producer and consumer
lives in a wiki page or in the producer's code, and the first incompatible producer deploy
breaks consumers at runtime — in production, per message, often with a deserialisation error
that names a field rather than a change.

A schema registry stores the schema for a subject (usually a topic, or topic-value and
topic-key), assigns each version an id, and embeds that id in the message. The consumer
fetches the schema by id and deserialises with it. On registration the registry validates the
new schema against the compatibility rule and rejects it if it would break someone.

A common misconception to correct in an answer: the registry is a schema store, not a
serialiser, and it is not part of the broker. It is another service in the critical path of
produce and consume, so it needs its own availability story and a client-side cache.

## Avro, Protobuf and JSON Schema

**Avro** is the common default on Kafka: compact binary, a schema that is always present with
the data, and reader/writer schema resolution, which is what makes adding a field with a
default safe. It has no generated-code requirement, though generators exist.

**Protobuf** brings a strong IDL, generated code, and a mature ecosystem where gRPC is already
in use. Field numbers replace field names as the compatibility anchor, so renaming is safe and
renumbering is catastrophic.

**JSON Schema** is the least efficient on the wire and the easiest to adopt for teams already
speaking JSON. It is the pragmatic choice for low-volume topics and the wrong one for a
high-throughput pipeline.

The choice follows from the rest of the stack: Protobuf if the organisation already runs
gRPC, Avro for a data pipeline with a schema-driven catalog, JSON Schema when the producer is
a third party.

## Compatibility modes

The Confluent documentation names four modes, and the default is **BACKWARD**:

- **Backward**: a consumer using the new schema can read data written with the old schema.
  You may add optional fields and remove fields. Upgrade consumers first.
- **Forward**: a consumer using the old schema can read data written with the new schema. You
  may remove optional fields and add fields. Upgrade producers first.
- **Full**: both directions — add or remove optional fields only.
- **Transitive**: compatibility checked against all previous versions, not just the last one.

The mode is a statement about deploy order. Backward means consumers can be ahead of
producers, so the safe rollout is consumers first. Full is the strictest and the easiest to
reason about in a system where you cannot guarantee deploy order at all. Transitive matters
when a consumer might still be pinned to a version several releases old.

## Evolving without a registry

A registry is not the only way. A topic can carry an explicit version field and the consumer
can branch — which is schema management implemented in application code, with the same
failure modes and no enforcement. JSON without a registry is the most common version of this.

If a registry is off the table, the minimum discipline is: never remove or retype a field,
always add optional fields, version the event type explicitly, and treat the topic's payload
as an API with its own deprecation and monitoring. The registry automates a rule that a team
can also follow manually — badly, but not never.

## Failure modes

Removing a field that consumers read, then discovering it in production because no registry
enforcement was on. A registry in the hot path with no client-side schema cache and no
redundancy. Compatibility set to NONE for a shared topic. A Protobuf schema renumbered, which
is a wire-format break that a compatibility check cannot see because it compares field names.
And a schema id embedded in every message but the consumer fetching it per record.
