# Tools — what this project can run

The harness itself is a dependency — [Harnessimo](https://github.com/atamaniuc/Harnessimo) —
not a folder of scripts kept here. A copied check is a fork the day after it is copied, and
this repository has already paid for that once: the `.harness/` reorganisation moved
`cold-start.sh` and left the queue item verifying it pointing at the old path, so CI was red
on every push until someone read the log.

What this project enforces is declared in `harnessimo.config.json`. `make harness-doctor`
prints it, and what it does *not* enforce, which is the half most tools leave out.

```
make check                       lint + test + validate + every harness gate
make harness-doctor              what is actually enforced here
make harness-status              the queue: what is in flight, what is queued
make harness-verify ID=<id>      run that item's own check and record the outcome
make harness-check ARGS=--reverify   re-run every passing claim
make cold-start                  a fresh clone installs and verifies from the repo alone
```

Project-specific tooling stays here: `scripts/` holds the ingest, extension build and
content verification, none of which the shared harness knows anything about.

## Why the queue is a command and not a file you edit

An item is finished when its check passes, not when someone believes it is. Models are
consistently over-confident about their own work, so the judgement is taken away from them
and given to a command — and CI re-runs every passing claim, so a hand-edited state is
detected rather than trusted.
