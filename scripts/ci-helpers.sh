#!/bin/bash

DOCKER_NETWORK="${DOCKER_NETWORK:-d5-dev-network}"

log_info() { echo "→ $*"; }
log_success() { echo "✓ $*"; }
log_warning() { echo "⚠ $*"; }
log_error() { echo "✗ $*" >&2; }

ensure_docker_network() {
  docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1 || \
    docker network create "$DOCKER_NETWORK" >/dev/null 2>&1
}

lint_go() {
  local module_path="${1:-.}"
  cd "$module_path" || exit 1
  
  log_info "Formatting Go code..."
  if command -v gofmt >/dev/null 2>&1; then
    gofmt -s -w . 2>/dev/null || {
      log_warning "gofmt failed, using Docker..."
      ensure_docker_network
      docker run --rm --network "$DOCKER_NETWORK" \
        -v "$(pwd)":/app -w /app golang:1.23-alpine \
        sh -c 'gofmt -s -w .'
    }
  else
    log_warning "gofmt not installed, using Docker..."
    ensure_docker_network
    docker run --rm --network "$DOCKER_NETWORK" \
      -v "$(pwd)":/app -w /app golang:1.23-alpine \
      sh -c 'gofmt -s -w .'
  fi
  
  log_info "Running golangci-lint..."
  if command -v golangci-lint >/dev/null 2>&1; then
    golangci-lint run --timeout=5m --fix
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
      log_success "Lint passed (local)"
      return 0
    else
      log_warning "Local lint exit $exit_code, verifying with Docker..."
      ensure_docker_network
      docker run --rm --network "$DOCKER_NETWORK" \
        -v "$(pwd)":/app -w /app \
        golangci/golangci-lint:v1.62-alpine \
        golangci-lint run --timeout=5m --fix
      return $?
    fi
  else
    log_warning "golangci-lint not installed, using Docker..."
    ensure_docker_network
    docker run --rm --network "$DOCKER_NETWORK" \
      -v "$(pwd)":/app -w /app \
      golangci/golangci-lint:v1.62-alpine \
      golangci-lint run --timeout=5m --fix
    return $?
  fi
}

lint_dockerfile() {
  local dockerfile_path="${1:-Dockerfile}"
  local context_dir="${2:-.}"
  cd "$context_dir" || exit 1
  
  log_info "Linting Dockerfile..."
  if command -v hadolint >/dev/null 2>&1; then
    hadolint "$dockerfile_path"
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
      log_success "Dockerfile lint passed (local)"
      return 0
    else
      log_warning "Local hadolint exit $exit_code, verifying with Docker..."
      ensure_docker_network
      docker run --rm --network "$DOCKER_NETWORK" \
        -v "$(pwd)":/app -w /app \
        hadolint/hadolint:latest-debian \
        hadolint "$dockerfile_path"
      return $?
    fi
  else
    log_warning "hadolint not installed, using Docker..."
    ensure_docker_network
    docker run --rm --network "$DOCKER_NETWORK" \
      -v "$(pwd)":/app -w /app \
      hadolint/hadolint:latest-debian \
      hadolint "$dockerfile_path"
    return $?
  fi
}

lint_node() {
  local module_path="${1:-.}"
  cd "$module_path" || exit 1
  
  log_info "Linting Node.js code..."
  if [ -f package.json ]; then
    npm run lint
  else
    log_error "No package.json found in $module_path"
    return 1
  fi
}

# Top-level acceptance-test function names that must appear as "pass" in every
# test_go run. Add an entry when a new mandatory integration or concurrency suite
# is introduced. Remove an entry only when the corresponding test is deleted.
_BACKEND_V2_REQUIRED_ACCEPTANCE_TESTS=(
  "TestAddArrayItem_ScopeDocumentSingularity"
  "TestAddArrayItem_AliasUniquenessUnderConcurrency"
  "TestCrossTypeAliasValidation"
)

# Returns 0 when every name in the required-tests list appears as "pass" in the
# go-test JSON stream written to <json_file>. Logs each absent or non-passing
# test to stderr and returns 1 if any are missing, failed, or skipped.
_assert_acceptance_tests_passed() {
  local json_file="$1"; shift
  local all_passed=true

  for test_name in "$@"; do
    if ! grep -F '"Action":"pass"' "$json_file" | grep -qF '"Test":"'"${test_name}"'"'; then
      log_error "Acceptance test absent or did not pass: ${test_name}"
      all_passed=false
    fi
  done

  [ "$all_passed" = true ]
}

test_go() {
  local module_path="${1:-.}"
  cd "$module_path" || exit 1

  local capture_file
  capture_file="$(mktemp)"

  log_info "Running Go tests (tags: integration)..."

  local runner_exit
  if command -v go >/dev/null 2>&1; then
    go test -tags integration -json ./... 2>&1 | tee "$capture_file"
    runner_exit="${PIPESTATUS[0]}"
  else
    log_warning "Go not installed, using Docker..."
    ensure_docker_network
    docker run --rm --network "$DOCKER_NETWORK" \
      --env TEST_MONGO_URI="${TEST_MONGO_URI:-}" \
      -v "$(pwd)":/app -w /app golang:1.23-alpine \
      go test -tags integration -json ./... 2>&1 | tee "$capture_file"
    runner_exit="${PIPESTATUS[0]}"
  fi

  local assert_exit=0
  if [ "$runner_exit" -eq 0 ]; then
    _assert_acceptance_tests_passed "$capture_file" "${_BACKEND_V2_REQUIRED_ACCEPTANCE_TESTS[@]}"
    assert_exit=$?
  fi

  rm -f "$capture_file"
  [ "$runner_exit" -ne 0 ] && return "$runner_exit"
  return "$assert_exit"
}

test_node() {
  local module_path="${1:-.}"
  cd "$module_path" || exit 1
  
  log_info "Running Node.js tests..."
  if [ -f package.json ]; then
    npm test
  else
    log_error "No package.json found in $module_path"
    return 1
  fi
}

build_go() {
  local module_path="${1:-.}"
  local binary_name="${2:-service}"
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$module_path" || exit 1

  local version
  version="$("${script_dir}/version.sh")"

  log_info "Building Go binary via Docker (version: ${version})..."
  ensure_docker_network

  docker build --network "$DOCKER_NETWORK" --target builder \
    --build-arg "BUILD_VERSION=${version}" \
    -t "${binary_name}-builder" . > /tmp/go-build.log 2>&1 || {
    log_error "Build failed"
    tail -30 /tmp/go-build.log
    return 1
  }
  
  docker rm -f "temp-${binary_name}" 2>/dev/null || true
  docker create --name "temp-${binary_name}" "${binary_name}-builder"
  docker cp "temp-${binary_name}:/build/service" "./${binary_name}"
  docker rm -f "temp-${binary_name}"
  chmod +x "${binary_name}"
  
  log_success "Binary built: ${binary_name}"
}

build_node() {
  local module_path="${1:-.}"
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$module_path" || exit 1

  local version
  version="$("${script_dir}/version.sh")"

  log_info "Building Node.js project (version: ${version})..."
  BUILD_VERSION="${version}" npm run build > /tmp/node-build.log 2>&1 || {
    log_error "Build failed"
    tail -30 /tmp/node-build.log
    return 1
  }

  log_success "Build complete"
}

build_tool_go() {
  local module_path="${1:-.}"
  local tool_path="$2"
  local output_binary="$3"
  cd "$module_path" || exit 1
  
  if command -v go >/dev/null 2>&1; then
    go build -o "$output_binary" "$tool_path" 2>/dev/null || {
      log_warning "Local go build failed, using Docker..."
      ensure_docker_network
      docker run --rm --network "$DOCKER_NETWORK" \
        -v "$(pwd)":/app -w /app golang:1.23-alpine \
        go build -o "$output_binary" "$tool_path" > /dev/null 2>&1
    }
  else
    log_warning "Go not installed, using Docker..."
    ensure_docker_network
    docker run --rm --network "$DOCKER_NETWORK" \
      -v "$(pwd)":/app -w /app golang:1.23-alpine \
      go build -o "$output_binary" "$tool_path" > /dev/null 2>&1
  fi
}

sanitize_docker_tag() {
    local tag="$1"
    echo "$tag" | sed 's|/|-|g'
}

generate_docker_tag() {
    if [[ -n "${CI_MERGE_REQUEST_IID}" ]]; then
        echo "${CI_MERGE_REQUEST_IID}"
    elif [[ "${CI_COMMIT_REF_NAME}" != "${CI_COMMIT_REF_NAME/deploy/}" ]]; then
        echo "${CI_COMMIT_SHORT_SHA}"
    else
        local tag="${CI_COMMIT_REF_NAME}"
        if [[ "$tag" == "main" ]]; then
            tag="latest"
        fi
        sanitize_docker_tag "$tag"
    fi
}

generate_docker_name() {
    local base_name="$1"
    if [[ -n "${CI_MERGE_REQUEST_IID}" ]]; then
        echo "${base_name}-merge"
    elif [[ "${CI_COMMIT_REF_NAME}" != "${CI_COMMIT_REF_NAME/deploy/}" ]]; then
        echo "${base_name}-branch"
    else
        echo "${base_name}"
    fi
}

check_no_legacy_version_symbols() {
  local repo_root
  repo_root="$(cd "$(dirname "$0")/.." && pwd)"

  local patterns=(
    'BUILD_REVISION'
    'bakeRevision'
    'bakedRevision'
    'buildRevision'
    'revisionPlugin'
    'revision-plugin'
    'build-revision'
    'probe-revision'
    'BuildRevision'
  )
  local retired_ci_guard_make='check-no-stale-''revision'
  local retired_ci_guard_shell='check_no_stale_''revision'
  patterns+=("${retired_ci_guard_make}" "${retired_ci_guard_shell}")

  local pattern
  pattern="$(IFS='|'; echo "${patterns[*]}")"

  local hits
  hits=$(grep -rn \
    --include="*.go" --include="*.ts" --include="*.tsx" \
    --include="*.js" --include="*.json" --include="*.sh" \
    --include="Makefile" --include="*.md" \
    --exclude-dir=node_modules --exclude-dir=dist \
    --exclude-dir=logs --exclude-dir=.git \
    --exclude="ci-helpers.sh" \
    --exclude="TODO.md" \
    -E "$pattern" \
    "$repo_root/scripts" \
    "$repo_root/backend-v2" \
    "$repo_root/frontend/src" \
    "$repo_root/frontend/plugins" \
    "$repo_root/backend/src" \
    "$repo_root/backend/scripts" \
    "$repo_root/backend/package.json" \
    "$repo_root/Makefile" \
    "$repo_root/.github/docs" \
    2>/dev/null || true)

  # Also check Dockerfiles (exact filename, not matched by --include)
  local dockerfile_hits
  dockerfile_hits=$(grep -rn \
    --include="Dockerfile" \
    --exclude-dir=node_modules --exclude-dir=.git \
    -E "$pattern" \
    "$repo_root" 2>/dev/null || true)

  local lessons_hits=""
  if [ -f "$repo_root/.github/docs/lessons-360.md" ]; then
    lessons_hits=$(grep -n -E "$pattern" "$repo_root/.github/docs/lessons-360.md" 2>/dev/null || true)
  fi

  local all_hits="${hits}${dockerfile_hits}${lessons_hits}"

  if [ -n "$all_hits" ]; then
    log_error "Legacy build-version symbols found — rename is incomplete:"
    echo "$all_hits" >&2
    return 1
  fi

  log_success "No legacy build-version symbols found"
}

if [ -n "$1" ]; then
  "$@"
fi
