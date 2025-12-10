#!/bin/bash
# Validate .gitlab-ci.yml references to directories that must exist

set -e

echo "→ Validating .gitlab-ci.yml directory references..."

ERRORS=0

# Check critical directories referenced in CI
CRITICAL_DIRS=(
    "backend"
    "backend-v2"
    "backend-v2/e2e"
    "frontend"
    "plugins/chat-popup"
)

for dir in "${CRITICAL_DIRS[@]}"; do
    if [[ ! -d "$dir" ]]; then
        echo "✗ Critical directory missing: $dir"
        ERRORS=$((ERRORS + 1))
    fi
done

echo "→ Validating Docker tag sanitization..."

# Source CI helpers
source scripts/ci-helpers.sh

# Test tag sanitization with branch names containing /
TEST_BRANCHES=(
    "feature/307-ci-gitlab-github"
    "bugfix/auth-token"
    "release/v2.0.0"
)

for branch in "${TEST_BRANCHES[@]}"; do
    sanitized=$(sanitize_docker_tag "$branch")
    if [[ "$sanitized" =~ / ]]; then
        echo "✗ Docker tag sanitization failed for '$branch' → '$sanitized' (still contains /)"
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $ERRORS -eq 0 ]; then
    echo "✓ All CI validations passed"
    exit 0
else
    echo "✗ Found $ERRORS validation error(s)"
    exit 1
fi
