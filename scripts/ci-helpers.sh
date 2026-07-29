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

test_go() {
  local module_path="${1:-.}"
  cd "$module_path" || exit 1
  
  log_info "Running Go unit tests..."
  if command -v go >/dev/null 2>&1; then
    go test -v ./...
  else
    log_warning "Go not installed, using Docker..."
    ensure_docker_network
    docker run --rm --network "$DOCKER_NETWORK" \
      -v "$(pwd)":/app -w /app golang:1.23-alpine \
      go test -v ./...
  fi
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
  local build_network="${DOCKER_BUILD_NETWORK:-$DOCKER_NETWORK}"
  cd "$module_path" || exit 1
  
  log_info "Building Go binary via Docker..."

  if [ -z "${DOCKER_BUILD_NETWORK:-}" ]; then
    ensure_docker_network
  fi
  
  docker build --network "$build_network" --target builder -t "${binary_name}-builder" . > /tmp/go-build.log 2>&1 || {
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
  cd "$module_path" || exit 1
  
  log_info "Building Node.js project..."
  npm run build > /tmp/node-build.log 2>&1 || {
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

assert_e2e_disk_free() {
  local required_gb="${1:-${E2E_DISK_MIN_GB:-10}}"
  local avail_kb avail_gb
  avail_kb=$(df --output=avail / | tail -1 | tr -d ' ')
  avail_gb=$((avail_kb / 1024 / 1024))
  if [ "$avail_gb" -lt "$required_gb" ]; then
    log_error "INSUFFICIENT_DISK_SPACE: free=${avail_gb}G required=${required_gb}G; run \`scripts/ci-helpers.sh reclaim_e2e_artefacts\`"
    return 1
  fi
  log_success "Disk pre-flight: ${avail_gb}G available (required: ${required_gb}G)"
}

reclaim_e2e_artefacts() {
  log_info "Reclaiming E2E artefacts..."
  rm -rf frontend/test-results frontend/playwright-report
  rm -rf backend-v2/e2e/.jest-cache
  rm -rf /tmp/playwright-artifacts-* /tmp/playwright-* 2>/dev/null || true
  log_success "E2E artefacts reclaimed"
}

if [ -n "$1" ]; then
  "$@"
fi
