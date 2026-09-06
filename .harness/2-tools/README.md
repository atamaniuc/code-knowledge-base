# Tools — what the project can run

Everything here is reachable through `make`; `make help` lists it. Running the scripts
directly works too.

## harness.ts — the work queue

Owns `../4-state/feature_list.json` and is the **only** thing that marks an item finished.

```
make harness-status              # what is in flight, what is queued
make harness-verify ID=<id>      # run that item's own check and record the outcome
make harness-check ARGS=--reverify   # re-run every finished item's check
```

Why a tool rather than editing the file: an item is finished when its check passes, not
when someone believes it is. Models are consistently over-confident about their own work,
so the judgement is taken away from them and given to a command.

It also enforces one item at a time, and refuses to start an item whose success cannot be
decided — see `../1-instructions/definition-of-done.md`.

## cold-start.sh — the newcomer test

```
make cold-start
```

Clones the project into an empty folder and tries to run and check it using nothing but the
repository. No explanation, no leftover files, no environment from this machine.

It is the honest test of the documentation. What is not written down does not exist for
someone arriving fresh — and every session after the first arrives fresh.

## locked-surfaces.sh — protecting the scoring

Refuses a commit written by the agent that touches the files defining success.

Its limit is stated in the script itself rather than hidden: it assumes commits pass
through CI, so it detects tampering rather than preventing it. Preventing it properly means
running the work where those files are read-only, which is infrastructure this project does
not have yet.
