---
slug: agent-skills
title: Agent skills and the context budget
lang: en
domain: agentic
topic: context-engineering
tech:
  name: Agent Skills
  version_range: ">=2025"
levels: [senior, staff]
summary: >-
  A skill packages procedure — instructions, and the files they need — so the model loads it
  only when it is relevant. It is the answer to the context problem that a growing system
  prompt creates, and it fails in the same way documentation fails: written once, never
  evaluated.
prerequisites: [agent-loop-design]
related: [mcp-tool-integration]
sources:
  - title: "Equipping agents for the real world with Agent Skills"
    url: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
    kind: article
review_status: draft
---

## A skill is packaged procedure

A skill is a directory with a manifest — a name and a description — plus the instructions and
supporting files for one kind of task: how to write the release notes, how to run the
incident review, how to add a database migration in this repository. The agent loads it when
the task matches, the same way a person opens the runbook for the system in front of them.

The unit is deliberately not a tool. A tool is a capability the agent can call; a skill is
knowledge about how work is done here, which is exactly the knowledge that otherwise
accumulates in a system prompt until nobody can edit it safely.

## Progressive disclosure

This is the mechanism that makes skills scale, and it is the part to get right.

- At startup the agent sees only the metadata: names and one-line descriptions.
- When a task matches, it loads the skill body — the procedure.
- Files the procedure references are loaded only if the procedure asks for them.

So a hundred skills cost roughly the tokens of a hundred one-line descriptions, and the
expensive text is paid for only when it is used. Written the other way — everything loaded
always — the context window fills with instructions for tasks not being performed, and
attention degrades for the task that is.

The corollary for authors: the description is the routing interface. A vague description
means the skill either never loads or loads for the wrong task, and no amount of detail
inside the body repairs that.

## MCP is connectivity; a skill is expertise

The two compose and are routinely confused. MCP answers "what can the agent reach" — a
database, a ticket tracker, a browser. A skill answers "what does this team consider a
correct way to use it". An MCP server for the payments API plus a skill that says how
refunds are approved here is a working system; either one alone is half of it.

## What belongs in a skill

Explicit procedure and house rules, things that are true for this repository or organisation
and cannot be inferred from the code: ordering constraints, the checks that must run before a
change is proposed, the names of things. Reference material goes in a file the body points
at, not in the body.

What does not belong: facts that change weekly with no owner, general knowledge the model
already has, and a restatement of the tool schema. Every one of those is context rent paid on
every task that loads the skill.

## Evaluation

A skill is a prompt with a long life, so it is evaluated like one: a set of tasks with known
good outcomes, run with and without the skill, and a check that the skill did not make any of
them worse. The failure mode is silent, because a skill that is merely mediocre produces
plausible work and no signal.

Track which skills load and which are dead. An unloaded skill is dead weight plus a
maintenance promise; deleting it is usually the improvement.

## Failure modes

One giant skill that is really a system prompt with a filename. Descriptions written for
humans rather than for routing. Skills that duplicate each other with slightly different
rules, so behaviour depends on load order. Bundling scripts that run with the agent's
credentials and are never reviewed. And no owner: skills drift the moment the procedure they
describe changes and nobody notices.
