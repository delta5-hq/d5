#!/usr/bin/env bash
#
# Behavioral test suite for scripts/probe-version.sh.
#
# Cases name freshness-gate invariants, not a single syntax regression:
# syntax · usage · dev-sentinel · unreachable · missing-field · clean-match ·
# exact-endpoint-forwarding · stale-mismatch.
#
# Self-contained: no external test framework required.
# Exit:  0 when all cases pass, 1 on any failure.
# Run:   bash scripts/probe-version.test.sh

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROBE_SH="${SCRIPT_DIR}/probe-version.sh"
VERSION_SH="${SCRIPT_DIR}/version.sh"
REAL_GIT="$(command -v git)"

_pass=0
_fail=0

_ok() { _pass=$((_pass + 1)); printf '  ok  %s\n' "$1"; }
_err() { _fail=$((_fail + 1)); printf ' FAIL %s\n       %s\n' "$1" "$2" >&2; }

assert_eq() {
    local name="$1" want="$2" got="$3"
    [[ "$got" == "$want" ]] \
        && _ok "$name" \
        || _err "$name" "want $(printf '%q' "$want")  got $(printf '%q' "$got")"
}

assert_contains() {
    local name="$1" needle="$2" haystack="$3"
    [[ "$haystack" == *"$needle"* ]] \
        && _ok "$name" \
        || _err "$name" "want substring $(printf '%q' "$needle") in $(printf '%q' "$haystack")"
}

assert_not_contains() {
    local name="$1" needle="$2" haystack="$3"
    [[ "$haystack" != *"$needle"* ]] \
        && _ok "$name" \
        || _err "$name" "unexpected substring $(printf '%q' "$needle") in $(printf '%q' "$haystack")"
}

_summary() {
    printf '\n--- %d passed, %d failed\n' "$_pass" "$_fail"
    [[ "$_fail" -eq 0 ]]
}

WORK="$(mktemp -d -t probe-version-suite-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

_repo() {
    local dir="$WORK/$1"
    mkdir -p "$dir"
    "$REAL_GIT" -C "$dir" init -q
    "$REAL_GIT" -C "$dir" config user.email "t@t.t"
    "$REAL_GIT" -C "$dir" config user.name "T"
    printf 'content\n' > "$dir/file.txt"
    "$REAL_GIT" -C "$dir" add file.txt
    "$REAL_GIT" -C "$dir" commit -q -m "init"
    printf '%s' "$dir"
}

_expected_version() {
    (cd "$1" && source "${VERSION_SH}" && compute_version 2>/dev/null)
}

_fake_curl_dir() {
    local name="$1" body="$2" exit_code="${3:-0}" dir="$WORK/fake-curl-$name"
    mkdir -p "$dir"
    cat > "$dir/curl" <<EOF
#!/usr/bin/env bash
printf '%s' '${body}'
exit ${exit_code}
EOF
    chmod +x "$dir/curl"
    printf '%s' "$dir"
}

_fake_curl_expect_endpoint_dir() {
    local name="$1" expected_endpoint="$2" body="$3" dir="$WORK/fake-curl-$name"
    mkdir -p "$dir"
    cat > "$dir/curl" <<EOF
#!/usr/bin/env bash
actual="\${@: -1}"
if [[ "\$actual" != '${expected_endpoint}' ]]; then
  printf 'unexpected-endpoint:%s' "\$actual" >&2
  exit 44
fi
printf '%s' '${body}'
EOF
    chmod +x "$dir/curl"
    printf '%s' "$dir"
}

_run_probe() {
    local cwd="$1" path_prefix="$2" stdout="$3" stderr="$4"
    shift 4

    (
        cd "$cwd" || exit 99
        PATH="${path_prefix}:${PATH}" bash "${PROBE_SH}" "$@"
    ) >"$stdout" 2>"$stderr"
}

printf '\n=== syntax ===\n'

if bash -n "${PROBE_SH}"; then
    _ok "script parses before runtime probes"
else
    _err "script parses before runtime probes" "bash -n failed"
fi

printf '\n=== usage ===\n'

USAGE_STDOUT="$WORK/usage.out"
USAGE_STDERR="$WORK/usage.err"
if bash "${PROBE_SH}" >"$USAGE_STDOUT" 2>"$USAGE_STDERR"; then
    _err "no arguments: exits non-zero" "command exited 0"
else
    assert_eq "no arguments: exit status is 1" "1" "$?"
fi
assert_contains "no arguments: usage emitted to stderr" "Usage: probe-version.sh <name>=<version-url> [...]" "$(cat "$USAGE_STDERR")"

printf '\n=== dev sentinel ===\n'

DEV_DIR="$WORK/not-a-git-repo"
mkdir -p "$DEV_DIR"
DEV_CURL="$(_fake_curl_dir dev-sentinel 'curl-should-not-run' 99)"
DEV_STDOUT="$WORK/dev.out"
DEV_STDERR="$WORK/dev.err"
if _run_probe "$DEV_DIR" "$DEV_CURL" "$DEV_STDOUT" "$DEV_STDERR" "svc=http://example.invalid"; then
    _ok "dev sentinel: exits clean before service probes"
else
    _err "dev sentinel: exits clean before service probes" "exit $?"
fi
assert_contains "dev sentinel: explains unavailable staleness detection" 'Staleness detection unavailable' "$(cat "$DEV_STDOUT")"
assert_not_contains "dev sentinel: does not call curl" 'curl-should-not-run' "$(cat "$DEV_STDOUT")$(cat "$DEV_STDERR")"

printf '\n=== unreachable service ===\n'

REPO_UNREACHABLE="$(_repo unreachable)"
UNREACHABLE_CURL="$(_fake_curl_dir unreachable '' 22)"
UNREACHABLE_STDOUT="$WORK/unreachable.out"
UNREACHABLE_STDERR="$WORK/unreachable.err"
if _run_probe "$REPO_UNREACHABLE" "$UNREACHABLE_CURL" "$UNREACHABLE_STDOUT" "$UNREACHABLE_STDERR" "api=http://api.invalid/version"; then
    _err "unreachable service: exits non-zero" "command exited 0"
else
    assert_eq "unreachable service: exit status is 1" "1" "$?"
fi
assert_contains "unreachable service: names service and URL" 'BLOCKED [api]: version endpoint unreachable at http://api.invalid/version' "$(cat "$UNREACHABLE_STDERR")"

printf '\n=== missing version field ===\n'

REPO_MISSING="$(_repo missing-field)"
MISSING_CURL="$(_fake_curl_dir missing-field '{"status":"ok"}')"
MISSING_STDOUT="$WORK/missing.out"
MISSING_STDERR="$WORK/missing.err"
if _run_probe "$REPO_MISSING" "$MISSING_CURL" "$MISSING_STDOUT" "$MISSING_STDERR" "api=http://api.invalid/version"; then
    _err "missing version field: exits non-zero" "command exited 0"
else
    assert_eq "missing version field: exit status is 1" "1" "$?"
fi
assert_contains "missing version field: body is surfaced" 'response missing "version" field' "$(cat "$MISSING_STDERR")"

printf '\n=== clean match ===\n'

REPO_CLEAN="$(_repo clean-match)"
EXPECTED_CLEAN="$(_expected_version "$REPO_CLEAN")"
CLEAN_CURL="$(_fake_curl_dir clean-match "{\"version\":\"${EXPECTED_CLEAN}\"}")"
CLEAN_STDOUT="$WORK/clean.out"
CLEAN_STDERR="$WORK/clean.err"
if _run_probe "$REPO_CLEAN" "$CLEAN_CURL" "$CLEAN_STDOUT" "$CLEAN_STDERR" "api=http://api.invalid/version"; then
    _ok "clean match: exits zero"
else
    _err "clean match: exits zero" "exit $?"
fi
assert_contains "clean match: emits CLEAN verdict" "CLEAN [api]: version ${EXPECTED_CLEAN}" "$(cat "$CLEAN_STDOUT")"
assert_contains "clean match: emits all-services summary" '✓ All services match working-tree version' "$(cat "$CLEAN_STDOUT")"
assert_eq "clean match: stderr is empty" "" "$(cat "$CLEAN_STDERR")"


printf '\n=== exact endpoint forwarding ===\n'

REPO_EXACT="$(_repo exact-endpoint)"
EXPECTED_EXACT="$(_expected_version "$REPO_EXACT")"

while IFS='|' read -r case_name service endpoint; do
    [ -z "$case_name" ] && continue
    CASE_CURL="$(_fake_curl_expect_endpoint_dir "exact-${case_name}" "$endpoint" "{\"version\":\"${EXPECTED_EXACT}\"}")"
    CASE_STDOUT="$WORK/exact-${case_name}.out"
    CASE_STDERR="$WORK/exact-${case_name}.err"

    if _run_probe "$REPO_EXACT" "$CASE_CURL" "$CASE_STDOUT" "$CASE_STDERR" "${service}=${endpoint}"; then
        _ok "exact endpoint forwarding: ${case_name} exits zero"
    else
        _err "exact endpoint forwarding: ${case_name} exits zero" "exit $? stderr $(cat "$CASE_STDERR")"
    fi

    assert_contains "exact endpoint forwarding: ${case_name} emits CLEAN verdict" \
        "CLEAN [${service}]: version ${EXPECTED_EXACT}" \
        "$(cat "$CASE_STDOUT")"
    assert_eq "exact endpoint forwarding: ${case_name} stderr is empty" "" "$(cat "$CASE_STDERR")"
done <<'ENDPOINT_CASES'
go-api-root|go-backend|http://api.invalid/api/v2/version
root-version|node-backend|http://api.invalid/version
query-string|frontend|http://api.invalid/assets/version?cache=off&token=a=b
ENDPOINT_CASES

printf '\n=== stale mismatch ===\n'

REPO_STALE="$(_repo stale-mismatch)"
EXPECTED_STALE="$(_expected_version "$REPO_STALE")"
STALE_CURL="$(_fake_curl_dir stale-mismatch '{"version":"stale-version"}')"
STALE_STDOUT="$WORK/stale.out"
STALE_STDERR="$WORK/stale.err"
if _run_probe "$REPO_STALE" "$STALE_CURL" "$STALE_STDOUT" "$STALE_STDERR" "api=http://api.invalid/version"; then
    _err "stale mismatch: exits non-zero" "command exited 0"
else
    assert_eq "stale mismatch: exit status is 1" "1" "$?"
fi
assert_contains "stale mismatch: reports running and expected versions" "BLOCKED [api]: running=stale-version  expected=${EXPECTED_STALE}" "$(cat "$STALE_STDERR")"
assert_contains "stale mismatch: emits rebuild instruction" 'service(s) outdated — rebuild and restart before probing' "$(cat "$STALE_STDERR")"

_summary
