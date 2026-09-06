---
slug: agent-loop-design
title: Designing an agent loop
lang: en
domain: agentic
topic: architecture
tech:
  name: LLM agents
  version_range: ">=2024"
levels: [middle, senior, staff]
summary: >-
  An agent is a loop that calls tools until it decides to stop. Almost every
  production failure is a stop-condition failure or a missing verification step,
  not a reasoning failure, and the interview question is really about control.
prerequisites: []
related: [prompt-injection, llm-cost-and-latency]
sources:
  - title: "Building effective agents"
    url: https://www.anthropic.com/engineering/building-effective-agents
    kind: article
  - title: "ReAct: Synergizing Reasoning and Acting in Language Models"
    url: https://arxiv.org/abs/2210.03629
    kind: paper
review_status: draft
---

## The shape

Model receives a goal and a set of tools. It emits a tool call, the runtime executes it and
returns the result, the model sees the result and decides what to do next. Repeat until it
declares completion or a limit stops it.

Everything interesting is in that last clause.

## Workflow or agent

The first judgement is whether a loop is needed at all. When the steps are known in
advance, a fixed pipeline of model calls is cheaper, faster, debuggable and does not
surprise anyone. A loop earns its cost only when the sequence genuinely depends on what is
discovered along the way.

Candidates who reach for an agent by default are answering a fashion question rather than
an engineering one. The strong answer names the condition: unknown step count, branching
that depends on intermediate results, and a verifier that can tell whether the goal is met.
Missing that last one is disqualifying — a loop with no way to check success cannot know
when to stop.

## Stop conditions

A loop needs several, and production incidents come from having only the first.

**Success.** The model says it is done. On its own this is the weakest signal in the
system: models are poorly calibrated about their own completion, and a loop that trusts
self-report will stop on plausible-looking failure.

**Verified success.** A check outside the model confirms the goal state — tests pass, the
record exists, the file parses. This is what should end a loop wherever it is available.

**Budget.** Iteration count, wall clock, tokens spent, money spent. Enforced by the runtime
rather than requested in the prompt, because the prompt is the part the loop can talk its
way around.

**No progress.** The state after this iteration is materially the same as the state before
it. Two agents can loop politely forever, each waiting for the other to change something,
and only an explicit no-progress detector notices.

**Escalation.** A path out to a human or to a stronger model for cases the loop cannot
close. A loop with no exit ramp turns an unusual input into a spend incident.

## Tool design decides behaviour

Tool interfaces shape the loop more than the prompt does. Names that say what the tool does
rather than how it is implemented. Arguments enumerated rather than free text where the
options are known. Errors that state what to do next — "no record with that id, list ids
with search_records" produces recovery, while "404" produces retries of the same call.

Fewer tools with clear boundaries beat many overlapping ones. Every ambiguous pair is a
routing decision the model has to get right on every iteration.

## Observability

A loop without traces is undebuggable, because the interesting failure is a sequence rather
than a moment. What is needed per run: every tool call with arguments and result, the state
the model saw at each step, where the loop was cut off and by which condition.

The frequency distribution over stop conditions is the health metric. A rising share of
budget stops means the loop is failing to close and being cut off, and that is visible
before users complain.

## What a staff answer adds

Idempotency and recovery. An agent that acts on the world will be interrupted mid-sequence,
so actions need to be safe to repeat, and the loop needs to reconstruct where it was from
durable state rather than from conversation history.

And the blast-radius question, which is the same one prompt injection raises from the other
side: what is the worst a runaway loop can do before a limit stops it, and is that answer
acceptable.
