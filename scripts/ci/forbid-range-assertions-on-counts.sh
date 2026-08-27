#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCANNER="${SCRIPT_DIR}/scan-range-assertions.mjs"

exec node "${SCANNER}" "${REPO_ROOT}/backend/src" "${REPO_ROOT}/frontend/src" "${REPO_ROOT}/frontend/e2e"
