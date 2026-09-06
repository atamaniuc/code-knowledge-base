---
slug: evaluating-rag
title: Evaluating a RAG system
lang: en
domain: agentic
topic: evaluation
tech:
  name: RAG
  version_range: ">=2024"
levels: [middle, senior, staff]
summary: >-
  Retrieval and generation fail differently and have to be measured separately.
  A single end-to-end answer score cannot tell you whether the retriever missed
  the document or the model ignored it, which are opposite fixes.
prerequisites: []
related: []
sources:
  - title: "RAGAS: Automated Evaluation of Retrieval Augmented Generation"
    url: https://arxiv.org/abs/2309.15217
    kind: paper
  - title: "Lost in the Middle: How Language Models Use Long Contexts"
    url: https://arxiv.org/abs/2307.03172
    kind: paper
  - title: "BEIR: A Heterogeneous Benchmark for Zero-shot Evaluation of IR Models"
    url: https://arxiv.org/abs/2104.08663
    kind: paper
review_status: draft
---

## Why one score is not enough

A RAG pipeline has two independent failure modes. The retriever can fail to surface the
document that contains the answer. Or the retriever can surface it and the generator can
ignore it, contradict it, or pad around it.

A single end-to-end answer score conflates them, and the fixes point in opposite
directions: one is chunking, embeddings and reranking, the other is prompting, context
placement and model choice. Teams that measure only the final answer spend weeks tuning
the retriever for a generation problem.

The first question in an interview is usually some form of "how would you know it is
working". The answer that separates a middle candidate from a senior one is not naming a
metric, it is splitting the system before naming any.

## Retrieval metrics

Retrieval is classical information retrieval, and the metrics are the classical ones.

**Recall@k** — of the documents that genuinely contain the answer, what share appear in
the top k. This is the metric that matters most in RAG, because a document the generator
never sees cannot be used, no matter how good the model is. Recall@k is the ceiling on
everything downstream.

**MRR** — the reciprocal of the rank of the first relevant document, averaged over
queries. It captures how far down the list the useful thing sits. Relevant when the
context budget is tight and only the top few chunks survive.

**nDCG** — discounted gain, which credits placing more relevant documents higher. Useful
when relevance is graded rather than binary; overkill when a chunk either contains the
answer or does not.

**Precision@k** matters less than intuition suggests. Extra irrelevant chunks cost context
budget and can distract, but they do not make the answer unreachable. Recall failures do.

Measuring any of these requires a labelled set: queries paired with the chunks that must
appear. Building it is the actual work, and it is the step teams skip.

## Generation metrics

**Faithfulness (groundedness)** — is every claim in the answer supported by the retrieved
context. This is the metric that detects the dangerous failure, where the model answers
from parametric memory and sounds exactly as confident as when it is quoting a document.

**Answer relevance** — does the answer address the question that was asked, independent of
whether it is true.

**Context relevance** — how much of the retrieved context was actually useful. Low values
mean the retriever is padding, which wastes budget and increases distraction.

The RAGAS framing is that these can be estimated by an LLM judge without human reference
answers, which is what makes continuous evaluation affordable. That is also its weakness:
judge scores are noisy, and a judge sharing a family with the generator shares its blind
spots.

## Position effects

Retrieval quality is not the only thing that decides whether a document gets used.
Accuracy degrades when the relevant passage sits in the middle of a long context and is
highest when it appears at the beginning or the end. A pipeline can retrieve the right
chunk, place it at position twelve of twenty, and still answer wrong.

This is why "we increased top-k and quality dropped" is a real and common result rather
than a paradox: more context lowered the odds that the useful part landed where the model
attends.

## What good looks like in practice

A golden set of queries with labelled required chunks, run on every change to chunking,
embeddings, or the retriever. Recall@k tracked as the ceiling. Faithfulness tracked
separately so a generation regression is not read as a retrieval one.

Offline metrics anchored to something real: a sample of production queries reviewed
periodically, because a golden set built once drifts away from what users actually ask.

And a rule about what a failure means. If recall@k is high and faithfulness is low, the
retriever is fine and the prompt or the model is not. If recall@k is low, nothing
downstream is worth tuning yet.
