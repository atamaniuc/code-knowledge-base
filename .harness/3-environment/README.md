# Environment — what the project runs in

Reproducibility, so that "works here" and "works anywhere" are the same statement.

- **Node version** — pinned in `.nvmrc` at the project root. CI reads the same file, so CI
  and a laptop cannot silently diverge.
- **Dependencies** — pinned in `pnpm-lock.yaml`. Installs are exact rather than
  approximately right.
- **No services.** No database to provision, no server to start, no API key needed to run
  the checks. `make setup && make check` is the whole setup, which is what makes the
  cold-start test meaningful.

## locked-baseline

Records the commit from which the locked-surface rule applies.

Some files define what counts as success: the scoring code, the acceptance rules, the
licence registry, the CI workflow. A system that improves itself will, given the
opportunity, improve its own score instead of its own work — every documented case of this
happened where the scoring was reachable. So those files are placed out of reach, and
`../2-tools/locked-surfaces.sh` enforces it.

The baseline exists because the commit that *creates* a protected file necessarily touches
it. Moving the baseline forward widens what the system may change, which is a decision a
person makes.
