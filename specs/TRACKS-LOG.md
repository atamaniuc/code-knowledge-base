# Closed tracks

Newest first. One or two sentences per track: what came out of it. Lasting decisions go to
[`.harness/4-state/DECISIONS.md`](../.harness/4-state/DECISIONS.md), not here; git carries
the rest.

- **Source grounding (G1)** — every factual claim in an article is matched to a passage
  quoted from a source that was actually fetched, and the quote is re-checked against the
  fetched text. The gate asks a model to quote, not to judge, because "is this correct"
  invites an answer from memory.
- **Harness consolidation into `.harness/`** — the rules, the queue, the enforcement and
  the environment reorganised into five folders by subsystem, each with a README written
  for someone with no context.
