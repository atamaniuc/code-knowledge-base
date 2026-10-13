---
slug: harness-context-engineering
title: The harness vocabulary an AI-heavy interview now uses
lang: en
domain: agentic
topic: context-engineering
tech:
  name: Agent harness
  version_range: ">=2025"
levels: [middle, senior, staff]
summary: >-
  Context engineering is the discipline of deciding what the model sees, and the harness
  is the thing that makes those decisions. The vocabulary — window, budget, compaction,
  progressive disclosure, skill, subagent — is how a 2026 interview tests whether you
  have operated a system or only used one.
prerequisites: [agent-loop-design, agent-skills]
related: [agent-skills, mcp-trust-boundary, agent-tracing-and-replay]
sources:
  - title: "Anthropic — Equipping agents for the real world with Agent Skills"
    url: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
    kind: article
  - title: "Anthropic — Building effective agents"
    url: https://www.anthropic.com/engineering/building-effective-agents
    kind: article
  - title: "Lost in the Middle: How Language Models Use Long Contexts"
    url: https://arxiv.org/abs/2307.03172
    kind: paper
review_status: draft
---

## Why the harness is the subject

The model is an API that turns a token sequence into tokens. Everything else — the loop,
the tools, the retrieval, the memory, the stop conditions — is the harness, and the
harness is what an engineering team actually owns and changes. Interviews moved here
because model choice is increasingly not the differentiator, and because the vocabulary
is a fast way to find out whether a candidate has run a system in production.

Answering a harness question with prompt-writing advice is the failure mode. The harness
question is about budgets, information flow and control, not about adjectives.

## The vocabulary, plainly

Context window: the maximum tokens a single model call can attend to. A property of the
model, and a hard boundary, not a soft one.

Context budget: how much of that window a component may consume. A system prompt, a set of
tool schemas, retrieved documents, conversation history and the current task all draw on
the same budget, and a budget is a design decision.

Token accounting: what each component costs in tokens, measured rather than estimated.
Without it, cost work is guesswork.

Compaction: replacing older history with a summary so the loop can continue past the
window. It is lossy, and the loss is exactly the details that turn out to matter, so what
is compacted and what is preserved must be deliberate.

Progressive disclosure: loading detail only when it is relevant — a skill's one-line
description first, its body on demand, its reference files after that. It is the
mechanism that keeps a growing capability set from consuming the window before the task
starts.

Skill: a directory of instructions and resources with a short metadata header, loaded
when the task calls for it. Packaged procedure, not connectivity.

Subagent: a separate context that takes a brief and returns a result. Its purpose is
context isolation: the messy work happens elsewhere and only the conclusion enters the
parent.

Scaffold: the accumulated engineering around a model — retries, parsers, validators,
state machines — that turns a probabilistic component into a dependable system.

## Context is a budget, not a bucket

A larger window does not remove the problem. Accuracy degrades with length and is worst
for information in the middle of a long input, so stuffing more in lowers quality while
raising cost and latency. Prompt caching rewards a stable prefix and punishes churn, which
means the order of context components is an engineering decision: put the stable system
prompt and tool schemas first, the volatile retrieved content after.

The practical rule is that every component must justify its tokens against a measured
change in outcome. An interviewer listening for this wants to hear that the budget is
spent, not merely mentioned.

## Progressive disclosure

The skill format is the clearest example: a short name and description are always loaded,
the instructions load when the skill is selected, and bundled files load only when a step
needs them. MCP resources play a similar role on the connectivity side — the host decides
what to pull into context rather than dumping everything a server can offer.

The failure mode is a skill that is a second system prompt. If the description does not
let the model decide when to load it, and if the body is always loaded, progressive
disclosure has been implemented as a folder structure rather than as a budget mechanism.

## Compaction and durable state

Long-running work will exceed any window, so compaction is unavoidable. Two decisions
matter. What is summarised: decisions taken, constraints discovered, the current plan —
not the raw transcript. And where the truth lives: durable state outside the conversation,
in a task list or a database, because the conversation is a cache and caches get evicted.

A loop that reconstructs where it was from a durable plan can resume after compaction or a
restart. A loop that trusts its memory of the conversation cannot.

## Where a skill belongs

Three homes for instruction, and choosing between them is a design skill. The system
prompt carries what every request needs and what must not vary: identity, hard
constraints, safety rules. A tool schema carries what the model must know to call one
capability correctly. A skill carries procedure that applies sometimes — the steps for a
specific kind of task, with its reference material.

Anything in the system prompt that is only sometimes relevant is a tax on every request,
and anything that must always hold must not depend on the model choosing to load it.

## What a staff answer adds

Evaluation of the harness itself. A new skill, a compaction change, a reordered context
are all changes whose effect must be measured on a task suite, or the team is tuning by
vibe. Trajectory evaluation on a labelled set is the instrument.

Cost per successful task rather than cost per call, because a cheaper model that takes
four times as many steps is not cheaper. And a written answer to what happens when the
window is exhausted mid-task: which state survives, which context is rebuilt, and how the
user is told.
