# packages/schema

Owns the definition of what valid content is. Everything else in the repository reads
content through this package, so a rule that is not expressed here is not enforced anywhere.

## Responsibilities

- Zod schemas for every content entity (`common`, `wiki`, `question`, `dsa`, `interview`, `registry`)
- Loading and frontmatter parsing (`load.ts`)
- Cross-file rules that no single-file schema can express (`validate.ts`)
- Turning failures into guidance an agent can act on (`explain.ts`)
- The `make validate` entry point (`cli.ts`)

## Boundaries

- **No content lives here.** Content lives in `content/`; this package only describes it.
- **No I/O beyond reading `content/`.** No network, no database, no writes. The validator
  must be safe to run in CI and on a pre-commit hook.
- **No knowledge of delivery.** The CLI trainer, the extension and the site all consume
  these schemas; none of their concerns leak in.

## Design constraints

**Strict objects everywhere.** `z.strictObject` rejects unknown keys, which turns a
frontmatter typo into a failure at the file that has it rather than a silently missing
field three layers later.

**Cross-file rules are separate from schemas.** A single YAML file cannot know whether the
article it references exists, or whether its source is licensed for commercial use. Those
checks live in `validate.ts` and run over the whole tree.

**Failures explain themselves.** `explain.ts` maps issue paths to what / why / fix. A
validator whose output is "invalid schema" makes the next session guess, and guessing is
how content quality decays.

**Negative tests are mandatory.** Every cross-file rule has a test proving it fires on a
fixture tree. A validation rule with no failing test is an assumption, not a rule.

## Adding a rule

1. Express it in a schema if a single file can decide it; otherwise add it to `validate.ts`.
2. Add a remedy in `explain.ts` if the fix is not obvious from the message.
3. Add a negative test in `test/validate.test.ts`.
4. Record it in the promoted-rules table in `docs/review-protocol.md`.
