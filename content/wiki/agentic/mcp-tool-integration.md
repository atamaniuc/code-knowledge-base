---
slug: mcp-tool-integration
title: MCP — one protocol for tool integration
lang: en
domain: agentic
topic: integration
tech:
  name: Model Context Protocol
  version_range: ">=2025-06"
levels: [senior, staff]
summary: >-
  MCP replaces a bespoke integration per tool with one client protocol per server. The win
  is combinatorial, the cost is a new trust boundary, and the interview answer is mostly
  about which of the two you are looking at.
prerequisites: []
related: [agent-skills, agent-loop-design]
sources:
  - title: "Model Context Protocol — specification 2025-06-18"
    url: https://modelcontextprotocol.io/specification/2025-06-18
    kind: spec
  - title: "Model Context Protocol — architecture"
    url: https://modelcontextprotocol.io/docs/concepts/architecture
    kind: official-docs
review_status: draft
---

## What the protocol standardises

MCP is a JSON-RPC protocol between an AI application and a capability provider. Before it,
connecting N tools to M agents cost N times M integrations, each with its own auth story,
its own schema conventions and its own failure modes. MCP makes it N plus M: a server
describes what it can do at runtime, and any host that speaks the protocol can use it
without being written for it.

The important consequence is discovery. Tools are not compiled into the agent; they are
negotiated at connection time, so a capability can be added to an environment without
shipping a new agent build.

## Host, client, server

- **Host** — the application the user talks to. It owns the model, the conversation and the
  permission decisions.
- **Client** — the connector inside the host, one per server, holding that connection's
  state and routing messages.
- **Server** — a process (or remote service) exposing tools, resources and prompts.

Splitting client from host matters in practice: it isolates one server's failures, and it is
the seam where the host applies per-server policy.

Transports are stdio for a local process and Streamable HTTP for a remote one. The transport
changes the deployment and the trust model, not the message shapes.

## What a server exposes

- **Tools** — callable functions with a JSON Schema for arguments. This is where the agent
  acts on the world, and therefore where the risk is.
- **Resources** — addressable read-only context (a file, a row, a document) that the host
  can pull in rather than having the model call a function to fetch.
- **Prompts** — server-authored templates the user can invoke, which is how a capability
  ships its own opinion about how to be used.

There are also client-side primitives — sampling and elicitation — where the server asks the
host to run a model or ask the user. Those invert the trust direction and deserve an explicit
decision rather than arriving by default.

## Why this beats bespoke integrations

One implementation per capability, reusable across every host; runtime discovery instead of
release coupling; a single place to declare authentication; and a schema the host can show a
user before anything runs. The failure of the alternative is not that bespoke tools do not
work, it is that the tenth one is written by copy-pasting the ninth.

## Versions and capability negotiation

The spec is versioned by date rather than by semantic version, and both sides declare
capabilities during initialization; a server that does not support a feature must be usable
without it. When you write a server, treat the negotiated capability set as the contract.
Announcing a capability you degrade quietly is how a client ends up calling something that
half works.

## Security: the tool list is the blast radius

An MCP server is a new trust boundary, and the threatening model is not the protocol, it is
the content. A tool description that arrives from a remote server is untrusted text that the
model will read — tool poisoning and indirect prompt injection both live there. Practical
rules:

- Treat a third-party server as untrusted code with the credentials you gave it. Scope tokens
  per server and per user; never forward a token through to a downstream API.
- Destructive and money-moving tools require human confirmation, and the confirmation shows
  the arguments rather than a summary written by the model.
- The agent's effective permission is the union of every connected server, so connect fewer
  servers rather than trusting more of them.

## When MCP is the wrong answer

For one tool used by one agent in one repository, a local function is cheaper and has no
trust boundary. MCP earns its overhead when capabilities are shared across hosts, when they
must be added without redeploying the agent, or when a third party should be able to bring
its own server. Reaching for a protocol to solve a one-off is architecture as fashion.
