---
slug: rag-long-context-fine-tuning
title: RAG, long context and fine-tuning in 2026
lang: en
domain: agentic
topic: architecture
tech:
  name: LLM systems
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Retrieval, a long window and fine-tuning are not three ways to do the same thing.
  Retrieval supplies facts that change, a long window supplies capacity within one call,
  and fine-tuning changes behaviour. Choosing between them is a question about which
  failure and which cost you can live with.
prerequisites: [long-context-versus-retrieval, evaluating-rag]
related: [evaluating-rag, long-context-versus-retrieval, llm-cost-and-latency]
sources:
  - title: "RAGAS: Automated Evaluation of Retrieval Augmented Generation"
    url: https://arxiv.org/abs/2309.15217
    kind: paper
  - title: "Lost in the Middle: How Language Models Use Long Contexts"
    url: https://arxiv.org/abs/2307.03172
    kind: paper
  - title: "LoRA: Low-Rank Adaptation of Large Language Models"
    url: https://arxiv.org/abs/2106.09685
    kind: paper
review_status: draft
---

## Three tools with three different jobs

The interview trap is treating these as substitutes. They are not, and the correct first
move is to separate the two things a system needs: knowledge and behaviour.

Knowledge is what the model must know — the current price list, this customer's contract,
last night's figures. Behaviour is how it must act — output format, tone, the shape of a
tool call, a narrow classification scheme. Retrieval addresses knowledge freshness and
provenance. Fine-tuning addresses behaviour consistency and cost per call. Long context
addresses how much a single call can consider. Only the first two are real strategies;
the third is a parameter.

## What retrieval is actually for

Retrieval exists because knowledge changes faster than models and because a citation is a
product requirement. A grounded answer can point at the document it used, be re-verified,
and be corrected by updating one record rather than retraining anything.

What makes retrieval work in practice is the boring half: chunking that respects structure,
hybrid search over keywords and vectors, a reranker, and evaluation split into retrieval
metrics and generation metrics so that a miss is attributed to the right component. RAGAS
made that split routine. The expensive failure is a team that measures only the final
answer and cannot tell whether the retriever or the generator is at fault — those are
opposite fixes.

## What long context actually buys

Capacity and reliable use are different properties. A million-token window means the input
is accepted; it does not mean the middle of it is attended to. The Lost in the Middle
result is that models retrieve information at the start and end of a long input far more
reliably than in the middle, and quality degrades as length grows. Cost and latency also
grow with input length, mitigated but not erased by prompt caching of a stable prefix.

So long context genuinely wins when the material is small enough to fit, when a single
reasoning pass must see everything at once — a whole contract, a whole file, a diff — and
when an extra retrieval round trip is the thing that hurts. It loses when the corpus is
large, when freshness matters, when you need citations, and when the same window is paid
for on every call.

## What fine-tuning actually changes

Fine-tuning, and parameter-efficient variants such as LoRA, changes the model's
disposition rather than its knowledge. What it reliably buys: a consistent output format
without a schema fight, a specialised style or taxonomy, shorter prompts because the
instruction is baked in, and sometimes a smaller and cheaper model doing the work of a
larger one.

What it does not buy: fresh facts, a knowledge base, or correctness. A fine-tuned model
confabulates the same way and now does so in your house style. It also creates a
maintenance object — training data, a reproducible pipeline, evaluation against the base
model, and a re-run every time the base model moves. That recurring cost is why
fine-tuning wins on narrow, high-volume, stable tasks and loses as a first move on a
general assistant.

## The decision order

Start with the strongest general model and no retrieval, to establish a ceiling on the
task. Add retrieval when the answer depends on data the model cannot have, or when
citations are required. Add a long window when the task genuinely needs whole-document
reasoning that retrieval would fragment. Consider fine-tuning when a task is well
understood, high volume, and the prompt has become a shipping container of instructions
that the model still follows inconsistently — and only after a smaller prompted model has
been measured against it.

Each step is justified by an evaluation, not by an intuition. The staff answer is that
these are cumulative investments with different maintenance profiles, and that the
question is what you are willing to keep paying for.

## What a staff answer adds

A cost model per successful task across the options, including the retrieval round trip
and the fine-tuning maintenance. A freshness story: how a fact is corrected in each
design, and how quickly. And the failure mode you have chosen, stated plainly — retrieval
will sometimes miss, long context will sometimes ignore the middle, fine-tuning will
sometimes drift with the base model — because an architect who cannot name the accepted
failure has not made a decision.
