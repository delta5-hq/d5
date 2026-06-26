#!/usr/bin/env bash
#
# Pre-probe staleness gate: verifies that every named service's running binary
# was built from the same working-tree state as the current source tree.
#
# Usage:
#   bash scripts/probe-version.sh <name>=<version-url> [<name>=<version-url> ...]
#
# Each spec is <name>=<version-url> where version-url is the exact JSON
# endpoint that returns {"version":"..."}. The script never probes fallback
# paths because a wrong version route must remain a loud QA blocker.
#
# Exit codes:
#   0  — all services are CLEAN (or staleness detection is unavailable)
#   1  — one or more services are BLOCKED (stale or unreachable)
#
# Example:
#   bash scripts/probe-version.sh \
#       "go-backend=http://localhost:3002/api/v2/version" \
#       "node-backend=http://localhost:3001/version"

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/version.sh
source "${SCRIPT_DIR}/version.sh"

probe_service() {
    local name="$1" endpoint="$2" expected="$3"
    local response actual

    if ! response="$(curl -sf --max-time 5 "${endpoint}" 2>/dev/null)"; then
        printf 'BLOCKED [%s]: version endpoint unreachable at %s\n' "$name" "$endpoint" >&2
        return 1
    fi

    actual="$(printf '%s' "$response" | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

    if [[ -z "$actual" ]]; then
        printf 'BLOCKED [%s]: response missing "version" field — body: %s\n' "$name" "$response" >&2
        return 1
    fi

    if [[ "$actual" == "$expected" ]]; then
        printf 'CLEAN [%s]: version %s\n' "$name" "$actual"
        return 0
    fi

    printf 'BLOCKED [%s]: running=%s  expected=%s\n' "$name" "$actual" "$expected" >&2
    return 1
}

main() {
    if [[ $# -eq 0 ]]; then
        printf 'Usage: %s <name>=<version-url> [...]\n' "$(basename "$0")" >&2
        return 1
    fi

    local expected
    expected="$(compute_version)"
    printf '→ Expected version: %s\n' "$expected"

    if [[ "$expected" == "dev" ]]; then
        printf '⚠ Staleness detection unavailable: working-tree version is "dev" (not in a git repo or no commits)\n'
        return 0
    fi

    local failures=0
    for spec in "$@"; do
        local name="${spec%%=*}"
        local endpoint="${spec#*=}"
        probe_service "$name" "$endpoint" "$expected" || failures=$((failures + 1))
    done

    if [[ $failures -gt 0 ]]; then
        printf '\n✗ %d service(s) outdated — rebuild and restart before probing\n' "$failures" >&2
        return 1
    fi

    printf '✓ All services match working-tree version\n'
}

main "$@"
