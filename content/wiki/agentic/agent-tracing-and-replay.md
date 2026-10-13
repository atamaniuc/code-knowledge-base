---
slug: agent-tracing-and-replay
title: Tracing and replaying an agent run
lang: en
domain: agentic
topic: operations
tech:
  name: OpenTelemetry
  version_range: ">=1.9"
levels: [senior, staff]
summary: >-
  An agent failure is a sequence, not a moment, so the unit of debugging is the run.
  A trace that records every model and tool step makes the sequence reviewable, and a
  replay that reconstructs the run from recorded inputs is what turns a one-off bug into
  a test case.
prerequisites: [agent-loop-design]
related: [evaluating-rag, llm-as-judge, llm-cost-and-latency]
sources:
  - title: "OpenTelemetry — Generative AI semantic conventions"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/
    kind: official-docs
  - title: "OpenTelemetry — GenAI semantic conventions for MCP"
    url: https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp/
    kind: official-docs
  - title: "OpenTelemetry semantic conventions for generative AI (repository)"
    url: https://github.com/open-telemetry/semantic-conventions-genai
    kind: official-docs
review_status: draft
---

## What a trace has to contain

An agent produces a run: a goal, a sequence of model calls, a set of tool calls with
arguments and results, and a stopping point. A log line per request cannot reconstruct
that, because the interesting failure is the step where the model saw a result and drew
the wrong conclusion. The trace has to be a tree whose nodes are the steps.

At minimum, per run: the initial goal and the exact system prompt; each model call with
its model id, decoding parameters and the context it received; each tool call with its
name, arguments and the full result, including errors; the token counts and wall clock of
each step; and the stop reason — which condition ended the run. That last field is the one
teams forget and the one that answers the first question of every incident review.

## The span tree of a run

OpenTelemetry is the neutral format, and the GenAI semantic conventions have moved into
their own repository as the working home for model, tool and agent spans. The shape to aim
for is a parent span for the run, a child span per model call, and a child span per tool
call, with the tool span carrying the arguments and result and the model span carrying
token usage. MCP has its own conventions, so a client can emit spans for server calls that
line up with the rest of the system.

The payoff is not dashboards. It is that a trace id is the join key between the agent, the
tool that actually changed something, and the user who asked for it — the three things an
incident needs at once.

## Replay means recording the inputs, not the answer

A trace lets you read a run. A replay lets you re-run it. These are different products,
and conflating them is the common mistake: recording the final answer is not replay, and
neither is replaying the conversation from the transcript alone.

To replay, record the inputs that a step consumed and make them injectable at the
boundary: the exact prompt, the model id and parameters, and every tool result as it was
returned. Then a replay harness can substitute recorded results for live calls and step
the loop deterministically, which converts a production failure into a regression test
that runs in CI.

## Why replay is never exact

Honesty about the limits is what separates a real answer from a demo. A model call is not
deterministic even at low temperature; providers deprecate model versions; a tool result
depends on the world, which has moved on. So a faithful replay is a controlled
approximation: fixed inputs, pinned model version, recorded tool outputs, and a set of
assertions about the trajectory rather than a byte-for-byte comparison.

The practical consequences are that model ids and prompts are versioned artifacts, that
tool results are stored with the run rather than re-fetched, and that the replay suite
asserts on properties — the goal was reached, no forbidden tool was called, the number of
steps stayed under the budget — instead of on exact text.

## Evaluating a trajectory, not an answer

Once runs are recorded, evaluation can grade the path. Answer-only evaluation cannot
distinguish an efficient run from one that took eleven wrong turns and arrived by luck,
and it cannot tell a reward-hacked shortcut from a solution.

Trajectory evaluation grades the steps against the rules of the task: were the required
checks performed, was the destructive tool confirmed, did the loop recover from an error.
An LLM judge can score the qualitative part, and it should be calibrated against a human
labelled sample, because a judge that is never checked drifts. The outcome metric and the
process metric are both needed: outcome says whether the system works, process says
whether it will keep working.

## Retention and privacy

Traces contain prompts, retrieved documents, tool arguments and tool results — which is to
say they contain customer data and, very often, credentials that were passed as arguments.
The run store is therefore a regulated data store, not an observability afterthought:
retention limits by policy, redaction at the point of recording, access control, and a
decision about what may be stored at all. A team that ships agent traces to a third-party
backend by default has made a data-processing decision by accident.

## What a staff answer adds

Replay as a first-class capability rather than a debugging hack, with the versioned
prompts and pinned models it requires. The stop-reason distribution as a monitored health
metric, so a rising share of budget terminations is noticed before users are affected.
Trajectory evaluation wired into the same CI pipeline as the code, so a prompt change has
a measurable verdict. And a stated retention policy for the run store, because the traces
are the most sensitive corpus the team now owns.
