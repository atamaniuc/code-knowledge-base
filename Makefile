# Single command surface for humans, CI and the harness.
# Every verification command referenced by feature_list.json is a target here.

.PHONY: setup test lint validate check drill ingest cold-start harness-status harness-activate harness-verify harness-check clean help

help:
	@echo "setup             install dependencies and enable the pre-commit hook"
	@echo "lint              typecheck the workspace"
	@echo "test              run the test suite"
	@echo "validate          validate content/ against schemas and cross-file rules"
	@echo "check             lint + test + validate; the gate for every feature list item"
	@echo "drill             run a practice session; ARGS=\"--help\" for options"
	@echo "ingest            rebuild the topic frequency map from live job postings"
	@echo "cold-start        clone HEAD into an empty dir and verify it runs from the repo alone"
	@echo ""
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

check: lint test validate

drill:
	@pnpm exec tsx apps/drill/src/cli.ts $(ARGS)

ingest:
	@pnpm exec tsx scripts/ingest-vacancies.ts $(ARGS)

cold-start:
	./scripts/cold-start.sh

harness-status:
	@pnpm exec tsx scripts/harness.ts status

harness-activate:
	@pnpm exec tsx scripts/harness.ts activate $(ID)

harness-verify:
	@pnpm exec tsx scripts/harness.ts verify $(ID)

harness-check:
	@pnpm exec tsx scripts/harness.ts check $(ARGS)

clean:
	rm -rf node_modules dist
