# Single command surface for humans, CI and the harness.
# Every verification command referenced by feature_list.json is a target here.

.PHONY: setup test lint validate check clean help

help:
	@echo "setup     install dependencies"
	@echo "lint      typecheck the workspace"
	@echo "test      run the test suite"
	@echo "validate  validate content/ against the schemas and cross-file rules"
	@echo "check     lint + test + validate; the gate for every feature list item"

setup:
	pnpm install

lint:
	pnpm run lint

test:
	pnpm run test

validate:
	pnpm run validate

check: lint test validate

clean:
	rm -rf node_modules dist
