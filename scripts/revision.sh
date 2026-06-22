#!/usr/bin/env bash
#
# Revision string: <commit-sha>+<tree-sha>[dirty]  — or "dev" when git is unavailable.
#
# <tree-sha> reflects the full working tree (staged + unstaged) by hashing
# a temporary git index that never touches .git/index.  Two invocations with
# identical working-tree contents produce the same string; any modified or
# new file produces a different string.
#
# [dirty] is appended when the working tree differs from the HEAD tree.
#
# Library:  source scripts/revision.sh && rev=$(compute_revision)
# Command:  bash scripts/revision.sh

_git_head_sha() {
    git rev-parse HEAD 2>/dev/null
}

_git_head_tree_sha() {
    git rev-parse HEAD^{tree} 2>/dev/null
}

# Hashes the entire working tree into a git tree object via a private temporary
# index so the real .git/index is never modified.
_git_working_tree_sha() {
    local tmp_index
    tmp_index="$(mktemp -t git-wtree-XXXXXX)" || return 1
    # mktemp creates a 0-byte file; git rejects it as malformed.  Remove it so
    # git initialises a valid empty index at this guaranteed-unique path.
    rm -f "${tmp_index}"
    # SC2064: expand now so the correct path is baked into the trap string.
    # shellcheck disable=SC2064
    trap "rm -f '${tmp_index}'" RETURN
    GIT_INDEX_FILE="${tmp_index}" git add --all 2>/dev/null || return 1
    GIT_INDEX_FILE="${tmp_index}" git write-tree 2>/dev/null
}

compute_revision() {
    local commit tree_sha head_tree dirty_suffix
    commit="$(_git_head_sha)" || { printf '%s' 'dev'; return 0; }
    tree_sha="$(_git_working_tree_sha)" || { printf '%s' "${commit}"; return 0; }
    head_tree="$(_git_head_tree_sha)" || head_tree=""
    dirty_suffix=""
    [[ -n "${head_tree}" && "${tree_sha}" != "${head_tree}" ]] && dirty_suffix="[dirty]"
    printf '%s' "${commit}+${tree_sha}${dirty_suffix}"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    compute_revision
fi
