#!/usr/bin/env bash
# QA coverage gate: verifies every acceptance bullet that requires live evidence
# has a non-placeholder verdict in qa-coverage-matrix-360.md.
#
# Passes when every `required: live` row carries CLEAN or BASELINE.
# Exits 1 when any required-live row is REGRESSION, INCOMPLETE, or unprobed (—).
#
# Usage:
#   qa-coverage-gate.sh            # strict: all required-live rows must be CLEAN/BASELINE
#   qa-coverage-gate.sh --report   # print a summary and exit 0 (for status reporting)
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly MATRIX="${REPO_ROOT}/.github/docs/qa-coverage-matrix-360.md"

STRICT=1
[ "${1:-}" = "--report" ] && STRICT=0

REQUIRED_LIVE=0
CLEAN_LIVE=0
OPEN_LIVE=0
OPEN_ROWS=()

while IFS= read -r row; do
  # Match table rows that contain 'live' in the required column
  # Row format: | id | bullet | required | verdict | evidence |
  if echo "$row" | grep -qE '^\| P' && echo "$row" | grep -qE '\| live \|'; then
    REQUIRED_LIVE=$((REQUIRED_LIVE + 1))
    verdict=$(echo "$row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $5); print $5}')
    id=$(echo "$row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}')

    case "$verdict" in
      CLEAN|BASELINE)
        CLEAN_LIVE=$((CLEAN_LIVE + 1))
        printf 'COVERAGE OK:      %s — %s\n' "$id" "$verdict"
        ;;
      *)
        OPEN_LIVE=$((OPEN_LIVE + 1))
        OPEN_ROWS+=("${id}: ${verdict}")
        printf 'COVERAGE OPEN:    %s — %s\n' "$id" "$verdict"
        ;;
    esac
  fi
done < "$MATRIX"

printf '\nSummary: %d/%d required-live rows are CLEAN or BASELINE; %d open\n' \
  "$CLEAN_LIVE" "$REQUIRED_LIVE" "$OPEN_LIVE"

[ "$STRICT" -eq 0 ] && exit 0

if [ "${OPEN_LIVE}" -gt 0 ]; then
  printf '\nqa-coverage-gate BLOCKED: %d live acceptance bullet(s) lack a CLEAN/BASELINE verdict:\n' \
    "$OPEN_LIVE" >&2
  for row in "${OPEN_ROWS[@]}"; do
    printf '  - %s\n' "$row" >&2
  done
  printf '\nUpdate %s after a successful live probe to clear the gate.\n' \
    ".github/docs/qa-coverage-matrix-360.md" >&2
  exit 1
fi

printf 'qa-coverage-gate PASS: all %d required-live acceptance bullets are CLEAN or BASELINE\n' \
  "$REQUIRED_LIVE"
