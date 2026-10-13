---
slug: graphql-n-plus-one-and-cost-controls
title: GraphQL N+1, DataLoader and query cost limits
lang: en
domain: network
topic: api-design
tech:
  name: GraphQL
  version_range: ">=2023"
levels: [senior, staff]
summary: >-
  A GraphQL resolver per field is a database call per item unless batching is built in.
  DataLoader fixes the N+1 for one request; depth and cost limits plus persisted queries
  fix the query that is simply too expensive to run.
prerequisites: []
related: [api-pagination-and-error-models, api-contract-evolution]
sources:
  - title: "GraphQL — Pagination"
    url: https://graphql.org/learn/pagination/
    kind: official-docs
  - title: "GraphQL — Security (depth limiting)"
    url: https://graphql.org/learn/security/
    kind: official-docs
  - title: "DataLoader"
    url: https://raw.githubusercontent.com/graphql/dataloader/main/README.md
    kind: article
  - title: "Apollo Server — Automatic persisted queries"
    url: https://www.apollographql.com/docs/apollo-server/performance/apq/
    kind: official-docs
review_status: draft
---

## The N+1, in one trace

A query asks for one hundred orders and each order's customer. The orders resolver returns
the list, then the customer resolver runs once per order and issues one query each: one
list query plus one hundred lookups. The trace makes it obvious; the code makes it
invisible, because each resolver looks correct on its own.

The fix is to batch within the tick: collect the keys requested during the same execution
step and resolve them with a single query.

## DataLoader

DataLoader is a utility that batches and caches loads for one request. Each instance is a
unique cache, and the guidance is to create one per request when different users can see
different things. A batch function receives an array of keys and must return values in the
same order.

Two properties are easy to get wrong. The cache is per instance, so a process-wide loader
leaks one user's data into another's response — instantiate per request. And the batch
function must return an entry for every key, including misses, or the ordering contract
breaks in a way that surfaces as wrong data rather than an error.

Batching fixes the query count. It does not fix a resolver that walks a collection with an
unbounded depth, which is a query-shape problem.

## Cost control on the query shape

The client chooses the shape, so the server must bound it.

- **Depth limiting** rejects a query deeper than a configured maximum, which caps nested
  selection cost.
- **Complexity or cost analysis** assigns each field a weight and rejects queries above a
  budget; it catches a shallow query with a wide fan-out that depth limiting misses.
- **Alias and field-count limits** stop a query that repeats the same expensive field many
  times with different aliases.
- **Timeouts and response-size caps** are the backstop when the static analysis is wrong.

Cost accounting is also what lets you charge a quota per client rather than per request
count, which reflects the actual resource use.

## Persisted queries

A persisted query is a document the server already knows, referenced by a hash instead of
being sent in full. Automatic persisted queries let a client send a hash, receive a
"not found", then upload the document once and use the hash afterwards. In production the
allow-listed variant is stronger: only documents registered ahead of time can execute, so
an attacker cannot use the API as an arbitrary query surface at all.

Both variants also shrink the request size and make the query set analyzable, which is
where the cost limits become enforceable rather than best-effort.

## Pagination is part of the contract

GraphQL's cursor-connections pattern gives a stable page token and a documented end of
list. Offset pagination built on top of a list field is the same trap as in REST: rows
shift under concurrent writes, and a client paging through a live collection sees
duplicates and skips.

## Failure modes

Creating one DataLoader at module scope, which caches across requests and users. Batching
only the obvious relationship and leaving the nested one unbatched. Turning on depth
limiting with a high number and calling the API protected. Running arbitrary client
documents in production with no allow-list. And resolving a list field with no page size
limit while the cost analyzer counts fields rather than rows.
