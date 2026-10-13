# Single command surface for humans, CI and the harness.
# Every verification command referenced by feature_list.json is a target here.

.PHONY: setup test lint validate check drill prep ingest extension icons verify-content cold-start harness-doctor harness-status harness-activate harness-verify harness-check clean help

help:
	@echo "setup             install dependencies and enable the pre-commit hook"
	@echo "lint              typecheck the workspace"
	@echo "test              run the test suite"
	@echo "validate          validate content/ against schemas and cross-file rules"
	@echo "check             lint + test + validate; the gate for every feature list item"
	@echo "drill             run a practice session; ARGS=\"--help\" for options"
	@echo "prep              ARGS=<job-url>  parse a posting and build a rehearsal plan for it"
	@echo "ingest            rebuild the topic frequency map from live job postings"
	@echo "extension         build the unpacked Chrome extension into apps/extension/dist"
	@echo "verify-content    run the grounding gate over wiki articles and promote what passes"
	@echo "cold-start        clone HEAD into an empty dir and verify it runs from the repo alone"
	@echo ""
	@echo "harness-doctor    what this repository actually enforces"
	@echo "harness-status    show the queue, WIP and review backlog"
	@echo "harness-activate  ID=<id>  start one item (enforces WIP=1 and the queue limit)"
	@echo "harness-verify    ID=<id>  run the item's verification and record the outcome"
	@echo "harness-check     invariants; add ARGS=--reverify to re-run every passing claim"

setup:
	pnpm install
	git config core.hooksPath .githooks
	@echo "pre-commit hook enabled (core.hooksPath=.githooks)"

lint:
	pnpm run lint

test:
	pnpm run test

validate:
	pnpm run validate

check: lint test validate harness-check

drill:
	@pnpm exec tsx apps/drill/src/cli.ts $(ARGS)

# The only target that reads the network: a posting URL in, a rehearsal plan out.
prep:
	@pnpm exec tsx scripts/prep-from-job.ts $(ARGS)

ingest:
	@pnpm exec tsx scripts/ingest-vacancies.ts $(ARGS)

# The icon is drawn, not imported: two letters on a rounded square, as PNG bytes we ship.
icons:
	@pnpm exec tsx scripts/make-icons.ts

# build first: it clears dist, so bundling the content before it would be wiped
extension:
	@pnpm exec tsx scripts/build-extension.ts
	@pnpm exec tsx scripts/bundle-extension.ts $(ARGS)

verify-content:
	@pnpm exec tsx scripts/verify-content.ts $(ARGS)

# The harness itself is a dependency (harnessimo), not scripts kept here: a
# copied check is a fork the day after it is copied. What this project enforces
# is declared in harnessimo.config.json; `harnessimo doctor` prints it.
cold-start:
	@pnpm exec harnessimo cold-start

harness-doctor:
	@pnpm exec harnessimo doctor

harness-status:
	@pnpm exec harnessimo queue status

harness-activate:
	@pnpm exec harnessimo queue activate $(ID)

harness-verify:
	@pnpm exec harnessimo queue verify $(ID)

harness-check:
	@pnpm exec harnessimo check $(ARGS)

clean:
	rm -rf node_modules dist
