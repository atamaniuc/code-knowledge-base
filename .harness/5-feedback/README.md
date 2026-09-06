# Feedback — how the project knows it worked

Checks live next to the code they check; this file maps them. A rule kept far from what it
governs goes stale without anyone noticing.

## One command

```
make check
```

Everything below runs from it, and it is the gate every queue item passes through. Passing
this is what "finished" means for code.

## Three levels

Skipping any of them means not finished.

**1. Types and schemas.** `tsc` over the workspace, and `make validate` over `content/`.
The content validator is the interesting half: it checks rules no single file could know
on its own — that a question points at an article that exists, that a promoted item names
the check that promoted it, that nothing derives from a source whose licence forbids
selling it.

**2. Tests.** Unit tests, and, more importantly, *negative* tests. Every content rule has a
test proving it actually fails on bad input. A rule with no failing test is an assumption
wearing a rule's clothes.

**3. End to end.** `make cold-start` clones the project into an empty folder and runs it
using only what is in the repository. It catches the class of problem the first two levels
are blind to: something that works only because of state on this machine.

## Re-checking claims

```
make harness-check ARGS=--reverify
```

Runs every finished item's check again. An item marked finished by hand, without the check
ever passing, fails here. This runs in CI on every push, so the claim is not taken on
trust.

## Failure messages

Failures are written to be acted on, not just read. Each says what failed, why it matters,
and what to do — because the next person to see it may be a fresh session with no memory of
the design, and "invalid schema" leaves them guessing.

## Content is different

Code is finished when a command passes. Content is finished when five verification gates
pass with stored evidence: every claim matched to a quoted passage in a document that was
actually fetched, an independent model failing to disprove it, no contradiction with
anything already published, the version checked against real release data, and a repeat
check against a source the author did not choose.

The design and its limits are in `../1-instructions/autonomy.md`.
