---
slug: kafka-node-clients-2026
title: "Kafka Node.js clients in 2026: KafkaJS is unmaintained"
lang: en
domain: messaging
topic: clients
tech:
  name: "@platformatic/kafka"
  version_range: ">=2"
levels: [middle, senior, staff]
summary: >-
  KafkaJS was the default Node client for years and has had no release since February
  2023. In 2026 the maintained options are @platformatic/kafka and
  @confluentinc/kafka-javascript, and recommending KafkaJS for a new service is a
  currency failure.
prerequisites: [kafka-producer-delivery-semantics]
related: [choosing-a-message-broker, kafka-consumer-groups-and-rebalancing]
sources:
  - title: "npm registry — @platformatic/kafka"
    url: https://registry.npmjs.org/@platformatic%2Fkafka
    kind: release-notes
  - title: "npm registry — @confluentinc/kafka-javascript"
    url: https://registry.npmjs.org/@confluentinc%2Fkafka-javascript
    kind: release-notes
  - title: "npm registry — kafkajs"
    url: https://registry.npmjs.org/kafkajs
    kind: release-notes
review_status: draft
---

## KafkaJS is unmaintained

KafkaJS was for years the pragmatic Node client: pure JavaScript, a pleasant API, no native
build step. Its last published version, `2.2.4`, dates from **2023-02-27** — the npm
registry's `time.modified` for the package has not moved since. There is a
`2.3.0-beta.3` tag, but no stable release in more than three years.

Three years is several Kafka major versions. KafkaJS predates Kafka 4 entirely, so it was
written against a world with ZooKeeper, the classic consumer rebalance protocol only, and no
dynamic controller quorums. Depending on what it uses internally it may still connect, and
plenty of production systems still run it, but "it works today" is not the claim an interview
is testing. The claim being tested is whether the candidate knows the client landscape has
moved and can say what replaced it.

## @platformatic/kafka

The actively developed pure-JavaScript option. The registry shows `2.14.0` published
2026-10-07, which is the kind of recency a Node client needs to track Kafka 4.x features.

Its appeal is the same as KafkaJS's: no native compilation, so it builds and deploys on any
platform without a toolchain, and the API is designed for modern Node with promises and
streams. For a team that values a simple dependency and does not need the librdkafka feature
set, it is the default recommendation for a new service.

## @confluentinc/kafka-javascript

Confluent's Node client, at `1.11.0`. It wraps librdkafka, the same C library behind the
Confluent clients for other languages, which brings a native build and, in exchange, the
widest feature coverage: the most complete producer, consumer and admin APIs, mature
transaction support, and behaviour that matches the Java and other clients.

Choose it when the workload needs transactional producers, when parity with the rest of the
organisation's Kafka clients matters, or when the operational team already runs librdkafka
clients everywhere. The cost is a native dependency in the build and deployment image.

## What to check before choosing

- **Kafka version support.** Does the client document support for the 4.x protocol and the
  new consumer group protocol? A client that only speaks classic consumer groups is not wrong,
  but it is a limitation to state.
- **Transactions and idempotence.** Whether the client exposes transactional producers, and
  whether it enables idempotence by default, decides whether exactly-once designs are
  available at all.
- **Maintenance signal.** Last publish date, release cadence, issue response. The registry
  metadata answers the first of those in one request, which is exactly how a candidate should
  be able to answer this question.
- **Native build.** Pure JavaScript versus librdkafka is a deployment decision: Alpine images,
  ARM, and CI caching all behave differently.

## Migrating off KafkaJS

The client sits behind an interface the application owns, so the migration is a dependency
swap plus a behavioural diff. The parts that bite:

- **Rebalance callbacks and offset commits.** Each client reports partition assignment and
  commit acknowledgement differently; the consumer's commit strategy must be re-verified, not
  assumed.
- **Error taxonomy.** Retriable and fatal errors are classified per client, and retry logic
  written against KafkaJS error names will silently stop retrying.
- **Batching and compression defaults.** Throughput characteristics change; re-measure rather
  than carrying over a tuning config.

Anything with a running cost of a client library is small; anything with the running cost of
a missing deduplication path is not. Migrate the client first, keep the idempotent consumer,
and change one thing at a time.

## Failure modes

Recommending KafkaJS for a new service in 2026. Assuming a maintained-looking GitHub
repository means published releases. Choosing librdkafka without accounting for the native
build in the deployment pipeline. And swapping the client without re-testing the
rebalance-and-commit behaviour, which is where duplicates and gaps come from.
