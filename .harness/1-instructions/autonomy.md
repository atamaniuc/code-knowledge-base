# Autonomy

The system promotes its own content. No human reviews items one by one. This document
states what replaces that review, what stays human, and where the guarantee is weaker
than the one it replaces.

## What changed

The original design made `reviewed` a human-only status and treated the review queue as
a deliberate bottleneck. That is removed. Content now promotes on **evidence**, through
gates that run without supervision.

The premise that made human review valuable — that reviewed content beats what a chatbot
generates free — still has to hold. It now holds through grounding rather than through a
person: a claim ships because it was checked against a fetched source document, not
because a model found it plausible.

## Status ladder

```
imported ─┐
          ├─► draft ─► auto_verified ─► verified
generated ┘              │                 │
                         └─► quarantined ◄─┘
```

- **draft** — authored, nothing checked. Never ships.
- **auto_verified** — passed every gate below. Ships to the trainer.
- **verified** — auto_verified and surviving in use: no dispute after N drill sessions.
- **quarantined** — failed a gate, or was demoted by a dispute. Ships to nothing, kept
  with its trace so the failure is minable.

## The gates

All five must pass. Any failure quarantines the item and archives the trace.

**G1 — Source grounding.** Every factual claim maps to a quoted span in a source that was
actually fetched during verification. The span is stored. A claim the checker believes
but cannot locate in a document does not pass; model recall is not evidence.

**G2 — Adversarial falsification.** A second model, in a separate context, is given the
claim and the fetched sources and asked to falsify it — not to confirm it. Asking "is
this right" and asking "show me this is wrong" produce different failure rates, and only
the second surfaces confident errors.

**G3 — Corpus consistency.** The claim must not contradict any other `auto_verified` or
`verified` claim. Contradiction quarantines **both** items: which one is wrong is exactly
what is unknown at that moment.

**G4 — Version currency.** `tech.version_range` is checked against real release data. A
claim true for React 18 and asserted for React 19 fails here rather than aging silently
into wrongness.

**G5 — Held-out grounding.** Verification is repeated against a source the author did not
cite, fetched independently. A claim that survives only against its own chosen citation
is fitted to that citation, not established by it.

## Acceptance for self-edits

When the loop proposes a change to content or to a prompt, acceptance is two-split:

- **held-in** — the cases the change targets. Must not regress.
- **held-out** — a question set the proposer never sees. Must not regress.

Accept only when neither regresses and at least one strictly improves. A change that
trades one split for the other is rejected even when the sum improves. Rejected
candidates are archived with their evidence so the same proposal is not rediscovered.

## Locked surfaces

The loop optimises whatever signal it is given, including the signal's weaknesses. These
paths are outside what it may change:

| Locked | Why |
|---|---|
| `packages/evaluator/**` | The scoring rule. A loop that can edit its own scorer will. |
| `.harness/1-instructions/autonomy.md`, gate configuration | The acceptance criteria themselves. |
| `content/sources.yaml` | Licence clearance is a legal decision. |
| `.github/workflows/**` | The enforcement itself. |

Enforcement is in CI, not in prompt text: constraints stated in a prompt get optimised
away, so they are treated as decorative. A commit that touches a locked path and carries
the agent's authorship trailer fails the build.

**Stated limit:** CI enforcement assumes commits pass through CI. It is not a sandbox. A
loop with direct push access and the ability to strip its own trailer would defeat it.
Closing that gap properly means running the loop in an environment where those paths are
read-only at the filesystem level, which is infrastructure this project does not have
yet. Until then the gate is drift *detection*, and the archive is what makes tampering
visible after the fact.

## Where the guarantee is weaker

Human review gave a hard guarantee on the items a human actually read. This gives a
statistical one over everything. Errors will ship. That trade is deliberate, and these
are the mitigations rather than a claim it does not happen:

- **Demotion on dispute.** A contested item is quarantined immediately, not defended.
- **Usage signal.** A bullet no one ever covers, across many sessions, is more likely
  badly worded than universally unknown. That is a defect signal, and it is free.
- **Sampling audit.** A random sample of promotions is inspectable at any time, with its
  fetched spans, so the promotion rate can be checked against reality without reading
  everything.
- **Full traces.** Every promotion keeps the fetched excerpts and both models' verdicts.
  Audits read raw traces, never a summary of them.

The honest weak point is the loop-readiness requirement that a fast deterministic
evaluator exist. Content correctness is not fully deterministic. Source grounding is what
narrows the gap: it converts "is this true" into "is this span in this document", which
is checkable. Where a claim cannot be grounded in a document at all, the item does not
promote — it stays in draft, which is the correct outcome for something no source
supports.

## What stays human

Humans move up the stack, not out of it. Reserved:

1. Changing the gates or the acceptance rule.
2. Expanding the set of editable surfaces.
3. Licence clearance in `content/sources.yaml`.
4. Deciding to abandon a direction. Models trained on successful outcomes are badly
   calibrated about when to stop, and preserved negative results are the cheapest way to
   narrow a successor's search.
