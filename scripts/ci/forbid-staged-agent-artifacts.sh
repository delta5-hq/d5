#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

readonly ALLOWED_LOCK_REGISTRY='.github/docs/locked-surfaces-360.md'
readonly ALLOWED_DOCS=(
  '.github/docs/lessons-360.md'
  "$ALLOWED_LOCK_REGISTRY"
)

is_github_docs_path() {
  local path="$1"

  [[ "$path" == .github/docs/* || "$path" == */.github/docs/* ]]
}

is_allowed_doc_path() {
  local path="$1"
  local allowed

  for allowed in "${ALLOWED_DOCS[@]}"; do
    [ "$path" = "$allowed" ] && return 0
  done

  return 1
}

is_blocked_staged_path() {
  local path="$1"

  case "$path" in
    frontend/.interface-design/*|.claude/*)
      return 0
      ;;
    *)
      if is_github_docs_path "$path"; then
        ! is_allowed_doc_path "$path"
        return
      fi
      return 1
      ;;
  esac
}

main() {
  local failed=0
  local path

  while IFS= read -r path; do
    [ -z "$path" ] && continue

    if is_blocked_staged_path "$path"; then
      echo "AGENT-ARTIFACT-VIOLATION: staged private/process artifact: $path" >&2
      failed=1
    fi
  done < <(git -C "$REPO_ROOT" diff --cached --name-only)

  if [ "$failed" -eq 1 ]; then
    echo "Remove private/process artifacts from the staged set or add a dedicated production allowlist entry in scripts/ci/forbid-staged-agent-artifacts.sh." >&2
    exit 1
  fi
}

main "$@"
