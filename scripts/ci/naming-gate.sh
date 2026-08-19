#!/usr/bin/env bash
# Naming-gate: verifies every user-visible label and cross-stack symbol introduced
# by the #360 changeset is documented in .github/docs/naming-decisions-360.md.
#
# Two checks:
#   1. Every string value exported from STRUCTURAL_GATE_REJECTION_REASON and
#      COMMODITY_SUPPRESSION_CAUSE in failureSemantics.js is present in the ledger.
#   2. Every vetted cross-stack metadata field key listed in the ledger exists in
#      both reliabilityMetadataFields.js AND reliability.go.
#
# Exit codes: 0 = all symbols covered; 1 = gap found.
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly LEDGER="${REPO_ROOT}/.github/docs/naming-decisions-360.md"
readonly FAILURE_SEMANTICS="${REPO_ROOT}/backend/src/controllers/commandExecutor/reliability/core/failureSemantics.js"
readonly METADATA_FIELDS="${REPO_ROOT}/backend/src/controllers/commandExecutor/reliability/core/reliabilityMetadataFields.js"
readonly GO_RELIABILITY="${REPO_ROOT}/backend-v2/internal/models/reliability.go"

FAILURES=0

fail() { printf 'NAMING-GATE FAIL: %s\n' "$*" >&2; FAILURES=$((FAILURES + 1)); }
ok()   { printf 'NAMING-GATE OK:   %s\n' "$*"; }

# ── Check 1: string values from tracked Object.freeze constants ───────────────
# Extract quoted string values from STRUCTURAL_GATE_REJECTION_REASON and
# COMMODITY_SUPPRESSION_CAUSE blocks in failureSemantics.js.
# Each block is an Object.freeze({ KEY: 'value', ... }) definition.
check_constant_coverage() {
  local const_name="$1"
  local in_block=0

  while IFS= read -r line; do
    if echo "$line" | grep -qF "export const ${const_name}"; then
      in_block=1
    fi
    if [ "$in_block" -eq 1 ]; then
      # Extract 'value' from lines like:  KEY: 'value',
      local value
      value=$(echo "$line" | sed -nE "s/.*: *'([^']+)'.*/\1/p")
      if [ -n "$value" ]; then
        if grep -qF "\`${value}\`" "$LEDGER"; then
          ok "${const_name}: '${value}' found in ledger"
        else
          fail "${const_name}: '${value}' has no ledger entry in ${LEDGER}"
        fi
      fi
      # Exit block when we see the closing })
      if echo "$line" | grep -qE '^\s*\}\)'; then
        in_block=0
      fi
    fi
  done < "$FAILURE_SEMANTICS"
}

check_constant_coverage "STRUCTURAL_GATE_REJECTION_REASON"
check_constant_coverage "COMMODITY_SUPPRESSION_CAUSE"

# ── Check 2: vetted cross-stack metadata field keys appear in both Node and Go ─
# Extract vetted wire-key entries from the metadata table in the ledger.
# Lines matching the table row pattern: | `key` | ... | vetted | ...
while IFS= read -r row; do
  # Extract the first backtick-quoted word from the row (the wire key column)
  wire_key=$(echo "$row" | sed -nE 's/^\| `([a-zA-Z]+)` .*/\1/p')
  [ -z "$wire_key" ] && continue

  # Check Node.js source contains the key (as a string or property)
  if grep -qE "['\"](${wire_key})['\"]|[^a-zA-Z](${wire_key}):" "$METADATA_FIELDS" 2>/dev/null; then
    ok "cross-stack: '${wire_key}' found in reliabilityMetadataFields.js"
  else
    fail "cross-stack: '${wire_key}' missing from reliabilityMetadataFields.js"
  fi

  # Check Go source contains the JSON tag
  if grep -qE "json:\"${wire_key}" "$GO_RELIABILITY" 2>/dev/null; then
    ok "cross-stack: '${wire_key}' json-tag found in reliability.go"
  else
    fail "cross-stack: '${wire_key}' json-tag missing from reliability.go"
  fi
done < <(grep -E '^\| `[a-zA-Z]' "$LEDGER" | grep 'vetted')

# ── Verdict ───────────────────────────────────────────────────────────────────
if [ "$FAILURES" -gt 0 ]; then
  printf '\nnaming-gate BLOCKED: %d symbol(s) lack ledger coverage — add rows to %s\n' \
    "$FAILURES" ".github/docs/naming-decisions-360.md" >&2
  exit 1
fi

printf '\nnaming-gate PASS: all tracked symbols covered in the ledger\n'
