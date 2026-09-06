# Review protocol

Review is the bottleneck of this project and the only step an agent may not perform.
Everything here is aimed at making it fast without making it shallow.

## Why it is human-only

An agent that promotes its own output to `reviewed` is self-approving. The status is the
entire difference between this product and text a chatbot generates for free, so
`CONSTRAINTS.md` rule 1 forbids it and `make check` enforces the attribution.

The fact-check node in the authoring graph runs in a separate context from the author for
the same reason — but it still cannot promote. It can only send work back.

## What a review checks

Score each axis A-D. Anything below B goes back with a reason.

| Axis | Passing looks like |
|---|---|
| Factual accuracy | Every claim traceable to a listed source, not to plausible-sounding recall |
| Version anchoring | `tech.version_range` is real and the claim is actually true for it |
| Source quality | Official docs, RFC, spec or release notes — not a blog restating them |
| Bullet independence | `expected_answer` bullets do not overlap; each can be missed on its own |
| Level calibration | `min_level` matches what that level is actually expected to say |
| Depth | Answers the "why", not only the "what" |

The same rubric is the contract for the fact-check node, so what a machine rejects and
what a human rejects are the same list.

## Throughput rules

- **Queue limit 15.** More than fifteen items awaiting review stops generation. Authoring
  is cheap and review is not; outrunning it inflates a metric that means nothing.
- **Review in one sitting per batch.** Context switching between domains costs more than
  the review itself.
- **Reject early.** An item that needs three fixes goes back whole; do not repair it
  inside the review pass, or authoring quality never improves.

## Promoting findings into checks

This is the mechanism that makes the queue shrink over time, and it is the highest-value
habit in the project.

When the same finding appears in review three times, it stops being feedback and becomes
a check:

1. Add the rule to the table at the bottom of this file.
2. Implement it in `packages/schema/src/validate.ts`, or as a remedy in
   `packages/schema/src/explain.ts` when it is a shape a schema can express.
3. Add a negative test proving it fires.

After that the agent hits the rule before you ever see the item.

### Promoted rules

| Finding | Became |
|---|---|
| Claim with no official source | `sources` requires at least one entry |
| Single-bullet expected answer | `expected_answer` requires at least two bullets |
| Question with no article behind it | `wiki_refs` requires at least one resolving entry |
| "Optimal" solution with the same cost as naive | Complexity refinement on `DsaTask` |
| Review status set with no reviewer named | Cross-file check for `reviewed_at` / `reviewed_by` |
| Placeholder left in shipped content | Placeholder scan across `content/` |

Add a row every time you promote one. An empty stretch in this table means review findings
are being fixed one at a time instead of once.
