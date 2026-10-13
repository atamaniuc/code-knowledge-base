---
slug: multi-agent-orchestration
title: Multi-agent orchestration versus one agent with more tools
lang: en
domain: agentic
topic: architecture
tech:
  name: LLM agents
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Splitting one agent into several is an architectural decision with a cost curve, not a
  capability upgrade. The default hypothesis should be a single agent with more tools;
  a multi-agent design has to name the constraint that forces the split and the
  coordination failure it accepts in exchange.
prerequisites: [agent-loop-design]
related: [agent-skills, mcp-trust-boundary, llm-cost-and-latency]
sources:
  - title: "Anthropic — Building effective agents"
    url: https://www.anthropic.com/engineering/building-effective-agents
    kind: article
  - title: "Model Context Protocol — specification 2026-07-28"
    url: https://modelcontextprotocol.io/specification/2026-07-28
    kind: spec
review_status: draft
---

## The default hypothesis

One agent with more tools is the null hypothesis, and the burden of proof is on the split.
A single loop keeps one context, one budget and one trace, and everything that goes wrong
is visible in one sequence. Multi-agent systems buy specialisation and isolation, and the
price is paid in three currencies: tokens, latency and debuggability.

Anthropic's guidance draws the line at workflows versus agents — a workflow is a
predefined code path and an agent directs its own process — and warns that the most
successful implementations use simple composable patterns. The same instinct applies one
level up: the successful multi-agent designs are usually a fixed topology, not emergent
swarms.

## What the split actually costs

Context fragmentation. Each agent sees a slice of the task, so no single agent holds the
whole picture and mistakes made at a boundary are invisible to both sides. Handing work to
a subagent is lossy compression in both directions: the brief and the report.

Coordination tokens. Agents talk, and the talk is billed. A three-agent system that
narrates its progress can spend more on coordination than on the task.

Non-determinism squared. If one agent is a distribution over trajectories, several
interacting agents are a much wider one, which makes evaluation harder every time a
subagent is added. A regression suite that scored an answer now has to score a
conversation between processes.

Error propagation with no owner. A wrong assumption handed from orchestrator to worker
comes back as a confident, well-formatted, wrong result, and the worker did everything
right.

## When multiple agents earn it

Four conditions justify the cost, and a strong answer names at least two with the
constraint attached.

Genuinely parallel independent subtasks. If ten documents must each be read and summarised
and the results only combine at the end, concurrency is the reason and the wall clock
improvement is measurable.

Context that must not pollute. A specialist agent loads a large, noisy corpus and returns
a short conclusion; keeping that corpus out of the orchestrator's context is the point.
This is progressive disclosure applied at the process boundary.

Security and credential isolation. A subagent that can touch production runs with a
different identity and a different tool set, so the blast radius of a bad instruction does
not include the whole system.

Work that outlives one context or one budget. A long migration or a research task that
runs for days is better modelled as durable units with a supervisor than as one enormous
loop.

## Coordination patterns and how they fail

The orchestrator-worker pattern is the workhorse: one lead decomposes, dispatches, and
reconciles. It fails by delegation without a contract — the worker returns prose the
orchestrator cannot verify. Fix it by giving every delegated unit an explicit output shape
and a verifier.

The handoff pattern passes an entire conversation to a specialist and back. It fails by
losing the reason the task exists; the receiving agent inherits history but not intent.

A shared blackboard — agents reading and writing a common state store — is the most
flexible and the hardest to debug, because the causal chain is spread across writers. It
fails with polite loops: two agents waiting for the other to change something.

Across all of them, the recurring failure is unbounded conversation. Every multi-agent
design needs the same budgets a single agent needs, applied per agent and to the system as
a whole.

## What a staff answer adds

A measurement before the architecture. Trajectory evaluation — did the system reach the
verified goal, at what token and latency cost, and where did it go wrong — is what turns
the multi-agent question from taste into engineering. If the single-agent baseline hits
the same success rate at half the cost, the debate is over.

Ownership of the seams. Whoever designs the boundary owns the contract at that boundary:
the output schema, the retry policy, the timeout, and the idempotency of any side effect
the subagent performs. A subagent that sends email must be as safe to re-run as any other
worker.

And a preference for the smallest interesting split. Two agents with a clear contract beat
five with a choreography, and a fixed pipeline with one model call where the steps are
known beats both.
