#!/usr/bin/env bash
# Cold-start test (lecture 03): can a fresh session run and verify this project
# using nothing but the repository?
#
# Clones HEAD into an empty directory and runs the documented commands. No
# environment reuse, no verbal explanation, no node_modules carried over.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "cold start: cloning HEAD into $WORK"
git clone --quiet "$REPO_ROOT" "$WORK/clone"
cd "$WORK/clone"

# The five questions a cold session must be able to answer from the repo alone.
for required in AGENTS.md Makefile .harness/README.md .harness/1-instructions/CONSTRAINTS.md \
                .harness/4-state/PROGRESS.md .harness/4-state/DECISIONS.md \
                .harness/4-state/feature_list.json; do
  if [[ ! -f "$required" ]]; then
    echo "cold start FAILED: $required is missing from a fresh clone" >&2
    echo "  why:  what is not in the repository does not exist for a fresh session" >&2
    exit 1
  fi
done

# AGENTS.md must not send a reader outside the repository.
if grep -qE '~/\.claude|/Users/|/home/[a-z]' AGENTS.md; then
  echo "cold start FAILED: AGENTS.md references a path outside the repository" >&2
  echo "  fix:  move the referenced material into the repo and point at a relative path" >&2
  exit 1
fi

echo "cold start: make setup"
make setup >/dev/null

echo "cold start: make check"
make check >/dev/null

echo "cold start PASSED: fresh clone installs and verifies from the repository alone"
