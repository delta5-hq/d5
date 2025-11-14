.PHONY: help ci-local ci-full lint-backend lint-frontend build-go build-frontend test-backend test-frontend install-hooks test-hook

help:
	@echo "Available targets:"
	@echo "  make ci-local        - Fast pre-commit checks (lint + build)"
	@echo "  make ci-full         - Full CI pipeline (lint + build + E2E)"
	@echo "  make install-hooks   - Install git pre-commit hook"
	@echo "  make test-hook       - Test pre-commit hook with broken code"
	@echo "  make lint-backend    - Lint Node.js backend"
	@echo "  make lint-frontend   - Lint React frontend"
	@echo "  make build-go        - Build Go backend"
	@echo "  make build-frontend  - Build React frontend"
	@echo "  make test-backend    - Run backend unit tests"
	@echo "  make test-frontend   - Run frontend E2E tests"

ci-local: lint-backend build-go build-frontend lint-frontend
	@echo "✓ Pre-commit checks passed"

lint-backend:
	@echo "→ Linting backend..."
	@cd backend && npm run lint

build-go:
	@echo "→ Building Go backend..."
	@cd backend-v2 && docker build --target builder -t backend-v2-test . > /tmp/d5-go-build.log 2>&1 || \
		(tail -30 /tmp/d5-go-build.log && exit 1)

build-frontend:
	@echo "→ Building frontend..."
	@cd frontend && npm run build > /tmp/d5-frontend-build.log 2>&1 || \
		(tail -30 /tmp/d5-frontend-build.log && exit 1)

lint-frontend:
	@echo "→ Linting frontend..."
	@cd frontend && npm run lint

test-backend:
	@echo "→ Running backend unit tests..."
	@cd backend && npm test

test-frontend:
	@echo "→ Running frontend E2E tests..."
	@cd frontend && npm run test:e2e

ci-full: ci-local
	@echo "→ Running full E2E tests..."
	@cd backend-v2 && make e2e

install-hooks:
	@echo "→ Installing git pre-commit hook..."
	@cp .git-hooks/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "✓ Git hooks installed"

test-hook:
	@echo "→ Testing pre-commit hook with broken code..."
	@echo "const broken = 'test" > backend/src/test-hook-validation.js
	@echo "Testing: Syntax error should be caught..."
	@make lint-backend 2>&1 | grep -q "error" && echo "✓ Hook would catch syntax errors" || echo "✗ Hook failed to catch error"
	@rm -f backend/src/test-hook-validation.js
	@echo "→ Testing build failure detection..."
	@echo "package invalid" > backend-v2/test-invalid.go
	@make build-go 2>&1 && echo "✗ Build should have failed" || echo "✓ Hook would catch build errors"
	@rm -f backend-v2/test-invalid.go
	@echo "✓ Hook validation complete"
