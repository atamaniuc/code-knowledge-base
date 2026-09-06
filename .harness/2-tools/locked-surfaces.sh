#!/usr/bin/env bash
# Locked-surface check.
#
# A self-improving loop optimises whatever signal it is given, including the signal's
# own weaknesses. These paths define or enforce that signal, so a commit written by the
# loop may not touch them. Constraints stated in prompt text get optimised away; this is
# the enforcement that does not.
#
# Limit, stated plainly: this assumes commits pass through CI. It is drift detection,
# not a sandbox. A loop with push access that strips its own authorship trailer defeats
# it. Closing that properly means filesystem-level read-only paths in the run
# environment, which this project does not have yet.
set -euo pipefail

LOCKED=(
  "packages/evaluator/"
  ".harness/1-instructions/autonomy.md"
  "content/sources.yaml"
  ".github/workflows/"
  ".harness/2-tools/locked-surfaces.sh"
)

AGENT_TRAILER="Co-Authored-By: Claude"
BASE="${1:-HEAD~1}"
HEAD_REF="${2:-HEAD}"

# Enforcement starts here. Commits at or before the baseline are exempt, because the
# commit that establishes a locked path necessarily touches it. Moving this baseline
# forward is expanding the editable surface, which is a human decision — see
# .harness/1-instructions/autonomy.md, "What stays human".
BASELINE_FILE=".harness/3-environment/locked-baseline"
BASELINE=""
if [ -f "$BASELINE_FILE" ]; then
  BASELINE=$(grep -vE '^\s*(#|$)' "$BASELINE_FILE" | head -1 | tr -d '[:space:]')
fi

fail=0
while read -r sha; do
  [ -z "$sha" ] && continue
  git log -1 --format=%B "$sha" | grep -qF "$AGENT_TRAILER" || continue

  # Skip anything at or before the baseline.
  if [ -n "$BASELINE" ] && git merge-base --is-ancestor "$sha" "$BASELINE" 2>/dev/null; then
    continue
  fi

  touched=$(git diff-tree --no-commit-id --name-only -r "$sha")
  for path in "${LOCKED[@]}"; do
    hits=$(printf '%s\n' "$touched" | grep -F "$path" || true)
    if [ -n "$hits" ]; then
      echo "locked surface modified by an agent commit: $sha" >&2
      printf '%s\n' "$hits" | sed 's/^/  /' >&2
      echo "  why:  these paths define or enforce the acceptance signal; a loop that can edit them can grant itself a passing score" >&2
      echo "  fix:  a human makes this change, in a commit without the agent trailer" >&2
      fail=1
    fi
  done
done < <(git rev-list "$BASE".."$HEAD_REF" 2>/dev/null || true)

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "locked surfaces intact"
