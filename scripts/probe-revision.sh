#!/usr/bin/env bash
#
# Pre-probe staleness gate: verifies that every named service's running binary
# was built from the same working-tree state as the current source tree.
#
# Usage:
#   bash scripts/probe-revision.sh <name>=<base-url> [<name>=<base-url> ...]
#
# Each spec is <name>=<base-url> where base-url is the service root
# (e.g. http://localhost:3002).  The script appends /revision to each URL.
#
# Exit codes:
#   0  — all services are CLEAN (or staleness detection is unavailable)
#   1  — one or more services are BLOCKED (stale or unreachable)
#
# Example:
#   bash scripts/probe-revision.sh \
#       "go-backend=http://localhost:3002" \
#       "node-backend=http://localhost:3001"

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/revision.sh
source "${SCRIPT_DIR}/revision.sh"

probe_service() {
    local name="$1" url="$2" expected="$3"
    local response actual

    if ! response="$(curl -sf --max-time 5 "${url}/revision" 2>/dev/null)"; then
        printf 'BLOCKED [%s]: /revision unreachable at %s\n' "$name" "$url" >&2
        return 1
    fi

    actual="$(printf '%s' "$response" | grep -o '"revision":"[^"]*"' | cut -d'"' -f4 || true)"

    if [[ -z "$actual" ]]; then
        printf 'BLOCKED [%s]: response missing "revision" field — body: %s\n' "$name" "$response" >&2
        return 1
    fi

    if [[ "$actual" == "$expected" ]]; then
        printf 'CLEAN [%s]: revision %s\n' "$name" "$actual"
        return 0
    fi

    printf 'BLOCKED [%s]: running=%s  expected=%s\n' "$name" "$actual" "$expected" >&2
    return 1
}

main() {
    if [[ $# -eq 0 ]]; then
        printf 'Usage: %s <name>=<base-url> [...]\n' "$(basename "$0")" >&2
        return 1
    fi

    local expected
    expected="$(compute_revision)"
    printf '→ Expected revision: %s\n' "$expected"

    if [[ "$expected" == "dev" ]]; then
        printf '⚠ Staleness detection unavailable: working-tree revision is "dev" (not in a git repo or no commits)\n'
        return 0
    fi

    local failures=0
    for spec in "$@"; do
        local name="${spec%%=*}"
        local url="${spec#*=}"
        probe_service "$name" "$url" "$expected" || failures=$((failures + 1))
    done

    if [[ $failures -gt 0 ]]; then
        printf '\n✗ %d service(s) outdated — rebuild and restart before probing\n' "$failures" >&2
        return 1
    fi

    printf '✓ All services match working-tree revision\n'
}

main "$@"
