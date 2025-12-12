#!/bin/bash

REQUIRED_TOOLS=(
  "go:1.25:https://go.dev/doc/install"
  "golangci-lint:1.62:https://golangci-lint.run/usage/install/"
  "hadolint:latest:https://github.com/hadolint/hadolint#install"
  "node:22:https://nodejs.org/en/download/"
  "pnpm:10:https://pnpm.io/installation"
  "docker:latest:https://docs.docker.com/get-docker/"
  "docker-compose:latest:https://docs.docker.com/compose/install/"
)

detect_os() {
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "linux"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macos"
  else
    echo "unknown"
  fi
}

install_go_linux() {
  echo "→ Installing Go 1.25..."
  wget -q https://go.dev/dl/go1.25.0.linux-amd64.tar.gz -O /tmp/go.tar.gz
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf /tmp/go.tar.gz
  rm /tmp/go.tar.gz
  
  if ! grep -q "/usr/local/go/bin" ~/.bashrc; then
    echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
  fi
  export PATH=$PATH:/usr/local/go/bin
  
  echo "✓ Go installed"
}

install_golangci_lint_linux() {
  echo "→ Installing golangci-lint 1.62..."
  curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.62.0
  
  if ! grep -q "$(go env GOPATH)/bin" ~/.bashrc; then
    echo 'export PATH=$PATH:'"$(go env GOPATH)/bin" >> ~/.bashrc
  fi
  export PATH=$PATH:$(go env GOPATH)/bin
  
  echo "✓ golangci-lint installed"
}

install_hadolint_linux() {
  echo "→ Installing hadolint..."
  local version="v2.12.0"
  wget -q "https://github.com/hadolint/hadolint/releases/download/${version}/hadolint-Linux-x86_64" -O /tmp/hadolint
  sudo mv /tmp/hadolint /usr/local/bin/hadolint
  sudo chmod +x /usr/local/bin/hadolint
  echo "✓ hadolint installed"
}

check_tool() {
  local tool=$1
  local version=$2
  local url=$3
  
  if command -v "$tool" >/dev/null 2>&1; then
    echo "✓ $tool"
    return 0
  else
    echo "✗ $tool (recommended: v$version)"
    echo "  $url"
    return 1
  fi
}

check_go_version() {
  if ! command -v go >/dev/null 2>&1; then
    return 1
  fi
  
  local current=$(go version | grep -oP 'go\K[0-9]+\.[0-9]+' || echo "0.0")
  local required="1.23"
  local current_major=$(echo "$current" | cut -d. -f1)
  local current_minor=$(echo "$current" | cut -d. -f2)
  
  if [ "$current_major" -eq 1 ] && [ "$current_minor" -eq 23 ]; then
    return 0
  elif [ "$current_major" -eq 1 ] && [ "$current_minor" -gt 23 ]; then
    if command -v golangci-lint >/dev/null 2>&1; then
      local lint_go=$(golangci-lint --version | grep -oP 'built with go\K[0-9]+\.[0-9]+' || echo "0.0")
      if [ "$lint_go" = "$current" ]; then
        echo "ℹ Go $current + golangci-lint (Go $lint_go) aligned"
        return 0
      fi
    fi
    echo "⚠ Go $current detected (CI uses $required.x)"
    echo "  Toolchain mismatch → Docker fallback during lint"
    echo "  Fix: docs/ENV_ALIGNMENT.md"
    return 2
  else
    return 1
  fi
}

echo "=== Build Tools Status ==="
echo ""

MISSING_TOOLS=()
MISSING_COUNT=0

for entry in "${REQUIRED_TOOLS[@]}"; do
  IFS=':' read -r tool version url <<< "$entry"
  if ! check_tool "$tool" "$version" "$url"; then
    MISSING_TOOLS+=("$tool")
    ((MISSING_COUNT++))
  fi
done

echo ""
check_go_version
GO_VERSION_STATUS=$?

echo ""

if [ $MISSING_COUNT -eq 0 ] && [ $GO_VERSION_STATUS -eq 0 ]; then
  echo "✓ All build tools installed"
  echo ""
  echo "No Docker fallbacks needed - optimal performance"
  exit 0
fi

if [ $GO_VERSION_STATUS -eq 2 ]; then
  echo "ℹ Toolchain mismatch - Docker fallback enabled"
  echo "  See docs/ENV_ALIGNMENT.md for alignment steps"
  echo ""
fi

OS_TYPE=$(detect_os)

if [ "$OS_TYPE" = "linux" ]; then
  echo "⚠ $MISSING_COUNT tool(s) missing"
  echo ""
  echo "Linux detected - automatic installation available"
  echo ""
  read -p "Install missing tools automatically? [y/N]: " -n 1 -r
  echo
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    for tool in "${MISSING_TOOLS[@]}"; do
      case "$tool" in
        go)
          install_go_linux
          ;;
        golangci-lint)
          install_golangci_lint_linux
          ;;
        hadolint)
          install_hadolint_linux
          ;;
        *)
          echo "→ Skipping $tool (manual installation required)"
          ;;
      esac
    done
    
    echo ""
    echo "✓ Installation complete"
    echo ""
    echo "Run 'source ~/.bashrc' or restart terminal to update PATH"
  else
    echo ""
    echo "Docker fallbacks enabled for missing tools"
    echo "Install tools manually using links above for faster builds"
  fi
else
  echo "⚠ $MISSING_COUNT tool(s) missing"
  echo ""
  echo "Docker fallbacks enabled for missing tools"
  echo "Install tools above for faster builds"
fi

exit 0
