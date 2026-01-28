.PHONY: help lint test build e2e dev dev-frontend dev-backend-v2 start-mongodb-dev start-mongodb-e2e stop ci-local ci-full lint-backend lint-backend-v2 lint-docker-backend lint-docker-backend-v2 lint-docker-frontend lint-frontend build-backend build-backend-v2 build-frontend test-backend test-backend-v2 test-frontend e2e-backend e2e-frontend e2e-frontend-throttled e2e-db-init e2e-db-drop dev-db-init dev-db-reset dev-db-drop setup-build-tools install-hooks test-hook clean-e2e clean-all fix-permissions cleanup-old-data

# Configuration variables (DRY principle)
DOCKER_NETWORK := d5-dev-network
JWT_SECRET := test-jwt-secret-change-in-production
BACKEND_PORT := 3002
API_ROOT := /api/v2
MONGO_DEV_URI := mongodb://localhost:27017/delta5-dev
MONGO_E2E_URI := mongodb://localhost:27018/delta5
FRONTEND_PORT := 5173

help:
	@echo "Available targets:"
	@echo ""
	@echo "Quick Commands (all modules):"
	@echo "  make lint                - Lint all modules (backend + backend-v2 + frontend)"
	@echo "  make test                - Test all modules (backend + backend-v2 unit tests)"
	@echo "  make build               - Build all modules (backend + backend-v2 + frontend)"
	@echo "  make e2e                 - Run all E2E tests (backend-v2 + frontend)"
	@echo ""
	@echo "Development:"
	@echo "  make dev                 - Start full stack (MongoDB-dev + backend-v2 + frontend)"
	@echo "  make dev-frontend        - Start frontend dev server only"
	@echo "  make dev-backend-v2      - Start backend-v2 in dev mode"
	@echo "  make start-mongodb-dev   - Start development MongoDB (port 27017, persistent)"
	@echo "  make start-mongodb-e2e   - Start E2E MongoDB (port 27018, test-only)"
	@echo "  make stop                - Stop all dev services"
	@echo ""
	@echo "CI/Testing:"
	@echo "  make ci-local            - Fast pre-commit checks (lint + build + test)"
	@echo "  make ci-full             - Full CI pipeline (lint + build + test + E2E)"
	@echo "  make e2e-backend         - Run backend-v2 E2E tests (14 suites)"
	@echo "  make e2e-frontend        - Run frontend E2E tests (27 tests)"
	@echo "  make e2e-frontend-throttled - Run frontend E2E tests (throttled: slowMo=50ms)"
	@echo "  make test-backend        - Run backend unit tests"
	@echo "  make test-backend-v2     - Run backend-v2 unit tests"
	@echo "  make test-frontend       - Run frontend unit tests (Vitest)"
	@echo ""
	@echo "Setup:"
	@echo "  make e2e-db-init         - Initialize E2E database with test fixtures"
	@echo "  make e2e-db-drop         - Drop E2E database"
	@echo "  make dev-db-init         - Initialize development database"
	@echo "  make dev-db-reset        - Reset development database to clean state"
	@echo "  make dev-db-drop         - Drop development database"
	@echo "  make setup-build-tools   - Check build tools and show installation links"
	@echo "  make fix-permissions     - Fix data directory ownership (no sudo required)"
	@echo "  make cleanup-old-data    - Remove old mongodb data directory"
	@echo "  make install-hooks       - Install git hooks (pre-commit + pre-push)"
	@echo "  make test-hook           - Test pre-commit hook with broken code"
	@echo ""
	@echo "Build:"
	@echo "  make build-backend       - Build Node.js backend"
	@echo "  make build-backend-v2    - Build backend-v2"
	@echo "  make build-frontend      - Build frontend"
	@echo ""
	@echo "Maintenance:"
	@echo "  make lint-backend        - Lint backend"
	@echo "  make lint-backend-v2     - Lint backend-v2 (with Docker fallback)"
	@echo "  make lint-docker-backend - Lint backend Dockerfile"
	@echo "  make lint-docker-backend-v2 - Lint backend-v2 Dockerfile"
	@echo "  make lint-docker-frontend - Lint frontend Dockerfile"
	@echo "  make lint-frontend       - Lint frontend"
	@echo "  make clean-e2e           - Clean all E2E test artifacts"
	@echo "  make clean-all           - Clean all build and test artifacts"

# Centralized commands (all modules)
lint: lint-backend lint-backend-v2 lint-docker-backend-v2 lint-docker-backend lint-docker-frontend lint-frontend
	@echo "✓ All modules linted"

test: test-backend test-backend-v2 test-frontend
	@echo "✓ All modules tested"

build: build-backend build-backend-v2 build-frontend
	@echo "✓ All modules built"

e2e: e2e-backend e2e-frontend
	@echo "✓ All E2E tests completed"

e2e-db-init:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users/main.go seed-users
	@echo "→ Initializing E2E database (port 27018)..."
	@DROP_DB=true MONGO_PORT=27018 bash backend-v2/e2e-db-init.sh
	@echo "✓ E2E database initialized"

e2e-db-drop:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users/main.go seed-users
	@echo "→ Dropping E2E database (port 27018)..."
	@MONGO_PORT=27018 bash backend-v2/e2e-db-drop.sh
	@echo "✓ E2E database dropped"

dev-db-init:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users/main.go seed-users
	@echo "→ Initializing development database (port 27017)..."
	@MONGO_PORT=27017 bash backend-v2/e2e-db-init.sh
	@echo "✓ Development database initialized"

dev-db-reset:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users/main.go seed-users
	@echo "→ Resetting development database..."
	@DROP_DB=true MONGO_PORT=27017 bash backend-v2/e2e-db-init.sh
	@echo "✓ Development database reset"

dev-db-drop:
	@bash scripts/ci-helpers.sh build_tool_go backend-v2 ./cmd/seed-users/main.go seed-users
	@echo "→ Dropping development database (port 27017)..."
	@MONGO_PORT=27017 bash backend-v2/e2e-db-drop.sh
	@echo "✓ Development database dropped"

start-mongodb-dev:
	@echo "→ Starting development MongoDB (port 27017)..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongodb-dev
	@echo "→ Waiting for MongoDB..."
	@sleep 3
	@echo "✓ Development MongoDB ready"

start-mongodb-e2e:
	@echo "→ Starting E2E MongoDB (port 27018)..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongodb-e2e
	@echo "→ Waiting for MongoDB..."
	@sleep 3
	@echo "✓ E2E MongoDB ready"

dev-backend-v2: start-mongodb-dev dev-db-init
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build
	@echo "→ Starting backend-v2 in dev mode..."
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_DEV_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=false \
		$(MAKE) start
	@echo "✓ Backend-v2 running on http://localhost:$(BACKEND_PORT)"

dev-frontend:
	@echo "→ Starting frontend dev server..."
	@cd frontend && pnpm dev --host 0.0.0.0

dev: start-mongodb-dev dev-db-init
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build
	@echo "→ Starting backend-v2..."
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_DEV_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=false \
		$(MAKE) start
	@echo "✓ Backend-v2 running on http://localhost:$(BACKEND_PORT)"
	@echo ""
	@echo "→ Starting frontend dev server..."
	@if lsof -ti:$(FRONTEND_PORT) >/dev/null 2>&1; then \
		echo "  ✗ Port $(FRONTEND_PORT) occupied, cleaning..."; \
		lsof -ti:$(FRONTEND_PORT) | xargs -r kill -9 2>/dev/null || true; \
		sleep 1; \
	fi
	@echo "✓ Frontend will be available at http://localhost:$(FRONTEND_PORT)"
	@echo ""
	@echo "Press Ctrl+C to stop..."
	@cd frontend && pnpm dev --host 0.0.0.0

stop:
	@echo "→ Stopping all services..."
	@cd backend-v2 && $(MAKE) stop 2>/dev/null || true
	@echo "  → Stopping MongoDB containers..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml stop mongodb-dev mongodb-e2e 2>/dev/null || true
	@docker ps -q --filter "name=mongodb-dev" | xargs -r docker stop 2>/dev/null || true
	@docker ps -q --filter "name=mongodb-e2e" | xargs -r docker stop 2>/dev/null || true
	@echo "  → Killing processes on port 5173..."
	@lsof -ti:5173 2>/dev/null | xargs -r kill -9 2>/dev/null || true
	@sleep 1
	@if lsof -ti:5173 >/dev/null 2>&1; then \
		echo "  ✗ Port 5173 still occupied"; \
		exit 1; \
	fi
	@echo "✓ All services stopped"

ci-local: lint build test
	@echo "✓ Pre-commit checks passed"

lint-backend:
	@bash scripts/ci-helpers.sh lint_node backend

lint-backend-v2:
	@bash scripts/ci-helpers.sh lint_go backend-v2

lint-docker-backend:
	@bash scripts/ci-helpers.sh lint_dockerfile Dockerfile backend

lint-docker-backend-v2:
	@bash scripts/ci-helpers.sh lint_dockerfile Dockerfile backend-v2

lint-docker-frontend:
	@bash scripts/ci-helpers.sh lint_dockerfile Dockerfile frontend

build-backend:
	@bash scripts/ci-helpers.sh build_node backend

build-backend-v2:
	@bash scripts/ci-helpers.sh build_go backend-v2 backend-v2

build-frontend:
	@bash scripts/ci-helpers.sh build_node frontend

lint-frontend:
	@bash scripts/ci-helpers.sh lint_node frontend

test-backend-v2:
	@bash scripts/ci-helpers.sh test_go backend-v2

test-backend:
	@bash scripts/ci-helpers.sh test_node backend

test-frontend:
	@echo "→ Running frontend unit tests..."
	@cd frontend && npm test -- --run

e2e-backend: start-mongodb-e2e e2e-db-init
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build > /dev/null 2>&1
	@echo "→ Starting backend-v2 for E2E tests..."
	@cd backend-v2 && $(MAKE) stop
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_E2E_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=true \
		$(MAKE) start
	@sleep 3
	@echo "→ Running backend-v2 E2E tests..."
	@TEST_EXIT=0; cd backend-v2/e2e && npm ci --silent && E2E_SERVER_URL=http://localhost:$(BACKEND_PORT) E2E_API_BASE_PATH=$(API_ROOT) E2E_MONGO_URI=$(MONGO_E2E_URI) npm test || TEST_EXIT=$$?; \
		cd ../.. && cd backend-v2 && $(MAKE) stop; \
		exit $$TEST_EXIT

e2e-frontend: start-mongodb-e2e e2e-db-init
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build > /dev/null 2>&1
	@echo "→ Starting backend-v2..."
	@cd backend-v2 && $(MAKE) stop
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_E2E_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
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

e2e-frontend-throttled: start-mongodb-e2e e2e-db-init
	@echo "→ Building backend-v2..."
	@cd backend-v2 && $(MAKE) build > /dev/null 2>&1
	@echo "→ Starting backend-v2..."
	@cd backend-v2 && $(MAKE) stop
	@cd backend-v2 && JWT_SECRET='$(JWT_SECRET)' \
		MONGO_URI='$(MONGO_E2E_URI)' \
		PORT=$(BACKEND_PORT) \
		API_ROOT='$(API_ROOT)' \
		MOCK_EXTERNAL_SERVICES=true \
		$(MAKE) start
	@sleep 20
	@until curl -s http://localhost:$(BACKEND_PORT)$(API_ROOT)/health > /dev/null 2>&1; do sleep 2; done
	@sleep 5
	@echo "→ Starting frontend dev server..."
	@cd frontend && bash -c 'nohup pnpm dev > /tmp/vite-e2e-throttled.log 2>&1 & echo $$! > /tmp/vite-e2e-throttled.pid'
	@sleep 10
	@echo "→ Running frontend E2E tests (throttled: slowMo=50ms, workers=1)..."
	@TEST_EXIT=0; cd frontend && E2E_ADMIN_USER=admin E2E_ADMIN_PASS='P@ssw0rd!' CI=true npm run test:e2e:throttled || TEST_EXIT=$$?; \
		kill $$(cat /tmp/vite-e2e-throttled.pid 2>/dev/null) 2>/dev/null || true; \
		cd ../backend-v2 && $(MAKE) stop; \
		exit $$TEST_EXIT

ci-full: ci-local e2e
	@echo "✓ Full CI pipeline completed"

install-hooks:
	@echo "→ Installing git hooks..."
	@cp .git-hooks/pre-commit .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@cp .git-hooks/pre-push .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@echo "✓ Git hooks installed (pre-commit + pre-push)"

test-hook:
	@echo "→ Testing pre-commit hook with broken code..."
	@echo "const broken = 'test" > backend/src/test-hook-validation.js
	@echo "Testing: Syntax error should be caught..."
	@make lint-backend 2>&1 | grep -q "error" && echo "✓ Hook would catch syntax errors" || echo "✗ Hook failed to catch error"
	@rm -f backend/src/test-hook-validation.js
	@echo "→ Testing build failure detection..."
	@echo "package invalid" > backend-v2/test-invalid.go
	@make build-backend-v2 2>&1 && echo "✗ Build should have failed" || echo "✓ Hook would catch build errors"
	@rm -f backend-v2/test-invalid.go
	@echo "✓ Hook validation complete"

setup-build-tools:
	@bash scripts/setup-build-tools.sh

fix-permissions:
	@echo "→ Fixing data directory permissions..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml stop mongodb-dev mongodb-e2e 2>/dev/null || true
	@if [ -d "data/mongodb-dev" ]; then \
		docker run --rm --network $(DOCKER_NETWORK) -v $(PWD)/data:/data alpine chown -R $(shell id -u):$(shell id -g) /data/mongodb-dev 2>/dev/null || true; \
	fi
	@if [ -d "data/mongodb-e2e" ]; then \
		docker run --rm --network $(DOCKER_NETWORK) -v $(PWD)/data:/data alpine chown -R $(shell id -u):$(shell id -g) /data/mongodb-e2e 2>/dev/null || true; \
	fi
	@echo "✓ Data directory permissions fixed (owned by user $(shell id -un))"

cleanup-old-data:
	@echo "→ Cleaning up old MongoDB data directory..."
	@docker-compose stop 2>/dev/null || true
	@docker rm -f d5_mongodb_1 2>/dev/null || true
	@if [ -d "data/mongodb" ]; then \
		docker run --rm --network $(DOCKER_NETWORK) -v $(PWD)/data:/data alpine rm -rf /data/mongodb 2>/dev/null || true; \
		echo "✓ Old data/mongodb directory removed"; \
	else \
		echo "✓ No old data/mongodb directory found"; \
	fi

clean-e2e:
	@echo "→ Cleaning E2E test artifacts..."
	@rm -f frontend/junit.xml frontend/e2e.log frontend-e2e-output.log
	@rm -f backend/junit.xml backend/e2e.log backend-e2e-output.log
	@rm -rf frontend/test-results frontend/playwright-report frontend/blob-report
	@rm -rf backend/coverage
	@rm -f backend.log .dev-server.log nohup.out
	@rm -f /tmp/vite-e2e.log /tmp/vite-e2e.pid
	@echo "✓ E2E artifacts cleaned"

clean-all: clean-e2e
	@echo "→ Cleaning all build artifacts..."
	@rm -f /tmp/d5-backend-build.log /tmp/d5-backend-v2-build.log /tmp/d5-frontend-build.log
	@cd backend && rm -rf build/ coverage/ || true
	@cd frontend && rm -rf dist/ dist-ssr/ || true
	@cd backend-v2 && rm -f backend-v2 || true
	@echo "✓ All artifacts cleaned"

# Backwards compatibility alias
build-go: build-backend-v2
