#!/usr/bin/env bash
# Synthetic unit tests for ci-helpers.sh shell functions.
# Run: bash scripts/ci-helpers.test.sh
# Exit 0 = all pass; non-zero = at least one failure.
set -eo pipefail

PASS=0; FAIL=0
ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1" >&2; FAIL=$((FAIL+1)); }

# shellcheck source=scripts/ci-helpers.sh
source "$(dirname "$0")/ci-helpers.sh"

echo "assert_e2e_disk_free"

df() { printf 'Avail\n12582912\n'; }
export -f df

if assert_e2e_disk_free 10 >/dev/null 2>&1; then
  ok "passes when available (12G) >= required (10G)"
else
  fail "should pass when 12G >= 10G"
fi

if ! assert_e2e_disk_free 20 >/dev/null 2>&1; then
  ok "fails when available (12G) < required (20G)"
else
  fail "should fail when 12G < 20G"
fi

df() { printf 'Avail\n5242880\n'; }
export -f df

if assert_e2e_disk_free 5 >/dev/null 2>&1; then
  ok "passes when available equals required (5G == 5G)"
else
  fail "should pass when 5G == 5G"
fi

# 1 KB: integer division truncates to 0 G, so even a 1G requirement fails
df() { printf 'Avail\n1\n'; }
export -f df

if ! assert_e2e_disk_free 1 >/dev/null 2>&1; then
  ok "fails when 1 KB available (truncates to 0G < 1G)"
else
  fail "integer division should truncate 1 KB to 0 G, failing the check"
fi

unset -f df

df() { printf 'Avail\n5242880\n'; }
export -f df

E2E_DISK_MIN_GB=3 assert_e2e_disk_free >/dev/null 2>&1 && \
  ok "no-arg call uses E2E_DISK_MIN_GB (5G >= 3G)" || \
  fail "no-arg call should use E2E_DISK_MIN_GB env var"

E2E_DISK_MIN_GB=8 assert_e2e_disk_free >/dev/null 2>&1 && \
  fail "no-arg call should respect E2E_DISK_MIN_GB=8 and fail (5G < 8G)" || \
  ok "no-arg call respects E2E_DISK_MIN_GB when available < required"

unset E2E_DISK_MIN_GB
assert_e2e_disk_free >/dev/null 2>&1 && \
  fail "no-arg no-env call should use hardcoded default 10G and fail (5G < 10G)" || \
  ok "no-arg no-env call falls back to hardcoded 10G default"

unset -f df

echo "reclaim_e2e_artefacts"

TMPDIR_BASE=$(mktemp -d)
mkdir -p "${TMPDIR_BASE}/frontend/test-results"
mkdir -p "${TMPDIR_BASE}/frontend/playwright-report"
mkdir -p "${TMPDIR_BASE}/backend-v2/e2e/.jest-cache"

(
  cd "${TMPDIR_BASE}"
  reclaim_e2e_artefacts >/dev/null 2>&1
  if [ ! -d frontend/test-results ] && [ ! -d frontend/playwright-report ] && [ ! -d backend-v2/e2e/.jest-cache ]; then
    ok "reclaim_e2e_artefacts removes all artefact directories"
  else
    fail "reclaim_e2e_artefacts should remove frontend/test-results, playwright-report, and .jest-cache"
  fi
)
rm -rf "${TMPDIR_BASE}"

echo "git hook pipefail exit-code propagation"

no_pipefail_exit=$(bash -c 'false | tee /dev/null; echo $?' 2>/dev/null)
if [ "$no_pipefail_exit" = "0" ]; then
  ok "without pipefail, 'false | tee' exits 0 (the problem we're fixing)"
else
  fail "expected 0 without pipefail, got $no_pipefail_exit"
fi

pipefail_exit=$(bash -c 'set -o pipefail; false | tee /dev/null; echo $?' 2>/dev/null)
if [ "$pipefail_exit" = "1" ]; then
  ok "with pipefail, 'false | tee' exits 1 (failure preserved)"
else
  fail "expected 1 with pipefail, got $pipefail_exit"
fi

for hook in .git-hooks/pre-commit .git-hooks/pre-push; do
  first_line=$(head -1 "$hook")
  if [ "$first_line" = "#!/bin/bash" ]; then
    ok "$hook uses #!/bin/bash shebang"
  else
    fail "$hook shebang is '$first_line', expected '#!/bin/bash'"
  fi
  if grep -q 'set -o pipefail' "$hook"; then
    ok "$hook contains 'set -o pipefail'"
  else
    fail "$hook is missing 'set -o pipefail'"
  fi
done

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
