.PHONY: help ci-local ci-full lint-backend lint-frontend build-go build-frontend test-backend e2e-backend e2e-frontend seed-e2e install-hooks test-hook

help:
	@echo "Available targets:"
	@echo "  make ci-local        - Fast pre-commit checks (lint + build)"
	@echo "  make ci-full         - Full CI pipeline (lint + build + E2E)"
	@echo "  make seed-e2e        - Seed E2E MongoDB with test users"
	@echo "  make install-hooks   - Install git pre-commit hook"
	@echo "  make test-hook       - Test pre-commit hook with broken code"
	@echo "  make lint-backend    - Lint Node.js backend"
	@echo "  make lint-frontend   - Lint React frontend"
	@echo "  make build-go        - Build Go backend"
	@echo "  make build-frontend  - Build React frontend"
	@echo "  make test-backend    - Run backend unit tests"
	@echo "  make e2e-backend     - Run backend E2E tests (backend-v2)"
	@echo "  make e2e-frontend    - Run frontend E2E tests (full stack)"

seed-e2e:
	@echo "→ Seeding E2E MongoDB..."
	@bash backend-v2/seed-e2e-users.sh

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

e2e-backend: seed-e2e
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build > /dev/null 2>&1
	@echo "→ Starting backend-v2 for E2E tests..."
	@cd backend-v2 && $(MAKE) stop
	@cd backend-v2 && JWT_SECRET='GrFYK5ftZDtCg7ZGwxZ1JpSxyyJ9bc8uJijvBD1DYiMoS64ZpnBSrFxsNuybN1iO' \
		MONGO_URI='mongodb://localhost:27017/delta5' \
		PORT=3002 \
		API_ROOT='/api/v2' \
		MOCK_EXTERNAL_SERVICES=true \
		$(MAKE) start
	@sleep 3
	@echo "→ Running backend E2E tests..."
	@TEST_EXIT=0; cd backend && npm ci > /dev/null 2>&1 && E2E_SERVER_URL=http://localhost:3002 E2E_API_BASE_PATH=/api/v2 E2E_MONGO_URI=mongodb://localhost:27017/delta5 npm run test:e2e || TEST_EXIT=$$?; \
		cd ../backend-v2 && $(MAKE) stop; \
		exit $$TEST_EXIT

e2e-frontend: seed-e2e
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build > /dev/null 2>&1
	@echo "→ Starting backend-v2..."
	@cd backend-v2 && $(MAKE) stop
	@cd backend-v2 && JWT_SECRET='GrFYK5ftZDtCg7ZGwxZ1JpSxyyJ9bc8uJijvBD1DYiMoS64ZpnBSrFxsNuybN1iO' \
		MONGO_URI='mongodb://localhost:27017/delta5' \
		PORT=3002 \
		API_ROOT='/api/v2' \
		MOCK_EXTERNAL_SERVICES=true \
		$(MAKE) start
	@sleep 3
	@echo "→ Starting frontend dev server..."
	@cd frontend && bash -c 'nohup pnpm dev > /tmp/vite-e2e.log 2>&1 & echo $$! > /tmp/vite-e2e.pid'
	@sleep 5
	@echo "→ Running frontend E2E tests..."
	@TEST_EXIT=0; cd frontend && E2E_ADMIN_USER=admin E2E_ADMIN_PASS='P@ssw0rd!' CI=true npm run test:e2e:ci || TEST_EXIT=$$?; \
		kill $$(cat /tmp/vite-e2e.pid 2>/dev/null) 2>/dev/null || true; \
		cd ../backend-v2 && $(MAKE) stop; \
		exit $$TEST_EXIT

ci-full: ci-local e2e-backend e2e-frontend
	@echo "✓ Full CI pipeline completed"

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
