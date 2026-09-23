#!/usr/bin/env bash
# Runs the backend-v2 e2e suite N consecutive times and emits a structured
# audit log. Exits 1 (BLOCKED) when any test run fails; exits 2 when the
# per-run DB reset command itself fails.
#
# Scope: proves DB-isolated run-to-run STABILITY — every run starts from a
# freshly-reset DB (DETERMINISM_RESET_CMD). It does NOT restart the backend
# between runs, so long-lived in-process/server state is shared across the N
# runs and a race that only manifests through it is out of this gate's scope.
#
# Usage:  determinism-gate-backend-v2.sh [RUNS]
#
# Env vars (all optional — defaults shown):
#   E2E_SERVER_URL        backend base URL      (http://localhost:3002)
#   E2E_API_BASE_PATH     API prefix            (/api/v2)
#   E2E_MONGO_URI         MongoDB URI for tests (mongodb://localhost:27017/delta5)
#   E2E_DIR               path to e2e dir       (backend-v2/e2e)
#   DETERMINISM_LOG       audit log path        (determinism-audit.log)
#   DETERMINISM_RESET_CMD shell command run before every test run to restore
#                         a known-good DB state; unset = no per-run isolation
set -euo pipefail

# Anchor to repo root so E2E_DIR and the audit log resolve regardless of cwd.
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ── Configuration ─────────────────────────────────────────────────────────────
readonly RUNS="${1:-20}"
readonly E2E_DIR="${E2E_DIR:-backend-v2/e2e}"
readonly AUDIT_LOG="${DETERMINISM_LOG:-determinism-audit.log}"
readonly E2E_SERVER_URL="${E2E_SERVER_URL:-http://localhost:3002}"
readonly E2E_API_BASE_PATH="${E2E_API_BASE_PATH:-/api/v2}"
readonly E2E_MONGO_URI="${E2E_MONGO_URI:-mongodb://localhost:27017/delta5}"
readonly DETERMINISM_RESET_CMD="${DETERMINISM_RESET_CMD:-}"
# Export env vars so the npm subprocess inherits them without prefix reassignment
# (bash forbids reassigning readonly variables even in a command-prefix context).
export E2E_SERVER_URL E2E_API_BASE_PATH E2E_MONGO_URI

PASS=0
FAIL=0
FAILED_RUNS=()

log() { printf '%s\n' "$*" | tee -a "$AUDIT_LOG"; }

emit_header() {
  local reset_label="${DETERMINISM_RESET_CMD:-<none — no per-run isolation>}"
  {
    echo "determinism-gate: backend-v2 e2e — ${RUNS} consecutive runs"
    echo "e2e dir:    ${E2E_DIR}"
    echo "server url: ${E2E_SERVER_URL}${E2E_API_BASE_PATH}"
    echo "db reset:   ${reset_label}"
    echo "scope:      DB-isolated run-to-run stability (backend NOT restarted per run)"
    echo "started:    $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "---"
  } | tee "$AUDIT_LOG"
}

reset_db() {
  local run_num="$1"
  [ -z "$DETERMINISM_RESET_CMD" ] && return 0
  log "  reset[$run_num]: ${DETERMINISM_RESET_CMD}"
  if ! bash -c "$DETERMINISM_RESET_CMD" >> "$AUDIT_LOG" 2>&1; then
    log "  [FATAL] DB reset failed at run ${run_num} — aborting gate"
    exit 2
  fi
}

run_e2e_once() {
  local run_num="$1"
  local run_start; run_start="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  local run_log;   run_log="$(mktemp)"

  local status
  if npm test --prefix "$E2E_DIR" --silent > "$run_log" 2>&1; then
    PASS=$((PASS + 1))
    status="PASS"
  else
    FAIL=$((FAIL + 1))
    FAILED_RUNS+=("$run_num")
    status="FAIL"
    cat "$run_log" >> "$AUDIT_LOG"
  fi

  log "[${run_start}] run ${run_num}/${RUNS}: ${status}  (${PASS} passed, ${FAIL} failed)"
  rm -f "$run_log"
}

emit_footer() {
  log "---"
  log "result: ${PASS}/${RUNS} passed, ${FAIL}/${RUNS} failed"
  log "finished: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}

report_verdict() {
  if [ "${FAIL}" -gt 0 ]; then
    log "BLOCKED: ${FAIL} of ${RUNS} e2e run(s) failed — non-determinism detected. Failed runs: ${FAILED_RUNS[*]}. See ${AUDIT_LOG}."
    exit 1
  fi
  echo "determinism-gate PASS: all ${RUNS} runs green"
}

# ── Isolation guard ───────────────────────────────────────────────────────────
# A PASS across N>1 runs without a REAL per-run DB reset cannot distinguish
# genuine determinism from test-harness state carry-over. Refuse loudly when the
# reset command is missing OR a known no-op (e.g. `true`, `:`), so the guarantee
# cannot be silently lost by an omitted or hollow reset command.
reset_is_noop() {
  case "$(printf '%s' "${DETERMINISM_RESET_CMD}" | tr -d '[:space:]')" in
    ''|:|true|/bin/true|/usr/bin/true) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  cd "$REPO_ROOT"

  if [ "${RUNS}" -gt 1 ] && reset_is_noop; then
    echo "determinism-gate: BLOCKED — a real per-run DB reset is required when RUNS > 1 (RUNS=${RUNS}); missing or no-op DETERMINISM_RESET_CMD ('${DETERMINISM_RESET_CMD}') cannot prove determinism" | tee -a "${AUDIT_LOG}"
    exit 1
  fi

  emit_header

  local i
  for i in $(seq 1 "$RUNS"); do
    reset_db "$i"
    run_e2e_once "$i"
  done

  emit_footer
  report_verdict
}

main "$@"
