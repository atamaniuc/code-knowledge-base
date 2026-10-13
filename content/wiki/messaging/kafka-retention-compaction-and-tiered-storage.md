---
slug: kafka-retention-compaction-and-tiered-storage
title: Kafka retention, compaction and tiered storage
lang: en
domain: messaging
topic: storage
tech:
  name: Apache Kafka
  version_range: ">=4.0"
levels: [senior, staff]
summary: >-
  cleanup.policy decides whether a topic forgets by time or remembers the latest value
  per key. Tiered storage moves cold segments to object storage, which changes the cost
  of long retention — but the retention policy is still what makes a topic readable
  tomorrow.
prerequisites: [kafka-partitioning-and-ordering]
related: [kafka-dead-letter-handling, schema-registry-and-evolution]
sources:
  - title: "Apache Kafka 4.3 — Topic Configs (cleanup.policy, retention)"
    url: https://kafka.apache.org/43/configuration/topic-configs/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Tiered Storage"
    url: https://kafka.apache.org/43/operations/tiered-storage/
    kind: official-docs
  - title: "Apache Kafka 4.3 — Design (log compaction)"
    url: https://kafka.apache.org/43/design/design/
    kind: official-docs
review_status: draft
---

## Delete, compact, or both

`cleanup.policy` is a list, and its default is `delete`. It controls what happens to
segments once they are old.

- `delete` discards segments past `retention.ms` or `retention.bytes`. This is the right
  policy for a stream of events: the topic is a bounded buffer, and a consumer that falls
  further behind than the retention window loses data permanently.
- `compact` retains the latest value for each key and removes older values. It turns a topic
  into a changelog — the current state of every key — which is what a state-store restore or a
  table-sync reads.
- `delete,compact` is the combination: old segments are dropped by time or size, while
  retained segments are compacted.

An empty list means infinite retention: no cleanup at all. That is a valid choice for a
short-lived archive and a disk-filling choice for anything busy.

## What compaction does and does not promise

Compaction is asynchronous and best-effort per key. It guarantees that the latest value for
each key is eventually retained, and that a consumer reading from the beginning sees at least
the latest value for every key still present. It does not guarantee immediate removal of the
previous value, does not preserve tombstones forever, and does not make the topic a
random-access store — a consumer still reads sequentially.

A tombstone (a record with a null value) is how a key is deleted from a compacted topic. Set
`delete.retention.ms` to a window longer than the slowest consumer, or a consumer that was
down can miss the tombstone and resurrect deleted keys.

Common uses: a compacted topic per entity type that a service replays to rebuild an in-memory
projection; Kafka Streams state stores; Debezium-style change capture where the latest row
image per key is what downstream needs.

## Tiered storage

Kafka's storage was local disk, so retention was bounded by brokers and rebalancing a large
partition moved a lot of bytes. Tiered storage, specified by KIP-405, keeps recent segments
locally and offloads completed segments to remote storage such as object storage.

Enable it on a broker with `remote.log.storage.system.enable=true`, and the storage
implementation is provided by a `RemoteStorageManager`. Apache Kafka does not ship an
out-of-the-box implementation, so a cluster uses a plugin from a distribution or a vendor. The
remote system is pluggable, which is also the operational caveat: the availability of the
remote store becomes part of the cluster's availability for reads of old data.

With tiered storage enabled, retention splits:

- `local.retention.ms` and `local.retention.bytes` bound what stays on the broker's disk.
- `retention.ms` and `retention.bytes` bound the total, including remote.

That split is the point: you can keep months of data for replay while the brokers hold days,
which removes the need to choose between retention and disk. Reads of remote segments are
slower, so a consumer replaying from the beginning is a workload to plan for, not a free
operation.

## Retention, lag and the honest answer

Retention is not just cost. It is a promise about what a consumer can recover. A consumer
down longer than `retention.ms` has lost offsets that no longer exist, and resetting to the
earliest offset is a data-loss decision. The maximum consumer downtime a topic can tolerate is
`retention.ms`, and it should be written down next to the topic, not discovered.

For a compacted topic, the equivalent promise is different: the topic always holds the latest
state per key, so a consumer can rebuild a full projection from the beginning regardless of
how long it was down. That is the reason to compact a table-like stream.

## Choosing per topic

| Need | Policy |
|---|---|
| Event stream consumed within hours | delete, retention sized to max consumer downtime |
| Current state of every entity, replayable | compact |
| Both: recent events and current state | delete,compact |
| Audit or analytics with long retention | tiered storage plus delete |
| Short-lived intermediary in a pipeline | delete with short retention |

## Failure modes

`retention.ms` shorter than the longest consumer outage, then a silent gap. A compacted topic
used as an event stream, so history is missing by design. `delete.retention.ms` shorter than
a consumer's downtime, so deleted keys are resurrected. Tiered storage enabled without
monitoring the remote store. And infinite retention kept as a default because nobody revisited
the topic config.
