# The harness

This folder holds everything that governs *how* work gets done here, as opposed to the
work itself. If you are new to the project, this is the shortest route to understanding
how it runs.

A harness is everything around the model: the instructions it is given, the tools it can
run, the environment it runs in, the state it carries between sessions, and the checks
that tell it whether it succeeded. A capable model with a bad harness produces work that
looks finished and is not; that is the problem this folder exists to solve.

The five folders below are those five parts. The kitchen comparison in brackets is the one
the source material uses, and it is genuinely the clearest way in.

---

## 1-instructions — what the agent is told *(the recipe shelf)*

The rules. Deliberately short: a long instruction file eats the model's working memory and
buries the important parts in the middle, where they get ignored.

| File | What it is |
|---|---|
| `CONSTRAINTS.md` | Fifteen hard rules. Each says whether a command enforces it or a person has to notice. |
| `definition-of-done.md` | When an item may start, and when it may be called finished. |
| `autonomy.md` | How content gets approved without a person reading each piece — and where that is weaker than a person would be. |

The entry point, `AGENTS.md`, stays in the project root because that is where every tool
looks for it. It is a router: what this project is, how to run it, how to check it, and
links here.

## 2-tools — what it can run *(the knife rack)*

| File | What it is |
|---|---|
| `harness.ts` | Owns the work queue. It is the only thing allowed to mark an item finished, and only after running that item's own check. |
| `cold-start.sh` | Clones the project into an empty folder and tries to run it using nothing but the repository. If a newcomer could not, this fails. |
| `locked-surfaces.sh` | Refuses commits from the agent that touch the files defining what counts as success. |

Everything is reachable through `make`; run `make help` for the list.

## 3-environment — what it runs in *(the cooking surface)*

Reproducibility. The Node version is pinned in `.nvmrc`, dependencies in the lockfile, and
`locked-baseline` records the commit from which the locked-surface rule applies.

Why the last one exists: a system that improves itself will, given the chance, improve its
own scoring. So the files that define success are placed out of its reach, and the reach is
enforced by a command rather than by an instruction — instructions get optimised away.

## 4-state — what carries between sessions *(the prep table)*

A session ends and its memory is gone. What is written down here is all that survives.

| File | What it is |
|---|---|
| `PROGRESS.md` | Where things stand: done, in flight, blocked, next. Read at the start of a session, updated at the end. |
| `DECISIONS.md` | What was decided, why, and what was rejected. Append-only. It exists so a later session does not quietly undo a deliberate choice. |
| `feature_list.json` | The work queue. Each item carries the behaviour it must produce, the command that proves it, its state, and the output that proved it. |

One item is worked at a time. Splitting attention across several produces work that is
started everywhere and finished nowhere.

## 5-feedback — how it knows it worked *(the quality-control window)*

The checks live next to the code they check rather than in this folder, because a rule far
from what it governs goes stale. `5-feedback/README.md` maps them.

The short version: three levels, and skipping any of them means not finished. Types and
schemas, then tests, then a real end-to-end run. Content has a further five gates of its
own, described in `1-instructions/autonomy.md`.

---

## If you read one thing

`1-instructions/CONSTRAINTS.md`. It is the shortest complete statement of how this project
behaves, and every rule in it says plainly whether a machine enforces it or a person has
to catch it. That distinction is the honest part, and it is the one most projects leave out.
