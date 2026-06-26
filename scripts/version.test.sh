#!/usr/bin/env bash
#
# Behavioral test suite for scripts/version.sh.
#
# Each case names an algorithm invariant — not a bug reference or implementation
# detail.  Groups: format · sentinel-fallbacks · fallback-chain · idempotency ·
# content-sensitivity · content-addressing · isolation · mode-parity.
#
# Self-contained: no external test framework required.
# Exit:  0 when all cases pass, 1 on any failure.
# Run:   bash scripts/version.test.sh

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_SH="${SCRIPT_DIR}/version.sh"
REAL_GIT="$(command -v git)"

# ---------------------------------------------------------------------------

_pass=0
_fail=0

_ok()   { _pass=$((_pass + 1)); printf '  ok  %s\n' "$1"; }
_err()  { _fail=$((_fail + 1)); printf ' FAIL %s\n       %s\n' "$1" "$2" >&2; }

assert_eq() {
    local name="$1" want="$2" got="$3"
    [[ "$got" == "$want" ]] \
        && _ok "$name" \
        || _err "$name" "want $(printf '%q' "$want")  got $(printf '%q' "$got")"
}

assert_not_eq() {
    local name="$1" unexpected="$2" got="$3"
    [[ "$got" != "$unexpected" ]] \
        && _ok "$name" \
        || _err "$name" "expected values to differ, both are $(printf '%q' "$got")"
}

assert_matches() {
    local name="$1" pattern="$2" got="$3"
    [[ "$got" =~ $pattern ]] \
        && _ok "$name" \
        || _err "$name" "want pattern /${pattern}/  got $(printf '%q' "$got")"
}

_summary() {
    printf '\n--- %d passed, %d failed\n' "$_pass" "$_fail"
    [[ "$_fail" -eq 0 ]]
}

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

WORK="$(mktemp -d -t version-suite-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

# Create an isolated git repo with one committed file; prints the repo path.
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

# Uses $REAL_GIT (absolute path) to prevent infinite recursion when the fake directory is prepended to PATH.
_fake_git() {
    local subcmd="$1" dir="$WORK/fake-git-${subcmd}"
    mkdir -p "$dir"
    printf '#!/usr/bin/env bash\n[[ "$1" == "%s" ]] && exit 1\nexec %s "$@"\n' \
        "$subcmd" "$REAL_GIT" > "$dir/git"
    chmod +x "$dir/git"
    printf '%s' "$dir"
}

# Preserves the rest of PATH so bash, mktemp, and other tools remain available inside the script under test.
_fake_git_unavailable() {
    local dir="$WORK/fake-git-unavailable"
    mkdir -p "$dir"
    printf '#!/usr/bin/env bash\nexit 1\n' > "$dir/git"
    chmod +x "$dir/git"
    printf '%s' "$dir"
}

# Run version.sh as a standalone command (exercises the if __main__ code path).
_cmd() { (cd "$1" && bash "${VERSION_SH}" 2>/dev/null); }

# Run version.sh as a command with a PATH prefix (for fake-git injection).
# Keeps the rest of PATH intact so bash, mktemp, find, etc. remain usable.
_cmd_path() { (cd "$1" && PATH="$2:${PATH}" bash "${VERSION_SH}" 2>/dev/null); }

# Run compute_version via library mode (source then call).
_lib() { (cd "$1" && source "${VERSION_SH}" && compute_version 2>/dev/null); }

# ---------------------------------------------------------------------------
# format — output shape contract
# ---------------------------------------------------------------------------

printf '\n=== format ===\n'

REPO_FMT=$(_repo format)
HEAD_FMT="$("$REAL_GIT" -C "$REPO_FMT" rev-parse HEAD)"

assert_matches \
    "clean repo: output is <40-hex>+<40-hex>" \
    '^[0-9a-f]{40}\+[0-9a-f]{40}$' \
    "$(_cmd "$REPO_FMT")"

assert_matches \
    "clean repo: commit portion equals HEAD sha" \
    "^${HEAD_FMT}" \
    "$(_cmd "$REPO_FMT")"

# ---------------------------------------------------------------------------
# sentinel fallbacks — when git information is unavailable
# ---------------------------------------------------------------------------

printf '\n=== sentinel fallbacks ===\n'

REPO_SENTINEL=$(_repo sentinel)
FAKE_UNAVAIL="$(_fake_git_unavailable)"

assert_eq \
    "git unavailable (all commands fail): produces dev sentinel" \
    "dev" \
    "$(_cmd_path "$REPO_SENTINEL" "$FAKE_UNAVAIL")"

REPO_NO_COMMITS="$WORK/no-commits"
mkdir -p "$REPO_NO_COMMITS"
"$REAL_GIT" -C "$REPO_NO_COMMITS" init -q

assert_eq \
    "git repo with no commits: produces dev sentinel" \
    "dev" \
    "$(_cmd "$REPO_NO_COMMITS")"

# ---------------------------------------------------------------------------
# fallback chain — graceful degradation when tree computation fails
# ---------------------------------------------------------------------------

printf '\n=== fallback chain ===\n'

REPO_CHAIN=$(_repo chain)
HEAD_CHAIN="$("$REAL_GIT" -C "$REPO_CHAIN" rev-parse HEAD)"
FAKE_ADD="$(_fake_git add)"

assert_eq \
    "git-add failure: falls back to bare 40-hex commit sha" \
    "$HEAD_CHAIN" \
    "$(_cmd_path "$REPO_CHAIN" "$FAKE_ADD")"

assert_matches \
    "git-add failure: bare commit sha matches 40-hex format (no + separator)" \
    '^[0-9a-f]{40}$' \
    "$(_cmd_path "$REPO_CHAIN" "$FAKE_ADD")"

FAKE_WT_CHAIN="$(_fake_git write-tree)"

assert_eq \
    "git write-tree failure: falls back to bare 40-hex commit sha" \
    "$HEAD_CHAIN" \
    "$(_cmd_path "$REPO_CHAIN" "$FAKE_WT_CHAIN")"

assert_matches \
    "git write-tree failure: bare commit sha matches 40-hex format (no + separator)" \
    '^[0-9a-f]{40}$' \
    "$(_cmd_path "$REPO_CHAIN" "$FAKE_WT_CHAIN")"

# ---------------------------------------------------------------------------
# idempotency — repeated calls on an unchanged working tree
# ---------------------------------------------------------------------------

printf '\n=== idempotency ===\n'

REPO_IDEM=$(_repo idempotency)
REV_IDEM_1=$(_cmd "$REPO_IDEM")
REV_IDEM_2=$(_cmd "$REPO_IDEM")
REV_IDEM_3=$(_cmd "$REPO_IDEM")

assert_eq "same working tree, second invocation: output unchanged" "$REV_IDEM_1" "$REV_IDEM_2"
assert_eq "same working tree, third invocation: output unchanged"  "$REV_IDEM_1" "$REV_IDEM_3"

# ---------------------------------------------------------------------------
# content sensitivity — any content change must produce a different revision
# ---------------------------------------------------------------------------

printf '\n=== content sensitivity ===\n'

REPO_SENS=$(_repo sensitivity)
REV_SENS_CLEAN=$(_cmd "$REPO_SENS")

printf 'changed\n' >> "$REPO_SENS/file.txt"
assert_not_eq \
    "unstaged content change: revision differs from committed state" \
    "$REV_SENS_CLEAN" \
    "$(_cmd "$REPO_SENS")"

"$REAL_GIT" -C "$REPO_SENS" checkout -- file.txt
assert_eq \
    "restored working tree: revision matches original committed state" \
    "$REV_SENS_CLEAN" \
    "$(_cmd "$REPO_SENS")"

printf 'staged\n' >> "$REPO_SENS/file.txt"
"$REAL_GIT" -C "$REPO_SENS" add file.txt
assert_not_eq \
    "staged content change: revision differs from committed state" \
    "$REV_SENS_CLEAN" \
    "$(_cmd "$REPO_SENS")"

# ---------------------------------------------------------------------------
# content addressing — mtime changes without content changes are transparent
# ---------------------------------------------------------------------------

printf '\n=== content addressing ===\n'

REPO_MTIME=$(_repo mtime)
REV_MTIME_BEFORE=$(_cmd "$REPO_MTIME")

touch -t 200001010000 "$REPO_MTIME/file.txt"   # past mtime, identical content

assert_eq \
    "mtime-only change (no content change): revision unchanged" \
    "$REV_MTIME_BEFORE" \
    "$(_cmd "$REPO_MTIME")"

# ---------------------------------------------------------------------------
# isolation — real .git/index and /tmp must not be polluted
# ---------------------------------------------------------------------------

printf '\n=== isolation ===\n'

REPO_ISO=$(_repo isolation)
IDX_MTIME_BEFORE="$(stat -c '%Y' "$REPO_ISO/.git/index")"
_cmd "$REPO_ISO" > /dev/null
IDX_MTIME_AFTER="$(stat -c '%Y' "$REPO_ISO/.git/index")"

assert_eq \
    ".git/index mtime: unmodified after compute_version" \
    "$IDX_MTIME_BEFORE" "$IDX_MTIME_AFTER"

LEAK_BEFORE="$(find /tmp -maxdepth 1 -name 'git-wtree-*' 2>/dev/null | wc -l)"
_cmd "$REPO_ISO" > /dev/null
LEAK_AFTER="$(find /tmp -maxdepth 1 -name 'git-wtree-*' 2>/dev/null | wc -l)"

assert_eq \
    "temp index file: none left after successful invocation" \
    "$LEAK_BEFORE" "$LEAK_AFTER"

FAKE_WT="$(_fake_git write-tree)"
LEAK_FAIL_BEFORE="$(find /tmp -maxdepth 1 -name 'git-wtree-*' 2>/dev/null | wc -l)"
_cmd_path "$REPO_ISO" "$FAKE_WT" > /dev/null
LEAK_FAIL_AFTER="$(find /tmp -maxdepth 1 -name 'git-wtree-*' 2>/dev/null | wc -l)"

assert_eq \
    "temp index file: none left after failed write-tree (error-path cleanup)" \
    "$LEAK_FAIL_BEFORE" "$LEAK_FAIL_AFTER"

# ---------------------------------------------------------------------------
# mode parity — library mode and command mode must produce identical output
# ---------------------------------------------------------------------------

printf '\n=== mode parity ===\n'

REPO_PARITY=$(_repo parity)

assert_eq \
    "library mode (source+call) and command mode (bash script): identical output" \
    "$(_lib "$REPO_PARITY")" \
    "$(_cmd "$REPO_PARITY")"

# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# dirty indicator — [dirty] suffix presence and format
# ---------------------------------------------------------------------------

printf '\n=== dirty indicator ===\n'

REPO_DIRTY_UNSTAGED=$(_repo dirty-unstaged)
REV_DIRTY_CLEAN=$(_cmd "$REPO_DIRTY_UNSTAGED")

printf 'changed\n' >> "$REPO_DIRTY_UNSTAGED/file.txt"
REV_DIRTY_UNSTAGED=$(_cmd "$REPO_DIRTY_UNSTAGED")

assert_matches \
    "unstaged change: revision carries [dirty] suffix" \
    '\[dirty\]$' \
    "$REV_DIRTY_UNSTAGED"

assert_matches \
    "unstaged change: format is <40-hex>+<40-hex>[dirty]" \
    '^[0-9a-f]{40}\+[0-9a-f]{40}\[dirty\]$' \
    "$REV_DIRTY_UNSTAGED"

REPO_DIRTY_STAGED=$(_repo dirty-staged)

printf 'staged\n' >> "$REPO_DIRTY_STAGED/file.txt"
"$REAL_GIT" -C "$REPO_DIRTY_STAGED" add file.txt

assert_matches \
    "staged change: revision carries [dirty] suffix" \
    '\[dirty\]$' \
    "$(_cmd "$REPO_DIRTY_STAGED")"

REPO_DIRTY_RESTORED=$(_repo dirty-restored)
REV_DIRTY_RESTORED_CLEAN=$(_cmd "$REPO_DIRTY_RESTORED")

printf 'changed\n' >> "$REPO_DIRTY_RESTORED/file.txt"
"$REAL_GIT" -C "$REPO_DIRTY_RESTORED" checkout -- file.txt
REV_DIRTY_RESTORED=$(_cmd "$REPO_DIRTY_RESTORED")

assert_eq \
    "restored working tree: matches clean baseline, no [dirty] suffix" \
    "$REV_DIRTY_RESTORED_CLEAN" \
    "$REV_DIRTY_RESTORED"

assert_matches \
    "restored working tree: format is <40-hex>+<40-hex> (no [dirty] suffix)" \
    '^[0-9a-f]{40}\+[0-9a-f]{40}$' \
    "$REV_DIRTY_RESTORED"


# untracked new file — dirty detection covers files not yet tracked by git

REPO_DIRTY_UNTRACKED=$(_repo dirty-untracked)
printf 'new content\n' > "$REPO_DIRTY_UNTRACKED/newfile.txt"

assert_matches \
    "untracked new file: revision carries [dirty] suffix" \
    '\[dirty\]$' \
    "$(_cmd "$REPO_DIRTY_UNTRACKED")"

assert_matches \
    "untracked new file: format is <40-hex>+<40-hex>[dirty]" \
    '^[0-9a-f]{40}\+[0-9a-f]{40}\[dirty\]$' \
    "$(_cmd "$REPO_DIRTY_UNTRACKED")"

# mode parity under dirty — library and command modes must agree on [dirty] suffix

REPO_DIRTY_PARITY=$(_repo dirty-parity)
printf 'parity-change\n' >> "$REPO_DIRTY_PARITY/file.txt"
REV_DIRTY_LIB=$(_lib "$REPO_DIRTY_PARITY")
REV_DIRTY_CMD=$(_cmd "$REPO_DIRTY_PARITY")

assert_eq \
    "dirty working tree: library mode and command mode produce identical [dirty] revision" \
    "$REV_DIRTY_LIB" \
    "$REV_DIRTY_CMD"

assert_matches \
    "dirty parity: both modes carry [dirty] suffix" \
    '\[dirty\]$' \
    "$REV_DIRTY_CMD"

# idempotency under dirty — same dirty tree called twice yields identical revision

REPO_DIRTY_IDEM=$(_repo dirty-idempotency)
printf 'dirty-content\n' >> "$REPO_DIRTY_IDEM/file.txt"
REV_DIRTY_IDEM_1=$(_cmd "$REPO_DIRTY_IDEM")
REV_DIRTY_IDEM_2=$(_cmd "$REPO_DIRTY_IDEM")

assert_eq \
    "dirty working tree: repeated calls produce identical revision" \
    "$REV_DIRTY_IDEM_1" \
    "$REV_DIRTY_IDEM_2"

assert_matches \
    "dirty working tree idempotency: revision carries [dirty] on both calls" \
    '\[dirty\]$' \
    "$REV_DIRTY_IDEM_1"

# after commit — committing dirty changes produces a clean revision (no [dirty] suffix)

REPO_POST_COMMIT=$(_repo post-commit)
printf 'committed-change\n' >> "$REPO_POST_COMMIT/file.txt"
"$REAL_GIT" -C "$REPO_POST_COMMIT" add file.txt
"$REAL_GIT" -C "$REPO_POST_COMMIT" commit -q -m "second"
REV_POST_COMMIT=$(_cmd "$REPO_POST_COMMIT")

assert_matches \
    "committed change: revision is <40-hex>+<40-hex> (no [dirty] suffix)" \
    '^[0-9a-f]{40}\+[0-9a-f]{40}$' \
    "$REV_POST_COMMIT"

# ---------------------------------------------------------------------------
_summary
