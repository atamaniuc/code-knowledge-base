---
slug: long-context-versus-retrieval
title: Long context versus retrieval
lang: en
domain: agentic
topic: architecture
tech:
  name: LLM context
  version_range: ">=2024"
levels: [middle, senior, staff]
summary: >-
  A million-token window does not make retrieval obsolete. Capacity and reliable
  use are different properties, and cost, latency and attention all degrade with
  length. The decision is about which failure you can tolerate, not which number
  is bigger.
prerequisites: [evaluating-rag]
related: [evaluating-rag, llm-cost-and-latency]
sources:
  - title: "Lost in the Middle: How Language Models Use Long Contexts"
    url: https://arxiv.org/abs/2307.03172
    kind: paper
  - title: "RAGAS: Automated Evaluation of Retrieval Augmented Generation"
    url: https://arxiv.org/abs/2309.15217
    kind: paper
review_status: draft
---

## The claim being tested

"Context windows keep growing, so RAG is a workaround that will disappear." It is a
reasonable-sounding argument and it is the setup for the question. What is being probed is
whether a candidate distinguishes what a system *can* hold from what it *reliably uses*.

## Capacity is not use

A model accepting a document does not mean it uses every part of it equally. Accuracy on
retrieving a fact drops when the fact sits in the middle of a long context, and is highest
at the beginning and the end. Filling a window uniformly therefore lowers the odds that the
relevant part lands where attention is strongest.

This is why "we gave it everything and quality dropped" is a routine result rather than a
contradiction. Retrieval is not only about fitting; it is about placement, and a retriever
that returns three chunks is also a ranker that decides what gets the good positions.

## Cost and latency do not forgive length

Every token in the window is paid for on every call. A conversation that stuffs a large
corpus into each turn multiplies that by the number of turns, and unlike a vector index the
cost recurs rather than amortising.

Latency follows: prefill grows with input length, so time to first token rises with the
window even when the answer is short. For an interactive product this is often the binding
constraint before quality is.

## Where long context genuinely wins

It is not a workaround with no proper use.

**When the whole document is genuinely needed.** Summarising a contract, finding
inconsistencies across a codebase, anything where the answer depends on the relationship
between distant parts rather than on locating one passage. Chunking actively destroys the
signal here.

**When the corpus is small and stable.** Below some size, an index is infrastructure you
maintain for no benefit. Send the whole thing and delete the retriever.

**As a first version.** Long context gets a feature working in a day so you can find out
whether anyone wants it; retrieval is what you build once the corpus outgrows the window.
Building the index first is a common way to spend a month on a feature nobody uses.

## Where retrieval still wins

Corpora that exceed any window. Content that changes between calls, where an index updates
and a prompt does not. Cost at scale. Auditability, since a retrieved chunk is a citable
provenance record and "it was somewhere in the 900k tokens" is not. And access control,
which is the one people forget: a retriever can filter by permission before the model sees
anything, while a stuffed context has already leaked.

## The answer that scores

Refuse the framing that one replaces the other, and give the deciding factors: corpus size
relative to the window, update frequency, cost per call multiplied by call volume, whether
the task needs whole-document reasoning or passage location, and whether per-user access
control is required.

A staff answer adds the hybrid that is common in practice: retrieve generously into a large
window, then rerank or compress so the strongest material occupies the positions the model
actually attends to. That uses the capacity without pretending placement is free.
