---
slug: structured-output
title: Structured output from language models
lang: en
domain: agentic
topic: integration
tech:
  name: LLM structured output
  version_range: ">=2024"
levels: [junior, middle, senior, staff]
summary: >-
  Getting valid JSON is close to solved by constrained decoding. Getting
  semantically correct fields is not, and conflating the two is the mistake the
  question is designed to surface.
prerequisites: []
related: [agent-loop-design]
sources:
  - title: "Efficient Guided Generation for Large Language Models (outlines)"
    url: https://arxiv.org/abs/2307.09702
    kind: paper
  - title: "JSON Schema specification"
    url: https://json-schema.org/specification
    kind: spec
review_status: draft
---

## Two problems wearing one name

**Syntactic validity** — is this parseable JSON matching the schema. This is largely a
solved problem: constrained decoding masks the token distribution at each step so that only
tokens keeping the output on a valid path can be sampled. Invalid output becomes
unreachable rather than unlikely.

**Semantic correctness** — are the values right. No decoding constraint touches this. A
schema that requires `confidence: number` will happily accept a fabricated 0.95, and a
required `customer_id` field guarantees the model emits *something* shaped like an id.

Candidates who answer this question only with "use structured output mode" have answered
the first half and not noticed the second.

## What a schema does to behaviour

A schema is not a neutral wrapper; it changes what the model produces.

**Required fields force answers.** If a field is required and the information is absent
from the input, the model cannot decline — the grammar does not permit omission — so it
invents. The fix is to make absence expressible: an optional field, an explicit
`not_found` variant, a nullable type. This is the single most useful thing to say in an
interview on this topic, because it inverts the instinct that stricter is safer.

**Enums beat free strings.** Where the value set is known, an enum removes an entire class
of normalisation work and makes downstream code total rather than defensive.

**Field order matters** in a way it does not in a normal API. Generation is autoregressive,
so a field placed earlier conditions the ones after it. Putting `reasoning` before
`answer` gives the answer something to condition on; putting it after produces a
justification for a conclusion already committed to.

**Deep nesting costs accuracy.** A flat schema with clear names is followed more reliably
than a nested one that is technically equivalent.

## Validation at the boundary

Constrained decoding covers the schema; it does not cover your invariants. Dates that must
be in the past, ids that must exist, totals that must equal the sum of their parts — these
are application rules, and they are validated in application code.

Which means a repair path is part of the design: on failure, return the validation error to
the model and retry, with a bounded number of attempts and a defined terminal behaviour.
Unbounded repair is the same failure as an agent loop with no stop condition.

## Cost and the honest trade

Structured output is usually cheaper than prose that says the same thing, and it removes
parsing entirely. Against that: constrained decoding can degrade quality on tasks where the
model reasons better in free text, which is why the reasoning-then-answer ordering exists
rather than forcing everything into fields.

The staff-level framing is that a schema is a contract between a probabilistic component
and a deterministic one, and the interesting design work is deciding which failures cross
that boundary as data — an explicit `not_found`, a confidence the caller may act on — and
which are refused at the boundary and retried.
