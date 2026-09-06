---
slug: llm-cost-and-latency
title: Cost and latency in LLM systems
lang: en
domain: agentic
topic: production
tech:
  name: LLM inference
  version_range: ">=2024"
levels: [middle, senior, staff]
summary: >-
  Cost and latency are both functions of tokens, but not the same function:
  latency is dominated by output tokens generated one at a time, while cost is
  dominated by whichever side of the exchange is larger. Optimising the wrong
  side is the common mistake.
prerequisites: []
related: [evaluating-rag]
sources:
  - title: "Efficient Memory Management for Large Language Model Serving with PagedAttention (vLLM)"
    url: https://arxiv.org/abs/2309.06180
    kind: paper
  - title: "Building effective agents"
    url: https://www.anthropic.com/engineering/building-effective-agents
    kind: article
review_status: draft
---

## The two are not the same problem

Input tokens are processed in parallel during prefill. Output tokens are produced one at a
time, each conditioned on the last. So a request with a huge prompt and a short answer is
cheap in latency and expensive in cost, while a short prompt with a long answer is the
reverse.

That asymmetry decides where optimisation effort goes, and it is the thing most candidates
have not internalised. "We will shorten the prompt to make it faster" is usually wrong:
prompt length moves cost and time-to-first-token, not the generation phase that dominates
wall-clock for a long answer.

Two metrics, not one. **Time to first token** is what a user experiences as
responsiveness, and streaming addresses it without making anything actually faster.
**Total time** is what a batch job cares about, and streaming does nothing for it.

## Prompt caching

When many requests share a long prefix — a system prompt, a tool schema, a document being
asked about repeatedly — the provider can reuse the computed state for that prefix instead
of recomputing it.

Two consequences shape design. The cache is prefix-based, so **stable content goes first**
and variable content last; putting a timestamp at the top of a prompt invalidates
everything after it. And caching changes the economics of long system prompts: the case
for aggressively trimming a stable prompt weakens when it is cached, while the case for
trimming per-request content does not.

Specific discounts and lifetimes are vendor- and version-dependent, and quoting numbers
from memory in an interview is a way to be confidently wrong. Naming the mechanism and its
prefix constraint is what is being tested.

## Routing

Not every call needs the strongest model. A classifier deciding which of five intents a
message has, a formatting pass, an extraction against a fixed schema — these run acceptably
on a small model at a fraction of the cost and latency.

The engineering content of routing is not the idea, it is the failure handling: how the
router decides, what happens on a low-confidence route, and whether an escalation path to
the larger model exists. A router with no escalation is a quality regression waiting for
its first unusual input.

Cascading is the version that survives contact with production: try the cheap model, check
the result against a cheap verifier, escalate only on failure. It works precisely when
verification is cheaper than generation, which is the same condition that makes evaluation
tractable at all.

## Batching and concurrency

Throughput and latency trade against each other. Serving batches many requests together
because the arithmetic is more efficient at scale, which raises throughput per unit cost
and raises the latency of any individual request in the batch.

For an interactive product that trade is usually wrong. For a nightly job over a hundred
thousand documents it is free money, and providers expose asynchronous batch modes at a
discount for exactly this shape.

## Reducing tokens without reducing quality

Retrieval instead of stuffing: send the three relevant chunks rather than the document.
This is a cost decision as much as a quality one, and it interacts with the position effect
— more context is worse on both axes past a point.

Structured output instead of prose: a JSON object with four fields costs a fraction of a
paragraph that says the same thing, and it does not need parsing afterwards.

Bounded generation: a maximum output length that reflects the task. Unbounded generation
on a task with a short right answer pays for tokens nobody reads.

## What a staff answer adds

Measurement before optimisation. Token counts per request path, split input and output,
attributed to features rather than aggregated — otherwise the team optimises whatever is
easiest to see rather than whatever is expensive.

And a budget expressed as a product constraint rather than a technical one: what this
feature is allowed to cost per user per month, decided before the architecture, because it
is the number that decides whether an agentic loop is affordable at all.
