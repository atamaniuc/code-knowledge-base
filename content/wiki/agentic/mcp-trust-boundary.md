---
slug: mcp-trust-boundary
title: "MCP and the trust boundary a connected server creates"
lang: en
domain: agentic
topic: integration
tech:
  name: Model Context Protocol
  version_range: ">=2026-07"
levels: [senior, staff]
summary: >-
  The 2026-07-28 revision made MCP stateless: no handshake, no session id, every request
  carrying its own version and capabilities. That removes a class of failure and changes
  nothing about the real question, which is that a connected server is untrusted code
  holding a credential.
prerequisites: [mcp-tool-integration]
related: [mcp-tool-integration, prompt-injection, agent-loop-design]
sources:
  - title: "Model Context Protocol — specification 2026-07-28"
    url: https://modelcontextprotocol.io/specification/2026-07-28
    kind: spec
  - title: "MCP — Key changes in 2026-07-28"
    url: https://modelcontextprotocol.io/specification/2026-07-28/changelog
    kind: spec
  - title: "MCP — Streamable HTTP transport"
    url: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
    kind: spec
  - title: "MCP — Authorization"
    url: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
    kind: spec
  - title: "MCP — Security best practices"
    url: https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices
    kind: spec
review_status: draft
---

## The revision that matters

Specification 2026-07-28 is the current revision; 2025-06-18 and 2025-11-25 are previous
ones. The change that reshaped implementations is that MCP became stateless. The
initialize handshake is gone, the Mcp-Session-Id header is gone, and protocol-level
sessions are gone. Every request now carries its own protocol version and client
capabilities in the io.modelcontextprotocol metadata fields, and a server that cannot
serve that version answers with a version error rather than negotiating a connection.

There is a new server/discover call a client may make first, to learn which versions and
capabilities a server supports, and server-to-client interactions such as sampling,
elicitation and roots are now embedded in results rather than pushed on a stream. Long
lived change notifications moved to a subscriptions/listen request.

An interviewer asking about MCP in late 2026 expects this vocabulary. Answering with
handshake-and-session language is answering a question from two revisions ago.

## What a server exposes

Three features, and the distinction is about who decides to use them.

Tools are model-controlled functions: the model discovers them from tools/list and calls
them. Resources are application-driven context, addressed by URI, and the host decides how
to surface them. Prompts are user-controlled templates, typically exposed as commands. A
server declares which capabilities it supports, and a client must not call into a feature
that was not declared.

Two details are worth quoting because they are the kind of thing that separates a recent
answer from a recalled one. The list endpoints must not vary per connection — the same
client asking twice sees the same set — but they may vary by the authorization presented
on the request, so a server can hide tools the caller's scopes do not permit. And servers
should return tools in a deterministic order, explicitly so that clients can cache the
list and prompt caches keep hitting.

## Transports

Two standard bindings, both carrying the same JSON-RPC 2.0 messages. stdio runs over the
standard streams of a subprocess the client launches, newline-delimited. Streamable HTTP
puts the server behind a single endpoint that accepts POST: each request or notification
is its own HTTP request, answered with one JSON object or with a request-scoped SSE stream
carrying notifications and then the response.

The 2026-07-28 revision removed the GET stream endpoint and protocol-level sessions from
Streamable HTTP. If a server needs state across calls, it mints an explicit handle and
passes it as an ordinary tool argument — state is now something the application chooses to
create, not something the transport quietly maintains.

Streamable HTTP also has two hard security requirements worth remembering: validate the
Origin header and reject invalid ones, because otherwise DNS rebinding reaches a locally
running server, and when running locally, bind to loopback rather than every interface.

## The trust boundary

This is what the interview is really about. Connecting a server does not add a library; it
adds a process, a credential and a stream of text the model will read.

A server's tool names, descriptions and schemas are untrusted content. They are injected
into the model's context, which means a malicious or compromised server can carry
instructions in a tool description and have the model act on them. That is indirect prompt
injection with the protocol as the delivery mechanism.

The second boundary is the credential. A server that acts with a broad token makes every
bug or compromise in that server equally broad. The specification's security guidance
names the confused deputy problem directly: a proxy server holding one static client id
for all callers can be tricked into obtaining authorization codes without the user's
consent. The mitigation is per-user, per-server, narrowly scoped tokens and no passing of
a client's token through to a downstream API.

The third boundary is the human. The specification recommends a human in the loop with the
ability to deny a tool invocation, and applications should show which tools are exposed
and visibly indicate when one is invoked. A confirmation dialog is only meaningful if it
shows the real arguments rather than a model-written summary of them.

## Authorization

Authorization is optional in the protocol and defined for HTTP transports: the MCP server
is an OAuth 2.1 resource server, the client is an OAuth client, and discovery uses
Protected Resource Metadata and Authorization Server Metadata. Resource indicators exist
precisely so that a token is audienced to one MCP server rather than accepted anywhere.

stdio is the opposite case: the specification says implementations should not follow the
authorization flow there and should take credentials from the environment instead. That is
not a loophole, it is a statement about who the trust boundary belongs to — a process the
host launched inherits the host's environment.

## What a staff answer adds

Least privilege applied per server rather than per deployment, and a written inventory of
which servers an agent may reach and why. Treating a newly connected server as a new
supplier with a security review, a pinned version and a way to revoke it. Logging every
tool call with its arguments and result so that a poisoned description that produced an
action is reconstructable. And the honest null hypothesis: if one agent needs one tool,
that is a function call, and a protocol adds a trust boundary for nothing.
